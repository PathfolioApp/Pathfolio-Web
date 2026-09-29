const multer = require('multer');

const MAX_RESUME_SIZE = 10 * 1024 * 1024; // 10MB

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_RESUME_SIZE },
  fileFilter: (_req, file, cb) => {
    const isPdf = file.mimetype === 'application/pdf' && /\.pdf$/i.test(file.originalname || '');
    if (!isPdf) {
      const err = new Error('Only PDF resumes are allowed');
      err.statusCode = 400;
      return cb(err);
    }
    cb(null, true);
  },
});

module.exports = {
  resumeUpload: upload.single('file'),
  MAX_RESUME_SIZE,
};
