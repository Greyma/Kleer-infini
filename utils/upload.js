const AWS = require('aws-sdk');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
require('dotenv').config();

// Configuration AWS S3
const s3 = new AWS.S3({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION
});

// Configuration multer pour l'upload temporaire
const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
  // Types de fichiers autorisés
  const allowedTypes = [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'image/jpeg',
    'image/png',
    'image/jpg'
  ];

  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Type de fichier non autorisé. Seuls PDF, DOC, DOCX, JPG, PNG sont acceptés.'), false);
  }
};

const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB max
  }
});

// Upload vers S3
const uploadToS3 = async (file, folder = 'general') => {
  try {
    const fileExtension = path.extname(file.originalname);
    const fileName = `${folder}/${uuidv4()}${fileExtension}`;

    const params = {
      Bucket: process.env.AWS_S3_BUCKET,
      Key: fileName,
      Body: file.buffer,
      ContentType: file.mimetype,
      ACL: 'private' // Fichiers privés par défaut
    };

    const result = await s3.upload(params).promise();
    
    return {
      url: result.Location,
      key: result.Key,
      fileName: file.originalname,
      size: file.size,
      mimeType: file.mimetype
    };
  } catch (error) {
    console.error('Erreur upload S3:', error);
    throw new Error('Erreur lors de l\'upload du fichier');
  }
};

// Supprimer un fichier de S3
const deleteFromS3 = async (key) => {
  try {
    const params = {
      Bucket: process.env.AWS_S3_BUCKET,
      Key: key
    };

    await s3.deleteObject(params).promise();
    return true;
  } catch (error) {
    console.error('Erreur suppression S3:', error);
    throw new Error('Erreur lors de la suppression du fichier');
  }
};

// Générer une URL signée pour accéder à un fichier privé
const getSignedUrl = async (key, expiresIn = 3600) => {
  try {
    const params = {
      Bucket: process.env.AWS_S3_BUCKET,
      Key: key,
      Expires: expiresIn
    };

    return await s3.getSignedUrlPromise('getObject', params);
  } catch (error) {
    console.error('Erreur génération URL signée:', error);
    throw new Error('Erreur lors de la génération de l\'URL');
  }
};

// Upload spécifique pour les CV
const uploadCV = upload.single('cv');

// Upload spécifique pour les diplômes
const uploadDiplome = upload.single('diplome');

// Upload spécifique pour les documents d'entreprise
const uploadDocument = upload.single('document');

// Upload multiple pour les documents
const uploadMultiple = upload.array('documents', 5); // Max 5 fichiers

module.exports = {
  upload,
  uploadToS3,
  deleteFromS3,
  getSignedUrl,
  uploadCV,
  uploadDiplome,
  uploadDocument,
  uploadMultiple
}; 