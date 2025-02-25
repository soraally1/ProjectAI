import { useState, useEffect } from 'react';
import { collection, query, getDocs, doc, updateDoc, setDoc, where, serverTimestamp, orderBy, getDoc, addDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useUser } from '../context/UserContext';
import TemplateManagement from './TemplateManagement';
import UserManagement from './UserManagement';
import { toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import * as XLSX from 'xlsx';
import React from 'react';

const AdminPage = () => {
  const { user, profile } = useUser();
  const [activeTab, setActiveTab] = useState('requests');
  const [users, setUsers] = useState([]);
  const [requests, setRequests] = useState([]);
  const [analysts, setAnalysts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [stats, setStats] = useState({
    totalUsers: 0,
    businessAnalysts: 0,
    businessRequesters: 0,
    activeUsers: 0,
    pendingUsers: 0,
    totalRequests: 0,
    newRequests: 0,
    inProgressRequests: 0,
    completedRequests: 0,
    pendingReviewRequests: 0
  });
  const [selectedUser, setSelectedUser] = useState(null);
  const [editingUser, setEditingUser] = useState(null);
  const [systemSettings, setSystemSettings] = useState({
    maxUsersPerWorkspace: 10,
    maxProjectsPerUser: 5,
    defaultProjectDuration: 30,
    allowGuestAccess: false,
    maintenanceMode: false,
    maintenanceMessage: 'We are currently performing system maintenance. Please check back later.',
    systemNotification: '',
    emailNotificationsEnabled: true,
    autoApproveUsers: false,
    fileUploadSizeLimitMB: 10,
    allowedFileTypes: '.pdf,.doc,.docx,.xls,.xlsx',
    defaultPrompts: {
      brdGeneration: `Anda adalah seorang Business Analyst profesional di Bank Jateng dengan pengalaman lebih dari 10 tahun dalam menyusun Business Requirements Document (BRD).
Tugas Anda adalah menghasilkan konten BRD yang sangat detail, terstruktur, dan profesional sesuai standar perbankan.
Gunakan bahasa Indonesia yang formal, teknis, dan mudah dipahami.
Setiap bagian harus mencakup:
- Penjelasan detail dan komprehensif
- Contoh spesifik yang relevan dengan perbankan
- Referensi ke best practices industri perbankan
- Pertimbangan regulasi perbankan yang berlaku
- Aspek keamanan dan kepatuhan yang relevan`,
      brdInstruction: 'Hasilkan BRD lengkap berdasarkan informasi berikut:'
    }
  });
  const [activeSettingsTab, setActiveSettingsTab] = useState('general');
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [showRequestDetail, setShowRequestDetail] = useState(false);

  const [showAssignAnalystModal, setShowAssignAnalystModal] = useState(false);
  const [selectedAnalyst, setSelectedAnalyst] = useState('');

  // Define loadSystemSettings function
  const loadSystemSettings = async () => {
    if (!profile?.isAdmin) {
      toast.error('Anda tidak memiliki izin untuk mengakses pengaturan sistem');
      return;
    }

    try {
      const settingsRef = doc(db, 'system_settings', 'general');
      const settingsSnap = await getDoc(settingsRef);
      
      if (settingsSnap.exists()) {
        const data = settingsSnap.data();
        setSystemSettings(prevSettings => ({
          ...prevSettings,
          ...data,
          maintenanceMode: data.maintenanceMode || false,
          maintenanceMessage: data.maintenanceMessage || 'We are currently performing system maintenance. Please check back later.'
        }));
      } else {
        // If settings don't exist, create them with default values
        const defaultSettings = {
          ...systemSettings,
          maintenanceMode: false,
          maintenanceMessage: 'We are currently performing system maintenance. Please check back later.',
          createdAt: serverTimestamp(),
          createdBy: user.uid,
          updatedAt: serverTimestamp(),
          updatedBy: user.uid
        };
        
        await setDoc(settingsRef, defaultSettings);
        setSystemSettings(defaultSettings);
        toast.success('Pengaturan sistem berhasil diinisialisasi dengan nilai default');
      }
    } catch (error) {
      console.error('Error loading system settings:', error);
      toast.error('Gagal memuat pengaturan sistem');
    }
  };

  useEffect(() => {
    if (profile?.isAdmin) {
      fetchRequests();
      fetchUsers();
      fetchAnalysts();
      loadSystemSettings();
    } else {
      toast.error('Anda tidak memiliki izin untuk mengakses halaman ini');
    }
  }, [profile]);

  useEffect(() => {
    // Calculate stats whenever users or requests change
    const newStats = {
      totalUsers: users.length,
      businessAnalysts: users.filter(u => u.role === 'Business Analyst').length,
      businessRequesters: users.filter(u => u.role === 'Business Requester' || !u.role).length,
      activeUsers: users.filter(u => u.status === 'active').length,
      pendingUsers: users.filter(u => u.status === 'pending').length,
      totalRequests: requests.length,
      newRequests: requests.filter(r => r.status === 'New').length,
      inProgressRequests: requests.filter(r => r.status === 'In Progress').length,
      completedRequests: requests.filter(r => r.status === 'Completed').length,
      pendingReviewRequests: requests.filter(r => r.status === 'Pending Review').length
    };
    setStats(newStats);
  }, [users, requests]);

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
      setError('Failed to fetch users');
      toast.error('Failed to fetch users');
    } finally {
      setLoading(false);
    }
  };

  const fetchAnalysts = async () => {
    try {
      const usersRef = collection(db, 'users');
      const q = query(usersRef, where('role', '==', 'Business Analyst'));
      const querySnapshot = await getDocs(q);
      const analystsData = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setAnalysts(analystsData);
    } catch (error) {
      console.error('Error fetching analysts:', error);
    }
  };

  const updateUserRole = async (userId, newRole) => {
    try {
      const userRef = doc(db, 'users', userId);
      await updateDoc(userRef, {
        role: newRole,
        updatedAt: new Date()
      });
      fetchUsers();
    } catch (error) {
      console.error('Error updating user role:', error);
      alert('Failed to update user role. Please try again.');
    }
  };

  const updateUserJabatan = async (userId, newJabatan) => {
    try {
      const userRef = doc(db, 'users', userId);
      await updateDoc(userRef, {
        jabatan: newJabatan,
        updatedAt: new Date()
      });
      fetchUsers();
    } catch (error) {
      console.error('Error updating user jabatan:', error);
      alert('Failed to update user jabatan. Please try again.');
    }
  };

  const toggleUserAdmin = async (userId, currentIsAdmin) => {
    try {
      const userRef = doc(db, 'users', userId);
      await updateDoc(userRef, {
        isAdmin: !currentIsAdmin,
        updatedAt: new Date()
      });
      fetchUsers(); // Refresh the list
    } catch (error) {
      console.error('Error updating admin status:', error);
      alert('Failed to update admin status. Please try again.');
    }
  };

  const fetchRequests = async () => {
    try {
      setLoading(true);
      const requestsRef = collection(db, 'brd_requests');
      const snapshot = await getDocs(requestsRef);
      const requestsData = snapshot.docs.map(doc => {
        const data = doc.data();
        // Handle both Timestamp and string date formats
        const updatedAt = data.updatedAt?.toDate ? data.updatedAt.toDate() : data.updatedAt ? new Date(data.updatedAt) : null;
        const createdAt = data.createdAt?.toDate ? data.createdAt.toDate() : data.createdAt ? new Date(data.createdAt) : null;
        
        return {
          id: doc.id,
          ...data,
          updatedAt,
          createdAt
        };
      });
      setRequests(requestsData);
    } catch (error) {
      console.error('Error fetching requests:', error);
      setError('Failed to fetch requests');
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (requestId, newStatus) => {
    try {
      const requestRef = doc(db, 'brd_requests', requestId);
      await updateDoc(requestRef, {
        status: newStatus,
        updatedAt: serverTimestamp(),
        updatedBy: user.uid,
        updatedByName: profile.namaLengkap
      });

      // Add activity log
      const activityRef = collection(db, 'brd_requests', requestId, 'activities');
      await addDoc(activityRef, {
        type: 'status_change',
        status: newStatus,
        timestamp: serverTimestamp(),
        userId: user.uid,
        userName: profile.namaLengkap,
        details: `Status permintaan diubah menjadi ${newStatus} oleh admin`
      });

      // Refresh requests data
      fetchRequests();
      
      toast.success(`Status berhasil diubah menjadi ${newStatus}`);
    } catch (error) {
      console.error('Error updating status:', error);
      toast.error('Gagal mengubah status permintaan');
    }
  };

  const handleApproveRequest = async (requestId) => {
    if (!selectedAnalyst) {
        toast.error('Silakan pilih analis bisnis terlebih dahulu');
        return;
      }
      
    try {
      const selectedAnalystDoc = await getDoc(doc(db, 'users', selectedAnalyst));
      if (!selectedAnalystDoc.exists()) {
        throw new Error('Analis tidak ditemukan');
      }
      const analystData = selectedAnalystDoc.data();

      const requestRef = doc(db, 'brd_requests', requestId);
      await updateDoc(requestRef, {
        status: 'In Progress',
        approvedAt: serverTimestamp(),
        approvedBy: user.uid,
        approvedByName: profile.namaLengkap,
        assignedAnalystId: selectedAnalyst,
        assignedAnalystName: analystData.namaLengkap,
        assignedAnalystPhotoURL: analystData.photoURL || null,
        assignedAt: serverTimestamp(),
        currentEditor: 'analyst',
        updatedAt: serverTimestamp(),
        updatedBy: user.uid,
        updatedByName: profile.namaLengkap
      });

      // Add activity log
      const activityRef = collection(db, 'brd_requests', requestId, 'activities');
      await addDoc(activityRef, {
        type: 'request_approved',
        timestamp: serverTimestamp(),
        userId: user.uid,
        userName: profile.namaLengkap,
        details: `Permintaan disetujui dan ditugaskan kepada ${analystData.namaLengkap}`
      });

      setSelectedAnalyst('');
      setShowAssignAnalystModal(false);
      fetchRequests();
      toast.success('Permintaan berhasil disetujui dan ditugaskan');
    } catch (error) {
      console.error('Error approving request:', error);
      toast.error('Gagal menyetujui permintaan');
    }
  };

  const handleRejectRequest = async (requestId, rejectReason) => {
    try {
      const requestRef = doc(db, 'brd_requests', requestId);
      await updateDoc(requestRef, {
        status: 'Rejected',
        rejectedAt: serverTimestamp(),
        rejectedBy: user.uid,
        rejectedByName: profile.namaLengkap,
        rejectReason: rejectReason,
        updatedAt: serverTimestamp(),
        updatedBy: user.uid,
        updatedByName: profile.namaLengkap
      });

      // Add activity log
      const activityRef = collection(db, 'brd_requests', requestId, 'activities');
      await addDoc(activityRef, {
        type: 'request_rejected',
        timestamp: serverTimestamp(),
        userId: user.uid,
        userName: profile.namaLengkap,
        details: `Permintaan ditolak oleh admin. Alasan: ${rejectReason}`
      });

      fetchRequests();
      toast.success('Permintaan berhasil ditolak');
    } catch (error) {
      console.error('Error rejecting request:', error);
      toast.error('Gagal menolak permintaan');
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'New':
        return 'bg-gray-100 text-gray-800';
      case 'Pending Review':
        return 'bg-yellow-100 text-yellow-800';
      case 'In Progress':
        return 'bg-blue-100 text-blue-800';
      case 'Completed':
        return 'bg-green-100 text-green-800';
      case 'Rejected':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

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

  const handleRoleChange = async (userId, newRole) => {
    try {
      const userRef = doc(db, 'users', userId);
      await updateDoc(userRef, {
        role: newRole,
        updatedAt: new Date()
      });
      
      // Update local state
      setUsers(users.map(user => 
        user.id === userId ? { ...user, role: newRole } : user
      ));
      
      toast.success('User role updated successfully');
    } catch (error) {
      console.error('Error updating user role:', error);
      toast.error('Failed to update user role');
    }
  };

  const handleStatusChangeUser = async (userId, newStatus) => {
    try {
      const userRef = doc(db, 'users', userId);
      await updateDoc(userRef, {
        status: newStatus,
        updatedAt: new Date()
      });
      
      // Update local state
      setUsers(users.map(user => 
        user.id === userId ? { ...user, status: newStatus } : user
      ));
      
      toast.success('User status updated successfully');
    } catch (error) {
      console.error('Error updating user status:', error);
      toast.error('Failed to update user status');
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

      // Update local state
      setUsers(users.map(user => 
        user.id === editingUser.id ? editingUser : user
      ));

      setEditingUser(null);
      toast.success('User updated successfully');
    } catch (error) {
      console.error('Error updating user:', error);
      toast.error('Failed to update user');
    }
  };

  const handleBackupData = async (format = 'json') => {
    if (!profile?.isAdmin) {
      toast.error('You do not have permission to backup data');
      return;
    }

    try {
      toast.info('Starting backup process...');
      const backupData = {
        users: [],
        brd_requests: [],
        brd_templates: [],
        system_settings: [],
        metadata: {
          timestamp: new Date().toISOString(),
          backupBy: user.uid,
          backupByName: profile.namaLengkap
        }
      };

      // Backup users
      const usersSnapshot = await getDocs(collection(db, 'users'));
      backupData.users = usersSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      // Backup BRD requests
      const requestsSnapshot = await getDocs(collection(db, 'brd_requests'));
      backupData.brd_requests = requestsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      // Backup BRD templates
      const templatesSnapshot = await getDocs(collection(db, 'brd_templates'));
      backupData.brd_templates = templatesSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      // Backup system settings
      const settingsSnapshot = await getDocs(collection(db, 'system_settings'));
      backupData.system_settings = settingsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      if (format === 'json') {
        // Export as JSON
        const jsonString = JSON.stringify(backupData, null, 2);
        const blob = new Blob([jsonString], { type: 'application/json' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `backup_${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      } else if (format === 'excel') {
        // Export as Excel
        const workbook = XLSX.utils.book_new();

        // Helper function to process large text
        const processLargeText = (text) => {
          if (typeof text !== 'string') return text;
          if (text.length <= 32000) return text; // Safe limit below Excel's max
          return text.substring(0, 32000) + '... (content truncated)';
        };

        // Convert each collection to worksheet
        const collections = ['users', 'brd_requests', 'brd_templates', 'system_settings'];
        collections.forEach(collection => {
          try {
            // Convert timestamps and complex objects to strings
            const processedData = backupData[collection].map(item => {
              const processedItem = {};
              Object.entries(item).forEach(([key, value]) => {
                let processedValue;
                if (value && typeof value === 'object') {
                  if (value.toDate) { // Firestore Timestamp
                    processedValue = value.toDate().toISOString();
                  } else if (value.seconds) { // Firestore Timestamp in seconds
                    processedValue = new Date(value.seconds * 1000).toISOString();
                  } else {
                    // For other objects, stringify and handle large content
                    try {
                      const stringified = JSON.stringify(value);
                      processedValue = processLargeText(stringified);
                    } catch (e) {
                      processedValue = 'Error: Content too complex';
                    }
                  }
                } else if (typeof value === 'string') {
                  processedValue = processLargeText(value);
                } else {
                  processedValue = value;
                }
                processedItem[key] = processedValue;
              });
              return processedItem;
            });

            const worksheet = XLSX.utils.json_to_sheet(processedData);
            XLSX.utils.book_append_sheet(workbook, worksheet, collection);
          } catch (error) {
            console.warn(`Warning: Could not process ${collection} fully, creating simplified version`, error);
            // Create a simplified version for problematic collections
            const safeData = [{
              warning: `Data for ${collection} was too large or complex for Excel format. Please use JSON export for complete data.`,
              timestamp: new Date().toISOString()
            }];
            const worksheet = XLSX.utils.json_to_sheet(safeData);
            XLSX.utils.book_append_sheet(workbook, worksheet, collection);
          }
        });

        // Add metadata sheet with warning
        const metadataSheet = XLSX.utils.json_to_sheet([{
          ...backupData.metadata,
          warning: 'Some content may be truncated due to Excel limitations. Use JSON format for complete data.',
          exportDate: new Date().toISOString()
        }]);
        XLSX.utils.book_append_sheet(workbook, metadataSheet, 'metadata');

        // Generate Excel file
        XLSX.writeFile(workbook, `backup_${new Date().toISOString().split('T')[0]}.xlsx`);
      } else if (format === 'mysql') {
        // Export as MySQL
        let sqlContent = `-- Backup generated on ${new Date().toISOString()}\n`;
        sqlContent += `-- Generated by: ${profile.namaLengkap}\n\n`;

        // Helper function to escape SQL values
        const escapeSqlValue = (value) => {
          if (value === null || value === undefined) return 'NULL';
          if (typeof value === 'number') return value;
          if (typeof value === 'boolean') return value ? 1 : 0;
          if (value instanceof Date) return `'${value.toISOString()}'`;
          if (typeof value === 'object') {
            if (value.toDate) return `'${value.toDate().toISOString()}'`;
            if (value.seconds) return `'${new Date(value.seconds * 1000).toISOString()}'`;
            return `'${JSON.stringify(value).replace(/'/g, "''")}'`;
          }
          return `'${String(value).replace(/'/g, "''")}'`;
        };

        // Generate CREATE TABLE and INSERT statements for each collection
        const collections = ['users', 'brd_requests', 'brd_templates', 'system_settings'];
        collections.forEach(collection => {
          const data = backupData[collection];
          if (data.length === 0) return;

          // Get all possible columns from the data
          const columns = new Set();
          data.forEach(item => {
            Object.keys(item).forEach(key => columns.add(key));
          });
          const columnsList = Array.from(columns);

          // Create table
          sqlContent += `\n-- Table structure for table \`${collection}\`\n`;
          sqlContent += `DROP TABLE IF EXISTS \`${collection}\`;\n`;
          sqlContent += `CREATE TABLE \`${collection}\` (\n`;
          columnsList.forEach((column, index) => {
            sqlContent += `  \`${column}\` TEXT${index < columnsList.length - 1 ? ',' : ''}\n`;
          });
          sqlContent += `);\n\n`;

          // Insert data
          sqlContent += `-- Dumping data for table \`${collection}\`\n`;
          data.forEach(item => {
            const values = columnsList.map(column => escapeSqlValue(item[column]));
            sqlContent += `INSERT INTO \`${collection}\` (\`${columnsList.join('`, `')}\`) VALUES (${values.join(', ')});\n`;
          });
          sqlContent += '\n';
        });

        // Download SQL file
        const blob = new Blob([sqlContent], { type: 'text/plain' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `backup_${new Date().toISOString().split('T')[0]}.sql`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      }

      toast.success('Backup completed successfully');
    } catch (error) {
      console.error('Error creating backup:', error);
      toast.error('Failed to create backup');
    }
  };

  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [selectedRequestId, setSelectedRequestId] = useState(null);

  const RejectModal = ({ isOpen, onClose, onConfirm }) => {
    if (!isOpen) return null;

    return (
      <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
        <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
          <div className="mt-3">
            <h3 className="text-lg font-medium text-gray-900">Alasan Penolakan</h3>
            <div className="mt-2">
              <textarea
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                rows="4"
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="Masukkan alasan penolakan..."
              />
            </div>
            <div className="mt-4 flex justify-end space-x-3">
              <button
                onClick={onClose}
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200"
              >
                Batal
              </button>
              <button
                onClick={() => {
                  onConfirm(rejectReason);
                  setRejectReason('');
                }}
                className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700"
                disabled={!rejectReason.trim()}
              >
                Tolak Permintaan
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const AssignAnalystModal = ({ isOpen, onClose, onConfirm, analysts }) => {
    if (!isOpen) return null;

    return (
      <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
        <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
          <div className="mt-3">
            <h3 className="text-lg font-medium text-gray-900">Pilih Analis Bisnis</h3>
            <div className="mt-2">
            <select
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                value={selectedAnalyst}
                onChange={(e) => setSelectedAnalyst(e.target.value)}
              >
                <option key="default" value="">Pilih Analis...</option>
                {analysts.map((analyst) => (
                  <option key={analyst.id} value={analyst.id}>
                    {analyst.namaLengkap}
                  </option>
                ))}
            </select>
          </div>
            <div className="mt-4 flex justify-end space-x-3">
          <button
                onClick={onClose}
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200"
              >
                Batal
              </button>
              <button
                onClick={() => onConfirm()}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                disabled={!selectedAnalyst}
              >
                Tugaskan & Setujui
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const handleResetAssignment = async (requestId) => {
    try {
      const requestRef = doc(db, 'brd_requests', requestId);
      await updateDoc(requestRef, {
        assignedAnalystId: null,
        assignedAnalystName: null,
        assignedAnalystPhotoURL: null,
        assignedAt: null,
        status: 'New',
        updatedAt: serverTimestamp(),
        updatedBy: user.uid,
        updatedByName: profile.namaLengkap
      });

      // Add activity log
      const activityRef = collection(db, 'brd_requests', requestId, 'activities');
      await addDoc(activityRef, {
        type: 'assignment_reset',
        timestamp: serverTimestamp(),
        userId: user.uid,
        userName: profile.namaLengkap,
        details: 'Penugasan analis bisnis telah direset oleh admin'
      });

      fetchRequests();
      toast.success('Penugasan berhasil direset');
    } catch (error) {
      console.error('Error resetting assignment:', error);
      toast.error('Gagal mereset penugasan');
    }
  };

  // Update the RequestDetailSection component
  const RequestDetailSection = ({ request }) => {
    return (
      <tr>
        <td colSpan="5" className="px-6 py-4 bg-gray-50">
          <div className="animate-fadeIn">
            <div className="bg-white rounded-lg shadow-lg p-6 relative">
              {/* Header Section */}
              <div className="border-b border-gray-200 pb-4 mb-6 sticky top-0 bg-white z-20">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">Detail Permintaan BRD</h3>
                    <p className="mt-1 text-sm text-gray-500">
                      Dibuat pada {request.createdAt?.toLocaleDateString('id-ID', {
                        day: 'numeric',
                        month: 'long',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </p>
                  </div>
                  <span className={`px-3 py-1 inline-flex text-sm leading-5 font-semibold rounded-full ${getStatusColor(request.status)}`}>
                    {request.status}
                  </span>
                </div>
              </div>

              {/* Content Area with padding for action buttons */}
              <div className="overflow-y-auto max-h-[calc(100vh-24rem)] pb-20">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  {/* Left Column */}
                  <div className="space-y-6">
                    <div className="bg-gray-50 rounded-lg p-4">
                      <h4 className="text-sm font-semibold text-gray-900 mb-4">Informasi Dokumen</h4>
                      <div className="space-y-4">
                        <div>
                          <label className="block text-xs font-medium text-gray-500">Nomor Surat</label>
                          <p className="mt-1 text-sm text-gray-900">{request.nomorSurat || '-'}</p>
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-500">Tanggal Pengajuan</label>
                          <p className="mt-1 text-sm text-gray-900">
                            {request.createdAt?.toLocaleDateString('id-ID', {
                              day: 'numeric',
                              month: 'long',
                              year: 'numeric'
                            }) || '-'}
                          </p>
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-500">Unit Bisnis</label>
                          <p className="mt-1 text-sm text-gray-900">{request.unitBisnis || '-'}</p>
                        </div>
                      </div>
                    </div>

                    <div className="bg-gray-50 rounded-lg p-4">
                      <h4 className="text-sm font-semibold text-gray-900 mb-4">Informasi Pengembangan</h4>
                      <div className="space-y-4">
                        <div>
                          <label className="block text-xs font-medium text-gray-500">Aplikasi yang Dikembangkan</label>
                          <p className="mt-1 text-sm text-gray-900">{request.aplikasiDikembangkan || '-'}</p>
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-500">Fitur yang Dikembangkan</label>
                          <p className="mt-1 text-sm text-gray-900">{request.fiturDikembangkan || '-'}</p>
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-500">Latar Belakang</label>
                          <p className="mt-1 text-sm text-gray-900">{request.latarBelakang || '-'}</p>
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-500">Manfaat yang Diharapkan</label>
                          <p className="mt-1 text-sm text-gray-900">{request.manfaatDiharapkan || '-'}</p>
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-500">Tujuan Pengembangan</label>
                          <p className="mt-1 text-sm text-gray-900">{request.tujuanPengembangan || '-'}</p>
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-500">Strategi Pelaksanaan</label>
                          <p className="mt-1 text-sm text-gray-900">{request.strategiPelaksanaan || '-'}</p>
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-500">Risiko Terkait</label>
                          <p className="mt-1 text-sm text-gray-900">{request.risikoTerkait || '-'}</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Right Column */}
                  <div className="space-y-6">
                    <div className="bg-gray-50 rounded-lg p-4">
                      <h4 className="text-sm font-semibold text-gray-900 mb-4">Informasi Pemohon</h4>
                      <div className="space-y-4">
                        <div>
                          <label className="block text-xs font-medium text-gray-500">Nama Pemohon</label>
                          <p className="mt-1 text-sm text-gray-900">{request.createdByName || '-'}</p>
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-500">Email Pemohon</label>
                          <p className="mt-1 text-sm text-gray-900">{request.createdByEmail || '-'}</p>
                        </div>
                      </div>
                    </div>

                    <div className="bg-gray-50 rounded-lg p-4">
                      <h4 className="text-sm font-semibold text-gray-900 mb-4">Status & Penugasan</h4>
                      <div className="space-y-4">
                        <div>
                          <label className="block text-xs font-medium text-gray-500">Status Saat Ini</label>
                          <span className={`mt-1 inline-flex px-2 text-xs leading-5 font-semibold rounded-full ${getStatusColor(request.status)}`}>
                            {request.status}
                          </span>
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-500">Analis Bisnis</label>
                          <div className="mt-1 flex items-center space-x-2">
                            <span className="h-6 w-6 rounded-full bg-blue-100 flex items-center justify-center">
                              <svg className="w-4 h-4 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                              </svg>
                            </span>
                            <span className="text-sm text-gray-900">{request.assignedAnalystName || 'Belum ditugaskan'}</span>
                          </div>
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-500">Tanggal Penugasan</label>
                          <p className="mt-1 text-sm text-gray-900">
                            {request.assignedAt ? new Date(request.assignedAt.seconds * 1000).toLocaleDateString('id-ID', {
                              day: 'numeric',
                              month: 'long',
                              year: 'numeric'
                            }) : '-'}
                          </p>
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-500">Terakhir Diperbarui</label>
                          <p className="mt-1 text-sm text-gray-900">
                            {request.updatedAt ? new Date(request.updatedAt).toLocaleDateString('id-ID', {
                              day: 'numeric',
                              month: 'long',
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit'
                            }) : '-'}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Action Buttons - Fixed Position */}
              {request.status === 'New' && (
                <div className="absolute bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-4">
                  <div className="flex justify-start space-x-3 px-2">
                    <button
                      onClick={() => {
                        setSelectedRequestId(request.id);
                        setShowAssignAnalystModal(true);
                      }}
                      className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 shadow-sm"
                    >
                      <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                      </svg>
                      Setujui & Tugaskan
                    </button>
                    <button
                      onClick={() => {
                        setSelectedRequestId(request.id);
                        setShowRejectModal(true);
                      }}
                      className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 shadow-sm"
                    >
                      <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                      Tolak
                    </button>
                  </div>
                </div>
              )}
              {request.status === 'In Progress' && request.assignedAnalystId && (
                <div className="absolute bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-4">
                  <div className="flex justify-start space-x-3 px-2">
                    <button
                      onClick={() => handleResetAssignment(request.id)}
                      className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 shadow-sm"
                    >
                      <svg className="w-4 h-4 mr-1.5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
                      Reset Penugasan
          </button>
        </div>
                </div>
              )}
            </div>
          </div>
        </td>
      </tr>
    );
  };

  // Update the renderRequestsTable function
  const renderRequestsTable = () => {
    // Filter requests based on selectedStatus
    const filteredRequests = selectedStatus === 'all' 
      ? requests 
      : requests.filter(request => request.status === selectedStatus);

    return (
      <div className="mt-4 bg-white rounded-lg shadow overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Nomor Surat
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Unit Bisnis
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Analis Bisnis
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Aksi
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredRequests.map((request) => (
                <React.Fragment key={request.id}>
                  <tr className={selectedRequest?.id === request.id ? 'bg-blue-50' : 'hover:bg-gray-50'}>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex flex-col">
                      <div className="text-sm font-medium text-gray-900">{request.nomorSurat}</div>
                      <div className="text-sm text-gray-500">
                        {request.createdAt?.toLocaleDateString('id-ID', {
                          day: 'numeric',
                          month: 'long',
                          year: 'numeric'
                        })}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">{request.unitBisnis}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusColor(request.status)}`}>
                      {request.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {request.status === 'New' ? (
                      <select
                        onChange={(e) => handleAssignAnalyst(request.id, e.target.value)}
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                        defaultValue=""
                      >
                        <option value="" disabled>Pilih Analis</option>
                        {analysts.map((analyst) => (
                          <option key={analyst.id} value={analyst.id}>
                            {analyst.namaLengkap}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <div className="text-sm text-gray-900">{request.assignedAnalystName || '-'}</div>
                    )}
                  </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex justify-end space-x-2">
                      <button
                          onClick={() => setSelectedRequest(selectedRequest?.id === request.id ? null : request)}
                          className={`inline-flex items-center px-3 py-1.5 text-sm font-medium rounded-md transition-colors duration-200 ${
                            selectedRequest?.id === request.id
                              ? 'text-blue-700 bg-blue-50'
                              : 'text-blue-600 hover:text-blue-700 hover:bg-blue-50'
                          }`}
                        >
                          <svg 
                            className={`w-4 h-4 mr-1.5 transform transition-transform duration-200 ${
                              selectedRequest?.id === request.id ? 'rotate-180' : ''
                            }`} 
                            fill="none" 
                            stroke="currentColor" 
                            viewBox="0 0 24 24"
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                          </svg>
                          {selectedRequest?.id === request.id ? 'Tutup' : 'Detail'}
                      </button>
                        {request.status === 'New' && (
                          <>
                            
                          </>
                    )}
                      </div>
                  </td>
                </tr>
                  {selectedRequest?.id === request.id && <RequestDetailSection request={request} />}
                </React.Fragment>
              ))}
            </tbody>
          </table>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-900"></div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header with Stats */}
      <div className="bg-white rounded-2xl shadow-lg p-6">
        <div className="flex flex-col gap-6">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Admin Dashboard</h1>
              <p className="mt-1 text-sm text-gray-500">Manage users and BRD requests</p>
            </div>
            <div className="flex items-center space-x-4">
              <button
                onClick={() => setActiveTab('requests')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                  activeTab === 'requests'
                    ? 'bg-blue-900 text-white'
                    : 'text-gray-700 hover:bg-blue-50'
                }`}
              >
                BRD Requests
              </button>
              <button
                onClick={() => setActiveTab('templates')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                  activeTab === 'templates'
                    ? 'bg-blue-900 text-white'
                    : 'text-gray-700 hover:bg-blue-50'
                }`}
              >
                Templates
              </button>
              <button
                onClick={() => setActiveTab('users')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                  activeTab === 'users'
                    ? 'bg-blue-900 text-white'
                    : 'text-gray-700 hover:bg-blue-50'
                }`}
              >
                Users
              </button>
              <button
                onClick={() => setActiveTab('settings')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                  activeTab === 'settings'
                    ? 'bg-blue-900 text-white'
                    : 'text-gray-700 hover:bg-blue-50'
                }`}
              >
                System Setting
              </button>
            </div>
          </div>

          {/* Statistics Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <StatCard
              title="Total Pengguna"
              value={stats.totalUsers}
              icon={
                <svg className="w-6 h-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              }
              color="bg-blue-50"
            />
            <StatCard
              title="Business Analysts"
              value={stats.businessAnalysts}
              icon={
                <svg className="w-6 h-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              }
              color="bg-green-50"
            />
            <StatCard
              title="Business Requesters"
              value={stats.businessRequesters}
              icon={
                <svg className="w-6 h-6 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
              }
              color="bg-purple-50"
            />
            <StatCard
              title="Total Permintaan"
              value={stats.totalRequests}
              icon={
                <svg className="w-6 h-6 text-yellow-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              }
              color="bg-yellow-50"
            />
          </div>

          {/* Request Status Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <StatCard
              title="Permintaan Baru"
              value={stats.newRequests}
              icon={
                <svg className="w-6 h-6 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
              }
              color="bg-gray-50"
            />
            <StatCard
              title="Dalam Review"
              value={stats.pendingReviewRequests}
              icon={
                <svg className="w-6 h-6 text-orange-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
              }
              color="bg-orange-50"
            />
            <StatCard
              title="Dalam Proses"
              value={stats.inProgressRequests}
              icon={
                <svg className="w-6 h-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              }
              color="bg-blue-50"
            />
            <StatCard
              title="Selesai"
              value={stats.completedRequests}
              icon={
                <svg className="w-6 h-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              }
              color="bg-green-50"
            />
          </div>

          {/* User Status Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
            <StatCard
              title="Pengguna Aktif"
              value={stats.activeUsers}
              icon={
                <svg className="w-6 h-6 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              }
              color="bg-emerald-50"
            />
            <StatCard
              title="Menunggu Persetujuan"
              value={stats.pendingUsers}
              icon={
                <svg className="w-6 h-6 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              }
              color="bg-amber-50"
            />
          </div>
        </div>
      </div>

      {/* Content Section */}
      <div className="mt-10 bg-white rounded-2xl shadow-lg overflow-hidden">
        {/* Tab-specific controls */}
        <div className="p-4 bg-gray-50 border-b border-gray-200">
          {activeTab === 'requests' && (
            <div className="flex justify-end">
              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                className="rounded-lg border-gray-300 text-sm focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="all">All Requests</option>
                <option value="New">New</option>
                <option value="Pending Review">Pending Review</option>
                <option value="In Progress">In Progress</option>
                <option value="Completed">Completed</option>
                <option value="Rejected">Rejected</option>
              </select>
            </div>
          )}
        </div>

        {/* Table Content */}
        {loading ? (
          <div className="p-8 text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-900 mx-auto"></div>
            <p className="mt-4 text-gray-500">Loading...</p>
          </div>
        ) : activeTab === 'requests' ? (
          renderRequestsTable()
        ) : activeTab === 'templates' ? (
          <TemplateManagement />
        ) : activeTab === 'users' ? (
          <UserManagement />
        ) : activeTab === 'settings' ? (
          <div className="p-6 space-y-8">
            {/* Settings Header */}
            <div className="border-b border-gray-200 pb-5">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900">System Settings</h2>
                  <p className="mt-1 text-sm text-gray-500">Konfigurasi pada sistem website</p>
                </div>
                <div className="flex items-center space-x-3">
                  <button
                    onClick={loadSystemSettings}
                    className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                  >
                    <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    Reload Settings
                  </button>
                  <button
                    onClick={async () => {
                      try {
                        const settingsRef = doc(db, 'system_settings', 'general');
                        await updateDoc(settingsRef, {
                          ...systemSettings,
                          updatedAt: serverTimestamp(),
                          updatedBy: user.uid
                        });
                        toast.success('Settings saved successfully');
                      } catch (error) {
                        console.error('Error saving settings:', error);
                        toast.error('Failed to save settings');
                      }
                    }}
                    className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                  >
                    <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    Save All Changes
                  </button>
                </div>
              </div>
              
              {/* Settings Navigation */}
              <div className="mt-6 border-b border-gray-200">
                <nav className="-mb-px flex space-x-8">
                  {['Access', 'AI Prompts', 'Backup'].map((tab) => (
                    <button
                      key={tab.toLowerCase()}
                      onClick={() => setActiveSettingsTab(tab.toLowerCase())}
                      className={`
                        whitespace-nowrap pb-4 px-1 border-b-2 font-medium text-sm
                        ${activeSettingsTab === tab.toLowerCase()
                          ? 'border-blue-500 text-blue-600'
                          : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}
                      `}
                    >
                      {tab}
                    </button>
                  ))}
                </nav>
              </div>
            </div>

            {/* Settings Content */}
            <div className="grid grid-cols-1 gap-8">
              {/* Access Settings */}
              {activeSettingsTab === 'access' && (
                <div className="bg-white rounded-lg shadow divide-y divide-gray-200">
                  <div className="p-6">
                    <h3 className="text-lg font-medium text-gray-900">Kontrol Akses</h3>
                    <p className="mt-1 text-sm text-gray-500">Kelola pengaturan akses dan keamanan pengguna.</p>
                    <div className="mt-6 space-y-6">
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <h4 className="text-sm font-medium text-gray-900">Izinkan Akses Tamu</h4>
                            <p className="text-xs text-gray-500 mt-1">Aktifkan akses untuk pengguna tidak terdaftar dengan izin terbatas.</p>
                          </div>
                          <button
                            onClick={() => setSystemSettings({
                              ...systemSettings,
                              allowGuestAccess: !systemSettings.allowGuestAccess
                            })}
                            className={`${
                              systemSettings.allowGuestAccess ? 'bg-blue-600' : 'bg-gray-200'
                            } relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2`}
                          >
                            <span
                              className={`${
                                systemSettings.allowGuestAccess ? 'translate-x-5' : 'translate-x-0'
                              } pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out`}
                            />
                          </button>
                        </div>

                        <div className="flex items-center justify-between">
                          <div>
                            <h4 className="text-sm font-medium text-gray-900">Mode Pemeliharaan</h4>
                            <p className="text-xs text-gray-500 mt-1">Nonaktifkan sementara akses ke aplikasi untuk pemeliharaan.</p>
                          </div>
                          <button
                            onClick={async () => {
                              try {
                                if (!systemSettings.maintenanceMode && 
                                    !window.confirm('Mengaktifkan mode pemeliharaan akan mencegah semua pengguna non-admin mengakses sistem. Anda yakin ingin melanjutkan?')) {
                                  return;
                                }

                                const settingsRef = doc(db, 'system_settings', 'general');
                                const newMaintenanceMode = !systemSettings.maintenanceMode;
                                
                                await updateDoc(settingsRef, {
                                  maintenanceMode: newMaintenanceMode,
                                  maintenanceMessage: systemSettings.maintenanceMessage,
                                  updatedAt: serverTimestamp(),
                                  updatedBy: user.uid
                                });

                                setSystemSettings(prev => ({
                                  ...prev,
                                  maintenanceMode: newMaintenanceMode
                                }));

                                toast.success(newMaintenanceMode ? 'Mode pemeliharaan diaktifkan' : 'Mode pemeliharaan dinonaktifkan');
                              } catch (error) {
                                console.error('Kesalahan saat mengubah mode pemeliharaan:', error);
                                toast.error('Gagal mengubah mode pemeliharaan');
                              }
                            }}
                            className={`${
                              systemSettings.maintenanceMode ? 'bg-blue-600' : 'bg-gray-200'
                            } relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2`}
                          >
                            <span
                              className={`${
                                systemSettings.maintenanceMode ? 'translate-x-5' : 'translate-x-0'
                              } pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out`}
                            />
                          </button>
                        </div>

                        {systemSettings.maintenanceMode && (
                          <div className="mt-4">
                            <label className="block text-sm font-medium text-gray-700">
                              Pesan Pemeliharaan
                            </label>
                            <div className="mt-1">
                              <textarea
                                value={systemSettings.maintenanceMessage}
                                onChange={async (e) => {
                                  const newMessage = e.target.value;
                                  setSystemSettings(prev => ({
                                    ...prev,
                                    maintenanceMessage: newMessage
                                  }));

                                  try {
                                    const settingsRef = doc(db, 'system_settings', 'general');
                                    await updateDoc(settingsRef, {
                                      maintenanceMessage: newMessage,
                                      updatedAt: serverTimestamp(),
                                      updatedBy: user.uid
                                    });
                                  } catch (error) {
                                    console.error('Kesalahan saat memperbarui pesan pemeliharaan:', error);
                                    toast.error('Gagal memperbarui pesan pemeliharaan');
                                  }
                                }}
                                onBlur={async () => {
                                  try {
                                    const settingsRef = doc(db, 'system_settings', 'general');
                                    await updateDoc(settingsRef, {
                                      maintenanceMessage: systemSettings.maintenanceMessage,
                                      updatedAt: serverTimestamp(),
                                      updatedBy: user.uid
                                    });
                                    toast.success('Pesan pemeliharaan tersimpan');
                                  } catch (error) {
                                    console.error('Kesalahan saat menyimpan pesan pemeliharaan:', error);
                                    toast.error('Gagal menyimpan pesan pemeliharaan');
                                  }
                                }}
                                rows={3}
                                className="block w-full rounded-md border-gray-300 shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                                placeholder="Masukkan pesan yang akan ditampilkan selama pemeliharaan..."
                              />
                            </div>
                            <p className="mt-2 text-xs text-gray-500">Pesan ini akan ditampilkan kepada pengguna selama mode pemeliharaan.</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* AI Prompts Settings */}
              {activeSettingsTab === 'ai prompts' && (
                <div className="bg-white rounded-lg shadow divide-y divide-gray-200">
                  <div className="p-6">
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="text-lg font-medium text-gray-900">Konfigurasi Prompt AI</h3>
                        <p className="mt-1 text-sm text-gray-500">Konfigurasi perilaku dan respons sistem AI untuk pembuatan BRD.</p>
                      </div>
                      <div className="ml-4 flex-shrink-0">
                        <button
                          onClick={() => {
                            if (window.confirm('Setel ulang prompt AI ke pengaturan default?')) {
                              const defaultPrompts = {
                                brdGeneration: `You are an expert Business Analyst at Bank Jateng with over 10 years of experience in creating Business Requirements Documents (BRD).
Your task is to generate content ONLY for the filled fields and sections in the BRD, following banking industry standards.
Use formal Indonesian language, technical banking terminology, and ensure compliance with banking regulations.
Do not generate content for unfilled fields or sections.
Each section should include:
- Detailed and comprehensive explanations
- Specific examples relevant to banking
- References to banking industry best practices
- Consideration of applicable banking regulations
- Relevant security and compliance aspects`,
                                brdInstruction: 'Generate a Business Requirements Document (BRD) based on the following filled template parameters:',
                                brdInstructions: `Generate content ONLY for sections with filled fields
Use formal Bahasa Indonesia throughout the document
Include specific banking industry context and terminology
Consider regulatory compliance and banking regulations
Focus on security and risk aspects
Generate detailed content only for provided field values
Use clear and concise language while maintaining technical accuracy
Format currency values in Indonesian Rupiah format
Maintain proper paragraph structure and formatting
Only reference and elaborate on the provided field values
Do not generate content for unfilled fields or sections
Add context and elaboration only around the provided values`
                              };

                              setSystemSettings(prev => ({
                                ...prev,
                                defaultPrompts: defaultPrompts
                              }));

                              // Update in Firestore
                              const settingsRef = doc(db, 'system_settings', 'general');
                              updateDoc(settingsRef, {
                                defaultPrompts: defaultPrompts,
                                updatedAt: serverTimestamp(),
                                updatedBy: user.uid
                              }).then(() => {
                                toast.success('AI prompts reset to default settings');
                              }).catch(error => {
                                console.error('Error resetting prompts:', error);
                                toast.error('Failed to reset prompts');
                              });
                            }
                          }}
                          className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                        >
                          Setel Ulang ke Default
                        </button>
                      </div>
                    </div>

                    <div className="mt-6 space-y-6">
                      <div>
                        <label className="block text-sm font-medium text-gray-700">
                          Prompt Sistem
                          <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                            Prompt Utama
                          </span>
                        </label>
                        <div className="mt-1">
                          <textarea
                            value={systemSettings.defaultPrompts?.brdGeneration || ''}
                            onChange={(e) => {
                              setSystemSettings(prev => ({
                                ...prev,
                                defaultPrompts: {
                                  ...prev.defaultPrompts,
                                  brdGeneration: e.target.value
                                }
                              }));
                            }}
                            onBlur={async () => {
                              try {
                                const settingsRef = doc(db, 'system_settings', 'general');
                                await updateDoc(settingsRef, {
                                  'defaultPrompts.brdGeneration': systemSettings.defaultPrompts?.brdGeneration,
                                  updatedAt: serverTimestamp(),
                                  updatedBy: user.uid
                                });
                                toast.success('System prompt saved');
                              } catch (error) {
                                console.error('Error saving system prompt:', error);
                                toast.error('Failed to save system prompt');
                              }
                            }}
                            rows={10}
                            className="block w-full rounded-md border-gray-300 shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm font-mono"
                            placeholder="Enter the main system prompt for BRD generation..."
                          />
                        </div>
                        <p className="mt-2 text-xs text-gray-500">This is the main prompt that defines the AI's role and behavior in generating BRD documents.</p>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700">
                          Instruksi Awal
                          <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                            Prompt Pembuka
                          </span>
                        </label>
                        <div className="mt-1">
                          <textarea
                            value={systemSettings.defaultPrompts?.brdInstruction || ''}
                            onChange={(e) => {
                              setSystemSettings(prev => ({
                                ...prev,
                                defaultPrompts: {
                                  ...prev.defaultPrompts,
                                  brdInstruction: e.target.value
                                }
                              }));
                            }}
                            onBlur={async () => {
                              try {
                                const settingsRef = doc(db, 'system_settings', 'general');
                                await updateDoc(settingsRef, {
                                  'defaultPrompts.brdInstruction': systemSettings.defaultPrompts?.brdInstruction,
                                  updatedAt: serverTimestamp(),
                                  updatedBy: user.uid
                                });
                                toast.success('Initial instruction saved');
                              } catch (error) {
                                console.error('Error saving initial instruction:', error);
                                toast.error('Failed to save initial instruction');
                              }
                            }}
                            rows={2}
                            className="block w-full rounded-md border-gray-300 shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm font-mono"
                            placeholder="Enter the initial instruction for BRD generation..."
                          />
                        </div>
                        <p className="mt-2 text-xs text-gray-500">This is the opening instruction that appears before the template parameters.</p>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700">
                          Instruksi Pembuatan
                          <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-800">
                            Instruksi Detail
                          </span>
                        </label>
                        <div className="mt-1">
                          <textarea
                            value={systemSettings.defaultPrompts?.brdInstructions || ''}
                            onChange={(e) => {
                              setSystemSettings(prev => ({
                                ...prev,
                                defaultPrompts: {
                                  ...prev.defaultPrompts,
                                  brdInstructions: e.target.value
                                }
                              }));
                            }}
                            onBlur={async () => {
                              try {
                                const settingsRef = doc(db, 'system_settings', 'general');
                                await updateDoc(settingsRef, {
                                  'defaultPrompts.brdInstructions': systemSettings.defaultPrompts?.brdInstructions,
                                  updatedAt: serverTimestamp(),
                                  updatedBy: user.uid
                                });
                                toast.success('Generation instructions saved');
                              } catch (error) {
                                console.error('Error saving generation instructions:', error);
                                toast.error('Failed to save generation instructions');
                              }
                            }}
                            rows={12}
                            className="block w-full rounded-md border-gray-300 shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm font-mono"
                            placeholder="Enter the detailed instructions for BRD generation (one per line)..."
                          />
                        </div>
                        <p className="mt-2 text-xs text-gray-500">Enter each instruction on a new line. These instructions guide the AI in generating the BRD content.</p>
                      </div>

                      <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4">
                        <div className="flex">
                          <div className="flex-shrink-0">
                            <svg className="h-5 w-5 text-yellow-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                              <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                            </svg>
                          </div>
                          <div className="ml-3">
                            <h3 className="text-sm font-medium text-yellow-800">Catatan Penting</h3>
                            <div className="mt-2 text-sm text-yellow-700">
                              <p>Perubahan pada prompt ini akan mempengaruhi bagaimana semua BRD akan dibuat di masa mendatang. Pastikan untuk menguji setiap perubahan secara menyeluruh sebelum menggunakannya di produksi.</p>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Backup Settings */}
              {activeSettingsTab === 'backup' && (
                <div className="bg-white rounded-lg shadow divide-y divide-gray-200">
                  <div className="p-6">
                    <h3 className="text-lg font-medium text-gray-900">Cadangan & Pemulihan</h3>
                    <p className="mt-1 text-sm text-gray-500">Kelola pencadangan dan pemulihan data sistem.</p>
                    
                    <div className="mt-6">
                      <div className="rounded-lg bg-blue-50 p-4">
                        <div className="flex">
                          <div className="flex-shrink-0">
                            <svg className="h-5 w-5 text-blue-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                            </svg>
                          </div>
                          <div className="ml-3 flex-1 md:flex md:justify-between">
                            <p className="text-sm text-blue-700">
                              Pencadangan rutin membantu melindungi data Anda. Pilih format yang Anda inginkan di bawah ini.
                            </p>
                          </div>
                        </div>
                      </div>

                      <div className="mt-6">
                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                          <div className="relative rounded-lg border border-gray-300 bg-white px-6 py-5 shadow-sm hover:border-gray-400 focus-within:ring-2 focus-within:ring-blue-500 focus-within:ring-offset-2">
                            <div className="flex items-center justify-between">
                              <div className="min-w-0 flex-1">
                                <button
                                  onClick={() => handleBackupData('json')}
                                  className="focus:outline-none"
                                >
                                  <span className="absolute inset-0" aria-hidden="true" />
                                  <p className="text-sm font-medium text-gray-900">Cadangan JSON</p>
                                  <p className="text-sm text-gray-500">Cadangan data lengkap dalam format JSON</p>
                                </button>
                              </div>
                              <svg className="h-6 w-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                              </svg>
                            </div>
                          </div>

                          <div className="relative rounded-lg border border-gray-300 bg-white px-6 py-5 shadow-sm hover:border-gray-400 focus-within:ring-2 focus-within:ring-blue-500 focus-within:ring-offset-2">
                            <div className="flex items-center justify-between">
                              <div className="min-w-0 flex-1">
                                <button
                                  onClick={() => handleBackupData('excel')}
                                  className="focus:outline-none"
                                >
                                  <span className="absolute inset-0" aria-hidden="true" />
                                  <p className="text-sm font-medium text-gray-900">Cadangan Excel</p>
                                  <p className="text-sm text-gray-500">Cadangan data dalam format Excel</p>
                                </button>
                              </div>
                              <svg className="h-6 w-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                              </svg>
                            </div>
                          </div>

                          <div className="relative rounded-lg border border-gray-300 bg-white px-6 py-5 shadow-sm hover:border-gray-400 focus-within:ring-2 focus-within:ring-blue-500 focus-within:ring-offset-2">
                            <div className="flex items-center justify-between">
                              <div className="min-w-0 flex-1">
                                <button
                                  onClick={() => handleBackupData('mysql')}
                                  className="focus:outline-none"
                                >
                                  <span className="absolute inset-0" aria-hidden="true" />
                                  <p className="text-sm font-medium text-gray-900">Cadangan SQL</p>
                                  <p className="text-sm text-gray-500">Cadangan data dalam format MySQL</p>
                                </button>
                              </div>
                              <svg className="h-6 w-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" />
                              </svg>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : null}
      </div>

      {/* User Details Modal */}
      {selectedUser && (
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-2xl w-full mx-4">
            <div className="flex justify-between items-start mb-4">
              <h3 className="text-lg font-medium text-gray-900">User Details</h3>
              <button
                onClick={() => setSelectedUser(null)}
                className="text-gray-400 hover:text-gray-500"
              >
                <span className="sr-only">Close</span>
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm font-medium text-gray-500">Full Name</p>
                <p className="mt-1">{selectedUser.namaLengkap}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-500">Email</p>
                <p className="mt-1">{selectedUser.email}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-500">Role</p>
                <p className="mt-1">{selectedUser.role || 'User'}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-500">Status</p>
                <p className="mt-1">{selectedUser.status || 'Active'}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-500">Unit Bisnis</p>
                <p className="mt-1">{selectedUser.unitBisnis}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-500">Phone</p>
                <p className="mt-1">{selectedUser.noTelp || '-'}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit User Modal */}
      {editingUser && (
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-2xl w-full mx-4">
            <div className="flex justify-between items-start mb-4">
              <h3 className="text-lg font-medium text-gray-900">Edit User</h3>
              <button
                onClick={() => setEditingUser(null)}
                className="text-gray-400 hover:text-gray-500"
              >
                <span className="sr-only">Close</span>
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <form onSubmit={handleUserEdit} className="space-y-4">
              <div>
                <label htmlFor="namaLengkap" className="block text-sm font-medium text-gray-700">Full Name</label>
                <input
                  type="text"
                  name="namaLengkap"
                  id="namaLengkap"
                  value={editingUser.namaLengkap || ''}
                  onChange={(e) => setEditingUser({ ...editingUser, namaLengkap: e.target.value })}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                />
              </div>
              <div>
                <label htmlFor="unitBisnis" className="block text-sm font-medium text-gray-700">Unit Bisnis</label>
                <input
                  type="text"
                  name="unitBisnis"
                  id="unitBisnis"
                  value={editingUser.unitBisnis || ''}
                  onChange={(e) => setEditingUser({ ...editingUser, unitBisnis: e.target.value })}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                />
              </div>
              <div>
                <label htmlFor="noTelp" className="block text-sm font-medium text-gray-700">Phone</label>
                <input
                  type="tel"
                  name="noTelp"
                  id="noTelp"
                  value={editingUser.noTelp || ''}
                  onChange={(e) => setEditingUser({ ...editingUser, noTelp: e.target.value })}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                />
              </div>
              <div className="flex justify-end space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => setEditingUser(null)}
                  className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add the RejectModal component */}
      <RejectModal
        isOpen={showRejectModal}
        onClose={() => {
          setShowRejectModal(false);
          setRejectReason('');
          setSelectedRequestId(null);
        }}
        onConfirm={(reason) => {
          handleRejectRequest(selectedRequestId, reason);
          setShowRejectModal(false);
          setSelectedRequestId(null);
        }}
      />

      {/* Add the AssignAnalystModal */}
      <AssignAnalystModal
        isOpen={showAssignAnalystModal}
        onClose={() => {
          setShowAssignAnalystModal(false);
          setSelectedAnalyst('');
          setSelectedRequestId(null);
        }}
        onConfirm={(analystId) => handleApproveRequest(selectedRequestId)}
        analysts={analysts}
      />
    </div>
  );
};

export default AdminPage; 