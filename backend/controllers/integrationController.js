import { OAuth2Client } from 'google-auth-library';
import { query } from '../config/database.js';
import config from '../config/environment.js';
import jwt from 'jsonwebtoken';
import { extractBodyAndAttachments, prefilterEmail } from '../utils/emailPreFilter.js';
import { encryptToken, decryptToken, isEncrypted } from '../utils/tokenCrypto.js';
import { logAudit } from '../utils/audit.js';
import { processPendingGmailMessages } from '../services/gmailOrderProcessor.js';
import { assertWithinLimit, getPlanContext, sendPlanError } from '../services/planGuard.js';

const GMAIL_API = 'https://gmail.googleapis.com/gmail/v1/users/me';

// Sanity caps to keep a single MVP scan bounded even on large inboxes.
// Listing is cheap (ids only), so we page past already-saved messages to find new ones.
const MAX_LIST_PAGES = 50;
const MAX_PROCESS_NEW = 100;
// First scan only looks back this far
const FIRST_SCAN_WINDOW = 'newer_than:30d';
// Re-check a small overlap before the last scan; duplicates are skipped by message id
const SCAN_OVERLAP_SECONDS = 60;

const ALLOWED_REDIRECTS = ['/onboarding/gmail', '/app/integrations'];
const DEFAULT_REDIRECT = '/onboarding/gmail';

// Timestamp columns on email_connections have no time zone; they hold wall-clock
// time in the DB session zone. These expressions convert them to real instants.
const LAST_SCAN_AT_SQL = `(last_scan_at AT TIME ZONE current_setting('TimeZone'))`;
const TOKEN_EXPIRY_SQL = `(token_expiry AT TIME ZONE current_setting('TimeZone'))`;

const RECONNECT_MESSAGE = 'Gmail access has expired or was revoked. Please reconnect Gmail.';
const reconnectError = () =>
  Object.assign(new Error(RECONNECT_MESSAGE), { status: 400, code: 'GMAIL_RECONNECT_REQUIRED' });

const GMAIL_READ_SCOPE = 'https://www.googleapis.com/auth/gmail.readonly';
const SCOPE_MESSAGE =
  'Gmail read permission was not granted. Please reconnect Gmail and tick "View your email messages and settings" on the Google screen.';
// Token works but lacks Gmail read access (user unticked the permission checkbox)
const scopeError = () =>
  Object.assign(new Error(SCOPE_MESSAGE), { status: 400, code: 'GMAIL_RECONNECT_REQUIRED', deactivate: true });

const truncate = (value, max) => (typeof value === 'string' && value.length > max ? value.slice(0, max) : value);

// In-flight guard per company to avoid accidental double scans.
const scanningCompanies = new Set();

const buildOAuthClient = () =>
  new OAuth2Client(
    config.google.clientId,
    config.google.clientSecret,
    `${config.backendUrl}/api/integration/gmail/callback`
  );

