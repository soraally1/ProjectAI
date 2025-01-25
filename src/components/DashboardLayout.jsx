import { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate, Outlet } from 'react-router-dom';
import { useUser } from '../context/UserContext';
import { auth } from '../firebase';
import logo from '../assets/i-BRDSystem.svg';

const DashboardLayout = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { profile } = useUser();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const handleLogout = async () => {
    try {
      await auth.signOut();
      navigate('/login');
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  const isActive = (path) => {
    return location.pathname === path;
  };

  let menuItems = [
    {
      path: '/dashboard',
      name: 'Dashboard',
      icon: (
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
        </svg>
      )
    },
    {
      path: '/dashboard/profile',
      name: 'Profile',
      icon: (
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
        </svg>
      )
    }
  ];

  // Add Business Analyst menu item if user has the role
  if (profile?.role === 'Business Analyst') {
    menuItems.push({
      path: '/dashboard/analyst',
      name: 'Business Analyst',
      icon: (
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      )
    });
  }

  // Add Admin menu item if user is admin
  if (profile?.isAdmin) {
    menuItems.push({
      path: '/dashboard/admin',
      name: 'Admin',
      icon: (
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
        </svg>
      )
    });
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      {/* Navigation Bar */}
      <nav 
        className={`fixed w-full top-0 z-50 transition-all duration-300 ${
          scrolled 
            ? 'bg-white/90 backdrop-blur-lg shadow-lg' 
            : 'bg-white/50 backdrop-blur-sm'
        }`}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <div className="flex-shrink-0 flex items-center">
                <Link to="/dashboard" className="flex items-center space-x-3">
                  <img className="h-10 w-auto" src={logo} alt="i-BRD System" />
                  <div className="hidden lg:flex lg:flex-col">
                    <span className="text-lg font-bold bg-gradient-to-r from-blue-900 to-blue-600 bg-clip-text text-transparent">
                      E-BRD System
                    </span>
                    <span className="text-xs text-gray-600">Banking & Finance</span>
                  </div>
                </Link>
              </div>
              {/* Desktop Menu */}
              <div className="hidden sm:ml-8 sm:flex sm:space-x-2">
                {menuItems.map((item) => (
                  <Link
                    key={item.path}
                    to={item.path}
                    className={`${
                      isActive(item.path)
                        ? 'bg-gradient-to-r from-blue-900 to-blue-700 text-white shadow-md shadow-blue-500/20'
                        : 'text-gray-700 hover:bg-blue-50'
                    } px-3 py-2 rounded-lg inline-flex items-center text-sm font-medium transition-all duration-200`}
                  >
                    <span className={`mr-1.5 ${isActive(item.path) ? 'text-white' : 'text-blue-900'}`}>
                      {item.icon}
                    </span>
                    {item.name}
                  </Link>
                ))}
              </div>
            </div>

            <div className="flex items-center space-x-4">
              {profile && (
                <div className="flex items-center space-x-3">
                  <div className="hidden md:flex md:flex-col md:items-end">
                    <p className="text-sm font-semibold text-gray-900">{profile.namaLengkap}</p>
                    <p className="text-xs text-gray-600">{profile.role || 'Business Requester'}</p>
                  </div>
                  <div className="relative">
                    {profile.photoURL ? (
                      <img 
                        src={profile.photoURL} 
                        alt={profile.namaLengkap}
                        className="h-9 w-9 rounded-lg object-cover ring-2 ring-white shadow-md"
                      />
                    ) : (
                      <div className="h-9 w-9 rounded-lg bg-gradient-to-br from-blue-900 to-blue-700 flex items-center justify-center ring-2 ring-white shadow-md">
                        <span className="text-white text-sm font-semibold">
                          {profile.namaLengkap?.charAt(0).toUpperCase()}
                        </span>
                      </div>
                    )}
                    <div className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full bg-green-500 ring-2 ring-white"></div>
                  </div>
                </div>
              )}
              <button
                onClick={handleLogout}
                className="inline-flex items-center px-3 py-1.5 text-sm font-medium rounded-lg text-blue-900 hover:text-white border-2 border-blue-900/10 hover:border-blue-900 hover:bg-blue-900 transition-all duration-200 group"
              >
                <svg 
                  className="h-4 w-4 mr-1.5 transition-transform duration-200 group-hover:translate-x-0.5" 
                  fill="none" 
                  viewBox="0 0 24 24" 
                  stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
                Logout
              </button>

              {/* Mobile menu button */}
              <button
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                className="sm:hidden inline-flex items-center justify-center p-2 rounded-lg text-gray-700 hover:text-blue-900 hover:bg-blue-50 transition-all duration-200"
              >
                <span className="sr-only">Open main menu</span>
                {isMobileMenuOpen ? (
                  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                ) : (
                  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                  </svg>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile Menu */}
        <div
          className={`sm:hidden transition-all duration-300 ${
            isMobileMenuOpen 
              ? 'max-h-96 opacity-100 bg-white/90 backdrop-blur-lg border-t border-gray-200/80' 
              : 'max-h-0 opacity-0 overflow-hidden'
          }`}
        >
          <div className="pt-2 pb-3 space-y-1 px-4">
            {menuItems.map((item) => (
              <Link
                key={item.path}
                to={item.path}
                className={`${
                  isActive(item.path)
                    ? 'bg-gradient-to-r from-blue-900 to-blue-700 text-white shadow-md'
                    : 'text-gray-700 hover:bg-blue-50'
                } block px-3 py-2 rounded-lg text-base font-medium transition-all duration-200`}
                onClick={() => setIsMobileMenuOpen(false)}
              >
                <div className="flex items-center">
                  <span className={`mr-2 ${isActive(item.path) ? 'text-white' : 'text-blue-900'}`}>
                    {item.icon}
                  </span>
                  {item.name}
                </div>
              </Link>
            ))}
          </div>
          <div className="pt-4 pb-3 border-t border-gray-200/80 px-4">
            {profile && (
              <div className="flex items-center py-2">
                <div className="flex-shrink-0">
                  {profile.photoURL ? (
                    <img 
                      src={profile.photoURL} 
                      alt={profile.namaLengkap}
                      className="h-10 w-10 rounded-lg object-cover ring-2 ring-white shadow-md"
                    />
                  ) : (
                    <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-blue-900 to-blue-700 flex items-center justify-center ring-2 ring-white shadow-md">
                      <span className="text-white text-base font-semibold">
                        {profile.namaLengkap?.charAt(0).toUpperCase()}
                      </span>
                    </div>
                  )}
                </div>
                <div className="ml-3">
                  <div className="text-base font-semibold text-gray-900">{profile.namaLengkap}</div>
                  <div className="text-sm text-gray-600">{profile.role || 'Business Requester'}</div>
                </div>
              </div>
            )}
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8 mt-20">
        <div className="bg-white/80 backdrop-blur-lg rounded-2xl shadow-xl shadow-gray-200/50 p-6">
          <Outlet />
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-white/80 backdrop-blur-lg mt-8">
        <div className="max-w-7xl mx-auto py-4 px-4 sm:px-6 lg:px-8">
          <p className="text-center text-sm text-gray-600">
            © {new Date().getFullYear()} i-BRD System. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
};

export default DashboardLayout; 