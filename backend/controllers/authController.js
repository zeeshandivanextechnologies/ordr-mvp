import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { query, getClient } from '../config/database.js';
import { trackEvents } from '../utils/analytics.js';
import config from '../config/environment.js';
import { sendOtpEmail } from '../utils/emailService.js';
import { logAudit } from '../utils/audit.js';

// Module 35: sign-in / password events for the audit log. Best-effort (never blocks the user).
const auditAs = (req, user, action, details = null) =>
  logAudit(
    { user: { id: user.id, company_id: user.company_id, full_name: user.full_name }, ip: req.ip },
    action,
    { entityType: 'user', entityId: user.id, details }
  );

// Logout does not require a valid session; when there is one, its user is recorded
const sessionUser = async (req) => {
  try {
    const header = req.headers?.authorization || '';
    const token = req.cookies?.token || (header.startsWith('Bearer ') ? header.slice(7) : null);
    if (!token) return null;
    const decoded = jwt.verify(token, config.jwtSecret);
    if (decoded?.typ !== 'session' || !decoded.userId) return null;
    const result = await query('SELECT id, company_id, full_name FROM users WHERE id = $1', [decoded.userId]);
    return result.rows[0] || null;
  } catch {
    return null;
  }
};

// ---------- password reset OTP helpers ----------
const OTP_TTL_MS = 10 * 60 * 1000;
const OTP_MAX_ATTEMPTS = 5;

// Cryptographically secure 6-digit code
const generateOtp = () => crypto.randomInt(100000, 1000000).toString();

// Only a hash of the OTP is stored (tied to the user), never the code itself
const hashOtp = (userId, otp) =>
  crypto.createHash('sha256').update(`${userId}:${String(otp).trim()}`).digest('hex');

// Checks an OTP. A wrong code counts as an attempt; after OTP_MAX_ATTEMPTS the code is locked.
// Returns 'ok', 'invalid' or 'locked'.
const checkOtp = async (userId, otp) => {
  const active = await query(
    `SELECT id, token, attempts FROM password_resets
     WHERE user_id = $1 AND used = false AND expires_at > NOW()
     ORDER BY created_at DESC LIMIT 1`,
    [userId]
  );
  const reset = active.rows[0];
  if (!reset) return 'invalid';
  if (reset.attempts >= OTP_MAX_ATTEMPTS) return 'locked';
  if (reset.token === hashOtp(userId, otp)) return 'ok';

  const attempts = reset.attempts + 1;
  await query(
    'UPDATE password_resets SET attempts = $1, used = $2 WHERE id = $3',
    [attempts, attempts >= OTP_MAX_ATTEMPTS, reset.id]
  );
  return attempts >= OTP_MAX_ATTEMPTS ? 'locked' : 'invalid';
};

const OTP_LOCKED_MESSAGE = 'Too many wrong attempts. Please request a new OTP.';

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

// Module 36: a new account creates a company and starts its 14-day trial
const trackSignup = (user, method) =>
  trackEvents(
    ['signup_completed', 'company_created', 'trial_started'].map((event) => ({
      event,
      companyId: user.company_id,
      userId: user.id,
      properties: { method },
      dedupeKey: `${event}:${user.company_id}`,
    }))
  );

