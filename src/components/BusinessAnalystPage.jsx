import { useState, useEffect } from 'react';
import { useUser } from '../context/UserContext';
import { collection, query, where, getDocs, doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { Link } from 'react-router-dom';

const BusinessAnalystPage = () => {
  const { profile, user } = useUser();
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [updating, setUpdating] = useState(null);

  useEffect(() => {
    fetchAssignedRequests();
  }, [user]);

  const fetchAssignedRequests = async () => {
    if (!user) return;
    
    try {
      setLoading(true);
      const brdRef = collection(db, 'brd_requests');
      const q = query(brdRef, where('assignedAnalystId', '==', user.uid));
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
      console.error('Error fetching assigned requests:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (requestId, newStatus) => {
    try {
      setUpdating(requestId);
      const requestRef = doc(db, 'brd_requests', requestId);
      await updateDoc(requestRef, {
        status: newStatus,
        updatedAt: serverTimestamp()
      });
      
      // Update local state with proper date handling
      setRequests(requests.map(req => 
        req.id === requestId 
          ? { 
              ...req, 
              status: newStatus, 
              updatedAt: new Date() // Use current date for immediate UI update
            }
          : req
      ));
    } catch (error) {
      console.error('Error updating request status:', error);
    } finally {
      setUpdating(null);
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'New':
        return 'bg-blue-100 text-blue-800';
      case 'Pending Review':
        return 'bg-yellow-100 text-yellow-800';
      case 'In Progress':
      case 'Sedang Diproses':
        return 'bg-blue-100 text-blue-800';
      case 'Already Generated':
      case 'Pembuatan Dokumen':
        return 'bg-emerald-100 text-emerald-800';
      case 'Completed':
      case 'Selesai':
        return 'bg-green-100 text-green-800';
      case 'Rejected':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const filteredRequests = selectedStatus === 'all' 
    ? requests 
    : requests.filter(request => {
        if (selectedStatus === 'In Progress') {
          return request.status === 'In Progress' || request.status === 'Sedang Diproses';
        } else if (selectedStatus === 'Already Generated') {
          return request.status === 'Already Generated' || request.status === 'Pembuatan Dokumen';
        } else if (selectedStatus === 'Completed') {
          return request.status === 'Completed' || request.status === 'Selesai';
        } else {
          return request.status === selectedStatus;
        }
      });

  const StatCard = ({ title, value, icon, color }) => (
    <div className="bg-white rounded-xl shadow-md p-6 flex items-center space-x-4">
      <div className={`p-3 rounded-lg ${color}`}>
        {icon}
      </div>
      <div>
        <p className="text-sm text-gray-600">{title}</p>
        <p className="text-2xl font-bold text-gray-900">{value}</p>
      </div>
    </div>
  );

  return (
    <div className="space-y-8 p-6">
      {/* Welcome Section with improved gradient and card design */}
      <div className="bg-gradient-to-br from-blue-900 via-blue-800 to-blue-700 rounded-3xl shadow-xl p-8 text-white relative overflow-hidden">
        <div className="absolute inset-0 bg-pattern opacity-10"></div>
        <div className="relative z-10">
          <div className="flex items-center space-x-4">
            <div className="p-3 bg-white/10 rounded-2xl backdrop-blur-lg">
              <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            </div>
            <div>
              <h1 className="text-3xl font-bold">Dashboard Analis Bisnis</h1>
              <p className="mt-2 text-blue-100 text-lg">
                Selamat datang kembali, {profile?.namaLengkap}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Stats Overview with improved card design */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white rounded-2xl shadow-lg p-6 transform transition-all duration-200 hover:scale-105">
          <div className="flex items-center justify-between">
            <div className="p-3 bg-blue-50 rounded-2xl">
              <svg className="w-8 h-8 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <span className="text-3xl font-bold text-gray-900">{requests.length}</span>
          </div>
          <p className="mt-4 text-sm font-medium text-gray-600">Total Ditugaskan</p>
          <div className="mt-2 h-1 w-full bg-blue-100 rounded-full overflow-hidden">
            <div className="h-full bg-blue-600 rounded-full" style={{ width: '100%' }}></div>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-lg p-6 transform transition-all duration-200 hover:scale-105">
          <div className="flex items-center justify-between">
            <div className="p-3 bg-yellow-50 rounded-2xl">
              <svg className="w-8 h-8 text-yellow-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
            </div>
            <span className="text-3xl font-bold text-gray-900">{requests.filter(r => r.status === 'Pending Review').length}</span>
          </div>
          <p className="mt-4 text-sm font-medium text-gray-600">Menunggu Review</p>
          <div className="mt-2 h-1 w-full bg-yellow-100 rounded-full overflow-hidden">
            <div className="h-full bg-yellow-600 rounded-full" style={{ width: `${(requests.filter(r => r.status === 'Pending Review').length / requests.length) * 100}%` }}></div>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-lg p-6 transform transition-all duration-200 hover:scale-105">
          <div className="flex items-center justify-between">
            <div className="p-3 bg-indigo-50 rounded-2xl">
              <svg className="w-8 h-8 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <span className="text-3xl font-bold text-gray-900">{requests.filter(r => r.status === 'In Progress' || r.status === 'Sedang Diproses').length}</span>
          </div>
          <p className="mt-4 text-sm font-medium text-gray-600">Sedang Dikerjakan</p>
          <div className="mt-2 h-1 w-full bg-indigo-100 rounded-full overflow-hidden">
            <div className="h-full bg-indigo-600 rounded-full" style={{ width: `${(requests.filter(r => r.status === 'In Progress' || r.status === 'Sedang Diproses').length / requests.length) * 100}%` }}></div>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-lg p-6 transform transition-all duration-200 hover:scale-105">
          <div className="flex items-center justify-between">
            <div className="p-3 bg-green-50 rounded-2xl">
              <svg className="w-8 h-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <span className="text-3xl font-bold text-gray-900">{requests.filter(r => r.status === 'Completed' || r.status === 'Selesai').length}</span>
          </div>
          <p className="mt-4 text-sm font-medium text-gray-600">Selesai</p>
          <div className="mt-2 h-1 w-full bg-green-100 rounded-full overflow-hidden">
            <div className="h-full bg-green-600 rounded-full" style={{ width: `${(requests.filter(r => r.status === 'Completed' || r.status === 'Selesai').length / requests.length) * 100}%` }}></div>
          </div>
        </div>
      </div>

      {/* Filter and Refresh Section */}
      <div className="flex justify-between items-center bg-white rounded-2xl shadow-lg p-4">
        <select
          value={selectedStatus}
          onChange={(e) => setSelectedStatus(e.target.value)}
          className="block w-64 rounded-xl border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 transition-all duration-200"
        >
          <option value="all">Semua Permintaan</option>
          <option value="Pending Review">Menunggu Review</option>
          <option value="In Progress">Sedang Dikerjakan</option>
          <option value="Already Generated">Sudah Dibuat</option>
          <option value="Completed">Selesai</option>
          <option value="Rejected">Ditolak</option>
        </select>
        <button
          onClick={fetchAssignedRequests}
          className="inline-flex items-center px-6 py-3 border border-transparent text-sm font-medium rounded-xl text-white bg-blue-900 hover:bg-blue-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transform transition-all duration-200 hover:scale-105"
        >
          <svg className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Refresh Data
        </button>
      </div>

      {/* Requests List with improved table design */}
      <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
        <div className="px-8 py-6 border-b border-gray-200 bg-gradient-to-r from-gray-50 to-white">
          <h2 className="text-xl font-semibold text-gray-900">Permintaan BRD yang Ditugaskan</h2>
        </div>
        
        {loading ? (
          <div className="p-12 text-center">
            <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-900 mx-auto"></div>
            <p className="mt-6 text-gray-500 text-lg">Memuat permintaan...</p>
          </div>
        ) : filteredRequests.length === 0 ? (
          <div className="p-12 text-center">
            <div className="mx-auto w-32 h-32 bg-gray-50 rounded-full flex items-center justify-center mb-6">
              <svg className="w-16 h-16 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            </div>
            <p className="text-gray-500 text-lg mb-3">Tidak ada permintaan yang ditugaskan</p>
            <p className="text-sm text-gray-400">Permintaan baru akan muncul di sini saat admin menugaskannya kepada Anda</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-8 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Detail BRD
                  </th>
                  <th className="px-8 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Pemohon
                  </th>
                  <th className="px-8 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Detail Project
                  </th>
                  <th className="px-8 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-8 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Aksi
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredRequests.map((request) => (
                  <tr key={request.id} className="hover:bg-gray-50 transition-colors duration-150">
                    <td className="px-8 py-5">
                      <div className="flex flex-col">
                        <span className="text-sm font-semibold text-gray-900">
                          {request.nomorSurat}
                        </span>
                        <span className="text-xs text-gray-500 mt-1">
                          Dibuat: {request.createdAt?.toLocaleDateString('id-ID', {
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric'
                          })}
                        </span>
                      </div>
                    </td>
                    <td className="px-8 py-5">
                      <div className="flex items-center space-x-3">
                        <div className="flex-shrink-0 h-10 w-10 bg-blue-100 rounded-full flex items-center justify-center">
                          <span className="text-blue-600 font-medium text-sm">
                            {request.createdByName?.charAt(0)}
                          </span>
                        </div>
                        <div className="flex flex-col">
                          <span className="text-sm font-medium text-gray-900">
                            {request.createdByName}
                          </span>
                          <span className="text-xs text-gray-500">
                            {request.unitBisnis}
                          </span>
                        </div>
                      </div>
                    </td>
                    <td className="px-8 py-5">
                      <div className="flex flex-col">
                        <span className="text-sm font-medium text-gray-900">
                          {request.aplikasiDikembangkan}
                        </span>
                        <span className="text-xs text-gray-500 line-clamp-1 mt-1">
                          {request.fiturDikembangkan}
                        </span>
                      </div>
                    </td>
                    <td className="px-8 py-5">
                      <select
                        value={request.status}
                        onChange={(e) => handleStatusChange(request.id, e.target.value)}
                        disabled={updating === request.id}
                        className={`block w-full rounded-xl shadow-sm text-sm transition-all duration-200
                          ${request.status === 'Pending Review' ? 'bg-yellow-50 border-yellow-300 text-yellow-800' :
                            request.status === 'In Progress' || request.status === 'Sedang Diproses' ? 'bg-blue-50 border-blue-300 text-blue-800' :
                            request.status === 'Already Generated' || request.status === 'Pembuatan Dokumen' ? 'bg-emerald-50 border-emerald-300 text-emerald-800' :
                            request.status === 'Completed' || request.status === 'Selesai' ? 'bg-green-50 border-green-300 text-green-800' :
                            request.status === 'Rejected' ? 'bg-red-50 border-red-300 text-red-800' :
                            'border-gray-300'} 
                          focus:border-blue-500 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed`}
                      >
                        <option value="Pending Review">Menunggu Review</option>
                        <option value="Sedang Diproses">Sedang Dikerjakan</option>
                        <option value="Pembuatan Dokumen">Pembuatan Dokumen</option>
                        <option value="Selesai">Selesai</option>
                        <option value="Rejected">Ditolak</option>
                      </select>
                    </td>
                    <td className="px-8 py-5">
                      <Link
                        to={`/dashboard/request/${request.id}`}
                        className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-xl text-blue-900 bg-blue-100 hover:bg-blue-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-all duration-200 transform hover:scale-105"
                      >
                        Buka Workspace
                        <svg className="ml-2 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                        </svg>
                      </Link>
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

export default BusinessAnalystPage; 