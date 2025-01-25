import { BrowserRouter as Router, Routes, Route, Navigate, Link } from 'react-router-dom';
import { UserProvider, useUser } from './context/UserContext';
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
import { RequestWorkspace } from './components/RequestWorkspace';

// Protected Route Component
const ProtectedRoute = ({ children, requireProfile = true, requireAdmin = false, requireAnalyst = false }) => {
  const { user, profile, loading } = useUser();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-900"></div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" />;
  }

  if (requireProfile && !profile) {
    return <Navigate to="/complete-profile" />;
  }

  if (requireAdmin && !profile?.isAdmin) {
    return <Navigate to="/dashboard" />;
  }

  if (requireAnalyst && profile?.role !== 'Business Analyst') {
    return <Navigate to="/dashboard" />;
  }

  return children;
};

const AppRoutes = () => {
  const { user, loading } = useUser();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-900"></div>
      </div>
    );
  }

  return (
    <Routes>
      {/* Public Routes */}
      <Route path="/" element={user ? <Navigate to="/dashboard" /> : <Navigate to="/login" />} />
      <Route path="/login" element={user ? <Navigate to="/dashboard" /> : <Login />} />
      <Route path="/signup" element={user ? <Navigate to="/dashboard" /> : <Signup />} />
      
      {/* Profile Completion Route */}
      <Route
        path="/complete-profile"
        element={
          <ProtectedRoute requireProfile={false}>
            <ProfileCompletion />
          </ProtectedRoute>
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
        <Route index element={<HomePage />} />
        <Route path="profile" element={<Profile />} />
        <Route path="settings" element={<Settings />} />
        <Route path="create-brd" element={<CreateBRD />} />
        <Route path="request/:requestId" element={<RequestWorkspace />} />
        <Route
          path="admin"
          element={
            <ProtectedRoute requireAdmin={true}>
              <AdminPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="analyst"
          element={
            <ProtectedRoute requireAnalyst={true}>
              <BusinessAnalystPage />
            </ProtectedRoute>
          }
        />
      </Route>

      {/* 404 Route */}
      <Route path="*" element={
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center">
            <h1 className="text-4xl font-bold text-gray-900">404</h1>
            <p className="mt-2 text-gray-600">Page not found</p>
            <Link to="/" className="mt-4 text-blue-500 hover:text-blue-600">Go back home</Link>
          </div>
        </div>
      } />
    </Routes>
  );
};

function App() {
  return (
    <UserProvider>
      <Router>
        <AppRoutes />
      </Router>
    </UserProvider>
  );
}

export default App;