export const signup = async (req, res) => {
  const client = await getClient();
  try {
    const { full_name, email, password } = req.body;

    if (!full_name || !email || !password) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    if (password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters' });
    }

    const existing = await query('SELECT id FROM users WHERE email = $1', [email.toLowerCase()]);
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: 'Email already registered' });
    }

    const password_hash = await bcrypt.hash(password, 12);

    await client.query('BEGIN');

    const companyResult = await client.query(
      'INSERT INTO companies (name) VALUES ($1) RETURNING id',
      [`${full_name}'s Company`]
    );
    const companyId = companyResult.rows[0].id;

    const userResult = await client.query(
      `INSERT INTO users (company_id, full_name, email, password_hash, role)
       VALUES ($1, $2, $3, $4, 'admin') RETURNING id, company_id, full_name, email, role`,
      [companyId, full_name, email.toLowerCase(), password_hash]
    );

    await client.query('COMMIT');

    const user = userResult.rows[0];
    trackSignup(user, 'email');
    const token = generateToken(user.id);
    setTokenCookie(res, token);

    res.status(201).json({
      message: 'Account created successfully',
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
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

export const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const result = await query(
      'SELECT id, company_id, full_name, email, password_hash, role, is_active FROM users WHERE email = $1',
      [email.toLowerCase()]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const user = result.rows[0];

    if (!user.is_active) {
      return res.status(403).json({ error: 'Account is deactivated' });
    }

    if (!user.password_hash) {
      return res.status(400).json({ error: 'Please login with Google' });
    }

    const isValid = await bcrypt.compare(password, user.password_hash);
    if (!isValid) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    await query('UPDATE users SET last_login = NOW() WHERE id = $1', [user.id]);
    await auditAs(req, user, 'auth.login', { method: 'password' });

    const token = generateToken(user.id);
    setTokenCookie(res, token);

    res.json({
      message: 'Login successful',
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
    throw error;
  }
};

export const logout = async (req, res) => {
  const user = await sessionUser(req);
  if (user) await auditAs(req, user, 'auth.logout');

  // Must use the same options as when the cookie was set, or browsers keep it
  res.clearCookie('token', {
    httpOnly: true,
    secure: config.nodeEnv === 'production',
    sameSite: config.nodeEnv === 'production' ? 'none' : 'lax',
  });
  res.json({ message: 'Logged out successfully' });
};

export const getMe = async (req, res) => {
  try {
    const result = await query(
      `SELECT u.id, u.company_id, u.full_name, u.email,
              u.role, u.avatar_url, u.phone, u.designation, u.gst_number, u.created_at,
              c.name as company_name, c.industry, c.country, c.timezone,
              c.tracking_preferences, c.onboarding_completed
       FROM users u
       LEFT JOIN companies c ON u.company_id = c.id
       WHERE u.id = $1`,
      [req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ user: result.rows[0] });
  } catch (error) {
    throw error;
  }
};

export const updateProfile = async (req, res) => {
  try {
    const { full_name, email, phone, designation, gst_number } = req.body;

    if (!full_name || !full_name.trim()) {
      return res.status(400).json({ error: 'Full name is required' });
    }

    if (email && email === req.user.email) {
      // unchanged email - nothing to validate
    } else if (email && email.trim()) {
      const existing = await query(
        'SELECT id FROM users WHERE email = $1 AND id <> $2',
        [email.toLowerCase(), req.user.id]
      );
      if (existing.rows.length > 0) {
        return res.status(409).json({ error: 'Email already registered' });
      }
    }

    const result = await query(
      `UPDATE users SET
         full_name = $1,
         email = $2,
         phone = $3,
         designation = $4,
         gst_number = $5,
         updated_at = NOW()
       WHERE id = $6
       RETURNING id, company_id, full_name, email, role, avatar_url, phone, designation, gst_number`,
      [
        full_name.trim(),
        email ? email.trim().toLowerCase() : req.user.email,
        phone || null,
        designation || null,
        gst_number || null,
        req.user.id,
      ]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({
      message: 'Profile updated successfully',
      user: result.rows[0],
    });
  } catch (error) {
    throw error;
  }
};

export const updateAvatar = async (req, res) => {
  try {
    const { avatar_url } = req.body;

    if (avatar_url === undefined) {
      return res.status(400).json({ error: 'avatar_url is required' });
    }

    if (avatar_url !== null && avatar_url !== '') {
      if (typeof avatar_url !== 'string') {
        return res.status(400).json({ error: 'avatar_url must be a string or null' });
      }

      const match = avatar_url.match(/^data:image\/(png|jpeg|jpg|gif|webp);base64,/);
      if (!match) {
        return res.status(400).json({ error: 'Invalid image format' });
      }

      const base64Length = avatar_url.length - avatar_url.indexOf(',') - 1;
      const approxBytes = base64Length * 0.75;
      if (approxBytes > 3 * 1024 * 1024) {
        return res.status(400).json({ error: 'Image too large (max 3MB)' });
      }
    }

    const result = await query(
      `UPDATE users SET
         avatar_url = $1,
         updated_at = NOW()
       WHERE id = $2
       RETURNING id, company_id, full_name, email, role, avatar_url, phone, designation, gst_number`,
      [avatar_url || null, req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({
      message: 'Avatar updated successfully',
      user: result.rows[0],
    });
  } catch (error) {
    throw error;
  }
};

export const changePassword = async (req, res) => {
  try {
    const { current_password, new_password } = req.body;

    if (!current_password || !new_password) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    if (new_password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters' });
    }

    const result = await query('SELECT password_hash FROM users WHERE id = $1', [req.user.id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user = result.rows[0];

    if (!user.password_hash) {
      return res.status(400).json({ error: 'Password change not available for Google accounts' });
    }

    const isMatch = await bcrypt.compare(current_password, user.password_hash);

    if (!isMatch) {
      return res.status(400).json({ error: 'Current password is incorrect' });
    }

    const password_hash = await bcrypt.hash(new_password, 12);

    // Other devices are signed out; this one gets a fresh session. Whole seconds, so the
    // new token (issued in the same second) stays valid.
    const changedAt = new Date(Math.floor(Date.now() / 1000) * 1000);
    await query(
      'UPDATE users SET password_hash = $1, password_changed_at = $2, updated_at = NOW() WHERE id = $3',
      [password_hash, changedAt, req.user.id]
    );
    await logAudit(req, 'auth.password_changed', { entityType: 'user', entityId: req.user.id });

    const token = generateToken(req.user.id);
    setTokenCookie(res, token);
    res.json({ message: 'Password updated successfully', token });
  } catch (error) {
    throw error;
  }
};

export const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    const result = await query('SELECT id FROM users WHERE email = $1', [email.toLowerCase()]);

    if (result.rows.length === 0) {
      // Same answer as for a real account, so the form cannot be used to find registered emails
      return res.json({ message: 'If an account exists for this email, an OTP has been sent.' });
    }

    const user = result.rows[0];
    const otp = generateOtp();
    const expires_at = new Date(Date.now() + OTP_TTL_MS);

    await query(
      'DELETE FROM password_resets WHERE user_id = $1 AND used = false',
      [user.id]
    );

    await query(
      'INSERT INTO password_resets (user_id, token, expires_at) VALUES ($1, $2, $3)',
      [user.id, hashOtp(user.id, otp), expires_at]
    );

    await sendOtpEmail(email, otp);

    res.json({ message: 'OTP sent to your email' });
  } catch (error) {
    throw error;
  }
};

export const resendOtp = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    const result = await query('SELECT id FROM users WHERE email = $1', [email.toLowerCase()]);

    if (result.rows.length === 0) {
      // Same answer as for a real account, so the form cannot be used to find registered emails
      return res.json({ message: 'If an account exists for this email, an OTP has been sent.' });
    }

    const user = result.rows[0];
    const otp = generateOtp();
    const expires_at = new Date(Date.now() + OTP_TTL_MS);

    await query(
      'DELETE FROM password_resets WHERE user_id = $1 AND used = false',
      [user.id]
    );

    await query(
      'INSERT INTO password_resets (user_id, token, expires_at) VALUES ($1, $2, $3)',
      [user.id, hashOtp(user.id, otp), expires_at]
    );

    await sendOtpEmail(email, otp);

    res.json({ message: 'OTP resent to your email' });
  } catch (error) {
    throw error;
  }
};

export const verifyOtp = async (req, res) => {
  try {
    const { email, otp } = req.body;

    if (!email || !otp) {
      return res.status(400).json({ error: 'Email and OTP are required' });
    }

    const userResult = await query('SELECT id FROM users WHERE email = $1', [email.toLowerCase()]);
    if (userResult.rows.length === 0) {
      return res.status(400).json({ error: 'Invalid OTP' });
    }

    const user_id = userResult.rows[0].id;

    const check = await checkOtp(user_id, otp);
    if (check === 'locked') {
      return res.status(429).json({ error: OTP_LOCKED_MESSAGE });
    }
    if (check !== 'ok') {
      return res.status(400).json({ error: 'Invalid or expired OTP' });
    }

    res.json({ message: 'OTP verified successfully' });
  } catch (error) {
    throw error;
  }
};

export const resetPassword = async (req, res) => {
  try {
    const { email, otp, password } = req.body;

    if (!email || !otp || !password) {
      return res.status(400).json({ error: 'Email, OTP and password are required' });
    }

    if (password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters' });
    }

    const userResult = await query('SELECT id, company_id, full_name FROM users WHERE email = $1', [email.toLowerCase()]);
    if (userResult.rows.length === 0) {
      return res.status(400).json({ error: 'Invalid request' });
    }

    const user_id = userResult.rows[0].id;

    const check = await checkOtp(user_id, otp);
    if (check === 'locked') {
      return res.status(429).json({ error: OTP_LOCKED_MESSAGE });
    }
    if (check !== 'ok') {
      return res.status(400).json({ error: 'Invalid or expired OTP' });
    }

    const password_hash = await bcrypt.hash(password, 12);

    const client = await getClient();
    try {
      await client.query('BEGIN');
      // Every existing session ends after a reset (the user signs in with the new password)
      await client.query('UPDATE users SET password_hash = $1, password_changed_at = NOW() WHERE id = $2', [password_hash, user_id]);
      await client.query('UPDATE password_resets SET used = true WHERE user_id = $1 AND token = $2', [user_id, hashOtp(user_id, otp)]);
      await client.query('COMMIT');
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
    await auditAs(req, userResult.rows[0], 'auth.password_reset');

    res.json({ message: 'Password reset successful' });
  } catch (error) {
    throw error;
  }
};

// Verifies a Google OAuth access token and returns the trusted profile, or null if invalid
const verifyGoogleAccessToken = async (accessToken) => {
  const tokenInfoRes = await fetch(
    `https://oauth2.googleapis.com/tokeninfo?access_token=${encodeURIComponent(accessToken)}`
  );
  if (!tokenInfoRes.ok) return null;
  const tokenInfo = await tokenInfoRes.json();

  // Token must have been issued to our app, not some other Google client
  if (!config.google.clientId || (tokenInfo.aud !== config.google.clientId && tokenInfo.azp !== config.google.clientId)) {
    return null;
  }

  const userInfoRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!userInfoRes.ok) return null;
  const userInfo = await userInfoRes.json();

  if (!userInfo.sub || !userInfo.email || userInfo.sub !== tokenInfo.sub) return null;
  if (userInfo.email_verified === false || userInfo.email_verified === 'false') return null;

  return {
    googleId: userInfo.sub,
    email: userInfo.email.toLowerCase(),
    fullName: userInfo.name || userInfo.email.split('@')[0],
    avatarUrl: userInfo.picture || null,
  };
};

export const googleCallback = async (req, res) => {
  try {
    const { accessToken } = req.body;

    if (!accessToken || typeof accessToken !== 'string') {
      return res.status(400).json({ error: 'Google access token is required' });
    }

    const profile = await verifyGoogleAccessToken(accessToken);
    if (!profile) {
      return res.status(401).json({ error: 'Google sign-in could not be verified. Please try again.' });
    }

    const { googleId, email, fullName, avatarUrl } = profile;

    let result = await query(
      `SELECT id, company_id, full_name, email, role, is_active, google_id FROM users
       WHERE google_id = $1 OR email = $2
       ORDER BY (google_id = $1) DESC NULLS LAST
       LIMIT 1`,
      [googleId, email]
    );

    let user;
    let isNew = false;

    if (result.rows.length > 0) {
      user = result.rows[0];
      if (!user.is_active) {
        return res.status(403).json({ error: 'Account is deactivated' });
      }
      if (!user.google_id) {
        await query('UPDATE users SET google_id = $1, avatar_url = COALESCE($2, avatar_url) WHERE id = $3',
          [googleId, avatarUrl, user.id]
        );
      }
    } else {
      isNew = true;
      const client = await getClient();
      try {
        await client.query('BEGIN');

        const companyResult = await client.query(
          'INSERT INTO companies (name) VALUES ($1) RETURNING id',
          [`${fullName}'s Company`]
        );

        const userResult = await client.query(
          `INSERT INTO users (company_id, full_name, email, google_id, avatar_url, role)
           VALUES ($1, $2, $3, $4, $5, 'admin')
           RETURNING id, company_id, full_name, email, role`,
          [companyResult.rows[0].id, fullName, email, googleId, avatarUrl]
        );

        await client.query('COMMIT');
        user = userResult.rows[0];
        trackSignup(user, 'google');
      } catch (e) {
        await client.query('ROLLBACK');
        throw e;
      } finally {
        client.release();
      }
    }

    await query('UPDATE users SET last_login = NOW() WHERE id = $1', [user.id]);
    await auditAs(req, user, 'auth.login', { method: 'google', new_account: isNew });

    const token = generateToken(user.id);
    setTokenCookie(res, token);

    res.json({
      message: 'Google login successful',
      user: {
        id: user.id,
        company_id: user.company_id,
        full_name: user.full_name,
        email: user.email,
        role: user.role,
      },
      isNew,
      token,
    });
  } catch (error) {
    throw error;
  }
};
