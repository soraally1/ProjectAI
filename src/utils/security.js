import CryptoJS from 'crypto-js';

// Get encryption key from environment or generate a fallback
const getSecretKey = () => {
  // Try to get from window.__ENV__ if it exists (can be set in index.html)
  const envKey = window.__ENV__?.REACT_APP_ENCRYPTION_KEY;
  
  if (envKey) return envKey;
  
  // If no environment key, generate a session-based key
  let sessionKey = sessionStorage.getItem('app_secret_key');
  
  if (!sessionKey) {
    // Generate a random key if none exists
    sessionKey = CryptoJS.lib.WordArray.random(32).toString();
    sessionStorage.setItem('app_secret_key', sessionKey);
  }
  
  return sessionKey;
};

const SECRET_KEY = getSecretKey();

// Encrypt data before storing
export const encryptData = (data) => {
  try {
    return CryptoJS.AES.encrypt(JSON.stringify(data), SECRET_KEY).toString();
  } catch (error) {
    console.error('Encryption error:', error);
    return null;
  }
};

// Decrypt data after retrieving
export const decryptData = (encryptedData) => {
  try {
    const bytes = CryptoJS.AES.decrypt(encryptedData, SECRET_KEY);
    return JSON.parse(bytes.toString(CryptoJS.enc.Utf8));
  } catch (error) {
    console.error('Decryption error:', error);
    return null;
  }
};

// Generate a secure session token
export const generateSessionToken = () => {
  return CryptoJS.lib.WordArray.random(32).toString();
};

// Validate token format
export const isValidToken = (token) => {
  const tokenRegex = /^[a-zA-Z0-9+/=_-]{44,}$/;
  return tokenRegex.test(token);
};

// Hash sensitive data
export const hashData = (data) => {
  return CryptoJS.SHA256(data).toString();
};

// Create tamper-proof signature
export const createSignature = (data) => {
  const timestamp = new Date().getTime();
  return {
    data,
    timestamp,
    signature: CryptoJS.HmacSHA256(`${JSON.stringify(data)}${timestamp}`, SECRET_KEY).toString()
  };
};

// Verify data signature
export const verifySignature = (signedData) => {
  const { data, timestamp, signature } = signedData;
  const expectedSignature = CryptoJS.HmacSHA256(`${JSON.stringify(data)}${timestamp}`, SECRET_KEY).toString();
  return signature === expectedSignature;
}; 