import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { query, getClient } from '../config/database.js';
import config from '../config/environment.js';
import { sendTeamInviteEmail } from '../utils/emailService.js';
import { logAudit } from '../utils/audit.js';
import { assertWithinLimit, getPlanContext, pendingInvitationCount, remainingQuota } from '../services/planGuard.js';

const generateToken = (userId) => {
  return jwt.sign({ userId, typ: 'session' }, config.jwtSecret, { expiresIn: config.jwtExpiresIn });
};

const setTokenCookie = (res, token) => {
  res.cookie('token', token, {
    httpOnly: true,
    secure: config.nodeEnv === 'production',
    // Production frontend may be on another domain: cross-site cookies need SameSite=None + Secure
    sameSite: config.nodeEnv === 'production' ? 'none' : 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });
};

const findPendingInvite = async (token) => {
  if (!token || typeof token !== 'string') {
    return { error: 'Invalid invitation link' };
  }

  const result = await query(
    `SELECT ti.id, ti.company_id, ti.email, ti.role, ti.status, ti.expires_at,
            c.name AS company_name, u.full_name AS inviter_name
     FROM team_invitations ti
     JOIN companies c ON c.id = ti.company_id
     JOIN users u ON u.id = ti.invited_by
     WHERE ti.token = $1`,
    [token]
  );

  if (result.rows.length === 0) {
    return { error: 'Invalid or expired invitation link' };
  }

  const invite = result.rows[0];

  if (invite.status !== 'pending') {
    return { error: 'This invitation has already been used or revoked' };
  }

  if (new Date(invite.expires_at) < new Date()) {
    return { error: 'This invitation has expired' };
  }

  return { invite };
};

export const verifyTeamInvite = async (req, res) => {
  try {
    const { error, invite } = await findPendingInvite(req.params.token);
    if (error) return res.status(400).json({ error });

    res.json({
      invite: {
        email: invite.email,
        role: invite.role,
        company_name: invite.company_name,
        inviter_name: invite.inviter_name,
      },
    });
  } catch (error) {
    console.error('Verify Invite Error:', error);
    res.status(500).json({ error: 'Failed to verify invitation' });
  }
};

export const acceptTeamInvite = async (req, res) => {
  const { full_name, password } = req.body;

  if (!full_name || !password) {
    return res.status(400).json({ error: 'Full name and password are required' });
  }

  if (password.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters' });
  }

  try {
    const { error, invite } = await findPendingInvite(req.params.token);
    if (error) return res.status(400).json({ error });

    const existing = await query('SELECT id, company_id, removed_at FROM users WHERE email = $1', [invite.email]);
    // A member who was removed from this same team can be invited back (their history is kept)
    const rejoining = existing.rows[0] && existing.rows[0].removed_at && existing.rows[0].company_id === invite.company_id
      ? existing.rows[0]
      : null;
    if (existing.rows.length > 0 && !rejoining) {
      return res.status(409).json({ error: 'An account with this email already exists. Please log in instead.' });
    }

    // The company's plan must still have a free user seat (and must not have expired)
    try {
      await assertWithinLimit(invite.company_id, 'users');
    } catch (planErr) {
      if (planErr.status === 402) {
        return res.status(402).json({ error: 'This team has reached its user limit. Please ask your admin to upgrade the plan.' });
      }
      throw planErr;
    }

    const password_hash = await bcrypt.hash(password, 12);
    const inviteRole = invite.role === 'admin' ? 'admin' : 'member';

    const client = await getClient();
    let user;
    try {
      await client.query('BEGIN');

      const userResult = rejoining
        ? await client.query(
            `UPDATE users
             SET full_name = $1, password_hash = $2, role = $3, is_active = true,
                 removed_at = NULL, removed_by = NULL, updated_at = NOW()
             WHERE id = $4
             RETURNING id, company_id, full_name, email, role`,
            [full_name, password_hash, inviteRole, rejoining.id]
          )
        : await client.query(
            `INSERT INTO users (company_id, full_name, email, password_hash, role)
             VALUES ($1, $2, $3, $4, $5)
             RETURNING id, company_id, full_name, email, role`,
            [invite.company_id, full_name, invite.email, password_hash, inviteRole]
          );
      user = userResult.rows[0];

      await client.query(
        `UPDATE team_invitations SET status = 'accepted', updated_at = NOW() WHERE id = $1`,
        [invite.id]
      );

      await client.query('COMMIT');
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }

    await query('UPDATE users SET last_login = NOW() WHERE id = $1', [user.id]);

    const token = generateToken(user.id);
    setTokenCookie(res, token);

    res.status(201).json({
      message: 'Invitation accepted successfully',
      user: {
        id: user.id,
        company_id: user.company_id,
        full_name: user.full_name,
        email: user.email,
        role: user.role,
      },
      token,
    });
  } catch (error) {
    console.error('Accept Invite Error:', error);
    res.status(500).json({ error: 'Failed to accept invitation' });
  }
};

