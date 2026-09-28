import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import path from 'path';
import { fileURLToPath } from 'url';

import config from './config/environment.js';
import authRoutes from './routes/auth.js';
import companyRoutes from './routes/company.js';
import integrationRoutes from './routes/integration.js';
import ordersRoutes from './routes/orders.js';
import teamRoutes from './routes/team.js';
import notificationRoutes from './routes/notifications.js';
import aiInboxRoutes from './routes/aiInbox.js';
import shipmentRoutes from './routes/shipments.js';
import documentRoutes from './routes/documents.js';
import dashboardRoutes from './routes/dashboard.js';
import billingRoutes from './routes/billing.js';
import auditRoutes from './routes/audit.js';
import alertRoutes from './routes/alerts.js';

import { errorHandler } from './middleware/errorHandler.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// Behind a hosting proxy (Render etc.) so rate limits see the real client IP
if (config.nodeEnv === 'production') app.set('trust proxy', 1);

// Production: always use HTTPS (the hosting proxy terminates TLS and sets x-forwarded-proto)
if (config.nodeEnv === 'production') {
  app.use((req, res, next) => {
    if (req.headers['x-forwarded-proto'] === 'http') {
      return res.redirect(301, `https://${req.headers.host}${req.originalUrl}`);
    }
    next();
  });
}

app.use(helmet({
  contentSecurityPolicy: config.nodeEnv === 'production' ? false : true,
}));

const allowedOrigins = [
  config.frontendUrl.replace(/\/$/, ''),
  config.frontendUrl.replace(/\/$/, '') + '/',
  'http://localhost:5173'
];

app.use(cors({
  origin: allowedOrigins,
  credentials: true,
}));

app.use(express.json({
  limit: '10mb',
  // Razorpay webhooks are verified against the exact raw request body
  verify: (req, res, buf) => {
    if (req.originalUrl.startsWith('/api/billing/webhook')) req.rawBody = buf;
  },
}));

app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { error: 'Too many requests, please try again later' },
});

app.use('/api/', limiter);

app.use('/api/auth', authRoutes);
app.use('/api/company', companyRoutes);
app.use('/api/integration', integrationRoutes);
app.use('/api/orders', ordersRoutes);
app.use('/api/team', teamRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/ai-inbox', aiInboxRoutes);
app.use('/api/shipments', shipmentRoutes);
app.use('/api/documents', documentRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/billing', billingRoutes);
app.use('/api/audit-logs', auditRoutes);
app.use('/api/alerts', alertRoutes);
import reportRoutes from './routes/reports.js';
app.use('/api/reports', reportRoutes);

app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString()
  });
});

app.get('/api/config/google', (req, res) => {
  res.json({
    clientId: config.google.clientId || null
  });
});

// Frontend is deployed separately, so we don't serve static files here.
app.use(errorHandler);

export default app;
