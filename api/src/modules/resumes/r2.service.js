const {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} = require('@aws-sdk/client-s3');
const { Readable } = require('stream');
const config = require('../../config');

// In-memory fallback for local development or testing when Cloudflare R2 credentials are not set
const memoryStore = new Map();

function isConfigured() {
  return Boolean(config.r2 && config.r2.configured);
}

function isAvailable() {
  return isConfigured() || config.nodeEnv !== 'production';
}

function getEndpoint() {
  if (config.r2.endpoint) return config.r2.endpoint;
  if (config.r2.accountId) return `https://${config.r2.accountId}.r2.cloudflarestorage.com`;
  return undefined;
}

let s3ClientInstance = null;

function getClient() {
  if (!isConfigured()) {
    const error = new Error('Cloudflare R2 is not configured');
    error.statusCode = 503;
    throw error;
  }

  if (!s3ClientInstance) {
    s3ClientInstance = new S3Client({
      region: config.r2.region || 'auto',
      endpoint: getEndpoint(),
      credentials: {
        accessKeyId: config.r2.accessKeyId,
        secretAccessKey: config.r2.secretAccessKey,
      },
    });
  }

  return s3ClientInstance;
}

const getBucket = () => config.r2.bucket;

async function uploadFile(buffer, key, contentType = 'application/pdf') {
  if (isConfigured()) {
    const client = getClient();
    await client.send(
      new PutObjectCommand({
        Bucket: getBucket(),
        Key: key,
        Body: buffer,
        ContentType: contentType,
      })
    );
  } else {
    // Memory fallback for development/test
    memoryStore.set(key, { buffer, contentType });
  }
  return { key };
}

async function getFile(key) {
  if (isConfigured()) {
    const client = getClient();
    return client.send(
      new GetObjectCommand({
        Bucket: getBucket(),
        Key: key,
      })
    );
  }

  const item = memoryStore.get(key);
  if (!item) return { Body: null };

  return {
    Body: Readable.from(item.buffer),
    ContentType: item.contentType,
    ContentLength: item.buffer.length,
  };
}

async function deleteFile(key) {
  if (isConfigured()) {
    try {
      const client = getClient();
      await client.send(
        new DeleteObjectCommand({
          Bucket: getBucket(),
          Key: key,
        })
      );
    } catch (_) {}
  } else {
    memoryStore.delete(key);
  }
}

module.exports = {
  isConfigured,
  isAvailable,
  uploadFile,
  getFile,
  deleteFile,
};
