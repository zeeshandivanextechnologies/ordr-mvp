import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { query, getClient } from '../config/database.js';
import config from '../config/environment.js';
import { sendOtpEmail } from '../utils/emailService.js';

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
  res.clearCookie('token');
  res.json({ message: 'Logged out successfully' });
};

export const getMe = async (req, res) => {
  try {
    const result = await query(
      `SELECT u.id, u.company_id, u.full_name, u.email,
              u.role, u.avatar_url, u.created_at,
              c.name as company_name, c.industry, c.country, c.timezone
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

export const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    const result = await query('SELECT id FROM users WHERE email = $1', [email.toLowerCase()]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'No account found with this email address' });
    }

    const user = result.rows[0];
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expires_at = new Date(Date.now() + 10 * 60 * 1000);

    await query(
      'DELETE FROM password_resets WHERE user_id = $1 AND used = false',
      [user.id]
    );

    await query(
      'INSERT INTO password_resets (user_id, token, expires_at) VALUES ($1, $2, $3)',
      [user.id, otp, expires_at]
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
      return res.status(404).json({ error: 'No account found with this email address' });
    }

    const user = result.rows[0];
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expires_at = new Date(Date.now() + 10 * 60 * 1000);

    await query(
      'DELETE FROM password_resets WHERE user_id = $1 AND used = false',
      [user.id]
    );

    await query(
      'INSERT INTO password_resets (user_id, token, expires_at) VALUES ($1, $2, $3)',
      [user.id, otp, expires_at]
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

    const result = await query(
      'SELECT id FROM password_resets WHERE user_id = $1 AND token = $2 AND expires_at > NOW() AND used = false',
      [user_id, otp]
    );

    if (result.rows.length === 0) {
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

    const userResult = await query('SELECT id FROM users WHERE email = $1', [email.toLowerCase()]);
    if (userResult.rows.length === 0) {
      return res.status(400).json({ error: 'Invalid request' });
    }

    const user_id = userResult.rows[0].id;

    const result = await query(
      'SELECT id FROM password_resets WHERE user_id = $1 AND token = $2 AND expires_at > NOW() AND used = false',
      [user_id, otp]
    );

    if (result.rows.length === 0) {
      return res.status(400).json({ error: 'Invalid or expired OTP' });
    }

    const password_hash = await bcrypt.hash(password, 12);

    const client = await getClient();
    try {
      await client.query('BEGIN');
      await client.query('UPDATE users SET password_hash = $1 WHERE id = $2', [password_hash, user_id]);
      await client.query('UPDATE password_resets SET used = true WHERE user_id = $1 AND token = $2', [user_id, otp]);
      await client.query('COMMIT');
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }

    res.json({ message: 'Password reset successful' });
  } catch (error) {
    throw error;
  }
};

export const googleCallback = async (req, res) => {
  try {
    const { googleId, email, fullName, avatarUrl } = req.body;

    let result = await query('SELECT id, company_id, full_name, email, role, is_active FROM users WHERE google_id = $1 OR email = $2', [googleId, email.toLowerCase()]);

    let user;
    let isNew = false;

    if (result.rows.length > 0) {
      user = result.rows[0];
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
          [companyResult.rows[0].id, fullName, email.toLowerCase(), googleId, avatarUrl]
        );

        await client.query('COMMIT');
        user = userResult.rows[0];
      } catch (e) {
        await client.query('ROLLBACK');
        throw e;
      } finally {
        client.release();
      }
    }

    await query('UPDATE users SET last_login = NOW() WHERE id = $1', [user.id]);

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