export const inviteTeamMembers = async (req, res) => {
  const { invites } = req.body; // Array of { email, role }
  const user = req.user; // from authenticate middleware

  if (!invites || !Array.isArray(invites) || invites.length === 0) {
    return res.status(400).json({ error: 'At least one invite is required' });
  }

  try {
    // Get inviter's company details
    const companyResult = await query('SELECT name FROM companies WHERE id = $1', [user.company_id]);
    if (companyResult.rows.length === 0) {
      return res.status(404).json({ error: 'Company not found' });
    }
    const companyName = companyResult.rows[0].name;

    // Plan user limit: active users + pending invitations must stay within the plan
    const planCtx = await getPlanContext(user.company_id);
    let seatsLeft = (await remainingQuota(user.company_id, 'users', planCtx)) - (await pendingInvitationCount(user.company_id));
    const userLimit = planCtx.plan.limits.users;

    const successfulInvites = [];
    const failedInvites = [];

    for (const invite of invites) {
      const { email, role } = invite;

      if (!email || !email.includes('@')) {
        failedInvites.push({ email, reason: 'Invalid email' });
        continue;
      }

      const cleanEmail = email.toLowerCase().trim();
      const inviteRole = role === 'admin' ? 'admin' : 'member';

      // Check if user is already in the company
      const existingUser = await query('SELECT id FROM users WHERE email = $1 AND company_id = $2 AND removed_at IS NULL', [cleanEmail, user.company_id]);
      if (existingUser.rows.length > 0) {
        failedInvites.push({ email: cleanEmail, reason: 'User is already in the company' });
        continue;
      }

      // Re-sending a still-pending invite does not take a new seat
      const alreadyPending = (await query(
        `SELECT 1 FROM team_invitations WHERE company_id = $1 AND email = $2 AND status = 'pending' AND expires_at > NOW()`,
        [user.company_id, cleanEmail]
      )).rows.length > 0;
      if (!alreadyPending) {
        if (seatsLeft <= 0) {
          failedInvites.push({
            email: cleanEmail,
            reason: `Your ${planCtx.plan.name} plan allows ${userLimit} users. Upgrade your plan in Billing to invite more.`,
          });
          continue;
        }
        seatsLeft -= 1;
      }

      const token = crypto.randomBytes(32).toString('hex');
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

      try {
        // Upsert invitation (in case they were invited before but it expired/pending)
        await query(
          `INSERT INTO team_invitations (company_id, invited_by, email, role, token, expires_at)
           VALUES ($1, $2, $3, $4, $5, $6)
           ON CONFLICT (company_id, email) 
           DO UPDATE SET token = $5, expires_at = $6, role = $4, status = 'pending', updated_at = NOW()`,
          [user.company_id, user.id, cleanEmail, inviteRole, token, expiresAt]
        );

        const inviteLink = `${config.frontendUrl}/accept-invite?token=${token}`;
        
        // Send email
        const emailSent = await sendTeamInviteEmail(cleanEmail, user.full_name, companyName, inviteRole, inviteLink);
        
        if (emailSent) {
          successfulInvites.push(cleanEmail);
        } else {
          failedInvites.push({ email: cleanEmail, reason: 'Failed to send email' });
        }
      } catch (err) {
        console.error('Error saving invitation:', err);
        failedInvites.push({ email: cleanEmail, reason: 'Internal server error' });
      }
    }

    if (successfulInvites.length > 0) {
      await logAudit(req, 'team.members_invited', {
        entityType: 'invitation',
        details: { emails: successfulInvites.map((i) => i.email || i) },
      });
    }

    res.json({
      message: `Processed ${invites.length} invitations`,
      success: successfulInvites,
      failed: failedInvites
    });

  } catch (error) {
    console.error('Invite Team Error:', error);
    res.status(500).json({ error: 'Failed to process invitations' });
  }
};

export const listTeamMembers = async (req, res) => {
  try {
    const { company_id } = req.user;

    const membersResult = await query(
      `SELECT id, full_name, email, role, is_active, created_at
       FROM users
       WHERE company_id = $1 AND removed_at IS NULL
       ORDER BY created_at ASC`,
      [company_id]
    );

    const invitesResult = await query(
      `SELECT id, email, role, status, expires_at, created_at
       FROM team_invitations
       WHERE company_id = $1 AND status = 'pending'
       ORDER BY created_at DESC`,
      [company_id]
    );

    res.json({
      members: membersResult.rows,
      invitations: invitesResult.rows,
    });
  } catch (error) {
    console.error('List Team Error:', error);
    res.status(500).json({ error: 'Failed to load team members' });
  }
};

// A company must always keep at least one active admin to manage billing, Gmail and the team
const isLastActiveAdmin = async (companyId, userId) => {
  const result = await query(
    `SELECT COUNT(*)::int AS count FROM users
     WHERE company_id = $1 AND id <> $2 AND role = 'admin' AND is_active = true AND removed_at IS NULL`,
    [companyId, userId]
  );
  return result.rows[0].count === 0;
};

