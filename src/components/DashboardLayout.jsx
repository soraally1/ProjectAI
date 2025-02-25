import { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate, Outlet } from 'react-router-dom';
import { useUser } from '../context/UserContext';
import { auth, db } from '../firebase';
import { collection, query, where, orderBy, onSnapshot, Timestamp, getDocs, updateDoc, doc } from 'firebase/firestore';
import logo from '../assets/i-BRDSystem.svg';

const DashboardLayout = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, profile } = useUser();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoadingNotifications, setIsLoadingNotifications] = useState(true);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Subscribe to notifications
  useEffect(() => {
    if (!user?.uid) return;

    setIsLoadingNotifications(true);
    let unsubscribeCallbacks = [];

    const setupNotificationSubscriptions = async () => {
      try {
        // Query for all BRD requests where user is involved
        const [assignedRequestsSnapshot, requestedRequestsSnapshot] = await Promise.all([
          getDocs(query(
            collection(db, 'brd_requests'),
            where('assignedAnalystId', '==', user.uid)
          )),
          getDocs(query(
            collection(db, 'brd_requests'),
            where('createdBy', '==', user.uid)
          ))
        ]);

        const allRequests = [...assignedRequestsSnapshot.docs, ...requestedRequestsSnapshot.docs];
        const uniqueRequestIds = [...new Set(allRequests.map(doc => doc.id))];
        const requestsData = allRequests.reduce((acc, doc) => {
          acc[doc.id] = doc.data();
          return acc;
        }, {});

        // Subscribe to comments for each request
        uniqueRequestIds.forEach(requestId => {
          const commentsQuery = query(
            collection(db, 'brd_requests', requestId, 'comments'),
            orderBy('timestamp', 'desc'),
            where('timestamp', '>=', Timestamp.fromDate(new Date(Date.now() - 7 * 24 * 60 * 60 * 1000))) // Last 7 days
          );

          const unsubscribe = onSnapshot(commentsQuery, async (commentsSnapshot) => {
            const newNotifications = commentsSnapshot.docs
              .filter(doc => {
                const data = doc.data();
                // Only show notifications for comments intended for this user
                return data.userId !== user.uid && data.recipientId === user.uid;
              })
              .map(doc => ({
                id: `comment_${doc.id}`,
                requestId: requestId,
                requestName: requestsData[requestId]?.namaProject || 'Unknown Project',
                type: 'comment',
                userName: doc.data().userName || 'Unknown User',
                message: doc.data().text,
                timestamp: doc.data().timestamp?.toDate() || new Date(),
                read: doc.data().read || false,
                userId: doc.data().userId
              }));

            updateNotifications(newNotifications);
          });

          unsubscribeCallbacks.push(unsubscribe);
        });

        // Subscribe to status updates
        const statusUnsubscribe = onSnapshot(
          query(
            collection(db, 'brd_requests'),
            where('createdBy', '==', user.uid),
            orderBy('updatedAt', 'desc')
          ),
          (statusSnapshot) => {
            const statusNotifications = statusSnapshot.docs
              .filter(doc => {
                const data = doc.data();
                const lastUpdated = data.updatedAt?.toDate() || new Date();
                const isRecent = lastUpdated > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
                return isRecent && data.status !== 'New';
              })
              .map(doc => {
                const data = doc.data();
                return {
                  id: `status_${doc.id}`,
                  requestId: doc.id,
                  requestName: data.namaProject,
                  type: 'status',
                  message: getStatusMessage(data.status),
                  timestamp: data.updatedAt?.toDate() || new Date(),
                  read: false,
                  status: data.status
                };
              });

            updateNotifications(statusNotifications);
          }
        );

        unsubscribeCallbacks.push(statusUnsubscribe);
        setIsLoadingNotifications(false);
      } catch (error) {
        console.error('Error setting up notifications:', error);
        setIsLoadingNotifications(false);
      }
    };

    setupNotificationSubscriptions();

    return () => {
      unsubscribeCallbacks.forEach(unsubscribe => unsubscribe());
    };
  }, [user?.uid]);

  const getStatusMessage = (status) => {
    switch (status) {
      case 'In Progress':
        return 'Analis telah mulai mengerjakan BRD';
      case 'Already Generated':
        return 'BRD telah selesai dibuat';
      case 'Completed':
        return 'BRD telah selesai diproses';
      case 'Rejected':
        return 'BRD telah ditolak';
      default:
        return 'Status BRD telah diperbarui';
    }
  };

  const updateNotifications = (newNotifications) => {
    setNotifications(prev => {
      const updatedNotifications = [...prev];
      
      newNotifications.forEach(newNotif => {
        const existingIndex = updatedNotifications.findIndex(n => n.id === newNotif.id);
        if (existingIndex === -1) {
          updatedNotifications.push(newNotif);
        } else {
          updatedNotifications[existingIndex] = {
            ...updatedNotifications[existingIndex],
            ...newNotif,
            read: updatedNotifications[existingIndex].read || newNotif.read
          };
        }
      });

      // Sort by timestamp and limit to last 50 notifications
      updatedNotifications.sort((a, b) => b.timestamp - a.timestamp);
      const limitedNotifications = updatedNotifications.slice(0, 50);
      
      // Update unread count
      setUnreadCount(limitedNotifications.filter(n => !n.read).length);
      
      return limitedNotifications;
    });
  };

  const handleNotificationClick = async (notification) => {
    if (!notification.read) {
      // Update read status in state
      setNotifications(prev => 
        prev.map(n => 
          n.id === notification.id ? { ...n, read: true } : n
        )
      );
      setUnreadCount(prev => Math.max(0, prev - 1));

      // Update read status in Firestore if it's a comment
      if (notification.type === 'comment') {
        try {
          const commentId = notification.id.replace('comment_', '');
          const commentRef = doc(db, 'brd_requests', notification.requestId, 'comments', commentId);
          await updateDoc(commentRef, { read: true });
        } catch (error) {
          console.error('Error updating notification read status:', error);
        }
      }
    }

    // Navigate to the request workspace
    navigate(`/dashboard/request/${notification.requestId}`);
    setShowNotifications(false);
  };

  const handleMarkAllAsRead = async () => {
    // Update all notifications in state
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    setUnreadCount(0);

    // Update read status in Firestore for comment notifications
    try {
      const commentNotifications = notifications
        .filter(n => n.type === 'comment' && !n.read)
        .map(n => ({
          requestId: n.requestId,
          commentId: n.id.replace('comment_', '')
        }));

      await Promise.all(
        commentNotifications.map(({ requestId, commentId }) =>
          updateDoc(
            doc(db, 'brd_requests', requestId, 'comments', commentId),
            { read: true }
          )
        )
      );
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
    }

    setShowNotifications(false);
  };

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

  // Define menu items based on user role
  const getMenuItems = () => {
    const baseMenuItems = [];

    // Add role-specific dashboard item first
    if (profile?.isAdmin) {
      baseMenuItems.push({
        path: '/dashboard/admin',
        name: 'Admin',
        icon: (
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
          </svg>
        )
      });
    } else if (profile?.role === 'Business Analyst') {
      baseMenuItems.push({
        path: '/dashboard/analyst',
        name: 'Dashboard',
        icon: (
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        )
      });
    } else {
      // Business Requester dashboard
      baseMenuItems.push({
        path: '/dashboard/home',
        name: 'Dashboard',
        icon: (
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
          </svg>
        )
      });
    }

    // Add profile menu item last
    baseMenuItems.push({
      path: '/dashboard/profile',
      name: 'Profile',
      icon: (
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
        </svg>
      )
    });

    return baseMenuItems;
  };

  const menuItems = getMenuItems();

  // Add this function to handle clicking outside to close
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (showNotifications && !event.target.closest('.notifications-container')) {
        setShowNotifications(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showNotifications]);

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
                      i-BRD System
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
              {/* Notifications */}
              <div className="relative notifications-container">
                <button
                  onClick={() => setShowNotifications(!showNotifications)}
                  className="relative p-2 rounded-lg text-gray-700 hover:bg-blue-50 hover:text-blue-900 transition-all duration-200 group"
                >
                  <svg className="h-6 w-6 transition-transform group-hover:scale-110" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                  </svg>
                  {unreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 flex h-5 w-5">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-5 w-5 bg-gradient-to-r from-blue-600 to-blue-800 text-white text-xs items-center justify-center font-medium shadow-lg">
                        {unreadCount}
                      </span>
                    </span>
                  )}
                </button>

                {/* Notifications Dropdown */}
                {showNotifications && (
                  <div className="absolute right-0 mt-3 w-96 bg-white rounded-xl shadow-xl ring-1 ring-black ring-opacity-5 focus:outline-none transform transition-all duration-300 ease-in-out">
                    <div className="rounded-xl overflow-hidden">
                      {/* Header */}
                      <div className="px-4 py-3 bg-gradient-to-r from-blue-900 to-blue-700 flex items-center justify-between">
                        <h3 className="text-sm font-semibold text-white flex items-center space-x-2">
                          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                          </svg>
                          <span>Notifikasi ({notifications.length})</span>
                        </h3>
                        {unreadCount > 0 && (
                          <button
                            onClick={handleMarkAllAsRead}
                            className="text-xs text-blue-100 hover:text-white transition-colors duration-200"
                          >
                            Tandai sudah dibaca
                          </button>
                        )}
                      </div>

                      {/* Notifications List */}
                      <div className="max-h-[32rem] overflow-y-auto overscroll-contain">
                        {isLoadingNotifications ? (
                          <div className="px-4 py-12 text-center">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-900 mx-auto"></div>
                            <p className="mt-4 text-sm text-gray-500">Memuat notifikasi...</p>
                          </div>
                        ) : notifications.length === 0 ? (
                          <div className="px-4 py-12 text-center">
                            <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                            </svg>
                            <p className="mt-4 text-sm text-gray-500">Tidak ada notifikasi</p>
                            <p className="mt-2 text-xs text-gray-400">Anda akan mendapat notifikasi saat ada pembaruan</p>
                          </div>
                        ) : (
                          <div className="divide-y divide-gray-100">
                            {notifications.map((notification) => (
                              <div
                                key={notification.id}
                                onClick={() => handleNotificationClick(notification)}
                                className={`px-4 py-4 hover:bg-blue-50 cursor-pointer transition-all duration-200 ${
                                  !notification.read ? 'bg-blue-50/50' : ''
                                }`}
                              >
                                <div className="flex items-start space-x-3">
                                  <div className="flex-shrink-0">
                                    <div className={`h-10 w-10 rounded-lg flex items-center justify-center shadow-sm ${
                                      notification.type === 'status' 
                                        ? notification.status === 'approved'
                                          ? 'bg-green-100 text-green-700'
                                          : notification.status === 'rejected'
                                          ? 'bg-red-100 text-red-700'
                                          : 'bg-yellow-100 text-yellow-700'
                                        : 'bg-gradient-to-br from-blue-100 to-blue-200 text-blue-700'
                                    }`}>
                                      {notification.type === 'status' ? (
                                        notification.status === 'approved' ? '✓' :
                                        notification.status === 'rejected' ? '✕' : '!'
                                      ) : (
                                        <span className="text-sm font-semibold">
                                          {notification.userName?.charAt(0).toUpperCase()}
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                  <div className="min-w-0 flex-1">
                                    <div className="flex items-center justify-between">
                                      <p className="text-sm font-medium text-gray-900">
                                        {notification.type === 'status' ? 'Pembaruan Status' : notification.userName}
                                      </p>
                                      <p className="text-xs text-gray-400 whitespace-nowrap ml-2">
                                        {notification.timestamp.toLocaleString('id-ID', {
                                          hour: '2-digit',
                                          minute: '2-digit'
                                        })}
                                      </p>
                                    </div>
                                    <p className="mt-1 text-sm text-gray-500 line-clamp-2">
                                      {notification.type === 'status' ? (
                                        <span>
                                          <span className="font-medium text-blue-900">{notification.requestName}</span>{' '}
                                          <span className={`font-medium ${
                                            notification.status === 'approved' ? 'text-green-600' :
                                            notification.status === 'rejected' ? 'text-red-600' :
                                            'text-yellow-600'
                                          }`}>
                                            {notification.message}
                                          </span>
                                        </span>
                                      ) : (
                                        <>
                                          Komentar pada <span className="font-medium text-blue-900">{notification.requestName}</span>
                                        </>
                                      )}
                                    </p>
                                    {notification.type === 'comment' && (
                                      <p className="mt-1 text-sm text-gray-600 line-clamp-2">
                                        "{notification.message}"
                                      </p>
                                    )}
                                    <p className="mt-1 text-xs text-gray-400">
                                      {notification.timestamp.toLocaleString('id-ID', {
                                        year: 'numeric',
                                        month: 'long',
                                        day: 'numeric'
                                      })}
                                    </p>
                                  </div>
                                  {!notification.read && (
                                    <div className="flex-shrink-0">
                                      <div className="h-2.5 w-2.5 rounded-full bg-blue-600 ring-2 ring-blue-600/20"></div>
                                    </div>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>

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