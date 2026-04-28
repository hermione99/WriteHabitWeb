import { randomBytes } from 'node:crypto';
import { mkdir } from 'node:fs/promises';
import { dirname, extname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Router } from 'express';
import multer from 'multer';
import { authenticate } from '../middleware/authenticate.js';
import { badRequest } from '../lib/httpError.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
export const UPLOADS_ROOT = resolve(__dirname, '../../uploads');
const AVATAR_DIR = resolve(UPLOADS_ROOT, 'avatars');

await mkdir(AVATAR_DIR, { recursive: true });

const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);

const avatarStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, AVATAR_DIR),
  filename: (req, file, cb) => {
    const ext = extname(file.originalname).toLowerCase().replace(/[^.a-z0-9]/g, '') || '.jpg';
    const id = randomBytes(8).toString('hex');
    cb(null, `${req.user.id}-${Date.now()}-${id}${ext}`);
  },
});

const avatarUpload = multer({
  storage: avatarStorage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!ALLOWED_MIME.has(file.mimetype)) {
      cb(badRequest('지원하지 않는 이미지 형식입니다. (JPG/PNG/WebP/GIF)'));
      return;
    }
    cb(null, true);
  },
});

export const uploadsRouter = Router();

uploadsRouter.post(
  '/uploads/avatar',
  authenticate,
  (req, res, next) => {
    avatarUpload.single('file')(req, res, (err) => {
      if (err) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          next(badRequest('이미지는 5MB 이하만 업로드 가능합니다.'));
          return;
        }
        next(err);
        return;
      }
      if (!req.file) {
        next(badRequest('파일이 첨부되지 않았습니다.'));
        return;
      }
      const url = `/uploads/avatars/${req.file.filename}`;
      res.json({ url });
    });
  }
);
