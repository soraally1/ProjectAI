import { useState, useEffect } from 'react';
import { collection, query, getDocs, doc, updateDoc, orderBy } from 'firebase/firestore';
import { db } from '../firebase';
import { toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { useUser } from '../context/UserContext';

const UserManagement = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState(null);
  const [editingUser, setEditingUser] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterRole, setFilterRole] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [stats, setStats] = useState({
    totalUsers: 0,
    businessAnalysts: 0,
    businessRequesters: 0,
    activeUsers: 0,
    pendingUsers: 0,
    adminUsers: 0
  });
  
  const { user, profile } = useUser();

  useEffect(() => {
    if (profile?.isAdmin) {
      fetchUsers();
    } else {
      setLoading(false);
      toast.error('Anda tidak memiliki izin untuk mengakses halaman ini');
    }
  }, [profile]);

  useEffect(() => {
    // Calculate stats whenever users change
    const newStats = {
      totalUsers: users.length,
      businessAnalysts: users.filter(u => u.role === 'Business Analyst').length,
      businessRequesters: users.filter(u => u.role === 'Business Requester' || !u.role).length,
      activeUsers: users.filter(u => u.status === 'active').length,
      pendingUsers: users.filter(u => u.status === 'pending').length,
      adminUsers: users.filter(u => u.isAdmin).length
    };
    setStats(newStats);
  }, [users]);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const usersRef = collection(db, 'users');
      const q = query(usersRef, orderBy('namaLengkap'));
      const snapshot = await getDocs(q);
      const usersData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setUsers(usersData);
    } catch (error) {
      console.error('Error fetching users:', error);
      toast.error('Gagal mengambil data pengguna');
    } finally {
      setLoading(false);
    }
  };

  const handleRoleChange = async (userId, newRole) => {
    try {
      const userRef = doc(db, 'users', userId);
      await updateDoc(userRef, {
        role: newRole || 'Business Requester',
        isAdmin: newRole === 'Administrator',
        updatedAt: new Date()
      });
      
      setUsers(users.map(user => 
        user.id === userId ? { 
          ...user, 
          role: newRole || 'Business Requester',
          isAdmin: newRole === 'Administrator'
        } : user
      ));
      
      toast.success('Peran pengguna berhasil diperbarui');
    } catch (error) {
      console.error('Error updating user role:', error);
      toast.error('Gagal memperbarui peran pengguna');
    }
  };

  const handleStatusChange = async (userId, newStatus) => {
    if (!profile?.isAdmin) {
      toast.error('Anda tidak memiliki izin untuk melakukan tindakan ini');
      return;
    }

    try {
      const userRef = doc(db, 'users', userId);
      await updateDoc(userRef, {
        status: newStatus,
        updatedAt: new Date(),
        ...(newStatus === 'active' ? {
          approvedAt: new Date(),
          approvedBy: user.uid
        } : {})
      });
      
      setUsers(users.map(u => 
        u.id === userId ? { 
          ...u, 
          status: newStatus,
          ...(newStatus === 'active' ? {
            approvedAt: new Date(),
            approvedBy: user.uid
          } : {})
        } : u
      ));
      
      toast.success(newStatus === 'active' 
        ? 'Pengguna berhasil disetujui' 
        : 'Status pengguna berhasil diperbarui'
      );
    } catch (error) {
      console.error('Error updating user status:', error);
      if (error.code === 'permission-denied') {
        toast.error('Anda tidak memiliki izin untuk melakukan tindakan ini');
      } else {
        toast.error('Gagal memperbarui status pengguna');
      }
    }
  };

  const handleUserEdit = async (e) => {
    e.preventDefault();
    if (!editingUser) return;

    try {
      const userRef = doc(db, 'users', editingUser.id);
      await updateDoc(userRef, {
        ...editingUser,
        updatedAt: new Date()
      });

      setUsers(users.map(user => 
        user.id === editingUser.id ? editingUser : user
      ));

      setEditingUser(null);
      toast.success('Data pengguna berhasil diperbarui');
    } catch (error) {
      console.error('Error updating user:', error);
      toast.error('Gagal memperbarui data pengguna');
    }
  };

  const toggleUserAdmin = async (userId, currentIsAdmin) => {
    if (!profile?.isAdmin) {
      toast.error('Anda tidak memiliki izin untuk melakukan tindakan ini');
      return;
    }

    try {
      const userRef = doc(db, 'users', userId);
      await updateDoc(userRef, {
        isAdmin: !currentIsAdmin,
        updatedAt: new Date()
      });
      
      setUsers(users.map(u => 
        u.id === userId ? { ...u, isAdmin: !currentIsAdmin } : u
      ));
      
      toast.success(!currentIsAdmin 
        ? 'Pengguna berhasil dijadikan admin' 
        : 'Hak akses admin berhasil dicabut'
      );
    } catch (error) {
      console.error('Error toggling admin status:', error);
      toast.error('Gagal mengubah status admin pengguna');
    }
  };

  const filteredUsers = users.filter(user => {
    const matchesSearch = user.namaLengkap?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         user.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         user.unitBisnis?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesRole = filterRole === 'all' || 
                       (filterRole === 'Administrator' ? user.isAdmin : user.role === filterRole);
    
    const matchesStatus = filterStatus === 'all' || user.status === filterStatus;
    return matchesSearch && matchesRole && matchesStatus;
  });

  const StatCard = ({ title, value, icon, color, bgColor, borderColor }) => (
    <div className={`bg-white rounded-xl shadow-md p-6 border-l-4 ${borderColor} transform hover:scale-105 transition-transform duration-200`}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-600">{title}</p>
          <p className="mt-2 text-3xl font-bold text-gray-900">{value}</p>
        </div>
        <div className={`p-3 rounded-full ${bgColor}`}>
          <div className={`w-8 h-8 ${color}`}>
            {icon}
          </div>
        </div>
      </div>
    </div>
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-blue-900 mx-auto"></div>
          <p className="mt-4 text-gray-600">Memuat data pengguna...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header with Stats */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Manajemen Pengguna</h1>
          <p className="mt-2 text-sm text-gray-600">
            Kelola peran dan izin pengguna dalam sistem
          </p>
        </div>

        {/* Statistics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-6 mb-8">
          <StatCard
            title="Total Pengguna"
            value={stats.totalUsers}
            icon={
              <svg className="w-full h-full" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            }
            color="text-blue-600"
            bgColor="bg-blue-100"
            borderColor="border-blue-500"
          />
          <StatCard
            title="Business Analysts"
            value={stats.businessAnalysts}
            icon={
              <svg className="w-full h-full" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            }
            color="text-green-600"
            bgColor="bg-green-100"
            borderColor="border-green-500"
          />
          <StatCard
            title="Business Requesters"
            value={stats.businessRequesters}
            icon={
              <svg className="w-full h-full" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            }
            color="text-purple-600"
            bgColor="bg-purple-100"
            borderColor="border-purple-500"
          />
          <StatCard
            title="Pengguna Aktif"
            value={stats.activeUsers}
            icon={
              <svg className="w-full h-full" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            }
            color="text-emerald-600"
            bgColor="bg-emerald-100"
            borderColor="border-emerald-500"
          />
          <StatCard
            title="Menunggu Persetujuan"
            value={stats.pendingUsers}
            icon={
              <svg className="w-full h-full" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            }
            color="text-yellow-600"
            bgColor="bg-yellow-100"
            borderColor="border-yellow-500"
          />
          <StatCard
            title="Admin"
            value={stats.adminUsers}
            icon={
              <svg className="w-full h-full" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            }
            color="text-indigo-600"
            bgColor="bg-indigo-100"
            borderColor="border-indigo-500"
          />
        </div>

        {/* Filters and Search */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label htmlFor="search" className="block text-sm font-medium text-gray-700 mb-1">
                Cari Pengguna
              </label>
              <div className="relative rounded-md shadow-sm">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>
                <input
                  type="text"
                  name="search"
                  id="search"
                  className="focus:ring-blue-500 focus:border-blue-500 block w-full pl-10 sm:text-sm border-gray-300 rounded-md"
                  placeholder="Cari nama, email, atau unit bisnis..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </div>
            
            <div>
              <label htmlFor="role-filter" className="block text-sm font-medium text-gray-700 mb-1">
                Filter Peran
              </label>
              <select
                id="role-filter"
                className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md"
                value={filterRole}
                onChange={(e) => setFilterRole(e.target.value)}
              >
                <option value="all">Semua Peran</option>
                <option value="Admin">Admin</option>
                <option value="Business Analyst">Business Analyst</option>
                <option value="Business Requester">Business Requester</option>
              </select>
            </div>

            <div>
              <label htmlFor="status-filter" className="block text-sm font-medium text-gray-700 mb-1">
                Filter Status
              </label>
              <select
                id="status-filter"
                className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md"
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
              >
                <option value="all">Semua Status</option>
                <option value="active">Aktif</option>
                <option value="pending">Menunggu</option>
                <option value="suspended">Ditangguhkan</option>
              </select>
            </div>
          </div>
        </div>

        {/* User List */}
        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-medium text-gray-900">Daftar Pengguna</h2>
              <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800">
                {filteredUsers.length} Pengguna
              </span>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Pengguna
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Peran
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Unit Bisnis
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Tindakan
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredUsers.map(user => (
                  <tr key={user.id} className="hover:bg-gray-50 transition-colors duration-150">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="flex-shrink-0 h-10 w-10">
                          {user.photoURL ? (
                            <img className="h-10 w-10 rounded-full object-cover" src={user.photoURL} alt="" />
                          ) : (
                            <div className="h-10 w-10 rounded-full bg-gray-200 flex items-center justify-center">
                              <span className="text-xl font-medium text-gray-600">
                                {user.namaLengkap?.charAt(0)?.toUpperCase() || user.email?.charAt(0)?.toUpperCase()}
                              </span>
                            </div>
                          )}
                        </div>
                        <div className="ml-4">
                          <div className="text-sm font-medium text-gray-900">{user.namaLengkap}</div>
                          <div className="text-sm text-gray-500">{user.email}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <select
                        className="text-sm border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                        value={user.role || 'Business Requester'}
                        onChange={(e) => handleRoleChange(user.id, e.target.value)}
                        disabled={!profile?.isAdmin}
                      >
                        <option value="Business Requester">Business Requester</option>
                        <option value="Business Analyst">Business Analyst</option>
                        <option value="Administrator">Administrator</option>
                      </select>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full 
                        ${user.status === 'active' ? 'bg-green-100 text-green-800' : 
                          user.status === 'pending' ? 'bg-yellow-100 text-yellow-800' : 
                          'bg-red-100 text-red-800'}`}>
                        {user.status === 'active' ? 'Aktif' :
                         user.status === 'pending' ? 'Menunggu' : 'Ditangguhkan'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {user.unitBisnis || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <div className="flex space-x-4">
                        {user.status === 'pending' && profile?.isAdmin && (
                          <button
                            onClick={() => handleStatusChange(user.id, 'active')}
                            className="text-green-600 hover:text-green-900 transition-colors duration-150"
                          >
                            Setujui
                          </button>
                        )}
                        {user.status === 'active' && profile?.isAdmin && (
                          <button
                            onClick={() => handleStatusChange(user.id, 'suspended')}
                            className="text-red-600 hover:text-red-900 transition-colors duration-150"
                          >
                            Tangguhkan
                          </button>
                        )}
                        {user.status === 'suspended' && profile?.isAdmin && (
                          <button
                            onClick={() => handleStatusChange(user.id, 'active')}
                            className="text-blue-600 hover:text-blue-900 transition-colors duration-150"
                          >
                            Aktifkan
                          </button>
                        )}
                        {profile?.isAdmin && user.id !== profile.uid && (
                          <button
                            onClick={() => toggleUserAdmin(user.id, user.isAdmin)}
                            className={`${
                              user.isAdmin 
                                ? 'text-red-600 hover:text-red-900' 
                                : 'text-indigo-600 hover:text-indigo-900'
                            } transition-colors duration-150`}
                          >
                            {user.isAdmin ? 'Cabut Admin' : 'Jadikan Admin'}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {filteredUsers.length === 0 && (
            <div className="text-center py-12">
              <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
              </svg>
              <h3 className="mt-2 text-sm font-medium text-gray-900">Tidak ada pengguna ditemukan</h3>
              <p className="mt-1 text-sm text-gray-500">
                Coba sesuaikan filter pencarian Anda
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default UserManagement; 