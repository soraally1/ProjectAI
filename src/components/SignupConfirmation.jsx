import { useEffect } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { useUser } from '../context/UserContext';
import { auth } from '../firebase';
import iBRDLogo from '../assets/i-BRDSystem.svg';

const SignupConfirmation = () => {
  const { user, profile } = useUser();
  const navigate = useNavigate();

  useEffect(() => {
    // If no user, redirect to login
    if (!user) {
      navigate('/login');
      return;
    }

    // If user is approved, redirect to dashboard
    if (profile?.status === 'active') {
      navigate('/dashboard');
      return;
    }

    // If profile is not completed, redirect to profile completion
    if (!profile?.profileCompleted) {
      navigate('/profile-completion');
      return;
    }
  }, [user, profile, navigate]);

  // Immediate redirects using Navigate component
  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (profile?.status === 'active') {
    return <Navigate to="/dashboard" replace />;
  }

  if (!profile?.profileCompleted) {
    return <Navigate to="/profile-completion" replace />;
  }

  const handleLogout = async () => {
    try {
      await auth.signOut();
      navigate('/login');
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  return (
    <div className="min-h-screen flex flex-col justify-center bg-gradient-to-b from-blue-50 to-white py-12 px-4 sm:px-6 lg:px-8 relative">
      <div className="max-w-lg mx-auto w-full space-y-8">
        {/* Logo and Header */}
        <div className="text-center">
          <img className="mx-auto h-20 w-auto" src={iBRDLogo} alt="i-BRD System" />
          <h2 className="mt-6 text-3xl font-extrabold text-gray-900">
            Menunggu Persetujuan Admin
          </h2>
          <p className="mt-2 text-sm text-gray-600">
            Akun Anda sedang dalam proses verifikasi
          </p>
        </div>

        {/* Main Content Card */}
        <div className="bg-white shadow-xl rounded-lg overflow-hidden">
          {/* Status Section */}
          <div className="px-6 py-8 border-b border-gray-200">
            <div className="flex items-center justify-center">
              <div className="relative">
                <div className="h-24 w-24 rounded-full bg-yellow-100 flex items-center justify-center">
                  <svg className="h-12 w-12 text-yellow-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div className="absolute -bottom-1 right-0">
                  <div className="animate-ping absolute inline-flex h-6 w-6 rounded-full bg-yellow-400 opacity-75"></div>
                  <div className="relative inline-flex rounded-full h-6 w-6 bg-yellow-500"></div>
                </div>
              </div>
            </div>

            <div className="mt-6 text-center">
              <h3 className="text-lg font-semibold text-gray-900">Status: Menunggu Persetujuan</h3>
              <p className="mt-2 text-sm text-gray-600">
                Terima kasih telah mendaftar di e-BRD System. Tim admin kami akan memverifikasi akun Anda segera.
              </p>
            </div>
          </div>

          {/* Information Section */}
          <div className="px-6 py-6 bg-gray-50">
            <h4 className="text-sm font-medium text-gray-900 mb-4">Informasi Penting:</h4>
            <ul className="space-y-4">
              <li className="flex items-start">
                <div className="flex-shrink-0">
                  <svg className="h-6 w-6 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <p className="ml-3 text-sm text-gray-600">
                  Proses verifikasi biasanya membutuhkan waktu 10 Menit
                </p>
              </li>
              <li className="flex items-start">
                <div className="flex-shrink-0">
                  <svg className="h-6 w-6 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                </div>
                <p className="ml-3 text-sm text-gray-600">
                  Anda akan menerima notifikasi email setelah akun Anda disetujui
                </p>
              </li>
              <li className="flex items-start">
                <div className="flex-shrink-0">
                  <svg className="h-6 w-6 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                </div>
                <p className="ml-3 text-sm text-gray-600">
                  Pastikan untuk menjaga kerahasiaan informasi login Anda
                </p>
              </li>
            </ul>
          </div>

          {/* Contact Section */}
          <div className="px-6 py-6 border-t border-gray-200">
            <div className="text-center">
              <p className="text-sm text-gray-600">
                Butuh bantuan? Hubungi tim support kami
              </p>
              <a href="mailto:spramoedony@gmail.com" className="mt-2 inline-flex items-center text-sm font-medium text-blue-600 hover:text-blue-500">
                <svg className="h-5 w-5 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
                spramoedony@gmail.com
              </a>
            </div>
          </div>
        </div>

        {/* Logout Button */}
        <div className="text-center">
          <button
            onClick={handleLogout}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-gray-700 bg-gray-100 hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500"
          >
            <svg className="h-5 w-5 mr-2 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            Keluar
          </button>
        </div>
      </div>

      {/* Copyright text */}
      <div className="absolute bottom-4 left-4 text-sm text-gray-500">
        © Copyright Daffa 2025. i-BRD v.1.0
      </div>
    </div>
  );
};

export default SignupConfirmation; 