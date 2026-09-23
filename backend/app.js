import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import path from 'path';
import { fileURLToPath } from 'url';
import config from './config/environment.js';
import authRoutes from './routes/auth.js';
import { errorHandler } from './middleware/errorHandler.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

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
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { error: 'Too many requests, please try again later' },
});
app.use('/api/', limiter);

app.use('/api/auth', authRoutes);
import companyRoutes from './routes/company.js';
app.use('/api/company', companyRoutes);
import integrationRoutes from './routes/integration.js';
app.use('/api/integration', integrationRoutes);
import teamRoutes from './routes/team.js';
app.use('/api/team', teamRoutes);
import notificationRoutes from './routes/notifications.js';
app.use('/api/notifications', notificationRoutes);

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.get('/api/config/google', (req, res) => {
  res.json({ clientId: config.google.clientId || null });
});

// Frontend is deployed separately, so we don't serve static files here.
app.use(errorHandler);

export default app;
