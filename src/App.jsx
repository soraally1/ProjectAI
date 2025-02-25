import { BrowserRouter, Routes, Route, Navigate, Link } from 'react-router-dom';
import { UserProvider, useUser } from './context/UserContext';
import { useState, useEffect } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from './firebase';
import Login from './components/Login';
import Signup from './components/Signup';
import ProfileCompletion from './components/ProfileCompletion';
import DashboardLayout from './components/DashboardLayout';
import HomePage from './components/HomePage';
import Profile from './components/Profile';
import Settings from './components/Settings';
import CreateBRD from './components/CreateBRD';
import AdminPage from './components/AdminPage';
import BusinessAnalystPage from './components/BusinessAnalystPage';
import RequestWorkspace from './components/RequestWorkspace';
import SignupConfirmation from './components/SignupConfirmation';
import MaintenancePage from './components/MaintenancePage';
import CookieConsent from './components/CookieConsent';
import SecurityMiddleware from './components/SecurityMiddleware';
import { auth } from './firebase';
import ForgotPassword from './components/ForgotPassword';
import ResetPassword from './components/ResetPassword';

// Protected Route Component
const ProtectedRoute = ({ children, allowedRoles, requireAdmin }) => {
  const { user, profile } = useUser();
  const [isMaintenanceMode, setIsMaintenanceMode] = useState(false);
  const [checkingMaintenance, setCheckingMaintenance] = useState(true);

  useEffect(() => {
    const checkMaintenanceMode = async () => {
      try {
        const settingsRef = doc(db, 'system_settings', 'general');
        const settingsSnap = await getDoc(settingsRef);
        
        if (settingsSnap.exists()) {
          const { maintenanceMode } = settingsSnap.data();
          setIsMaintenanceMode(maintenanceMode);
        }
      } catch (error) {
        console.error('Error checking maintenance mode:', error);
      } finally {
        setCheckingMaintenance(false);
      }
    };

    checkMaintenanceMode();
  }, []);

  if (checkingMaintenance) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-900"></div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // Allow admins to bypass maintenance mode
  if (isMaintenanceMode && !profile?.isAdmin) {
    return <Navigate to="/maintenance" replace />;
  }

  if (requireAdmin && !profile?.isAdmin) {
    return <Navigate to="/dashboard" replace />;
  }

  if (allowedRoles && !allowedRoles.includes(profile?.role)) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
};

const PublicRoute = ({ children }) => {
  const { user, profile } = useUser();
  const [isMaintenanceMode, setIsMaintenanceMode] = useState(false);
  const [checkingMaintenance, setCheckingMaintenance] = useState(true);

  useEffect(() => {
    const checkMaintenanceMode = async () => {
      try {
        const settingsRef = doc(db, 'system_settings', 'general');
        const settingsSnap = await getDoc(settingsRef);
        
        if (settingsSnap.exists()) {
          const { maintenanceMode } = settingsSnap.data();
          setIsMaintenanceMode(maintenanceMode);
        }
      } catch (error) {
        console.error('Error checking maintenance mode:', error);
      } finally {
        setCheckingMaintenance(false);
      }
    };

    checkMaintenanceMode();
  }, []);

  if (checkingMaintenance) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-900"></div>
      </div>
    );
  }

  // Show maintenance page for non-admin users when maintenance mode is active
  if (isMaintenanceMode && !profile?.isAdmin) {
    return <Navigate to="/maintenance" replace />;
  }

  return children;
};

