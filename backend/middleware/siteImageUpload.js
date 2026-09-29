// Website Content images (e.g. testimonial photos): JPG / PNG / WEBP up to 2 MB,
// saved under uploads/site with a random name.
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const SITE_IMAGE_DIR = path.join(__dirname, '..', 'uploads', 'site');
fs.mkdirSync(SITE_IMAGE_DIR, { recursive: true });

export const SITE_IMAGE_TYPES = { '.jpg': 'jpg', '.jpeg': 'jpg', '.png': 'png', '.webp': 'webp' };
export const SITE_IMAGE_MAX_BYTES = 2 * 1024 * 1024;

const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, SITE_IMAGE_DIR),
    filename: (req, file, cb) => {
      const ext = SITE_IMAGE_TYPES[path.extname(file.originalname).toLowerCase()];
      cb(null, `${crypto.randomUUID()}.${ext}`);
    },
  }),
  limits: { fileSize: SITE_IMAGE_MAX_BYTES, files: 1 },
  fileFilter: (req, file, cb) => {
    if (!SITE_IMAGE_TYPES[path.extname(file.originalname).toLowerCase()]) {
      return cb(Object.assign(new Error('Please choose a JPG, PNG or WEBP image'), { status: 400 }));
    }
    cb(null, true);
  },
});

// Multer errors (too big, wrong type) become a clear 400 instead of a server error
export const siteImageUpload = (req, res, next) => {
  upload.single('image')(req, res, (err) => {
    if (!err) return next();
    const message = err.code === 'LIMIT_FILE_SIZE' ? 'The photo must be 2 MB or smaller' : err.message || 'Upload failed';
    return res.status(400).json({ message });
  });
};
