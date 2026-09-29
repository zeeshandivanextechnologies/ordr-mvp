import jwt from 'jsonwebtoken';
import config from '../config/environment.js';
import { query } from '../config/database.js';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);
const APP_ORIGINS = new Set([config.frontendUrl.replace(/\/+$/, ''), 'http://localhost:5173']);

// CSRF: a change made with only the login cookie must come from the ORDR app itself.
// (The app sends its token in the Authorization header, which other websites cannot do.)
const fromAppOrigin = (req) => {
  const source = req.headers.origin || req.headers.referer;
  if (!source) return false;
  try {
    return APP_ORIGINS.has(new URL(source).origin);
  } catch {
    return false;
  }
};

export const authenticate = async (req, res, next) => {
  try {
    const headerToken = req.headers.authorization?.split(' ')[1];
    const token = req.cookies?.token || headerToken;

    if (!token) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    if (!headerToken && !SAFE_METHODS.has(req.method) && !fromAppOrigin(req)) {
      return res.status(403).json({ error: 'Request blocked: it did not come from the ORDR app' });
    }

    const decoded = jwt.verify(token, config.jwtSecret);
    // Only login (session) tokens open a session; e.g. a Gmail connect "state" token never does
    if (decoded.typ && decoded.typ !== 'session') {
      return res.status(401).json({ error: 'Invalid token' });
    }
    const result = await query(
      'SELECT id, company_id, full_name, email, role, is_active, removed_at, password_changed_at FROM users WHERE id = $1',
      [decoded.userId]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'User not found' });
    }

    // Sessions from before a password change / reset end
    const changedAt = result.rows[0].password_changed_at;
    if (changedAt && decoded.iat < Math.floor(new Date(changedAt).getTime() / 1000)) {
      return res.status(401).json({ error: 'Your password was changed. Please sign in again.' });
    }

    // Removed from the team: end the session
    if (result.rows[0].removed_at) {
      return res.status(401).json({ error: 'Your account was removed from this team' });
    }

    if (!result.rows[0].is_active) {
      return res.status(403).json({ error: 'Account is deactivated' });
    }

    req.user = result.rows[0];
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expired' });
    }
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ error: 'Invalid token' });
    }
    next(error);
  }
};

export const requireAuth = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  next();
};
