import React, { useEffect, useState } from 'react';
import { getCookieConsent, setCookieConsent } from '../utils/cookieManager';

const CookieConsent = () => {
  const [showBanner, setShowBanner] = useState(false);

  useEffect(() => {
    // Check if user has already given consent
    const hasConsent = getCookieConsent();
    if (hasConsent === undefined) {
      setShowBanner(true);
    }
  }, []);

  const handleAccept = () => {
    setCookieConsent(true);
    setShowBanner(false);
  };

  const handleDecline = () => {
    setCookieConsent(false);
    setShowBanner(false);
  };

  if (!showBanner) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 shadow-lg z-50">
      <div className="max-w-7xl mx-auto px-4 py-6 sm:px-6 lg:px-8">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex-1">
            <p className="text-base text-gray-700">
              Kami menggunakan cookies untuk meningkatkan pengalaman Anda di website kami. 
              Dengan menggunakan website ini, Anda menyetujui penggunaan cookies sesuai dengan kebijakan privasi kami.
            </p>
          </div>
          <div className="flex gap-4">
            <button
              onClick={handleDecline}
              className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
            >
              Tolak
            </button>
            <button
              onClick={handleAccept}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-900 hover:bg-blue-800"
            >
              Setuju
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CookieConsent; 