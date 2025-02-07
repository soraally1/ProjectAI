import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUser } from '../context/UserContext';
import { db } from '../firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { Tooltip } from 'react-tooltip';
import { toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

const CreateBRD = () => {
  const navigate = useNavigate();
  const { profile, user } = useUser();
  const [loading, setLoading] = useState(false);
  const [activeSection, setActiveSection] = useState('pemohon');
  const [isDirty, setIsDirty] = useState(false);
  const [validationErrors, setValidationErrors] = useState({});
  const [autoSaveStatus, setAutoSaveStatus] = useState('');
  const [formData, setFormData] = useState({
    nomorSurat: '',
    contactPerson: '',
    aplikasiDikembangkan: '',
    fiturDikembangkan: '',
    latarBelakang: '',
    tujuanPengembangan: '',
    manfaatDiharapkan: '',
    risikoTerkait: '',
    strategiPelaksanaan: ''
  });

  // Autosave functionality
  useEffect(() => {
    if (isDirty) {
      const timeoutId = setTimeout(() => {
        localStorage.setItem('brd_draft', JSON.stringify(formData));
        setAutoSaveStatus('Draft tersimpan');
        setTimeout(() => setAutoSaveStatus(''), 2000);
      }, 1000);
      return () => clearTimeout(timeoutId);
    }
  }, [formData, isDirty]);

  // Load draft on mount and set unit bisnis
  useEffect(() => {
    const savedDraft = localStorage.getItem('brd_draft');
    if (savedDraft) {
      const parsedDraft = JSON.parse(savedDraft);
      setFormData(prev => ({ ...prev, ...parsedDraft }));
    }
  }, []);

  const validateForm = () => {
    const errors = {};
    const requiredFields = [
      'nomorSurat',
      'aplikasiDikembangkan',
      'fiturDikembangkan',
      'latarBelakang',
      'tujuanPengembangan',
      'manfaatDiharapkan',
      'risikoTerkait',
      'strategiPelaksanaan'
    ];

    requiredFields.forEach(field => {
      if (!formData[field]?.trim()) {
        errors[field] = 'Kolom ini wajib diisi';
      }
    });

    setValidationErrors(errors);
    
    if (Object.keys(errors).length > 0) {
      const unfilledFields = Object.keys(errors).join(', ');
      toast.error(`Mohon lengkapi field berikut: ${unfilledFields}`);
      return false;
    }

    return true;
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    setIsDirty(true);
    // Clear validation error when user types
    if (validationErrors[name]) {
      setValidationErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!user || !profile) {
      toast.error('Silakan login terlebih dahulu');
      return;
    }

    if (!validateForm()) {
      return;
    }

    setLoading(true);
    try {
      const brdRef = collection(db, 'brd_requests');
      const brdData = {
        ...formData,
        createdBy: user.uid,
        createdByEmail: user.email,
        createdByName: profile.namaLengkap,
        unitBisnis: profile.unitBisnis,
        status: 'New',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        assignedTo: null,
        assignedAnalystName: null,
        assignedAnalystId: null,
        comments: []
      };

      await addDoc(brdRef, brdData);

      // Clear draft after successful submission
      localStorage.removeItem('brd_draft');
      
      toast.success('BRD berhasil dikirim!');
      
      // Short delay to ensure toast is visible
      setTimeout(() => {
        navigate('/dashboard/home', { 
          state: { 
            success: true, 
            message: 'Permintaan BRD berhasil dibuat! Menunggu admin untuk menugaskan analis.' 
          } 
        });
      }, 1000);
    } catch (error) {
      console.error('Error submitting BRD:', error);
      toast.error(error.message || 'Gagal mengirim BRD. Silakan coba lagi.');
    } finally {
      setLoading(false);
    }
  };

  // Progress calculation
  const calculateProgress = () => {
    const totalFields = Object.keys(formData).length; // unitBisnis is not included in formData
    const filledFields = Object.values(formData).filter(value => value.trim()).length;
    return Math.round((filledFields / totalFields) * 100);
  };

  const handleBeforeUnload = (e) => {
    if (isDirty) {
      e.preventDefault();
      e.returnValue = '';
    }
  };

  useEffect(() => {
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isDirty]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 py-12">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header with Progress */}
        <div className="bg-white rounded-3xl shadow-xl p-8 mb-8 transform transition-all duration-300 hover:shadow-2xl">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-4xl font-extrabold bg-clip-text text-transparent bg-gradient-to-r from-blue-900 to-blue-600">
                Buat Permintaan BRD
              </h2>
              <p className="mt-2 text-lg text-gray-600">
                Isi formulir di bawah ini untuk mengajukan permintaan Business Requirement Document baru.
              </p>
            </div>
            <button
              onClick={() => navigate('/dashboard')}
              className="p-3 text-gray-400 hover:text-red-500 rounded-full hover:bg-red-50 transition-all duration-300 transform hover:rotate-90"
              data-tooltip-id="close-tooltip"
              data-tooltip-content="Tutup formulir"
            >
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          
          {/* Progress Bar */}
          <div className="mt-4">
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm font-medium text-gray-600">Progres Pengisian</span>
              <span className="text-sm font-medium text-blue-600">{calculateProgress()}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2.5">
              <div 
                className="bg-blue-600 h-2.5 rounded-full transition-all duration-300"
                style={{ width: `${calculateProgress()}%` }}
              ></div>
            </div>
          </div>
          
          {/* Autosave Status */}
          {autoSaveStatus && (
            <div className="mt-2 text-sm text-gray-500 flex items-center">
              <svg className="w-4 h-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              Draft tersimpan
            </div>
          )}
        </div>

        {/* Navigation Tabs */}
        <div className="bg-white/60 backdrop-blur-sm p-2 rounded-2xl shadow-md mb-8">
          <div className="flex space-x-2">
            <button
              onClick={() => setActiveSection('pemohon')}
              className={`flex-1 px-6 py-3 rounded-xl font-medium transition-all duration-300 flex items-center justify-center ${
                activeSection === 'pemohon'
                ? 'bg-blue-900 text-white shadow-lg'
                : 'bg-white text-gray-600 hover:bg-blue-50'
              }`}
            >
              <svg className="w-5 h-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
              <span>Informasi Pemohon</span>
            </button>
            <button
              onClick={() => setActiveSection('data')}
              className={`flex-1 px-6 py-3 rounded-xl font-medium transition-all duration-300 flex items-center justify-center ${
                activeSection === 'data'
                ? 'bg-blue-900 text-white shadow-lg'
                : 'bg-white text-gray-600 hover:bg-blue-50'
              }`}
            >
              <svg className="w-5 h-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <span>Informasi Data</span>
            </button>
          </div>
        </div>
        
        <form onSubmit={handleSubmit} className="space-y-8">
          {/* Form sections */}
          <div className="relative min-h-[300px]">
            {/* INFORMASI PEMOHON */}
            <div className={`transition-all duration-300 ${
              activeSection === 'pemohon' ? 'block' : 'hidden'
            }`}>
              <div className="bg-white rounded-3xl shadow-xl overflow-hidden">
                <div className="bg-gradient-to-r from-blue-900 via-blue-800 to-blue-700 px-8 py-5">
                  <h3 className="text-xl font-bold text-white flex items-center">
                    <svg className="w-6 h-6 mr-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                    INFORMASI PEMOHON
                  </h3>
                </div>
                <div className="p-8">
                  <div className="grid grid-cols-1 gap-8">
                    <div className="rounded-2xl border border-gray-200 overflow-hidden transition-all duration-300 hover:border-blue-400 hover:shadow-md">
                      <div className="grid grid-cols-3 divide-x divide-gray-200">
                        <div className="p-5 bg-gradient-to-br from-gray-50 to-gray-100 flex items-center">
                          <span className="font-semibold text-gray-700">Unit Bisnis</span>
                        </div>
                        <div className="col-span-2 p-5">
                          <input
                            type="text"
                            value={profile?.unitBisnis || ''}
                            disabled
                            className="w-full bg-gray-50 rounded-xl border-0 focus:ring-0 text-gray-600 cursor-not-allowed"
                          />
                          <p className="mt-1 text-xs text-gray-500">Unit bisnis diambil dari profil Anda</p>
                        </div>
                      </div>
                    </div>
                    <div className="rounded-2xl border border-gray-200 overflow-hidden transition-all duration-300 hover:border-blue-400 hover:shadow-md">
                      <div className="grid grid-cols-3 divide-x divide-gray-200">
                        <div className="p-5 bg-gradient-to-br from-gray-50 to-gray-100 flex items-center">
                          <span className="font-semibold text-gray-700">Nomor Surat/Contact Person</span>
                        </div>
                        <div className="col-span-2 p-5">
                          <input
                            type="text"
                            name="nomorSurat"
                            value={formData.nomorSurat}
                            onChange={handleChange}
                            className={`w-full rounded-xl border-gray-200 focus:border-blue-500 focus:ring focus:ring-blue-200 transition-all duration-300 ${
                              validationErrors.nomorSurat ? 'border-red-300' : ''
                            }`}
                            required
                            data-tooltip-id="nomor-surat-tooltip"
                            data-tooltip-content="Masukkan nomor surat referensi atau detail contact person"
                          />
                          {validationErrors.nomorSurat && (
                            <p className="mt-1 text-sm text-red-500">{validationErrors.nomorSurat}</p>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* INFORMASI DATA */}
            <div className={`transition-all duration-300 ${
              activeSection === 'data' ? 'block' : 'hidden'
            }`}>
              <div className="bg-white rounded-3xl shadow-xl overflow-hidden">
                <div className="bg-gradient-to-r from-blue-900 via-blue-800 to-blue-700 px-8 py-5">
                  <h3 className="text-xl font-bold text-white flex items-center">
                    <svg className="w-6 h-6 mr-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    INFORMASI DATA
                  </h3>
                </div>
                <div className="p-8">
                  <div className="grid grid-cols-1 gap-8">
                    {[
                      { 
                        label: 'Aplikasi yang dikembangkan', 
                        name: 'aplikasiDikembangkan', 
                        type: 'input',
                        tooltip: 'Masukkan nama aplikasi yang akan dikembangkan'
                      },
                      { 
                        label: 'Fitur yang ingin dikembangkan', 
                        name: 'fiturDikembangkan', 
                        type: 'textarea',
                        tooltip: 'Jelaskan fitur-fitur yang ingin dikembangkan'
                      },
                      { 
                        label: 'Latar belakang Pengembangan', 
                        name: 'latarBelakang', 
                        type: 'textarea',
                        tooltip: 'Jelaskan latar belakang dan konteks pengembangan ini'
                      },
                      { 
                        label: 'Tujuan pengembangan', 
                        name: 'tujuanPengembangan', 
                        type: 'textarea',
                        tooltip: 'Sebutkan tujuan dari pengembangan ini'
                      },
                      { 
                        label: 'Manfaat yang diharapkan', 
                        name: 'manfaatDiharapkan', 
                        type: 'textarea',
                        tooltip: 'Jelaskan manfaat yang diharapkan'
                      },
                      { 
                        label: 'Risiko terkait bila Pengembangan tidak dilakukan', 
                        name: 'risikoTerkait', 
                        type: 'textarea',
                        tooltip: 'Jelaskan risiko jika pengembangan tidak dilakukan'
                      },
                      { 
                        label: 'Strategi Pelaksanaan', 
                        name: 'strategiPelaksanaan', 
                        type: 'textarea',
                        tooltip: 'Jelaskan strategi pelaksanaan pengembangan'
                      }
                    ].map((field) => (
                      <div key={field.name} className="rounded-2xl border border-gray-200 overflow-hidden transition-all duration-300 hover:border-blue-400 hover:shadow-md">
                        <div className="grid grid-cols-3 divide-x divide-gray-200">
                          <div className="p-5 bg-gradient-to-br from-gray-50 to-gray-100 flex items-center">
                            <span className="font-semibold text-gray-700">{field.label}</span>
                          </div>
                          <div className="col-span-2 p-5">
                            {field.type === 'input' ? (
                              <input
                                type="text"
                                name={field.name}
                                value={formData[field.name]}
                                onChange={handleChange}
                                className={`w-full rounded-xl border-gray-200 focus:border-blue-500 focus:ring focus:ring-blue-200 transition-all duration-300 ${
                                  validationErrors[field.name] ? 'border-red-300' : ''
                                }`}
                                required
                                data-tooltip-id={`${field.name}-tooltip`}
                                data-tooltip-content={field.tooltip}
                              />
                            ) : (
                              <textarea
                                name={field.name}
                                value={formData[field.name]}
                                onChange={handleChange}
                                rows="3"
                                className={`w-full rounded-xl border-gray-200 focus:border-blue-500 focus:ring focus:ring-blue-200 transition-all duration-300 ${
                                  validationErrors[field.name] ? 'border-red-300' : ''
                                }`}
                                required
                                data-tooltip-id={`${field.name}-tooltip`}
                                data-tooltip-content={field.tooltip}
                              />
                            )}
                            {validationErrors[field.name] && (
                              <p className="mt-1 text-sm text-red-500">{validationErrors[field.name]}</p>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Submit Button */}
          <div className="flex justify-end space-x-4 sticky bottom-8 z-10">
            <div className="bg-white/80 backdrop-blur-lg rounded-2xl shadow-xl p-4 flex space-x-4">
              <button
                type="button"
                onClick={() => {
                  if (isDirty) {
                    if (window.confirm('Ada perubahan yang belum disimpan. Anda yakin ingin keluar?')) {
                      navigate('/dashboard');
                    }
                  } else {
                    navigate('/dashboard');
                  }
                }}
                className="px-8 py-4 text-gray-700 bg-white border-2 border-gray-200 rounded-xl hover:bg-gray-50 hover:border-gray-300 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 transition-all duration-300 font-medium"
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={loading}
                className="px-8 py-4 text-white bg-gradient-to-r from-blue-900 via-blue-800 to-blue-700 rounded-xl hover:from-blue-800 hover:via-blue-700 hover:to-blue-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg font-medium"
              >
                {loading ? (
                  <div className="flex items-center">
                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Memproses Permintaan...
                  </div>
                ) : (
                  <div className="flex items-center">
                    <svg className="w-5 h-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Kirim BRD
                  </div>
                )}
              </button>
            </div>
          </div>
        </form>
      </div>
      
      {/* Tooltips */}
      <Tooltip id="close-tooltip" />
      <Tooltip id="nomor-surat-tooltip" />
      {[
        'aplikasiDikembangkan',
        'fiturDikembangkan',
        'latarBelakang',
        'tujuanPengembangan',
        'manfaatDiharapkan',
        'risikoTerkait',
        'strategiPelaksanaan'
      ].map(name => (
        <Tooltip key={name} id={`${name}-tooltip`} />
      ))}
    </div>
  );
};

export default CreateBRD; 