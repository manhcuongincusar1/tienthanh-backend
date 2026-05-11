// CloudFront signed URL helper — DECISIONS D4.
// Dùng cho file private. Public file đi CDN cache thường, không qua đây.
//
// Env vars cần set khi deploy (S4):
//  CF_DOMAIN          = 'https://tienthanhcdn.datviet.ai'
//  CF_KEY_PAIR_ID     = '<CloudFront public key id>'
//  CF_PRIVATE_KEY     = '<RSA private key PEM, nguyên dấu \n>'
//
// Khi env thiếu (local dev) → throw để caller biết phải fallback presignGet.

const AWS = require('aws-sdk');

const CF_DOMAIN = process.env.CF_DOMAIN || 'https://tienthanhcdn.datviet.ai';

function getSigner() {
  const keyPairId = process.env.CF_KEY_PAIR_ID;
  const privateKey = process.env.CF_PRIVATE_KEY;
  if (!keyPairId || !privateKey) {
    return null;
  }
  return new AWS.CloudFront.Signer(keyPairId, privateKey);
}

exports.isConfigured = () => getSigner() !== null;

// Sign URL cho 1 resource — TTL ngắn (5 phút default).
exports.signUrl = ({path, expiresInSec = 300}) => {
  const signer = getSigner();
  if (!signer) {
    throw new Error('cloudfront_signer_not_configured');
  }
  // Path prefix /_signed/... per DECISIONS D4.
  const url = `${CF_DOMAIN}/_signed${path.startsWith('/') ? path : '/' + path}`;
  const expires = Math.floor(Date.now() / 1000) + expiresInSec;
  return new Promise((resolve, reject) => {
    signer.getSignedUrl({url, expires}, (err, signed) => {
      if (err) return reject(err);
      resolve(signed);
    });
  });
};

exports.CF_DOMAIN = CF_DOMAIN;