const AppRoutes = () => {
  const { user, profile, loading } = useUser();
  const [isMaintenanceMode, setIsMaintenanceMode] = useState(false);
  const [checkingMaintenance, setCheckingMaintenance] = useState(true);

  useEffect(() => {
    const checkMaintenanceMode = async () => {
      try {
        const settingsRef = doc(db, 'system_settings', 'general');
        const settingsSnap = await getDoc(settingsRef);
        
        if (settingsSnap.exists()) {
          const { maintenanceMode } = settingsSnap.data();
          setIsMaintenanceMode(maintenanceMode);
        }
      } catch (error) {
        console.error('Error checking maintenance mode:', error);
      } finally {
        setCheckingMaintenance(false);
      }
    };

    checkMaintenanceMode();
  }, []);

  if (loading || checkingMaintenance) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-900"></div>
      </div>
    );
  }

  // Show maintenance page for non-admin users when maintenance mode is active
  if (isMaintenanceMode && !profile?.isAdmin) {
    return <MaintenancePage />;
  }

  return (
    <Routes>
      {/* Maintenance Route */}
      <Route 
        path="/maintenance" 
        element={
          isMaintenanceMode && !profile?.isAdmin ? <MaintenancePage /> : <Navigate to="/" replace />
        } 
      />

      {/* Public Routes */}
      <Route 
        path="/" 
        element={
          <PublicRoute>
            {!user ? <Navigate to="/login" replace /> :
            !profile?.profileCompleted ? <Navigate to="/profile-completion" replace /> :
            profile?.status === 'pending' ? <Navigate to="/signup-confirmation" replace /> :
            <Navigate to="/dashboard" replace />}
          </PublicRoute>
        } 
      />

      {/* Login Route */}
      <Route 
        path="/login" 
        element={
          <PublicRoute>
            {user ? (
              !profile?.profileCompleted ? <Navigate to="/profile-completion" replace /> :
              profile?.status === 'pending' ? <Navigate to="/signup-confirmation" replace /> :
              <Navigate to="/dashboard" replace />
            ) : (
              <Login />
            )}
          </PublicRoute>
        } 
      />

      {/* Signup Route */}
      <Route 
        path="/signup" 
        element={
          <PublicRoute>
            {user ? (
              !profile?.profileCompleted ? <Navigate to="/profile-completion" replace /> :
              profile?.status === 'pending' ? <Navigate to="/signup-confirmation" replace /> :
              <Navigate to="/dashboard" replace />
            ) : (
              <Signup />
            )}
          </PublicRoute>
        } 
      />
      
      {/* Profile Completion Route */}
      <Route
        path="/profile-completion"
        element={
          !user ? <Navigate to="/login" replace /> :
          profile?.profileCompleted && profile?.status === 'pending' ? <Navigate to="/signup-confirmation" replace /> :
          profile?.status === 'active' ? <Navigate to="/dashboard" replace /> :
          <ProfileCompletion />
        }
      />

      {/* Signup Confirmation Route */}
      <Route
        path="/signup-confirmation"
        element={
          !user ? <Navigate to="/login" replace /> :
          !profile?.profileCompleted ? <Navigate to="/profile-completion" replace /> :
          profile?.status === 'active' ? <Navigate to="/dashboard" replace /> :
          <SignupConfirmation />
        }
      />

      {/* Account Status Route */}
      <Route
        path="/account-status"
        element={
          !user ? <Navigate to="/login" replace /> :
          profile?.status === 'active' ? <Navigate to="/admin" replace /> :
          <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-blue-50 to-white py-12 px-4 sm:px-6 lg:px-8">
            <div className="max-w-md w-full text-center">
              <h2 className="text-3xl font-bold text-gray-900 mb-4">Status Akun</h2>
              <p className="text-gray-600 mb-4">
                {profile?.status === 'suspended' ? 
                  'Akun Anda telah dinonaktifkan. Silakan hubungi administrator.' :
                  'Akun Anda tidak aktif. Silakan hubungi administrator.'}
              </p>
              <button
                onClick={() => auth.signOut()}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-900 hover:bg-blue-800"
              >
                Keluar
              </button>
            </div>
          </div>
        }
      />

      {/* Protected Dashboard Routes */}
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <DashboardLayout />
          </ProtectedRoute>
        }
      >
        {/* Default Dashboard Route */}
        <Route index element={
          <ProtectedRoute>
            {profile?.isAdmin ? (
              <Navigate to="admin" replace />
            ) : profile?.role === 'Business Analyst' ? (
              <Navigate to="analyst" replace />
            ) : (
              <Navigate to="home" replace />
            )}
          </ProtectedRoute>
        } />

        {/* Home Route - Business Requester Only */}
        <Route path="home" element={
          <ProtectedRoute allowedRoles={['Business Requester']}>
            <HomePage />
          </ProtectedRoute>
        } />

        {/* Business Analyst Route */}
        <Route path="analyst" element={
          <ProtectedRoute allowedRoles={['Business Analyst']}>
            <BusinessAnalystPage />
          </ProtectedRoute>
        } />

        {/* Admin Route - Admin Only */}
        <Route path="admin" element={
          <ProtectedRoute requireAdmin={true}>
            <AdminPage />
          </ProtectedRoute>
        } />

        {/* Profile Route - Accessible by all roles */}
        <Route path="profile" element={
          <ProtectedRoute>
            <Profile />
          </ProtectedRoute>
        } />

        {/* Create BRD Route - Business Requester Only */}
        <Route path="create-brd" element={
          <ProtectedRoute allowedRoles={['Business Requester']}>
            <CreateBRD />
          </ProtectedRoute>
        } />

        {/* Request Workspace Route - Accessible by all roles */}
        <Route path="request/:requestId" element={
          <ProtectedRoute>
            <RequestWorkspace />
          </ProtectedRoute>
        } />
      </Route>

      {/* Forgot Password Route */}
      <Route path="/forgot-password" element={<ForgotPassword />} />

      {/* Reset Password Route */}
      <Route path="/reset-password" element={<ResetPassword />} />

      {/* 404 Route */}
      <Route 
        path="*" 
        element={
          <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-white to-blue-50 p-4">
            <div className="max-w-2xl w-full text-center">
              <div className="mb-8">
                <svg
                  className="mx-auto h-32 w-32 text-blue-500 animate-pulse"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M12 21a9 9 0 110-18 9 9 0 010 18z"
                  />
                </svg>
              </div>
              <h1 className="text-6xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-blue-800 mb-4">
                404
              </h1>
              <h2 className="text-3xl font-semibold text-gray-900 mb-4">
                Halaman Tidak Ditemukan
              </h2>
              <p className="text-lg text-gray-600 mb-8 max-w-md mx-auto">
                Maaf, halaman yang Anda cari tidak dapat ditemukan. Halaman mungkin telah dipindahkan atau dihapus.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
                <Link
                  to="/"
                  className="inline-flex items-center px-6 py-3 text-base font-medium rounded-xl text-white bg-gradient-to-r from-blue-600 to-blue-800 hover:from-blue-700 hover:to-blue-900 transition-all duration-200 shadow-md hover:shadow-lg"
                >
                  <svg className="w-5 h-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                  </svg>
                  Kembali ke Beranda
                </Link>
                <button
                  onClick={() => window.history.back()}
                  className="inline-flex items-center px-6 py-3 text-base font-medium rounded-xl text-blue-700 bg-blue-50 hover:bg-blue-100 transition-all duration-200"
                >
                  <svg className="w-5 h-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                  </svg>
                  Kembali ke Halaman Sebelumnya
                </button>
              </div>
              <div className="mt-8 text-sm text-gray-500">
                Butuh bantuan? Silakan hubungi{' '}
                <a href="mailto:spramoedony@gmail.com" className="text-blue-600 hover:text-blue-800 font-medium">
                  tim support kami  
                </a>
              </div>
            </div>
          </div>
        } 
      />
    </Routes>
  );
};

function App() {
  useEffect(() => {
    // Disable browser developer tools in production
    if (process.env.NODE_ENV === 'production') {
      const disableDevTools = () => {
        const handler = (e) => {
          e.preventDefault();
          e.stopPropagation();
          return false;
        };

        // Disable various developer tools shortcuts
        document.addEventListener('keydown', (e) => {
          if (
            (e.ctrlKey && (e.shiftKey || e.metaKey)) ||
            e.key === 'F12' ||
            e.keyCode === 123
          ) {
            handler(e);
          }
        });

        // Additional protection against console opening
        Object.defineProperty(window, 'console', {
          get: () => ({
            log: () => {},
            info: () => {},
            warn: () => {},
            error: () => {},
            debug: () => {}
          })
        });
      };

      disableDevTools();
    }
  }, []);

  return (
    <UserProvider>
      <BrowserRouter>
        <SecurityMiddleware>
          <AppRoutes />
          <CookieConsent />
        </SecurityMiddleware>
      </BrowserRouter>
    </UserProvider>
  );
}

export default App;
