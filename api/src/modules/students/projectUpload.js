const multer = require('multer');

const MAX_DOCUMENT_SIZE = 10 * 1024 * 1024; // 10MB

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_DOCUMENT_SIZE },
  fileFilter: (_req, file, cb) => {
    const isPdf = 
      file.mimetype === 'application/pdf' ||
      /\.pdf$/i.test(file.originalname || '');
    if (!isPdf) {
      const err = new Error('Only PDF documents are allowed for project attachments.');
      err.statusCode = 400;
      return cb(err);
    }
    cb(null, true);
  },
});

module.exports = {
  projectUpload: upload.single('file'),
  MAX_DOCUMENT_SIZE,
};
