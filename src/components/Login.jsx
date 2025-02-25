import { useState, useEffect, useCallback, useMemo } from 'react';
import { auth, db } from '../firebase';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { Link, useNavigate } from 'react-router-dom';
import { doc, getDoc } from 'firebase/firestore';
import { encryptData, hashData } from '../utils/security';
import { setCookie } from '../utils/cookieManager';
import iBRDLogo from '../assets/i-BRDSystem.svg';
import batikBg from '../assets/batik.svg';

// Security constants
const SECURITY_CONFIG = {
  MAX_LOGIN_ATTEMPTS: 3,
  COOLDOWN_DURATION: 10000, // 10 seconds
  MIN_ATTEMPT_INTERVAL: 2000, // 2 seconds between attempts
  PASSWORD_MIN_LENGTH: 6,
  SESSION_STORAGE_KEYS: {
    LOGIN_ATTEMPTS: 'loginAttempts',
    COOLDOWN_END_TIME: 'cooldownEndTime',
    SECURITY_EVENTS: 'securityEvents'
  }
};

// Form validation constants
const VALIDATION = {
  EMAIL_REGEX: /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/,
  SANITIZE_REGEX: /[<>{}]/g
};

const Login = () => {
  const [formData, setFormData] = useState({ email: '', password: '' });
  const [errors, setErrors] = useState({});
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loginAttempts, setLoginAttempts] = useState(0);
  const [cooldownEndTime, setCooldownEndTime] = useState(null);
  const [timeLeft, setTimeLeft] = useState(0);
  const [lastAttemptTime, setLastAttemptTime] = useState(Date.now());
  const [rememberMe, setRememberMe] = useState(false);
  const navigate = useNavigate();

  // Memoized form state
  const isFormDisabled = useMemo(() => 
    loading || (cooldownEndTime && Date.now() < cooldownEndTime),
    [loading, cooldownEndTime]
  );

  // Load previous security state
  useEffect(() => {
    const loadSecurityState = () => {
      const { LOGIN_ATTEMPTS, COOLDOWN_END_TIME } = SECURITY_CONFIG.SESSION_STORAGE_KEYS;
      const storedAttempts = sessionStorage.getItem(LOGIN_ATTEMPTS);
      const storedCooldown = sessionStorage.getItem(COOLDOWN_END_TIME);
      
      if (storedAttempts) {
        setLoginAttempts(parseInt(storedAttempts));
      }
      
      if (storedCooldown) {
        const endTime = parseInt(storedCooldown);
        if (Date.now() < endTime) {
          setCooldownEndTime(endTime);
          setTimeLeft(Math.ceil((endTime - Date.now()) / 1000));
        } else {
          clearSecurityState();
        }
      }
    };

    loadSecurityState();
  }, []);

  // Cooldown timer
  useEffect(() => {
    let timer;
    if (cooldownEndTime && timeLeft > 0) {
      timer = setInterval(() => {
        const newTimeLeft = Math.max(0, Math.ceil((cooldownEndTime - Date.now()) / 1000));
        setTimeLeft(newTimeLeft);
        
        if (newTimeLeft === 0) {
          clearSecurityState();
        }
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [cooldownEndTime, timeLeft]);

  // Clear security state
  const clearSecurityState = useCallback(() => {
    const { LOGIN_ATTEMPTS, COOLDOWN_END_TIME } = SECURITY_CONFIG.SESSION_STORAGE_KEYS;
    setCooldownEndTime(null);
    setLoginAttempts(0);
    sessionStorage.removeItem(LOGIN_ATTEMPTS);
    sessionStorage.removeItem(COOLDOWN_END_TIME);
  }, []);

  // Enhanced input sanitization
  const sanitizeInput = useCallback((input) => {
    return input.replace(VALIDATION.SANITIZE_REGEX, '').trim();
  }, []);

  // Form validation
  const validateForm = useCallback(() => {
    const newErrors = {};
    const { EMAIL_REGEX } = VALIDATION;
    const { PASSWORD_MIN_LENGTH } = SECURITY_CONFIG;
    
    if (!formData.email) {
      newErrors.email = 'Email wajib diisi';
    } else if (!EMAIL_REGEX.test(formData.email)) {
      newErrors.email = 'Masukkan alamat email yang valid';
    }

    if (!formData.password) {
      newErrors.password = 'Kata sandi wajib diisi';
    } else if (formData.password.length < PASSWORD_MIN_LENGTH) {
      newErrors.password = `Kata sandi minimal ${PASSWORD_MIN_LENGTH} karakter`;
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [formData]);

  // Handle form input changes
  const handleChange = useCallback((e) => {
    const { name, value } = e.target;
    const sanitizedValue = sanitizeInput(value);
    
    setFormData(prev => ({ ...prev, [name]: sanitizedValue }));
    setErrors(prev => ({ ...prev, [name]: '', general: '' }));
  }, [sanitizeInput]);

  // Enhanced security logging
  const logSecurityEvent = useCallback(async (eventType, details) => {
    try {
      const encryptedDetails = encryptData({
        eventType,
        details,
        timestamp: new Date().toISOString(),
        userAgent: navigator.userAgent,
        ip: 'Captured on server',
        deviceInfo: {
          platform: navigator.platform,
          language: navigator.language,
          screenResolution: `${window.screen.width}x${window.screen.height}`
        }
      });
      
      const { SECURITY_EVENTS } = SECURITY_CONFIG.SESSION_STORAGE_KEYS;
      const events = JSON.parse(sessionStorage.getItem(SECURITY_EVENTS) || '[]');
      events.push(encryptedDetails);
      sessionStorage.setItem(SECURITY_EVENTS, JSON.stringify(events));
    } catch (error) {
      console.error('Error logging security event:', error);
    }
  }, []);

  // Handle form submission
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    const timeSinceLastAttempt = Date.now() - lastAttemptTime;
    if (timeSinceLastAttempt < SECURITY_CONFIG.MIN_ATTEMPT_INTERVAL) {
      setErrors({ general: 'Terlalu cepat. Mohon tunggu sebentar.' });
      return;
    }
    setLastAttemptTime(Date.now());

    if (cooldownEndTime && Date.now() < cooldownEndTime) {
      setErrors({ general: `Silakan tunggu ${timeLeft} detik sebelum mencoba lagi.` });
      logSecurityEvent('cooldown_attempt', { email: formData.email });
      return;
    }

    if (!validateForm()) {
      logSecurityEvent('validation_failed', { email: formData.email });
      return;
    }

    setLoading(true);
    try {
      const hashedPassword = hashData(formData.password);
      const userCredential = await signInWithEmailAndPassword(auth, formData.email, formData.password);
      const userDoc = await getDoc(doc(db, 'users', userCredential.user.uid));
      
      if (!userDoc.exists()) {
        throw new Error('Profil pengguna tidak ditemukan');
      }

      const userData = userDoc.data();
      const sessionData = {
        uid: userCredential.user.uid,
        email: formData.email,
        timestamp: Date.now(),
        userAgent: navigator.userAgent,
        lastLogin: new Date().toISOString()
      };
      
      const encryptedSession = encryptData(sessionData);
      setCookie('user_session', encryptedSession, { 
        secure: true, 
        sameSite: 'Strict',
        maxAge: 3600 // 1 hour
      });

      clearSecurityState();
      logSecurityEvent('successful_login', { email: formData.email });

      switch (userData.status) {
        case 'active':
          navigate('/dashboard');
          break;
        case 'pending':
          navigate('/signup-confirmation');
          break;
        case 'suspended':
        case 'inactive':
          logSecurityEvent(`${userData.status}_account_attempt`, { email: formData.email });
          throw new Error(
            userData.status === 'suspended' 
              ? 'Akun Anda telah dinonaktifkan. Silakan hubungi administrator.'
              : 'Akun Anda tidak aktif. Silakan hubungi administrator.'
          );
        default:
          throw new Error('Status akun tidak valid');
      }
    } catch (error) {
      console.error('Login error:', error);
      
      const newAttempts = loginAttempts + 1;
      setLoginAttempts(newAttempts);
      sessionStorage.setItem(SECURITY_CONFIG.SESSION_STORAGE_KEYS.LOGIN_ATTEMPTS, newAttempts.toString());

      logSecurityEvent('failed_login_attempt', { 
        email: formData.email, 
        attemptNumber: newAttempts,
        errorMessage: error.message,
        timestamp: new Date().toISOString()
      });

      if (newAttempts >= SECURITY_CONFIG.MAX_LOGIN_ATTEMPTS) {
        const endTime = Date.now() + SECURITY_CONFIG.COOLDOWN_DURATION;
        setCooldownEndTime(endTime);
        setTimeLeft(Math.ceil(SECURITY_CONFIG.COOLDOWN_DURATION / 1000));
        sessionStorage.setItem(SECURITY_CONFIG.SESSION_STORAGE_KEYS.COOLDOWN_END_TIME, endTime.toString());
        setErrors({ 
          general: `Terlalu banyak percobaan gagal. Silakan tunggu ${Math.ceil(SECURITY_CONFIG.COOLDOWN_DURATION / 1000)} detik sebelum mencoba lagi.` 
        });
      } else {
        setErrors({
          general: error.message === 'Firebase: Error (auth/invalid-credential).' 
            ? 'Email atau kata sandi tidak valid' 
            : 'Terjadi kesalahan saat login. Silakan coba lagi.'
        });
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex justify-center">
      {/* Centered Login Form */}
      <div className="flex-1 flex flex-col justify-center py-12 px-4 sm:px-6 lg:max-w-[1024px]">
        <div className="mx-auto w-full max-w-sm lg:w-[480px]">
          <div className="flex flex-col items-center space-y-4">
            <img 
              className="h-20 w-auto transform hover:scale-105 transition-transform duration-200" 
              src={iBRDLogo} 
              alt="i-BRD System" 
            />
            <h2 className="text-3xl font-extrabold text-gray-900 text-center">
              Selamat Datang Kembali
            </h2>
            <p className="text-sm text-gray-600 text-center max-w-[280px]">
              Silakan masuk ke akun Anda untuk mengakses sistem BRD
            </p>
          </div>
        </div>

        <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
          <div className="bg-white py-8 px-4 shadow-xl rounded-lg sm:px-10 border border-gray-100 relative overflow-hidden">
            {/* Progress bar during loading */}
            {loading && (
              <div className="absolute top-0 left-0 h-1 bg-blue-600 animate-progress w-full transform origin-left"></div>
            )}
            
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Error Messages */}
              {errors.general && (
                <div className="rounded-md bg-red-50 p-4 animate-fadeIn">
                  <div className="flex">
                    <div className="flex-shrink-0">
                      <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                      </svg>
                    </div>
                    <div className="ml-3">
                      <p className="text-sm text-red-700">{errors.general}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Email Field */}
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
                    value={formData.email}
                    onChange={handleChange}
                    className={`appearance-none block w-full pl-10 pr-3 py-2 border ${
                      errors.email ? 'border-red-300 focus:ring-red-500 focus:border-red-500' : 'border-gray-300 focus:ring-blue-500 focus:border-blue-500'
                    } rounded-md shadow-sm placeholder-gray-400 focus:outline-none sm:text-sm transition-colors duration-200`}
                    placeholder="Masukkan alamat email Anda"
                    disabled={isFormDisabled}
                  />
                  {errors.email && (
                    <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                      <svg className="h-5 w-5 text-red-500" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                      </svg>
                    </div>
                  )}
                </div>
                {errors.email && (
                  <p className="mt-2 text-sm text-red-600 animate-fadeIn">{errors.email}</p>
                )}
              </div>

              {/* Password Field */}
              <div className="space-y-1">
                <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                  Kata Sandi
                </label>
                <div className="mt-1 relative rounded-md shadow-sm">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <svg className="h-5 w-5 text-gray-400" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <input
                    id="password"
                    name="password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    required
                    value={formData.password}
                    onChange={handleChange}
                    className={`appearance-none block w-full pl-10 pr-10 py-2 border ${
                      errors.password ? 'border-red-300 focus:ring-red-500 focus:border-red-500' : 'border-gray-300 focus:ring-blue-500 focus:border-blue-500'
                    } rounded-md shadow-sm placeholder-gray-400 focus:outline-none sm:text-sm transition-colors duration-200`}
                    placeholder="Masukkan kata sandi Anda"
                    disabled={isFormDisabled}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center focus:outline-none"
                    disabled={isFormDisabled}
                  >
                    {showPassword ? (
                      <svg className="h-5 w-5 text-gray-400 hover:text-gray-500 transition-colors duration-200" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                      </svg>
                    ) : (
                      <svg className="h-5 w-5 text-gray-400 hover:text-gray-500 transition-colors duration-200" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                    )}
                  </button>
                </div>
                {errors.password && (
                  <p className="mt-2 text-sm text-red-600 animate-fadeIn">{errors.password}</p>
                )}
              </div>

              {/* Remember Me and Forgot Password */}
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <input
                    id="remember-me"
                    name="remember-me"
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="h-4 w-4 text-blue-900 focus:ring-blue-500 border-gray-300 rounded cursor-pointer"
                    disabled={isFormDisabled}
                  />
                  <label htmlFor="remember-me" className="ml-2 block text-sm text-gray-700 cursor-pointer">
                    Ingat saya
                  </label>
                </div>
                <div className="text-sm">
                  <Link
                    to="/forgot-password"
                    className="font-medium text-blue-900 hover:text-blue-800 transition-colors duration-200 flex items-center group"
                  >
                    <svg 
                      className="w-4 h-4 mr-1 text-blue-900 group-hover:text-blue-800 transition-colors duration-200" 
                      fill="none" 
                      viewBox="0 0 24 24" 
                      stroke="currentColor"
                    >
                      <path 
                        strokeLinecap="round" 
                        strokeLinejoin="round" 
                        strokeWidth={2} 
                        d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" 
                      />
                    </svg>
                    Lupa kata sandi?
                  </Link>
                </div>
              </div>

              {/* Submit Button */}
              <div>
                <button
                  type="submit"
                  disabled={isFormDisabled}
                  className={`w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white transition-all duration-200 ${
                    isFormDisabled
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
                      Masuk...
                    </div>
                  ) : isFormDisabled ? (
                    <div className="flex items-center">
                      <svg className="animate-pulse -ml-1 mr-3 h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      Menunggu... ({timeLeft}s)
                    </div>
                  ) : (
                    'Masuk'
                  )}
                </button>
              </div>

              {/* Divider */}
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-300"></div>
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-2 bg-white text-gray-500">
                    Belum punya akun?
                  </span>
                </div>
              </div>

              {/* Sign Up Link */}
              <div>
                <Link
                  to="/signup"
                  className="w-full flex justify-center py-2 px-4 border border-blue-900 rounded-md shadow-sm text-sm font-medium text-blue-900 bg-white hover:bg-blue-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-all duration-200 transform hover:-translate-y-0.5"
                >
                  Buat akun baru
                </Link>
              </div>
            </form>
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

export default Login; 