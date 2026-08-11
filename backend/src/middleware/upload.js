const multer = require('multer');
const path = require('path');
const crypto = require('crypto');
const fs = require('fs');

// Local-disk storage, backed by a named Docker volume (see docker-compose.yml's backend_uploads
// volume) so files survive container restarts. Fine for pilot scale; migrate to real object
// storage (S3/Cloudinary/etc.) before production traffic - the model only stores a relative
// `attachment.url`, so that migration only touches this file and the static-serving route in
// index.js, not any stored data.
const UPLOAD_DIR = path.join(__dirname, '..', '..', 'uploads', 'group-attachments');
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const ALLOWED_MIME_TYPES = {
  image: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
  video: ['video/mp4', 'video/quicktime', 'video/webm']
};
const ALL_ALLOWED_MIME_TYPES = [...ALLOWED_MIME_TYPES.image, ...ALLOWED_MIME_TYPES.video];

// 20MB covers a phone photo or a short video clip without letting a pilot-scale volume mount
// fill up on a handful of large uploads.
const MAX_FILE_SIZE_BYTES = 20 * 1024 * 1024;

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    // Random filename, not the client-supplied one - avoids path traversal and collisions;
    // the original name is preserved separately in GroupMessage.attachment.fileName for display.
    const randomName = crypto.randomBytes(16).toString('hex');
    cb(null, `${randomName}${path.extname(file.originalname).slice(0, 10)}`);
  }
});

function fileFilter(req, file, cb) {
  if (!ALL_ALLOWED_MIME_TYPES.includes(file.mimetype)) {
    return cb(new Error('Only JPEG/PNG/GIF/WebP images or MP4/MOV/WebM videos are allowed'));
  }
  cb(null, true);
}

const uploadGroupAttachment = multer({
  storage,
  fileFilter,
  limits: { fileSize: MAX_FILE_SIZE_BYTES }
}).single('file');

function attachmentTypeFromMime(mimeType) {
  if (ALLOWED_MIME_TYPES.image.includes(mimeType)) return 'image';
  if (ALLOWED_MIME_TYPES.video.includes(mimeType)) return 'video';
  return null;
}

module.exports = { uploadGroupAttachment, attachmentTypeFromMime, UPLOAD_DIR, MAX_FILE_SIZE_BYTES };
