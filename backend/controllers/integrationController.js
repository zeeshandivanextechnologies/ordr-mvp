import { OAuth2Client } from 'google-auth-library';
import { query } from '../config/database.js';
import config from '../config/environment.js';
import jwt from 'jsonwebtoken';

// Use environment variables for Google OAuth
// We use the same client ID and secret as Google Sign-in, but a different callback
const oauth2Client = new OAuth2Client(
  config.google.clientId,
  config.google.clientSecret,
  `${config.backendUrl}/api/integration/gmail/callback`
);

export const connectGmail = async (req, res) => {
  try {
    const { id, company_id } = req.user;

    // Generate a secure state token containing the user id to verify the callback
    const state = jwt.sign({ userId: id, companyId: company_id }, config.jwtSecret, { expiresIn: '15m' });

    // Generate the URL that will be used for the consent dialog.
    const authorizeUrl = oauth2Client.generateAuthUrl({
      access_type: 'offline', // gets refresh token
      prompt: 'consent', // force consent to always get refresh token
      scope: [
        'https://www.googleapis.com/auth/gmail.readonly',
        'https://www.googleapis.com/auth/userinfo.email',
      ],
      state: state
    });

    res.json({ url: authorizeUrl });
  } catch (error) {
    res.status(500).json({ error: 'Failed to generate connection URL' });
  }
};

export const gmailCallback = async (req, res) => {
  try {
    const { code, state } = req.query;

    if (!code || !state) {
      return res.redirect(`${config.frontendUrl}/onboarding/gmail?error=Missing+parameters`);
    }

    // Verify state token to get user context
    let decoded;
    try {
      decoded = jwt.verify(state, config.jwtSecret);
    } catch (err) {
      return res.redirect(`${config.frontendUrl}/onboarding/gmail?error=Invalid+state+token`);
    }

    const { userId, companyId } = decoded;

    // Exchange authorization code for access and refresh tokens
    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);

    // Get user info (email)
    const tokenInfo = await oauth2Client.getTokenInfo(tokens.access_token);
    const email = tokenInfo.email;

    if (!email) {
      return res.redirect(`${config.frontendUrl}/onboarding/gmail?error=Could+not+get+email`);
    }

    // Save tokens in database (upsert)
    const existingResult = await query(
      'SELECT id FROM email_connections WHERE company_id = $1 AND email = $2',
      [companyId, email]
    );

    if (existingResult.rows.length > 0) {
      await query(
        `UPDATE email_connections 
         SET access_token = $1, refresh_token = COALESCE($2, refresh_token), is_active = true, updated_at = NOW() 
         WHERE id = $3`,
        [tokens.access_token, tokens.refresh_token, existingResult.rows[0].id]
      );
    } else {
      await query(
        `INSERT INTO email_connections (company_id, user_id, provider, email, access_token, refresh_token)
         VALUES ($1, $2, 'gmail', $3, $4, $5)`,
        [companyId, userId, email, tokens.access_token, tokens.refresh_token]
      );
    }

    res.redirect(`${config.frontendUrl}/onboarding/gmail?success=true`);
  } catch (error) {
    console.error('Gmail OAuth Callback Error:', error);
    res.redirect(`${config.frontendUrl}/onboarding/gmail?error=Authentication+failed`);
  }
};

export const getConnectionStatus = async (req, res) => {
  try {
    const { company_id } = req.user;

    const result = await query(
      'SELECT id, email, is_active, last_scan_at FROM email_connections WHERE company_id = $1 AND is_active = true',
      [company_id]
    );

    res.json({
      connected: result.rows.length > 0,
      connections: result.rows
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch connection status' });
  }
};
