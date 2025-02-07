import { useState, useEffect } from 'react';
import { db } from '../firebase';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { useNavigate, Navigate } from 'react-router-dom';
import { useUser } from '../context/UserContext';
import iBRDLogo from '../assets/i-BRDSystem.svg';

const ProfileCompletion = () => {
  const { user, profile, refreshProfile } = useUser();
  const [formData, setFormData] = useState({
    username: '',
    namaLengkap: profile?.namaLengkap || '',
    unitBisnis: profile?.unitBisnis || '',
    jabatan: profile?.jabatan || '',
    noTelp: profile?.nomorTelepon || '',
    photoURL: profile?.photoURL || ''
  });
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (!user) {
      navigate('/login');
      return;
    }

    // If user is already approved, redirect to dashboard
    if (profile?.status === 'active') {
      navigate('/dashboard');
      return;
    }

    // If user's profile is completed and pending approval, redirect to confirmation
    if (profile?.profileCompleted && profile?.status === 'pending') {
      navigate('/signup-confirmation');
      return;
    }

    const loadProfileData = async () => {
      try {
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        if (userDoc.exists()) {
          const userData = userDoc.data();
          setFormData(prev => ({
            ...prev,
            namaLengkap: userData.namaLengkap || '',
            unitBisnis: userData.unitBisnis || '',
            jabatan: userData.jabatan || '',
            noTelp: userData.nomorTelepon || '',
            username: userData.username || '',
            photoURL: userData.photoURL || ''
          }));
        }
      } catch (error) {
        console.error('Error loading profile:', error);
        setErrors({ general: 'Gagal memuat data profil' });
      }
    };

    loadProfileData();
  }, [user, profile, navigate]);

  // If no user, redirect to login
  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // If user is already approved, redirect to dashboard
  if (profile?.status === 'active') {
    return <Navigate to="/dashboard" replace />;
  }

  // If user's profile is completed and pending approval, redirect to confirmation
  if (profile?.profileCompleted && profile?.status === 'pending') {
    return <Navigate to="/signup-confirmation" replace />;
  }

  const handlePhotoChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      setErrors(prev => ({
        ...prev,
        photo: 'File harus berupa gambar'
      }));
      return;
    }

    // Validate file size (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
      setErrors(prev => ({
        ...prev,
        photo: 'Ukuran foto tidak boleh lebih dari 2MB'
      }));
      return;
    }

    try {
      const base64 = await convertToBase64(file);
      setFormData(prev => ({ ...prev, photoURL: base64 }));
      // Clear error when new file is selected
      setErrors(prev => ({ ...prev, photo: '' }));
    } catch (error) {
      console.error('Error converting image:', error);
      setErrors(prev => ({
        ...prev,
        photo: 'Gagal memproses gambar'
      }));
    }
  };

  const convertToBase64 = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result);
      reader.onerror = (error) => reject(error);
    });
  };

  const validateForm = () => {
    const newErrors = {};
    
    if (!formData.username.trim()) {
      newErrors.username = 'Username wajib diisi';
    } else if (formData.username.length < 3) {
      newErrors.username = 'Username minimal 3 karakter';
    } else if (!/^[a-zA-Z0-9_]+$/.test(formData.username)) {
      newErrors.username = 'Username hanya boleh mengandung huruf, angka, dan underscore';
    }

    if (!formData.namaLengkap.trim()) {
      newErrors.namaLengkap = 'Nama lengkap wajib diisi';
    } else if (formData.namaLengkap.length < 3) {
      newErrors.namaLengkap = 'Nama lengkap minimal 3 karakter';
    }

    if (!formData.unitBisnis.trim()) {
      newErrors.unitBisnis = 'Unit bisnis wajib diisi';
    }

    if (!formData.jabatan.trim()) {
      newErrors.jabatan = 'Jabatan wajib diisi';
    }

    if (!formData.noTelp.trim()) {
      newErrors.noTelp = 'Nomor telepon wajib diisi';
    } else {
      const phoneRegex = /^[0-9]{10,13}$/;
      const cleanPhone = formData.noTelp.replace(/[-\s]/g, '');
      if (!phoneRegex.test(cleanPhone)) {
        newErrors.noTelp = 'Masukkan nomor telepon yang valid (10-13 digit)';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    if (errors[name]) {
      setErrors(prev => ({
        ...prev,
        [name]: ''
      }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;
    
    setLoading(true);
    setErrors({});

    try {
      const userDocRef = doc(db, 'users', user.uid);
      const profileData = {
        ...formData,
        role: 'Business Requester',
        status: 'pending',
        profileCompleted: true,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };

      await setDoc(userDocRef, profileData, { merge: true });
      
      // Set success before refreshing profile
      setSuccess(true);
      
      // Refresh the profile data
      await refreshProfile();
      
      // Short delay to show success message
      setTimeout(() => {
        navigate('/signup-confirmation', { replace: true });
      }, 1000);

    } catch (error) {
      console.error('Error saving profile:', error);
      setErrors({ general: 'Terjadi kesalahan saat menyimpan profil' });
      setSuccess(false);
    } finally {
      setLoading(false);
    }
  };

  // Show success message overlay
  if (success) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-gray-900 bg-opacity-50 z-50">
        <div className="bg-white rounded-lg p-8 max-w-sm w-full mx-4 text-center">
          <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-green-100">
            <svg className="h-6 w-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h3 className="mt-4 text-lg font-medium text-gray-900">Profil Berhasil Disimpan</h3>
          <p className="mt-2 text-sm text-gray-500">
            Mengarahkan ke halaman konfirmasi...
          </p>
          <div className="mt-4 flex justify-center">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-900"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-blue-50 to-white py-12 px-4 sm:px-6 lg:px-8 relative">
      <div className="max-w-md w-full space-y-8">
        <div>
          <img className="mx-auto h-16 w-auto" src={iBRDLogo} alt="i-BRD System" />
          <h2 className="mt-6 text-center text-2xl font-bold text-gray-900">Lengkapi Profil Anda</h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            Silakan lengkapi informasi profil Anda untuk melanjutkan
          </p>
        </div>

        <form className="mt-8 space-y-6 bg-white p-6 rounded-lg shadow-md" onSubmit={handleSubmit}>
          {errors.general && (
            <div className="rounded-md bg-red-50 p-4">
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

          <div className="flex flex-col items-center">
            <div className="relative group">
              <div className="w-32 h-32 rounded-full overflow-hidden bg-gray-100 border-4 border-white shadow-lg">
                {formData.photoURL ? (
                  <img 
                    src={formData.photoURL} 
                    alt="Profile Preview" 
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-gray-200">
                    <span className="text-4xl font-medium text-gray-400">
                      {formData.namaLengkap?.charAt(0)?.toUpperCase() || user?.email?.charAt(0)?.toUpperCase() || '?'}
                    </span>
                  </div>
                )}
                <label
                  htmlFor="photo-upload"
                  className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-50 opacity-0 group-hover:opacity-100 cursor-pointer transition-opacity duration-200"
                >
                  <svg className="h-8 w-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </label>
              </div>
              <input
                id="photo-upload"
                name="photo"
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handlePhotoChange}
                disabled={loading}
              />
            </div>
            {errors.photo && (
              <p className="mt-2 text-sm text-red-600">{errors.photo}</p>
            )}
            <p className="mt-2 text-xs text-gray-500">
              Unggah foto profil (Maks. 2MB)
            </p>
          </div>

          <div className="space-y-4">
            <div>
              <label htmlFor="username" className="block text-sm font-medium text-gray-700">
                Username <span className="text-red-500">*</span>
              </label>
              <div className="mt-1 relative rounded-md shadow-sm">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <svg className="h-5 w-5 text-gray-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                  </svg>
                </div>
                <input
                  id="username"
                  name="username"
                  type="text"
                  required
                  className={`pl-10 appearance-none rounded-md relative block w-full px-3 py-2 border ${
                    errors.username ? 'border-red-300' : 'border-gray-300'
                  } placeholder-gray-400 text-gray-900 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm`}
                  value={formData.username}
                  onChange={handleChange}
                  placeholder="Masukkan username Anda"
                  disabled={loading}
                />
              </div>
              {errors.username && (
                <p className="mt-2 text-sm text-red-600">{errors.username}</p>
              )}
            </div>

            <div>
              <label htmlFor="namaLengkap" className="block text-sm font-medium text-gray-700">
                Nama Lengkap <span className="text-red-500">*</span>
              </label>
              <div className="mt-1 relative rounded-md shadow-sm">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <svg className="h-5 w-5 text-gray-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                    <path d="M9 6a3 3 0 11-6 0 3 3 0 016 0zM17 6a3 3 0 11-6 0 3 3 0 016 0zM12.93 17c.046-.327.07-.66.07-1a6.97 6.97 0 00-1.5-4.33A5 5 0 0119 16v1h-6.07zM6 11a5 5 0 015 5v1H1v-1a5 5 0 015-5z" />
                  </svg>
                </div>
                <input
                  id="namaLengkap"
                  name="namaLengkap"
                  type="text"
                  required
                  className={`pl-10 appearance-none rounded-md relative block w-full px-3 py-2 border ${
                    errors.namaLengkap ? 'border-red-300' : 'border-gray-300'
                  } placeholder-gray-400 text-gray-900 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm`}
                  value={formData.namaLengkap}
                  onChange={handleChange}
                  placeholder="Masukkan nama lengkap Anda"
                  disabled={loading}
                />
              </div>
              {errors.namaLengkap && (
                <p className="mt-2 text-sm text-red-600">{errors.namaLengkap}</p>
              )}
            </div>

            <div>
              <label htmlFor="unitBisnis" className="block text-sm font-medium text-gray-700">
                Unit Bisnis <span className="text-red-500">*</span>
              </label>
              <div className="mt-1 relative rounded-md shadow-sm">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <svg className="h-5 w-5 text-gray-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M4 4a2 2 0 012-2h8a2 2 0 012 2v12a1 1 0 110 2h-3a1 1 0 01-1-1v-2a1 1 0 00-1-1H9a1 1 0 00-1 1v2a1 1 0 01-1 1H4a1 1 0 110-2V4zm3 1h6v4H7V5z" clipRule="evenodd" />
                  </svg>
                </div>
                <input
                  id="unitBisnis"
                  name="unitBisnis"
                  type="text"
                  required
                  className={`pl-10 appearance-none rounded-md relative block w-full px-3 py-2 border ${
                    errors.unitBisnis ? 'border-red-300' : 'border-gray-300'
                  } placeholder-gray-400 text-gray-900 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm`}
                  value={formData.unitBisnis}
                  onChange={handleChange}
                  placeholder="Masukkan unit bisnis Anda"
                  disabled={loading}
                />
              </div>
              {errors.unitBisnis && (
                <p className="mt-2 text-sm text-red-600">{errors.unitBisnis}</p>
              )}
            </div>

            <div>
              <label htmlFor="jabatan" className="block text-sm font-medium text-gray-700">
                Jabatan <span className="text-red-500">*</span>
              </label>
              <div className="mt-1 relative rounded-md shadow-sm">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <svg className="h-5 w-5 text-gray-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M6 6V5a3 3 0 013-3h2a3 3 0 013 3v1h2a2 2 0 012 2v3.57A22.952 22.952 0 0110 13a22.95 22.95 0 01-8-1.43V8a2 2 0 012-2h2zm2-1a1 1 0 011-1h2a1 1 0 011 1v1H8V5zm1 5a1 1 0 011-1h.01a1 1 0 110 2H10a1 1 0 01-1-1z" clipRule="evenodd" />
                    <path d="M2 13.692V16a2 2 0 002 2h12a2 2 0 002-2v-2.308A24.974 24.974 0 0110 15c-2.796 0-5.487-.46-8-1.308z" />
                  </svg>
                </div>
                <input
                  id="jabatan"
                  name="jabatan"
                  type="text"
                  required
                  className={`pl-10 appearance-none rounded-md relative block w-full px-3 py-2 border ${
                    errors.jabatan ? 'border-red-300' : 'border-gray-300'
                  } placeholder-gray-400 text-gray-900 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm`}
                  value={formData.jabatan}
                  onChange={handleChange}
                  placeholder="Masukkan jabatan Anda"
                  disabled={loading}
                />
              </div>
              {errors.jabatan && (
                <p className="mt-2 text-sm text-red-600">{errors.jabatan}</p>
              )}
            </div>

            <div>
              <label htmlFor="noTelp" className="block text-sm font-medium text-gray-700">
                Nomor Telepon <span className="text-red-500">*</span>
              </label>
              <div className="mt-1 relative rounded-md shadow-sm">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <svg className="h-5 w-5 text-gray-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                    <path d="M2 3a1 1 0 011-1h2.153a1 1 0 01.986.836l.74 4.435a1 1 0 01-.54 1.06l-1.548.773a11.037 11.037 0 006.105 6.105l.774-1.548a1 1 0 011.059-.54l4.435.74a1 1 0 01.836.986V17a1 1 0 01-1 1h-2C7.82 18 2 12.18 2 5V3z" />
                  </svg>
                </div>
                <input
                  id="noTelp"
                  name="noTelp"
                  type="tel"
                  required
                  className={`pl-10 appearance-none rounded-md relative block w-full px-3 py-2 border ${
                    errors.noTelp ? 'border-red-300' : 'border-gray-300'
                  } placeholder-gray-400 text-gray-900 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm`}
                  value={formData.noTelp}
                  onChange={handleChange}
                  placeholder="Masukkan nomor telepon Anda"
                  disabled={loading}
                />
              </div>
              {errors.noTelp && (
                <p className="mt-2 text-sm text-red-600">{errors.noTelp}</p>
              )}
              <p className="mt-1 text-xs text-gray-500">Format: 08xxxxxxxxxx (10-13 digit)</p>
            </div>
          </div>

          <div>
            <button
              type="submit"
              disabled={loading}
              className={`group relative w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white ${
                loading ? 'bg-gray-400 cursor-not-allowed' : 'bg-blue-900 hover:bg-blue-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500'
              }`}
            >
              {loading ? (
                <>
                  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Menyimpan...
                </>
              ) : (
                'Simpan Profil'
              )}
            </button>
          </div>
        </form>
      </div>

      {/* Copyright text */}
      <div className="absolute bottom-4 left-4 text-sm text-gray-500">
        © Copyright Daffa 2025. i-BRD v.1.0
      </div>
    </div>
  );
};

export default ProfileCompletion; 