const LAST_ADMIN_ERROR = 'The company must keep at least one active admin';

export const removeTeamMember = async (req, res) => {
  try {
    const { id } = req.params;
    const { company_id, id: currentUserId } = req.user;

    if (id === currentUserId) {
      return res.status(400).json({ error: 'You cannot remove yourself' });
    }

    const result = await query(
      'SELECT id, role FROM users WHERE id = $1 AND company_id = $2 AND removed_at IS NULL',
      [id, company_id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Member not found' });
    }

    if (result.rows[0].role === 'admin' && await isLastActiveAdmin(company_id, id)) {
      return res.status(400).json({ error: LAST_ADMIN_ERROR });
    }

    // Soft remove: the account is disabled and hidden, but everything the member created stays
    await query(
      'UPDATE users SET is_active = false, removed_at = NOW(), removed_by = $1, updated_at = NOW() WHERE id = $2',
      [currentUserId, id]
    );

    await logAudit(req, 'team.member_removed', { entityType: 'user', entityId: id });
    res.json({ message: 'Member removed successfully' });
  } catch (error) {
    console.error('Remove Team Member Error:', error);
    res.status(500).json({ error: 'Failed to remove member' });
  }
};

export const revokeInvitation = async (req, res) => {
  try {
    const { id } = req.params;
    const { company_id } = req.user;

    const result = await query(
      `UPDATE team_invitations
       SET status = 'expired', updated_at = NOW()
       WHERE id = $1 AND company_id = $2 AND status = 'pending'`,
      [id, company_id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Invitation not found' });
    }

    res.json({ message: 'Invitation revoked' });
  } catch (error) {
    console.error('Revoke Invitation Error:', error);
    res.status(500).json({ error: 'Failed to revoke invitation' });
  }
};

export const updateMemberStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { is_active } = req.body;
    const { company_id, id: currentUserId } = req.user;

    if (typeof is_active !== 'boolean') {
      return res.status(400).json({ error: 'is_active must be a boolean' });
    }

    if (id === currentUserId) {
      return res.status(400).json({ error: 'You cannot change your own status' });
    }

    const result = await query(
      'SELECT id, role, is_active FROM users WHERE id = $1 AND company_id = $2 AND removed_at IS NULL',
      [id, company_id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Member not found' });
    }

    const member = result.rows[0];

    if (!is_active && member.role === 'admin' && await isLastActiveAdmin(company_id, id)) {
      return res.status(400).json({ error: LAST_ADMIN_ERROR });
    }

    // Re-activating takes a seat again, so it must fit the plan's user limit
    if (is_active && !member.is_active) {
      await assertWithinLimit(company_id, 'users');
    }

    await query(
      'UPDATE users SET is_active = $1, updated_at = NOW() WHERE id = $2',
      [is_active, id]
    );

    await logAudit(req, is_active ? 'team.member_activated' : 'team.member_deactivated', { entityType: 'user', entityId: id });
    res.json({ message: is_active ? 'Member activated' : 'Member deactivated' });
  } catch (error) {
    if (error.status === 402) {
      return res.status(402).json({ error: error.message, code: error.code });
    }
    console.error('Update Member Status Error:', error);
    res.status(500).json({ error: 'Failed to update member status' });
  }
};

// Module 27: admin changes a member's role (Admin <-> Member)
export const updateMemberRole = async (req, res) => {
  try {
    const { id } = req.params;
    const { role } = req.body;
    const { company_id, id: currentUserId } = req.user;

    if (role !== 'admin' && role !== 'member') {
      return res.status(400).json({ error: 'Role must be admin or member' });
    }

    if (id === currentUserId) {
      return res.status(400).json({ error: 'You cannot change your own role' });
    }

    const result = await query(
      'SELECT id, role FROM users WHERE id = $1 AND company_id = $2 AND removed_at IS NULL',
      [id, company_id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Member not found' });
    }

    const previousRole = result.rows[0].role;
    if (previousRole === role) {
      return res.status(400).json({ error: `Member is already ${role === 'admin' ? 'an admin' : 'a member'}` });
    }

    if (previousRole === 'admin' && await isLastActiveAdmin(company_id, id)) {
      return res.status(400).json({ error: LAST_ADMIN_ERROR });
    }

    await query(
      'UPDATE users SET role = $1, updated_at = NOW() WHERE id = $2',
      [role, id]
    );

    await logAudit(req, 'team.member_role_changed', { entityType: 'user', entityId: id, details: { from: previousRole, to: role } });
    res.json({ message: role === 'admin' ? 'Member is now an admin' : 'Admin is now a member' });
  } catch (error) {
    console.error('Update Member Role Error:', error);
    res.status(500).json({ error: 'Failed to update member role' });
  }
};
