import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { query, getClient } from '../config/database.js';
import config from '../config/environment.js';
import { sendTeamInviteEmail } from '../utils/emailService.js';

const generateToken = (userId) => {
  return jwt.sign({ userId }, config.jwtSecret, { expiresIn: config.jwtExpiresIn });
};

const setTokenCookie = (res, token) => {
  res.cookie('token', token, {
    httpOnly: true,
    secure: config.nodeEnv === 'production',
    sameSite: 'lax',
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

    const existing = await query('SELECT id FROM users WHERE email = $1', [invite.email]);
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: 'An account with this email already exists. Please log in instead.' });
    }

    const password_hash = await bcrypt.hash(password, 12);
    const inviteRole = invite.role === 'admin' ? 'admin' : 'member';

    const client = await getClient();
    let user;
    try {
      await client.query('BEGIN');

      const userResult = await client.query(
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
      const existingUser = await query('SELECT id FROM users WHERE email = $1 AND company_id = $2', [cleanEmail, user.company_id]);
      if (existingUser.rows.length > 0) {
        failedInvites.push({ email: cleanEmail, reason: 'User is already in the company' });
        continue;
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
