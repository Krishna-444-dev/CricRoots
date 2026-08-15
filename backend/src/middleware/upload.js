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

// Same disk-storage/random-filename approach as group attachments above, in a separate
// directory with its own MIME allowlist - a tournament's house-rules reference document
// (PDF or Word doc), not user chat media.
const TOURNAMENT_DOC_DIR = path.join(__dirname, '..', '..', 'uploads', 'tournament-documents');
fs.mkdirSync(TOURNAMENT_DOC_DIR, { recursive: true });

const TOURNAMENT_DOC_MIME_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
];
// Plenty for a rules document (a scanned/image-heavy PDF would be unusual for this use case).
const MAX_DOC_SIZE_BYTES = 10 * 1024 * 1024;

const tournamentDocStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, TOURNAMENT_DOC_DIR),
  filename: (req, file, cb) => {
    const randomName = crypto.randomBytes(16).toString('hex');
    cb(null, `${randomName}${path.extname(file.originalname).slice(0, 10)}`);
  }
});

function tournamentDocFileFilter(req, file, cb) {
  if (!TOURNAMENT_DOC_MIME_TYPES.includes(file.mimetype)) {
    return cb(new Error('Only PDF or Word (.doc/.docx) documents are allowed'));
  }
  cb(null, true);
}

const uploadTournamentDocument = multer({
  storage: tournamentDocStorage,
  fileFilter: tournamentDocFileFilter,
  limits: { fileSize: MAX_DOC_SIZE_BYTES }
}).single('file');

// Same disk-storage/random-filename approach again, in its own directory - a match's Gallery
// tab (CricClubs' match-photos feature), image-only (no video, unlike group attachments above).
// Reuses ALLOWED_MIME_TYPES.image rather than redefining the allowlist a third time.
const MATCH_PHOTO_DIR = path.join(__dirname, '..', '..', 'uploads', 'match-photos');
fs.mkdirSync(MATCH_PHOTO_DIR, { recursive: true });

// Tighter than the 20MB image+video limit above - these are plain event photos (not videos,
// which drove that limit up), so 8MB comfortably covers a full-resolution phone photo without
// a handful of uploads filling up the volume mount as fast as the group-attachments case could.
const MAX_MATCH_PHOTO_SIZE_BYTES = 8 * 1024 * 1024;

const matchPhotoStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, MATCH_PHOTO_DIR),
  filename: (req, file, cb) => {
    const randomName = crypto.randomBytes(16).toString('hex');
    cb(null, `${randomName}${path.extname(file.originalname).slice(0, 10)}`);
  }
});

function matchPhotoFileFilter(req, file, cb) {
  if (!ALLOWED_MIME_TYPES.image.includes(file.mimetype)) {
    return cb(new Error('Only JPEG/PNG/GIF/WebP images are allowed'));
  }
  cb(null, true);
}

const uploadMatchPhoto = multer({
  storage: matchPhotoStorage,
  fileFilter: matchPhotoFileFilter,
  limits: { fileSize: MAX_MATCH_PHOTO_SIZE_BYTES }
}).single('file');

module.exports = {
  uploadGroupAttachment,
  attachmentTypeFromMime,
  UPLOAD_DIR,
  MAX_FILE_SIZE_BYTES,
  uploadTournamentDocument,
  MAX_DOC_SIZE_BYTES,
  uploadMatchPhoto,
  MATCH_PHOTO_DIR,
  MAX_MATCH_PHOTO_SIZE_BYTES
};
