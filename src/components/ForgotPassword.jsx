import { useState, useCallback, useEffect } from 'react';
import { auth, db } from '../firebase';
import { sendPasswordResetEmail } from 'firebase/auth';
import { Link, useNavigate } from 'react-router-dom';
import { doc, getDoc } from 'firebase/firestore';
import iBRDLogo from '../assets/i-BRDSystem.svg';
import batikBg from '../assets/batik.svg';

const VALIDATION = {
  EMAIL_REGEX: /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/,
  SANITIZE_REGEX: /[<>{}]/g
};

const RESET_CONFIG = {
  COOLDOWN_DURATION: 60000, // 1 minute cooldown
  MAX_ATTEMPTS: 3,
  ATTEMPT_INTERVAL: 2000 // 2 seconds between attempts
};

const ForgotPassword = () => {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const [attempts, setAttempts] = useState(0);
  const [cooldownEndTime, setCooldownEndTime] = useState(null);
  const [timeLeft, setTimeLeft] = useState(0);
  const [lastAttemptTime, setLastAttemptTime] = useState(Date.now());
  const navigate = useNavigate();

  // Handle cooldown timer
  useEffect(() => {
    let timer;
    if (cooldownEndTime && timeLeft > 0) {
      timer = setInterval(() => {
        const newTimeLeft = Math.max(0, Math.ceil((cooldownEndTime - Date.now()) / 1000));
        setTimeLeft(newTimeLeft);
        
        if (newTimeLeft === 0) {
          setCooldownEndTime(null);
          setAttempts(0);
        }
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [cooldownEndTime, timeLeft]);

  // Input sanitization
  const sanitizeInput = useCallback((input) => {
    return input.replace(VALIDATION.SANITIZE_REGEX, '').trim();
  }, []);

  // Form validation
  const validateEmail = useCallback(() => {
    if (!email) {
      setError('Email wajib diisi');
      return false;
    }
    if (!VALIDATION.EMAIL_REGEX.test(email)) {
      setError('Masukkan alamat email yang valid');
      return false;
    }
    return true;
  }, [email]);

  // Handle form submission
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess(false);

    // Check attempt interval
    const timeSinceLastAttempt = Date.now() - lastAttemptTime;
    if (timeSinceLastAttempt < RESET_CONFIG.ATTEMPT_INTERVAL) {
      setError('Terlalu cepat. Mohon tunggu sebentar.');
      return;
    }
    setLastAttemptTime(Date.now());

    // Check cooldown
    if (cooldownEndTime && Date.now() < cooldownEndTime) {
      setError(`Silakan tunggu ${timeLeft} detik sebelum mencoba lagi.`);
      return;
    }

    if (!validateEmail()) return;

    setLoading(true);
    try {
      // Konfigurasi untuk reset password
      const actionCodeSettings = {
        // URL yang akan dibuka setelah user mengklik link di email
        url: `${window.location.origin}/reset-password`,
        // Mengizinkan password reset link untuk dihandle oleh aplikasi
        handleCodeInApp: true
      };

      // Kirim email reset password
      await sendPasswordResetEmail(auth, email, actionCodeSettings);
      
      setSuccess(true);
      setEmail('');
      
      // Start countdown to redirect
      setTimeout(() => {
        navigate('/login');
      }, 5000);
    } catch (error) {
      console.error('Error sending reset email:', error);
      const newAttempts = attempts + 1;
      setAttempts(newAttempts);

      if (newAttempts >= RESET_CONFIG.MAX_ATTEMPTS) {
        const endTime = Date.now() + RESET_CONFIG.COOLDOWN_DURATION;
        setCooldownEndTime(endTime);
        setTimeLeft(Math.ceil(RESET_CONFIG.COOLDOWN_DURATION / 1000));
        setError(`Terlalu banyak percobaan. Silakan tunggu ${Math.ceil(RESET_CONFIG.COOLDOWN_DURATION / 1000)} detik sebelum mencoba lagi.`);
      } else {
        switch (error.code) {
          case 'auth/user-not-found':
            setError('Email tidak terdaftar dalam sistem');
            break;
          case 'auth/invalid-email':
            setError('Format email tidak valid');
            break;
          case 'auth/too-many-requests':
            setError('Terlalu banyak permintaan. Silakan coba lagi nanti');
            break;
          default:
            setError('Terjadi kesalahan. Silakan coba lagi');
        }
      }
    } finally {
      setLoading(false);
    }
  };

  const isDisabled = loading || (cooldownEndTime && Date.now() < cooldownEndTime);

  return (
    <div className="min-h-screen bg-gray-50 flex justify-center">
      <div className="flex-1 flex flex-col justify-center py-12 px-4 sm:px-6 lg:max-w-[1024px]">
        <div className="mx-auto w-full max-w-sm lg:w-[480px]">
          <div className="flex flex-col items-center space-y-4">
            <Link to="/" className="transform hover:scale-105 transition-transform duration-200">
              <img className="h-20 w-auto" src={iBRDLogo} alt="i-BRD System" />
            </Link>
            <h2 className="text-3xl font-extrabold text-gray-900 text-center">
              Lupa Kata Sandi?
            </h2>
            <p className="text-sm text-gray-600 text-center max-w-[320px]">
              Masukkan alamat email Anda dan kami akan mengirimkan tautan untuk mengatur ulang kata sandi
            </p>
          </div>
        </div>

        <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
          <div className="bg-white py-8 px-4 shadow-xl rounded-lg sm:px-10 border border-gray-100 relative overflow-hidden">
            {/* Progress bar during loading */}
            {loading && (
              <div className="absolute top-0 left-0 h-1 bg-blue-600 animate-progress w-full transform origin-left"></div>
            )}

            {success ? (
              <div className="space-y-6">
                <div className="rounded-md bg-green-50 p-4 animate-fadeIn">
                  <div className="flex">
                    <div className="flex-shrink-0">
                      <svg className="h-5 w-5 text-green-400" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                    </div>
                    <div className="ml-3">
                      <p className="text-sm font-medium text-green-800">
                        Tautan pengaturan ulang kata sandi telah dikirim ke email Anda
                      </p>
                    </div>
                  </div>
                </div>
                <p className="text-sm text-gray-500 text-center">
                  Anda akan dialihkan ke halaman login dalam {timeLeft || 5} detik
                </p>
                <div className="flex justify-center">
                  <Link
                    to="/login"
                    className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-900 hover:bg-blue-800 transition-colors duration-200"
                  >
                    Kembali ke Login
                  </Link>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-6">
                {error && (
                  <div className="rounded-md bg-red-50 p-4 animate-fadeIn">
                    <div className="flex">
                      <div className="flex-shrink-0">
                        <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                        </svg>
                      </div>
                      <div className="ml-3">
                        <p className="text-sm text-red-700">{error}</p>
                      </div>
                    </div>
                  </div>
                )}

                <div className="space-y-1">
                  <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                    Alamat Email
                  </label>
                  <div className="mt-1 relative rounded-md shadow-sm">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <svg className="h-5 w-5 text-gray-400" viewBox="0 0 20 20" fill="currentColor">
                        <path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z" />
                        <path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z" />
                      </svg>
                    </div>
                    <input
                      id="email"
                      name="email"
                      type="email"
                      autoComplete="email"
                      required
                      value={email}
                      onChange={(e) => {
                        setEmail(sanitizeInput(e.target.value));
                        setError('');
                      }}
                      className={`appearance-none block w-full pl-10 pr-3 py-2 border ${
                        error ? 'border-red-300 focus:ring-red-500 focus:border-red-500' : 'border-gray-300 focus:ring-blue-500 focus:border-blue-500'
                      } rounded-md shadow-sm placeholder-gray-400 focus:outline-none sm:text-sm transition-colors duration-200`}
                      placeholder="Masukkan alamat email Anda"
                      disabled={isDisabled}
                    />
                  </div>
                </div>

                <div>
                  <button
                    type="submit"
                    disabled={isDisabled}
                    className={`w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white transition-all duration-200 ${
                      isDisabled
                        ? 'bg-gray-400 cursor-not-allowed'
                        : 'bg-blue-900 hover:bg-blue-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transform hover:-translate-y-0.5'
                    }`}
                  >
                    {loading ? (
                      <div className="flex items-center">
                        <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Mengirim...
                      </div>
                    ) : cooldownEndTime && Date.now() < cooldownEndTime ? (
                      <div className="flex items-center">
                        <svg className="animate-pulse -ml-1 mr-3 h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        Tunggu {timeLeft}s
                      </div>
                    ) : (
                      'Kirim Tautan Reset'
                    )}
                  </button>
                </div>

                <div className="text-center">
                  <Link
                    to="/login"
                    className="inline-flex items-center text-sm font-medium text-blue-900 hover:text-blue-800 transition-colors duration-200"
                  >
                    <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                    </svg>
                    Kembali ke halaman login
                  </Link>
                </div>
              </form>
            )}
          </div>
        </div>
      </div>

      {/* Batik Background */}
      <div 
        className="fixed inset-0 pointer-events-none opacity-15 transition-opacity duration-1000"
        style={{
          backgroundImage: `url(${batikBg})`,
          backgroundSize: 'contain',
          backgroundPosition: 'right',
          backgroundRepeat: 'no-repeat'
        }}
      />
    </div>
  );
};

export default ForgotPassword; 