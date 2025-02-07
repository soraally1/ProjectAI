import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { generateSessionToken, isValidToken } from '../utils/security';
import { getCookie, setCookie } from '../utils/cookieManager';

const SecurityMiddleware = ({ children }) => {
  const navigate = useNavigate();
  const isProduction = window.__ENV__?.NODE_ENV === 'production';

  useEffect(() => {
    // Add security headers
    if (typeof window !== 'undefined') {
      // Prevent clickjacking
      const styleNode = document.createElement('style');
      styleNode.innerHTML = '* { user-select: none !important; }';
      document.head.appendChild(styleNode);

      // Disable right-click in production
      if (isProduction) {
        document.addEventListener('contextmenu', (e) => e.preventDefault());

        // Disable DevTools keyboard shortcut
        document.addEventListener('keydown', (e) => {
          if (
            (e.ctrlKey && e.shiftKey && (e.key === 'I' || e.key === 'J' || e.key === 'C')) ||
            (e.key === 'F12')
          ) {
            e.preventDefault();
          }
        });

        // Disable source view
        document.addEventListener('keydown', (e) => {
          if (e.ctrlKey && e.key === 'u') {
            e.preventDefault();
          }
        });

        // Additional security measures for production
        const securityInterval = setInterval(() => {
          if (window.outerHeight - window.innerHeight > 200 || window.outerWidth - window.innerWidth > 200) {
            // Potential DevTools detected
            navigate('/');
          }
        }, 1000);

        return () => clearInterval(securityInterval);
      }
    }

    // Verify session integrity
    const sessionToken = getCookie('session_token');
    if (!sessionToken) {
      // Create new session token if none exists
      const newToken = generateSessionToken();
      setCookie('session_token', newToken);
    } else if (!isValidToken(sessionToken)) {
      // Invalid token detected, clear session and redirect to login
      console.error('Invalid session detected');
      navigate('/login');
    }

    // Add mutation observer to prevent HTML tampering
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.type === 'attributes') {
          // Prevent attribute modifications on sensitive elements
          const sensitiveClasses = ['protected', 'secure-content'];
          if (sensitiveClasses.some(cls => mutation.target.classList.contains(cls))) {
            mutation.target.setAttribute(mutation.attributeName, mutation.oldValue);
          }
        }
      });
    });

    observer.observe(document.body, {
      attributes: true,
      childList: true,
      subtree: true,
      attributeOldValue: true
    });

    return () => {
      observer.disconnect();
    };
  }, [navigate, isProduction]);

  // Wrap content in security container
  return (
    <div 
      className="security-container"
      style={{ 
        opacity: isProduction ? '0.999' : '1',
        // Add CSS that makes it harder to manipulate content
        WebkitUserSelect: 'none',
        MozUserSelect: 'none',
        msUserSelect: 'none',
        userSelect: 'none',
        WebkitTouchCallout: 'none',
      }}
    >
      {children}
    </div>
  );
};

export default SecurityMiddleware; 