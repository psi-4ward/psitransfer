const { hash, verify, Algorithm } = require('@node-rs/argon2');
const { timingSafeEqual } = require('node:crypto');

function isArgon2Hash(value) {
  return typeof value === 'string' && value.startsWith('$argon2');
}

function safeEqualUtf8(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const aBuf = Buffer.from(a, 'utf8');
  const bBuf = Buffer.from(b, 'utf8');
  if (aBuf.length !== bBuf.length) return false;
  return timingSafeEqual(aBuf, bBuf);
}

async function hashPassword(password) {
  // Keep parameters modest for broad hardware support (incl. Raspberry Pi),
  // while still using Argon2id.
  return hash(password, {
    algorithm: Algorithm.Argon2id,
    timeCost: 3,
    memoryCost: 8192, // KiB (8 MiB)
    parallelism: 1,
    outputLen: 32,
  });
}

async function verifyPassword(stored, provided) {
  const pass = typeof provided === 'string' ? provided : '';

  if (isArgon2Hash(stored)) {
    try {
      return await verify(stored, pass);
    } catch {
      return false;
    }
  }

  // Backward compatibility: legacy plaintext stored in metadata JSON.
  return safeEqualUtf8(String(stored ?? ''), pass);
}

module.exports = {
  isArgon2Hash,
  hashPassword,
  verifyPassword,
};