const gmailFetch = (path, token) =>
  fetch(`${GMAIL_API}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });

const deactivateConnection = (connectionId) =>
  query(
    `UPDATE email_connections
     SET is_active = false, access_token = NULL, refresh_token = NULL, token_expiry = NULL, updated_at = NOW()
     WHERE id = $1`,
    [connectionId]
  );

// `force` ignores the stored expiry and always asks Google for a new access token
const refreshAccessToken = async (connection, force = false) => {
  let accessToken;
  let refreshToken;
  try {
    accessToken = decryptToken(connection.access_token);
    refreshToken = decryptToken(connection.refresh_token);
  } catch (e) {
    // Stored tokens cannot be decrypted (e.g. encryption key changed)
    await deactivateConnection(connection.id);
    throw reconnectError();
  }

  if (!refreshToken) {
    throw Object.assign(new Error('Missing refresh token, please reconnect Gmail'), { status: 400, code: 'GMAIL_RECONNECT_REQUIRED' });
  }
  const client = buildOAuthClient();
  client.setCredentials({
    access_token: accessToken,
    refresh_token: refreshToken,
    // Refresh a minute early so the token does not expire mid-scan
    expiry_date: !force && connection.token_expiry_ms ? Number(connection.token_expiry_ms) - 60000 : 1,
  });

  let token;
  try {
    ({ token } = await client.getAccessToken());
  } catch (e) {
    const reason = e?.response?.data?.error || e?.message || '';
    if (String(reason).includes('invalid_grant')) {
      // Refresh token revoked or expired: user must reconnect
      await deactivateConnection(connection.id);
      throw reconnectError();
    }
    throw e;
  }

  if (token) {
    const expiryDate = client.credentials.expiry_date ? new Date(client.credentials.expiry_date).toISOString() : null;
    // Also upgrades legacy plaintext refresh tokens to encrypted storage
    await query(
      `UPDATE email_connections
       SET access_token = $1, token_expiry = $2::timestamptz,
           refresh_token = CASE WHEN $3::text IS NULL THEN refresh_token ELSE $3 END,
           updated_at = NOW()
       WHERE id = $4`,
      [
        encryptToken(token),
        expiryDate,
        isEncrypted(connection.refresh_token) ? null : encryptToken(refreshToken),
        connection.id,
      ]
    );
  }
  return token;
};

// Decodes RFC 2047 encoded-words (=?charset?B|Q?text?=) in headers like Subject/From
const decodeHeader = (value) => {
  if (!value) return '';
  const encodedWord = /=\?([^?]+)\?([bBqQ])\?([^?]*)\?=/g;
  // Whitespace between two adjacent encoded-words is not part of the text
  const joined = value.replace(/(\?=)\s+(=\?)/g, '$1$2');
  return joined.replace(encodedWord, (match, charset, enc, text) => {
    try {
      let bytes;
      if (enc.toLowerCase() === 'b') {
        bytes = Buffer.from(text, 'base64');
      } else {
        const qText = text.replace(/_/g, ' ');
        const out = [];
        for (let i = 0; i < qText.length; i += 1) {
          if (qText[i] === '=' && /^[0-9A-Fa-f]{2}$/.test(qText.slice(i + 1, i + 3))) {
            out.push(parseInt(qText.slice(i + 1, i + 3), 16));
            i += 2;
          } else {
            out.push(qText.charCodeAt(i) & 0xff);
          }
        }
        bytes = Buffer.from(out);
      }
      const label = String(charset).split('*')[0].toLowerCase();
      try {
        return new TextDecoder(label).decode(bytes);
      } catch {
        return bytes.toString('utf8');
      }
    } catch (e) {
      return match;
    }
  });
};

// Splits a From header like `"Name" <a@b.com>` into name and email
const parseFromHeader = (sender) => {
  const decoded = decodeHeader(sender || '').trim();
  const match = decoded.match(/^(.*)<([^>]+)>\s*$/);
  if (match) {
    const name = match[1].trim().replace(/^"(.*)"$/, '$1').trim();
    return { fromName: name, fromEmail: match[2].trim() };
  }
  return { fromName: decoded, fromEmail: decoded || 'Unknown' };
};

// Picks the redirect path from the OAuth state without trusting anything outside the allowlist
const redirectFromState = (state) => {
  try {
    const decoded = state ? jwt.decode(state) : null;
    const path = decoded?.redirectPath;
    return ALLOWED_REDIRECTS.includes(path) ? path : DEFAULT_REDIRECT;
  } catch {
    return DEFAULT_REDIRECT;
  }
};

const parseDateHeader = (value) => {
  const time = Date.parse(value || '');
  return Number.isFinite(time) ? new Date(time) : null;
};

const getMessageHeader = (headers, name) => {
  const lower = name.toLowerCase();
  const found = (headers || []).find((h) => String(h.name || '').toLowerCase() === lower);
  return found ? found.value : null;
};

export const connectGmail = async (req, res) => {
  try {
    const { id, company_id } = req.user;

    // Plan limit: number of connected Gmail inboxes
    try {
      await assertWithinLimit(company_id, 'gmailInboxes');
    } catch (planErr) {
      if (sendPlanError(res, planErr)) return;
      throw planErr;
    }

    const requestedRedirect = String(req.query.redirect || DEFAULT_REDIRECT);
    const redirectPath = ALLOWED_REDIRECTS.includes(requestedRedirect) ? requestedRedirect : DEFAULT_REDIRECT;

    // Generate a secure state token containing the user id to verify the callback
    const state = jwt.sign({ userId: id, companyId: company_id, redirectPath }, config.jwtSecret, { expiresIn: '15m' });

    // Generate the URL that will be used for the consent dialog.
    const authorizeUrl = buildOAuthClient().generateAuthUrl({
      access_type: 'offline', // gets refresh token
      prompt: 'consent', // force consent to always get refresh token
      scope: [
        GMAIL_READ_SCOPE,
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
  // Send errors back to the page the user started from (onboarding or integrations)
  let redirectPath = redirectFromState(req.query.state);
  try {
    const { code, state, error: oauthError } = req.query;

    if (oauthError) {
      // e.g. user clicked "Cancel" on Google's consent screen
      return res.redirect(`${config.frontendUrl}${redirectPath}?error=Gmail+access+was+not+granted`);
    }

    if (!code || !state) {
      return res.redirect(`${config.frontendUrl}${redirectPath}?error=Missing+parameters`);
    }

    // Verify state token to get user context
    let decoded;
    try {
      decoded = jwt.verify(state, config.jwtSecret);
    } catch (err) {
      return res.redirect(`${config.frontendUrl}${redirectPath}?error=Connection+link+expired,+please+try+again`);
    }

    const { userId, companyId } = decoded;
    redirectPath = ALLOWED_REDIRECTS.includes(decoded.redirectPath) ? decoded.redirectPath : DEFAULT_REDIRECT;

    // Exchange authorization code for access and refresh tokens
    const client = buildOAuthClient();
    const { tokens } = await client.getToken(code);
    client.setCredentials(tokens);

    // Google lets users untick individual permissions; without Gmail read access scanning cannot work
    const grantedScopes = String(tokens.scope || '').split(/\s+/);
    if (!grantedScopes.includes(GMAIL_READ_SCOPE)) {
      return res.redirect(
        `${config.frontendUrl}${redirectPath}?error=${encodeURIComponent('Please allow Gmail read access: tick "View your email messages and settings" and try again')}`
      );
    }

    // Get user info (email)
    const tokenInfo = await client.getTokenInfo(tokens.access_token);
    const email = tokenInfo.email;

    if (!email) {
      return res.redirect(`${config.frontendUrl}${redirectPath}?error=Could+not+get+email`);
    }

    // Save tokens in database (upsert)
    const existingResult = await query(
      'SELECT id FROM email_connections WHERE company_id = $1 AND email = $2',
      [companyId, email]
    );

    // Plan limit: a new inbox (not a reconnect of an active one) must fit in the plan
    const planCtx = await getPlanContext(companyId);
    const inboxLimit = planCtx.plan.limits.gmailInboxes;
    if (inboxLimit !== null && inboxLimit !== undefined) {
      const active = await query(
        'SELECT email FROM email_connections WHERE company_id = $1 AND is_active = true',
        [companyId]
      );
      const isActiveAlready = active.rows.some((r) => r.email === email);
      if (!isActiveAlready && active.rows.length >= inboxLimit) {
        return res.redirect(
          `${config.frontendUrl}${redirectPath}?error=${encodeURIComponent(`Your ${planCtx.plan.name} plan allows ${inboxLimit} Gmail inbox${inboxLimit === 1 ? '' : 'es'}. Disconnect one or upgrade your plan.`)}`
        );
      }
    }

    // Tokens are stored encrypted, never in plain text
    const expiry = tokens.expiry_date ? new Date(tokens.expiry_date).toISOString() : null;
    if (existingResult.rows.length > 0) {
      await query(
        `UPDATE email_connections
         SET access_token = $1, refresh_token = COALESCE($2, refresh_token),
             token_expiry = $3::timestamptz, is_active = true, updated_at = NOW()
         WHERE id = $4`,
        [encryptToken(tokens.access_token), encryptToken(tokens.refresh_token), expiry, existingResult.rows[0].id]
      );
    } else {
      await query(
        `INSERT INTO email_connections (company_id, user_id, provider, email, access_token, refresh_token, token_expiry)
         VALUES ($1, $2, 'gmail', $3, $4, $5, $6::timestamptz)`,
        [companyId, userId, email, encryptToken(tokens.access_token), encryptToken(tokens.refresh_token), expiry]
      );
    }

    await logAudit({ user: { id: userId, company_id: companyId }, ip: req.ip }, 'gmail.connected', { entityType: 'email_connection', details: { email } });
    
    // Start the first scan right away in the background (the user does not wait for it)
    runGmailScan(companyId).catch((err) => {
      if (err.status !== 409) console.error('Initial Gmail scan failed:', err.message);
    });

    res.redirect(`${config.frontendUrl}${redirectPath}?success=true`);
  } catch (error) {
    console.error('Gmail OAuth Callback Error:', error);
    res.redirect(`${config.frontendUrl}${redirectPath}?error=Authentication+failed`);
  }
};

export const getConnectionStatus = async (req, res) => {
  try {
    const { company_id } = req.user;

    const result = await query(
      `SELECT id, email, is_active, ${LAST_SCAN_AT_SQL} AS last_scan_at
       FROM email_connections WHERE company_id = $1 AND is_active = true
       ORDER BY created_at DESC`,
      [company_id]
    );

    const connection = result.rows[0] || null;

    res.json({
      connected: !!connection,
      connections: result.rows,
      connection,
      autoScanMinutes: config.gmailAutoScanMinutes > 0 ? config.gmailAutoScanMinutes : null,
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch connection status' });
  }
};

// Lists message ids matching the query, skipping ones already saved, until
// MAX_PROCESS_NEW new ids are found. `complete` is false when new messages remain.
const listNewMessageIds = async (token, queryString, companyId) => {
  const newIds = [];
  let scanned = 0;
  let duplicates = 0;
  let overflow = false;
  let exhausted = false;
  let pageToken = null;

  for (let page = 0; page < MAX_LIST_PAGES; page += 1) {
    const path = `/messages?q=${encodeURIComponent(queryString)}&maxResults=100${pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : ''}`;
    const response = await gmailFetch(path, token);
    // Access token rejected: the caller retries once with a forced token refresh
    if (response.status === 401) throw Object.assign(reconnectError(), { unauthorized: true });
    if (!response.ok) {
      const body = await response.text();
      if (response.status === 403 && /ACCESS_TOKEN_SCOPE_INSUFFICIENT|insufficientPermissions/.test(body)) {
        throw scopeError();
      }
      throw Object.assign(new Error(`Gmail list error ${response.status}: ${body}`), { status: response.status });
    }
    const data = await response.json();
    const batch = (data.messages || []).map((m) => m.id);
    scanned += batch.length;

    if (batch.length > 0) {
      const existingResult = await query(
        'SELECT message_id FROM gmail_messages WHERE company_id = $1 AND message_id = ANY($2::text[])',
        [companyId, batch]
      );
      const existing = new Set(existingResult.rows.map((r) => r.message_id));
      for (const id of batch) {
        if (existing.has(id)) duplicates += 1;
        else if (newIds.length < MAX_PROCESS_NEW) newIds.push(id);
        else overflow = true;
      }
    }

    pageToken = data.nextPageToken;
    if (!pageToken) {
      exhausted = true;
      break;
    }
    if (newIds.length >= MAX_PROCESS_NEW) {
      overflow = true;
      break;
    }
  }

  return { newIds, scanned, duplicates, complete: exhausted && !overflow };
};

// Access token for an active Gmail connection (refreshed if needed), or null when
// the connection is gone. Used by the AI processor to download attachments.
export const getGmailAccessToken = async (connectionId) => {
  const { rows } = await query(
    `SELECT *, (EXTRACT(EPOCH FROM ${TOKEN_EXPIRY_SQL}) * 1000)::bigint AS token_expiry_ms
     FROM email_connections WHERE id = $1 AND is_active = true`,
    [connectionId]
  );
  if (!rows[0]) return null;
  return refreshAccessToken(rows[0]);
};

// Downloads one Gmail attachment and returns its bytes
export const downloadGmailAttachment = async (token, messageId, attachmentId) => {
  const response = await gmailFetch(
    `/messages/${encodeURIComponent(messageId)}/attachments/${encodeURIComponent(attachmentId)}`,
    token
  );
  if (!response.ok) {
    throw Object.assign(new Error(`Gmail attachment error ${response.status}`), { status: response.status });
  }
  const data = await response.json();
  const b64 = String(data.data || '').replace(/-/g, '+').replace(/_/g, '/');
  return Buffer.from(b64, 'base64');
};

const fetchMessageFull = async (token, messageId) => {
  const path = `/messages/${encodeURIComponent(messageId)}?format=full`;
  const response = await gmailFetch(path, token);
  if (!response.ok) {
    throw Object.assign(new Error(`Gmail message error ${response.status}`), { status: response.status });
  }
  return response.json();
};

const runConcurrent = async (items, limit, worker) => {
  const results = new Array(items.length);
  let index = 0;
  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (index < items.length) {
      const current = index;
      index += 1;
      try {
        results[current] = await worker(items[current]);
      } catch (e) {
        console.error('Message processing error:', e.message);
        results[current] = null;
      }
    }
  });
  await Promise.all(runners);
  return results;
};

// Scans the company's newest active Gmail connection. Used by "Scan Now", right
// after connecting, and by the automatic background scan. Throws errors with a
// `status` (400 not connected / reconnect needed, 409 already scanning).
// Scans one connected inbox. Errors are thrown with a `status` (400 = reconnect needed).
const scanOneConnection = async (companyId, connection) => {
  const scannedConnectionId = connection.id;
  try {

    let token = await refreshAccessToken(connection);

    // The next scan resumes from when this one started (emails arriving mid-scan are not missed)
    const scanStartedAt = Math.floor(Date.now() / 1000);

    let searchQuery = 'in:inbox';
    if (connection.last_scan_epoch) {
      searchQuery += ` after:${Number(connection.last_scan_epoch) - SCAN_OVERLAP_SECONDS}`;
    } else {
      searchQuery += ` ${FIRST_SCAN_WINDOW}`;
    }

    let listResult;
    try {
      listResult = await listNewMessageIds(token, searchQuery, companyId);
    } catch (listError) {
      if (!listError.unauthorized) throw listError;
      // Stored access token was rejected. Force a refresh: if the grant was revoked this
      // throws invalid_grant and deactivates the connection; otherwise retry with the new token.
      token = await refreshAccessToken(connection, true);
      try {
        listResult = await listNewMessageIds(token, searchQuery, companyId);
      } catch (retryError) {
        if (retryError.unauthorized) retryError.deactivate = true;
        throw retryError;
      }
    }
    const { newIds, scanned, duplicates, complete: listComplete } = listResult;

    let inserted = 0;
    let potentialOrders = 0;
    let marketingSkipped = 0;
    let otherSkipped = 0;
    let fetchFailed = 0;
    let insertFailed = 0;
    if (newIds.length > 0) {
      const messages = await runConcurrent(newIds, 6, (messageId) => fetchMessageFull(token, messageId));
      fetchFailed = messages.filter((m) => !m || !m.id).length;

      const rows = [];
      for (const message of messages) {
        if (!message || !message.id) continue;
        const { fromName, fromEmail } = parseFromHeader(getMessageHeader(message.payload?.headers, 'From'));
        const subject = decodeHeader(getMessageHeader(message.payload?.headers, 'Subject')) || '';
        const receivedAt = parseDateHeader(getMessageHeader(message.payload?.headers, 'Date'));

        const { body, attachmentNames, attachments, hasAttachment } = extractBodyAndAttachments(message.payload);
        const prefilter = prefilterEmail({
          subject,
          body,
          sender: fromEmail,
          hasAttachment,
          attachmentNames,
        });

        if (prefilter.reason === 'order') potentialOrders += 1;
        else if (prefilter.reason === 'marketing') marketingSkipped += 1;
        else otherSkipped += 1;

        // Values are capped to the column sizes so one unusual email cannot fail the batch
        rows.push([
          companyId,
          connection.id,
          truncate(message.id, 255),
          truncate(message.threadId || '', 255),
          truncate(fromEmail, 255),
          fromName && fromName !== fromEmail ? truncate(fromName, 255) : null,
          truncate(subject, 1000) || null,
          message.snippet || null,
          receivedAt,
          body || null,
          hasAttachment,
          attachmentNames.length > 0 ? attachmentNames.join(', ') : null,
          prefilter.isPotentialOrder,
          truncate(prefilter.reason, 50),
          prefilter.keywords.length > 0 ? prefilter.keywords.join(', ') : null,
          attachments.length > 0 ? JSON.stringify(attachments) : null,
        ]);
      }

      const INSERT_COLUMNS = 16;
      const insertSql = (count) => {
        const values = [];
        for (let r = 0; r < count; r += 1) {
          const base = r * INSERT_COLUMNS;
          values.push(`(${Array.from({ length: INSERT_COLUMNS }, (_, c) => `$${base + c + 1}`).join(', ')})`);
        }
        return `INSERT INTO gmail_messages
             (company_id, email_connection_id, message_id, thread_id, sender_email, sender_name, subject, snippet, received_at, body, has_attachment, attachment_names, is_potential_order, prefilter_reason, prefilter_keywords, attachments)
           VALUES ${values.join(', ')}
           ON CONFLICT (company_id, message_id) DO NOTHING`;
      };

      if (rows.length > 0) {
        try {
          const insertResult = await query(insertSql(rows.length), rows.flat());
          inserted = Number.isInteger(insertResult.rowCount) ? insertResult.rowCount : rows.length;
        } catch (batchError) {
          // Fall back to one row at a time so a single bad email is skipped, not the whole scan
          console.error('Gmail batch insert failed, retrying per message:', batchError.message);
          for (const row of rows) {
            try {
              const r = await query(insertSql(1), row);
              inserted += r.rowCount || 0;
            } catch (rowError) {
              insertFailed += 1;
              console.error(`Skipping Gmail message ${row[2]}:`, rowError.message);
            }
          }
        }
      }
    }

    // Only move the scan cursor forward when everything up to now was collected.
    // Otherwise the next scan re-checks the same window (saved emails are skipped).
    const complete = listComplete && fetchFailed === 0;
    if (complete) {
      await query(
        'UPDATE email_connections SET last_scan_at = to_timestamp($1), updated_at = NOW() WHERE id = $2',
        [scanStartedAt, connection.id]
      );
    }

    const statusResult = await query(
      `SELECT email, ${LAST_SCAN_AT_SQL} AS last_scan_at FROM email_connections WHERE id = $1`,
      [connection.id]
    );

    return {
      message: complete ? 'Inbox scan completed' : 'Partial scan: more emails remaining, scan again to continue',
      scanned,
      newMessages: inserted,
      skippedDuplicates: duplicates,
      potentialOrders,
      marketingSkipped,
      otherSkipped,
      failed: fetchFailed + insertFailed,
      hasMore: !complete,
      connection: statusResult.rows[0] || null,
    };
  } catch (error) {
    if (error.deactivate && scannedConnectionId) {
      // Mark the unusable connection inactive so the UI offers "Connect" again
      await deactivateConnection(scannedConnectionId).catch(() => {});
    }
    throw error;
  }
};

// Scans every connected inbox of the company (Business / Pro plans allow several).
// Used by "Scan Now", right after connecting, and by the automatic background scan.
// Throws with a `status` (400 not connected / reconnect needed, 409 already scanning).
export const runGmailScan = async (companyId) => {
  if (scanningCompanies.has(companyId)) {
    throw Object.assign(new Error('A scan is already in progress, please wait'), { status: 409 });
  }
  scanningCompanies.add(companyId);

  try {
    const connResult = await query(
      `SELECT *,
         EXTRACT(EPOCH FROM ${LAST_SCAN_AT_SQL})::bigint AS last_scan_epoch,
         (EXTRACT(EPOCH FROM ${TOKEN_EXPIRY_SQL}) * 1000)::bigint AS token_expiry_ms
       FROM email_connections WHERE company_id = $1 AND is_active = true ORDER BY created_at DESC`,
      [companyId]
    );
    if (connResult.rows.length === 0) {
      throw Object.assign(new Error('Gmail is not connected. Connect your Gmail first.'), { status: 400 });
    }

    const results = [];
    const errors = [];
    for (const connection of connResult.rows) {
      try {
        results.push(await scanOneConnection(companyId, connection));
      } catch (error) {
        // One inbox failing (e.g. access revoked) must not stop the others
        errors.push({ email: connection.email, error });
      }
    }
    if (results.length === 0) throw errors[0].error;

    // Module 8: potential order emails are classified/extracted by AI in the background,
    // so the scan itself stays fast. Results appear in the AI Order Inbox.
    setImmediate(() => {
      processPendingGmailMessages(companyId).catch((err) =>
        console.error('Gmail AI processing failed:', err.message)
      );
    });

    const sum = (key) => results.reduce((total, r) => total + (r[key] || 0), 0);
    const hasMore = results.some((r) => r.hasMore);
    return {
      message: hasMore ? 'Partial scan: more emails remaining, scan again to continue' : 'Inbox scan completed',
      scanned: sum('scanned'),
      newMessages: sum('newMessages'),
      skippedDuplicates: sum('skippedDuplicates'),
      potentialOrders: sum('potentialOrders'),
      marketingSkipped: sum('marketingSkipped'),
      otherSkipped: sum('otherSkipped'),
      failed: sum('failed'),
      hasMore,
      // Newest inbox first (what the Integrations page shows); all inboxes in `connections`
      connection: results[0].connection,
      connections: results.map((r) => r.connection),
      errors: errors.map((e) => ({ email: e.email, message: e.error.message, code: e.error.code })),
    };
  } finally {
    scanningCompanies.delete(companyId);
  }
};

export const scanInbox = async (req, res) => {
  try {
    const result = await runGmailScan(req.user.company_id);
    res.json(result);
  } catch (error) {
    if (error.status === 400 || error.status === 409) {
      return res.status(error.status).json({ error: error.message, code: error.code });
    }
    console.error('Gmail scan error:', error.message);
    res.status(500).json({ error: `Failed to scan inbox: ${error.message}` });
  }
};

export const disconnectGmail = async (req, res, next) => {
  try {
    const { company_id } = req.user;
    const { id } = req.params;

    const result = await query(
      `UPDATE email_connections
       SET is_active = false, access_token = NULL, refresh_token = NULL, token_expiry = NULL, updated_at = NOW()
       WHERE id = $1 AND company_id = $2
       RETURNING id`,
      [id, company_id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Connection not found' });
    }

    await logAudit(req, 'gmail.disconnected', { entityType: 'email_connection', entityId: id });
    res.json({ message: 'Gmail disconnected successfully' });
  } catch (error) {
    next(error);
  }
};