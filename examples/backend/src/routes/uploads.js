const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { db, utils } = require('../data/db');
const { verifyToken } = require('../middleware/auth');
const router = express.Router();

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../../uploads');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    // Generate a unique filename
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    cb(null, file.fieldname + '-' + uniqueSuffix + ext);
  },
});

// File filter
const fileFilter = (req, file, cb) => {
  // Accept images, PDFs, and text files
  if (
    file.mimetype.startsWith('image/') ||
    file.mimetype === 'application/pdf' ||
    file.mimetype === 'text/plain'
  ) {
    cb(null, true);
  } else {
    cb(new Error('Unsupported file type. Only images, PDFs, and text files are allowed.'), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
});

/**
 * @route   POST /api/uploads/single
 * @desc    Upload a single file
 * @access  Private
 */
router.post('/single', verifyToken, upload.single('file'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({
      error: 'Upload Error',
      message: 'No file uploaded or invalid file type',
    });
  }

  // Create a file record
  const fileRecord = {
    id: utils.generateId(),
    originalName: req.file.originalname,
    fileName: req.file.filename,
    filePath: req.file.path,
    fileSize: req.file.size,
    mimeType: req.file.mimetype,
    uploadedBy: req.user.id,
    uploadedAt: utils.now(),
  };

  // Save to database
  db.uploads.push(fileRecord);

  // Generate public URL
  const fileUrl = `${req.protocol}://${req.get('host')}/uploads/${req.file.filename}`;

  res.status(201).json({
    message: 'File uploaded successfully',
    file: {
      ...fileRecord,
      url: fileUrl,
    },
  });
});

/**
 * @route   POST /api/uploads/multiple
 * @desc    Upload multiple files (up to 5)
 * @access  Private
 */
router.post('/multiple', verifyToken, upload.array('files', 5), (req, res) => {
  if (!req.files || req.files.length === 0) {
    return res.status(400).json({
      error: 'Upload Error',
      message: 'No files uploaded or invalid file types',
    });
  }

  const uploadedFiles = req.files.map((file) => {
    // Create a file record
    const fileRecord = {
      id: utils.generateId(),
      originalName: file.originalname,
      fileName: file.filename,
      filePath: file.path,
      fileSize: file.size,
      mimeType: file.mimetype,
      uploadedBy: req.user.id,
      uploadedAt: utils.now(),
    };

    // Generate public URL
    const fileUrl = `${req.protocol}://${req.get('host')}/uploads/${file.filename}`;

    // Save to database
    db.uploads.push(fileRecord);

    return {
      ...fileRecord,
      url: fileUrl,
    };
  });

  res.status(201).json({
    message: `${uploadedFiles.length} files uploaded successfully`,
    files: uploadedFiles,
  });
});

/**
 * @route   GET /api/uploads
 * @desc    Get all uploads for current user
 * @access  Private
 */
router.get('/', verifyToken, (req, res) => {
  // Filter uploads by user
  const userUploads = db.uploads.filter((upload) => upload.uploadedBy === req.user.id);

  // Add URLs to each upload
  const uploadsWithUrls = userUploads.map((upload) => {
    const fileUrl = `${req.protocol}://${req.get('host')}/uploads/${upload.fileName}`;
    return {
      ...upload,
      url: fileUrl,
    };
  });

  res.json(uploadsWithUrls);
});

/**
 * @route   DELETE /api/uploads/:id
 * @desc    Delete a file upload
 * @access  Private
 */
router.delete('/:id', verifyToken, (req, res) => {
  // Find the upload
  const uploadIndex = db.uploads.findIndex(
    (upload) => upload.id === req.params.id && upload.uploadedBy === req.user.id,
  );

  if (uploadIndex === -1) {
    return res.status(404).json({
      error: 'Not Found',
      message: 'File not found or you do not have permission to delete it',
    });
  }

  const upload = db.uploads[uploadIndex];

  // Delete the file from disk
  try {
    fs.unlinkSync(upload.filePath);
  } catch (error) {
    console.error(`Error deleting file: ${error.message}`);
    // Continue even if file deletion fails (file might not exist on disk)
  }

  // Remove from database
  db.uploads.splice(uploadIndex, 1);

  res.json({
    message: 'File deleted successfully',
  });
});

/**
 * @route   POST /api/uploads/form
 * @desc    Upload a file with additional form data
 * @access  Private
 */
router.post('/form', verifyToken, upload.single('file'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({
      error: 'Upload Error',
      message: 'No file uploaded or invalid file type',
    });
  }

  // Create a file record with additional metadata
  const fileRecord = {
    id: utils.generateId(),
    originalName: req.file.originalname,
    fileName: req.file.filename,
    filePath: req.file.path,
    fileSize: req.file.size,
    mimeType: req.file.mimetype,
    uploadedBy: req.user.id,
    description: req.body.description || '',
    category: req.body.category || 'uncategorized',
    tags: req.body.tags ? req.body.tags.split(',').map((tag) => tag.trim()) : [],
    uploadedAt: utils.now(),
  };

  // Save to database
  db.uploads.push(fileRecord);

  // Generate public URL
  const fileUrl = `${req.protocol}://${req.get('host')}/uploads/${req.file.filename}`;

  res.status(201).json({
    message: 'File uploaded successfully with metadata',
    file: {
      ...fileRecord,
      url: fileUrl,
    },
  });
});

// Error handler for multer
router.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    // A Multer error occurred when uploading
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        error: 'File too large',
        message: 'File size exceeds the 5MB limit',
      });
    }
    return res.status(400).json({
      error: 'Upload Error',
      message: err.message,
    });
  } else if (err) {
    // An unknown error occurred
    return res.status(500).json({
      error: 'Server Error',
      message: err.message,
    });
  }
  next();
});

module.exports = router;
