import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useUser } from '../context/UserContext';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../firebase';

const HomePage = () => {
  const { profile, user } = useUser();
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterDateRange, setFilterDateRange] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetchRequests();
  }, [user]);

  const fetchRequests = async () => {
    if (!user) return;
    
    try {
      setLoading(true);
      const brdRef = collection(db, 'brd_requests');
      const q = query(brdRef, where('createdBy', '==', user.uid));
      const querySnapshot = await getDocs(q);
      const requestsData = querySnapshot.docs.map(doc => {
        const data = doc.data();
        // Handle both Timestamp and string date formats
        const createdAt = data.createdAt?.toDate ? data.createdAt.toDate() : data.createdAt ? new Date(data.createdAt) : null;
        const updatedAt = data.updatedAt?.toDate ? data.updatedAt.toDate() : data.updatedAt ? new Date(data.updatedAt) : null;
        const assignedAt = data.assignedAt?.toDate ? data.assignedAt.toDate() : data.assignedAt ? new Date(data.assignedAt) : null;
        
        return {
          id: doc.id,
          ...data,
          createdAt,
          updatedAt,
          assignedAt
        };
      });
      setRequests(requestsData.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)));
    } catch (error) {
      console.error('Error fetching requests:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    if (isRefreshing) return;
    
    try {
      setIsRefreshing(true);
      await fetchRequests();
    } finally {
      setIsRefreshing(false);
    }
  };

  const getStatusMessage = (request) => {
    switch (request.status) {
      case 'New':
        return request.assignedAnalystId ? 
          `Menunggu Review Analyst - ${request.assignedAnalystName || '-'}` : 
          'Menunggu admin untuk menugaskan analis';
      case 'Pending Review':
        return `Menunggu review dari ${request.assignedAnalystName || '-'}`;
      case 'In Progress':
      case 'Sedang Diproses':
        return `Sedang dikerjakan oleh ${request.assignedAnalystName || '-'}`;
      case 'Already Generated':
      case 'Pembuatan Dokumen':
        return `BRD telah dibuat oleh ${request.assignedAnalystName || '-'}`;
      case 'Completed':
      case 'Selesai':
        return `Selesai dikerjakan oleh ${request.assignedAnalystName || '-'}`;
      case 'Rejected':
        return `Ditolak${request.rejectReason ? `: ${request.rejectReason}` : ''}`;
      default:
        return 'Status tidak diketahui';
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'New':
        return 'bg-blue-50 text-blue-700';
      case 'Pending Review':
        return 'bg-amber-50 text-amber-700';
      case 'In Progress':
      case 'Sedang Diproses':
        return 'bg-indigo-50 text-indigo-700';
      case 'Already Generated':
      case 'Pembuatan Dokumen':
        return 'bg-emerald-50 text-emerald-700';
      case 'Completed':
      case 'Selesai':
        return 'bg-green-50 text-green-700';
      case 'Rejected':
        return 'bg-red-50 text-red-700';
      default:
        return 'bg-gray-50 text-gray-700';
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'New':
        return (
          <svg className="w-4 h-4 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
          </svg>
        );
      case 'Pending Review':
        return (
          <svg className="w-4 h-4 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
          </svg>
        );
      case 'In Progress':
        return (
          <svg className="w-4 h-4 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        );
      case 'Generated':
        return (
          <svg className="w-4 h-4 text-purple-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        );
      case 'Completed':
        return (
          <svg className="w-4 h-4 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        );
      case 'Rejected':
        return (
          <svg className="w-4 h-4 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        );
      default:
        return (
          <svg className="w-4 h-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        );
    }
  };

  const StatCard = ({ title, value, icon, color, bgColor, textColor }) => (
    <div className="bg-white rounded-xl shadow-md hover:shadow-lg transition-shadow duration-200 p-6">
      <div className="flex items-center space-x-4">
        <div className={`p-3 rounded-xl ${bgColor}`}>
          <div className={`${textColor}`}>
            {icon}
          </div>
        </div>
        <div>
          <p className="text-sm font-medium text-gray-600">{title}</p>
          <p className="text-2xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent">
            {value}
          </p>
        </div>
      </div>
    </div>
  );

  const getFilteredRequests = () => {
    return requests.filter(request => {
      let matchesStatus = filterStatus === 'all';
      
      if (!matchesStatus) {
        if (filterStatus === 'In Progress') {
          matchesStatus = request.status === 'In Progress' || request.status === 'Sedang Diproses';
        } else if (filterStatus === 'Sedang Diproses') {
          matchesStatus = request.status === 'In Progress' || request.status === 'Sedang Diproses';
        } else if (filterStatus === 'Pembuatan Dokumen') {
          matchesStatus = request.status === 'Generated' || request.status === 'Already Generated' || request.status === 'Pembuatan Dokumen';
        } else if (filterStatus === 'Selesai') {
          matchesStatus = request.status === 'Completed' || request.status === 'Selesai';
        } else {
          matchesStatus = request.status === filterStatus;
        }
      }
      
      const matchesSearch = 
        request.aplikasiDikembangkan?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        request.fiturDikembangkan?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        request.unitBisnis?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        request.nomorSurat?.toLowerCase().includes(searchTerm.toLowerCase());

      let matchesDate = true;
      const today = new Date();
      const requestDate = request.createdAt;

      if (filterDateRange === 'today') {
        matchesDate = requestDate?.toDateString() === today.toDateString();
      } else if (filterDateRange === 'week') {
        const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
        matchesDate = requestDate >= weekAgo;
      } else if (filterDateRange === 'month') {
        const monthAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
        matchesDate = requestDate >= monthAgo;
      }

      return matchesStatus && matchesSearch && matchesDate;
    });
  };

  const filteredRequests = getFilteredRequests();

  return (
    <div className="space-y-8">
      {/* Welcome Section */}
      <div className="bg-gradient-to-br from-blue-900 via-blue-800 to-blue-900 rounded-2xl shadow-xl p-8 text-white relative overflow-hidden">
        <div className="absolute inset-0 bg-grid-white/[0.05] bg-[size:20px_20px]"></div>
        <div className="relative">
          <h1 className="text-3xl font-bold">Selamat Datang, {profile?.namaLengkap}! 👋</h1>
          <p className="mt-2 text-blue-100 text-lg">
            {profile?.role === 'Business Requester' 
              ? 'Buat dan pantau permintaan BRD Anda dengan mudah' 
              : 'Kelola tugas Anda dan lihat permintaan yang telah ditugaskan'}
          </p>
        </div>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <StatCard
          title="Total Permintaan"
          value={requests.length}
          icon={
            <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          }
          bgColor="bg-blue-50"
          textColor="text-blue-600"
        />
        <StatCard
          title="Sedang Diproses"
          value={requests.filter(r => r.status === 'In Progress' || r.status === 'Sedang Diproses').length}
          icon={
            <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          }
          bgColor="bg-amber-50"
          textColor="text-amber-600"
        />
        <StatCard
          title="Selesai"
          value={requests.filter(r => r.status === 'Completed' || r.status === 'Selesai').length}
          icon={
            <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          }
          bgColor="bg-green-50"
          textColor="text-green-600"
        />
      </div>

      {/* Quick Actions */}
      <div className="flex justify-end">
        <Link
          to="/dashboard/create-brd"
          className="inline-flex items-center px-5 py-2.5 text-sm font-medium rounded-xl shadow-md text-white bg-gradient-to-r from-blue-900 to-blue-700 hover:from-blue-800 hover:to-blue-600 transition-all duration-200 group"
        >
          <svg className="h-5 w-5 mr-2 transition-transform duration-200 group-hover:scale-110" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Buat Permintaan Aplikasi Baru
        </Link>
      </div>

      {/* Requests List */}
      <div className="bg-white rounded-2xl shadow-xl overflow-hidden border border-gray-100">
        <div className="px-8 py-6 border-b border-gray-100">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center space-y-4 sm:space-y-0">
            <div>
              <h2 className="text-xl font-semibold text-gray-900">Daftar Permintaan BRD Anda</h2>
              <p className="text-sm text-gray-500 mt-1">Kelola dan pantau dokumen kebutuhan bisnis Anda</p>
            </div>
            
            <div className="flex flex-col space-y-4 w-full sm:w-auto">
              {/* Filters Row */}
              <div className="flex flex-wrap gap-3">
                {/* Search Input with better styling */}
                <div className="relative flex-grow sm:flex-grow-0 sm:w-64">
                  <input
                    type="text"
                    placeholder="Cari permintaan..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm bg-white shadow-sm"
                  />
                  <div className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400">
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                  </div>
                </div>

                {/* Status Filter with icon */}
                <div className="relative">
                  <select
                    value={filterStatus}
                    onChange={(e) => setFilterStatus(e.target.value)}
                    className="appearance-none pl-10 pr-8 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm bg-white shadow-sm cursor-pointer min-w-[160px]"
                  >
                    <option value="all">Semua Status</option>
                    <option value="New">Baru</option>
                    <option value="Pending Review">Menunggu Review</option>
                    <option value="In Progress">Sedang Diproses</option>
                    <option value="Sedang Diproses">Sedang Diproses</option>
                    <option value="Pembuatan Dokumen">Pembuatan Dokumen</option>
                    <option value="Selesai">Selesai</option>
                    <option value="Rejected">Ditolak</option>
                  </select>
                  <div className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400">
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 pointer-events-none">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </div>

                {/* Date Range Filter with icon */}
                <div className="relative">
                  <select
                    value={filterDateRange}
                    onChange={(e) => setFilterDateRange(e.target.value)}
                    className="appearance-none pl-10 pr-8 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm bg-white shadow-sm cursor-pointer min-w-[160px]"
                  >
                    <option value="all">Semua Waktu</option>
                    <option value="today">Hari Ini</option>
                    <option value="week">7 Hari Terakhir</option>
                    <option value="month">30 Hari Terakhir</option>
                  </select>
                  <div className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400">
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <div className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 pointer-events-none">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </div>

                {/* Refresh Button with better alignment */}
                <button
                  onClick={handleRefresh}
                  disabled={isRefreshing || loading}
                  className={`inline-flex items-center px-4 py-2 rounded-lg border shadow-sm transition-all duration-200 min-w-[120px] justify-center
                    ${isRefreshing || loading
                      ? 'bg-gray-50 text-gray-400 border-gray-200 cursor-not-allowed'
                      : 'border-gray-200 hover:border-blue-500 hover:text-blue-600 text-gray-600 hover:bg-blue-50'
                    }`}
                >
                  <svg
                    className={`w-4 h-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                    />
                  </svg>
                  {isRefreshing ? 'Memperbarui...' : 'Perbarui'}
                </button>
              </div>

            </div>
          </div>
        </div>
        
        {loading ? (
          <div className="p-12 text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-900 mx-auto"></div>
            <p className="mt-4 text-gray-500 text-sm">Memuat permintaan Anda...</p>
          </div>
        ) : filteredRequests.length === 0 ? (
          <div className="p-12 text-center">
            <div className="mx-auto w-24 h-24 bg-blue-50 rounded-full flex items-center justify-center mb-4">
              <svg className="w-12 h-12 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">Belum Ada Permintaan BRD</h3>
            <p className="text-gray-500 mb-6">Mulai dengan membuat dokumen kebutuhan bisnis pertama Anda</p>
            <Link
              to="/dashboard/create-brd"
              className="inline-flex items-center px-4 py-2 text-sm font-medium rounded-lg text-white bg-blue-600 hover:bg-blue-700 transition-colors duration-200"
            >
              <svg className="w-5 h-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Buat Permintaan Baru
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-100">
              <thead>
                <tr className="bg-gray-50">
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Nomor & Tanggal
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Aplikasi & Fitur
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Unit Bisnis
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Analis Bisnis
                  </th>
                  <th className="px-6 py-4 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Aksi
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 bg-white">
                {filteredRequests.map((request) => (
                  <tr key={request.id} className="hover:bg-gray-50/50 transition-colors duration-150">
                    <td className="px-6 py-4">
                      <div className="flex flex-col">
                        <span className="text-sm font-semibold text-gray-900">
                          {request.nomorSurat || 'Nomor Pending'}
                        </span>
                        <span className="text-xs text-gray-500 mt-1 flex items-center">
                          <svg className="w-3.5 h-3.5 mr-1 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                          {request.createdAt?.toLocaleDateString('id-ID', { 
                            year: 'numeric', 
                            month: 'long', 
                            day: 'numeric' 
                          })}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col">
                        <span className="text-sm font-semibold text-gray-900">
                          {request.aplikasiDikembangkan || '-'}
                        </span>
                        <span className="text-xs text-gray-500 mt-1 line-clamp-1">
                          {request.fiturDikembangkan || 'Fitur belum ditentukan'}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center">
                        <div className="h-8 w-8 rounded-lg bg-blue-50 flex items-center justify-center mr-3">
                          <svg className="w-4 h-4 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                          </svg>
                        </div>
                        <span className="text-sm text-gray-900">
                          {request.unitBisnis || '-'}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center space-x-2">
                        <span className={`px-3 py-1 inline-flex items-center text-xs leading-5 font-semibold rounded-full ${getStatusColor(request.status)}`}>
                          <span className="mr-1.5">{getStatusIcon(request.status)}</span>
                          {request.status === 'New' ? 'Baru' :
                           request.status === 'Pending Review' ? 'Menunggu Review' :
                           request.status === 'In Progress' || request.status === 'Sedang Diproses' ? 'Sedang Diproses' :
                           request.status === 'Generated' || request.status === 'Already Generated' || request.status === 'Pembuatan Dokumen' ? 'Pembuatan Dokumen' :
                           request.status === 'Completed' || request.status === 'Selesai' ? 'Selesai' :
                           request.status === 'Rejected' ? 'Ditolak' :
                           request.status}
                        </span>
                      </div>
                      <div className="mt-1 text-xs text-gray-500">
                        {getStatusMessage(request)}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      {request.assignedAnalystId ? (
                        <div className="flex items-start space-x-3">
                          <div className="flex-shrink-0">
                            <div className="h-8 w-8 rounded-lg bg-indigo-50 flex items-center justify-center">
                              <svg className="w-4 h-4 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                              </svg>
                            </div>
                          </div>
                          <div>
                            <div className="text-sm font-medium text-gray-900">{request.assignedAnalystName}</div>
                            <div className="text-xs text-gray-500 mt-0.5">
                              {request.status === 'New' ? 'Menunggu Review' :
                               request.status === 'In Progress' ? 'Sedang Mengerjakan' :
                               request.status === 'Already Generated' ? 'Memasuki Tahap Generating' :
                               request.status === 'Completed' ? 'Selesai' : 'Menunggu Review'}
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center text-gray-500">
                          <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          <span className="text-sm">Menunggu Penugasan</span>
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      {(request.status === 'In Progress' || request.status === 'Already Generated' || 
                        request.status === 'Sedang Diproses' || request.status === 'Pembuatan Dokumen') ? (
                        <Link
                          to={`/dashboard/request/${request.id}`}
                          className="inline-flex items-center px-3 py-1.5 text-sm font-medium rounded-lg text-blue-600 hover:text-blue-700 hover:bg-blue-50 transition-colors duration-200"
                        >
                          {request.status === 'Already Generated' || request.status === 'Pembuatan Dokumen' ? 'Lihat Detail' : 'Buka Ruang Kerja'}
                          <svg className="w-4 h-4 ml-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                        </Link>
                      ) : (
                        <div className="inline-flex items-center px-3 py-1.5 text-sm font-medium rounded-lg text-gray-400 bg-gray-50 cursor-not-allowed">
                          <svg className="w-4 h-4 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            {request.status === 'Completed' || request.status === 'Selesai' ? (
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            ) : (
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                            )}
                          </svg>
                          {!request.assignedAnalystId ? 'Menunggu Penugasan' : 
                           request.status === 'New' ? 'Menunggu Review Analyst' :
                           request.status === 'Pending Review' ? 'Menunggu Review' :
                           request.status === 'Completed' || request.status === 'Selesai' ? 'BRD Telah Selesai' : 'Tidak Dapat Diakses'}
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default HomePage; 