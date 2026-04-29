import { createHash, randomBytes } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, extname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Router } from 'express';
import multer from 'multer';
import { env } from '../config/env.js';
import { authenticate } from '../middleware/authenticate.js';
import { badRequest } from '../lib/httpError.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
export const UPLOADS_ROOT = resolve(__dirname, '../../uploads');
const AVATAR_DIR = resolve(UPLOADS_ROOT, 'avatars');

await mkdir(AVATAR_DIR, { recursive: true });

const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);

const avatarUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!ALLOWED_MIME.has(file.mimetype)) {
      cb(badRequest('지원하지 않는 이미지 형식입니다. (JPG/PNG/WebP/GIF)'));
      return;
    }
    cb(null, true);
  },
});

const hasCloudinaryConfig = () =>
  Boolean(env.cloudinaryCloudName && env.cloudinaryApiKey && env.cloudinaryApiSecret);

const buildFilename = (userId, originalName) => {
  const ext = extname(originalName).toLowerCase().replace(/[^.a-z0-9]/g, '') || '.jpg';
  const id = randomBytes(8).toString('hex');
  return `${userId}-${Date.now()}-${id}${ext}`;
};

const signCloudinaryParams = (params) => {
  const payload = Object.keys(params)
    .sort()
    .map((key) => `${key}=${params[key]}`)
    .join('&');
  return createHash('sha1')
    .update(`${payload}${env.cloudinaryApiSecret}`)
    .digest('hex');
};

const uploadToCloudinary = async ({ file, user }) => {
  const publicId = `${user.id}-${Date.now()}-${randomBytes(8).toString('hex')}`;
  const timestamp = Math.floor(Date.now() / 1000);
  const params = {
    folder: env.cloudinaryFolder,
    public_id: publicId,
    timestamp,
  };

  const body = new FormData();
  body.set('file', new Blob([file.buffer], { type: file.mimetype }), file.originalname);
  body.set('api_key', env.cloudinaryApiKey);
  body.set('folder', params.folder);
  body.set('public_id', params.public_id);
  body.set('timestamp', String(params.timestamp));
  body.set('signature', signCloudinaryParams(params));

  const response = await fetch(`https://api.cloudinary.com/v1_1/${env.cloudinaryCloudName}/image/upload`, {
    method: 'POST',
    body,
  });
  const data = await response.json().catch(() => ({}));

  if (!response.ok || !data.secure_url) {
    throw new Error(data.error?.message || 'Cloudinary upload failed');
  }

  return data.secure_url;
};

const saveToLocalUploads = async ({ file, user }) => {
  const filename = buildFilename(user.id, file.originalname);
  await writeFile(resolve(AVATAR_DIR, filename), file.buffer);
  return `/uploads/avatars/${filename}`;
};

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
      Promise.resolve()
        .then(() => hasCloudinaryConfig()
          ? uploadToCloudinary({ file: req.file, user: req.user })
          : saveToLocalUploads({ file: req.file, user: req.user }))
        .then((url) => {
          res.json({
            url,
            storage: hasCloudinaryConfig() ? 'cloudinary' : 'local',
          });
        })
        .catch(next);
    });
  }
);
