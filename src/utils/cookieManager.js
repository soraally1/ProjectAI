import Cookies from 'js-cookie';
import { encryptData, decryptData, createSignature, verifySignature } from './security';

// Cookie configuration defaults
const COOKIE_DEFAULTS = {
  expires: 365, // days
  path: '/',
  secure: true, // Always use secure cookies
  sameSite: 'Strict', // Enhanced security
  httpOnly: true // When possible
};

// Set a cookie with encryption for sensitive data
export const setCookie = (name, value, options = {}) => {
  const encryptedValue = encryptData(value);
  const signedData = createSignature(encryptedValue);
  Cookies.set(name, JSON.stringify(signedData), { ...COOKIE_DEFAULTS, ...options });
};

// Get a cookie and verify its integrity
export const getCookie = (name) => {
  try {
    const cookie = Cookies.get(name);
    if (!cookie) return null;

    const signedData = JSON.parse(cookie);
    if (!verifySignature(signedData)) {
      console.error('Cookie tampering detected');
      removeCookie(name);
      return null;
    }

    return decryptData(signedData.data);
  } catch (error) {
    console.error('Error reading cookie:', error);
    return null;
  }
};

// Remove a cookie
export const removeCookie = (name, options = {}) => {
  Cookies.remove(name, { ...COOKIE_DEFAULTS, ...options });
};

// Check if cookie exists
export const hasCookie = (name) => {
  return !!getCookie(name);
};

// Set cookie consent with encryption
export const setCookieConsent = (consented) => {
  setCookie('cookie_consent', consented ? 'true' : 'false');
};

// Get cookie consent status
export const getCookieConsent = () => {
  return getCookie('cookie_consent') === 'true';
};

// Set user preferences with encryption
export const setUserPreferences = (preferences) => {
  setCookie('user_preferences', preferences);
};

// Get user preferences
export const getUserPreferences = () => {
  const preferences = getCookie('user_preferences');
  return preferences || null;
}; 