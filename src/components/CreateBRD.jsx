import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUser } from '../context/UserContext';
import { db } from '../firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { auth } from '../firebase';

const CreateBRD = () => {
  const navigate = useNavigate();
  const { profile, user } = useUser();
  const [loading, setLoading] = useState(false);
  const [activeSection, setActiveSection] = useState('basic');
  const [formData, setFormData] = useState({
    noBRD: '',
    tanggalPermintaan: '',
    unitBisnis: profile?.unitBisnis || '',
    namaPemohon: profile?.namaLengkap || '',
    jabatanPemohon: profile?.jabatan || '',
    namaProject: '',
    jenisPermintaan: 'New System',
    prioritas: 'Normal',
    targetImplementasi: '',
    latarBelakang: '',
    kondisiSaatIni: '',
    kondisiYangDiharapkan: '',
    potentialRisk: '',
    estimasiBiaya: '',
    estimasiWaktu: '',
    manfaat: '',
    dokumenTambahan: ''
  });
  const [error, setError] = useState('');

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const brdRef = collection(db, 'brd_requests');
      const docRef = await addDoc(brdRef, {
        ...formData,
        createdBy: user.uid,
        createdByEmail: user.email,
        createdByName: profile.namaLengkap,
        unitBisnis: profile.unitBisnis,
        status: 'New',
        createdAt: new Date(),
        updatedAt: new Date()
      });

      navigate('/dashboard', { 
        state: { 
          success: true, 
          message: 'BRD request created successfully! Waiting for admin to assign an analyst.' 
        } 
      });
    } catch (error) {
      console.error('Error submitting BRD:', error);
      setError('Failed to submit BRD request. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const sections = [
    { id: 'basic', name: 'Basic Information' },
    { id: 'details', name: 'Project Details' },
    { id: 'requirements', name: 'Requirements' },
    { id: 'estimation', name: 'Estimation' }
  ];

  return (
    <div className="max-w-5xl mx-auto">
      {/* Header */}
      <div className="bg-white rounded-2xl shadow-lg p-6 mb-6">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Create BRD Request</h2>
            <p className="mt-1 text-sm text-gray-500">Fill out the form below to submit a new Business Requirement Document request.</p>
          </div>
          <button
            onClick={() => navigate('/dashboard')}
            className="p-2 text-gray-500 hover:text-gray-700 rounded-lg hover:bg-gray-100 transition-all duration-200"
          >
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Progress Navigation */}
        <div className="mt-6 border-t border-b border-gray-200">
          <nav className="flex justify-between -mb-px">
            {sections.map((section, index) => (
              <button
                key={section.id}
                onClick={() => setActiveSection(section.id)}
                className={`flex-1 py-4 px-1 text-center border-b-2 text-sm font-medium transition-all duration-200 ${
                  activeSection === section.id
                    ? 'border-blue-900 text-blue-900'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <span className="flex items-center justify-center">
                  <span className={`w-6 h-6 flex items-center justify-center rounded-full text-sm mr-2 ${
                    activeSection === section.id
                      ? 'bg-blue-900 text-white'
                      : 'bg-gray-200 text-gray-600'
                  }`}>
                    {index + 1}
                  </span>
                  {section.name}
                </span>
              </button>
            ))}
          </nav>
        </div>
      </div>

      {/* Form */}
      <div className="bg-white rounded-2xl shadow-lg p-6">
        <form onSubmit={handleSubmit} className="space-y-8">
          {/* Basic Information Section */}
          <div className={activeSection === 'basic' ? 'block' : 'hidden'}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="col-span-2">
                <div className="bg-blue-50 rounded-lg p-4 mb-6">
                  <h3 className="text-lg font-medium text-blue-900 mb-2">Basic Information</h3>
                  <p className="text-sm text-blue-700">Please fill in the basic information about your BRD request.</p>
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700">No. BRD</label>
                <div className="mt-1 relative rounded-md shadow-sm">
                  <input
                    type="text"
                    name="noBRD"
                    value={formData.noBRD}
                    onChange={handleChange}
                    className="block w-full rounded-md border-gray-300 pl-4 focus:border-blue-500 focus:ring-blue-500"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">Tanggal Permintaan</label>
                <div className="mt-1 relative rounded-md shadow-sm">
                  <input
                    type="date"
                    name="tanggalPermintaan"
                    value={formData.tanggalPermintaan}
                    onChange={handleChange}
                    className="block w-full rounded-md border-gray-300 pl-4 focus:border-blue-500 focus:ring-blue-500"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">Unit Bisnis</label>
                <div className="mt-1 relative rounded-md shadow-sm">
                  <input
                    type="text"
                    name="unitBisnis"
                    value={formData.unitBisnis}
                    onChange={handleChange}
                    className="block w-full rounded-md border-gray-300 pl-4 bg-gray-50 focus:border-blue-500 focus:ring-blue-500"
                    readOnly
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">Nama Pemohon</label>
                <div className="mt-1 relative rounded-md shadow-sm">
                  <input
                    type="text"
                    name="namaPemohon"
                    value={formData.namaPemohon}
                    onChange={handleChange}
                    className="block w-full rounded-md border-gray-300 pl-4 bg-gray-50 focus:border-blue-500 focus:ring-blue-500"
                    readOnly
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">Jabatan Pemohon</label>
                <div className="mt-1 relative rounded-md shadow-sm">
                  <input
                    type="text"
                    name="jabatanPemohon"
                    value={formData.jabatanPemohon}
                    onChange={handleChange}
                    className="block w-full rounded-md border-gray-300 pl-4 bg-gray-50 focus:border-blue-500 focus:ring-blue-500"
                    readOnly
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Project Details Section */}
          <div className={activeSection === 'details' ? 'block' : 'hidden'}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="col-span-2">
                <div className="bg-blue-50 rounded-lg p-4 mb-6">
                  <h3 className="text-lg font-medium text-blue-900 mb-2">Project Details</h3>
                  <p className="text-sm text-blue-700">Provide detailed information about your project.</p>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">Nama Project</label>
                <div className="mt-1 relative rounded-md shadow-sm">
                  <input
                    type="text"
                    name="namaProject"
                    value={formData.namaProject}
                    onChange={handleChange}
                    className="block w-full rounded-md border-gray-300 pl-4 focus:border-blue-500 focus:ring-blue-500"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">Jenis Permintaan</label>
                <div className="mt-1 relative rounded-md shadow-sm">
                  <select
                    name="jenisPermintaan"
                    value={formData.jenisPermintaan}
                    onChange={handleChange}
                    className="block w-full rounded-md border-gray-300 pl-4 focus:border-blue-500 focus:ring-blue-500"
                    required
                  >
                    <option value="New System">New System</option>
                    <option value="Enhancement">Enhancement</option>
                    <option value="Bug Fix">Bug Fix</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">Prioritas</label>
                <div className="mt-1 relative rounded-md shadow-sm">
                  <select
                    name="prioritas"
                    value={formData.prioritas}
                    onChange={handleChange}
                    className="block w-full rounded-md border-gray-300 pl-4 focus:border-blue-500 focus:ring-blue-500"
                    required
                  >
                    <option value="Normal">Normal</option>
                    <option value="High">High</option>
                    <option value="Critical">Critical</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">Target Implementasi</label>
                <div className="mt-1 relative rounded-md shadow-sm">
                  <input
                    type="date"
                    name="targetImplementasi"
                    value={formData.targetImplementasi}
                    onChange={handleChange}
                    className="block w-full rounded-md border-gray-300 pl-4 focus:border-blue-500 focus:ring-blue-500"
                    required
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Requirements Section */}
          <div className={activeSection === 'requirements' ? 'block' : 'hidden'}>
            <div className="space-y-6">
              <div className="bg-blue-50 rounded-lg p-4 mb-6">
                <h3 className="text-lg font-medium text-blue-900 mb-2">Requirements</h3>
                <p className="text-sm text-blue-700">Describe the requirements and current conditions of your project.</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">Latar Belakang</label>
                <div className="mt-1">
                  <textarea
                    name="latarBelakang"
                    value={formData.latarBelakang}
                    onChange={handleChange}
                    rows={3}
                    className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">Kondisi Saat Ini</label>
                <div className="mt-1">
                  <textarea
                    name="kondisiSaatIni"
                    value={formData.kondisiSaatIni}
                    onChange={handleChange}
                    rows={3}
                    className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">Kondisi Yang Diharapkan</label>
                <div className="mt-1">
                  <textarea
                    name="kondisiYangDiharapkan"
                    value={formData.kondisiYangDiharapkan}
                    onChange={handleChange}
                    rows={3}
                    className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">Potential Risk</label>
                <div className="mt-1">
                  <textarea
                    name="potentialRisk"
                    value={formData.potentialRisk}
                    onChange={handleChange}
                    rows={3}
                    className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                    required
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Estimation Section */}
          <div className={activeSection === 'estimation' ? 'block' : 'hidden'}>
            <div className="space-y-6">
              <div className="bg-blue-50 rounded-lg p-4 mb-6">
                <h3 className="text-lg font-medium text-blue-900 mb-2">Estimation</h3>
                <p className="text-sm text-blue-700">Provide estimations and benefits of your project.</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">Estimasi Biaya</label>
                <div className="mt-1 relative rounded-md shadow-sm">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <span className="text-gray-500 sm:text-sm">Rp</span>
                  </div>
                  <input
                    type="text"
                    name="estimasiBiaya"
                    value={formData.estimasiBiaya}
                    onChange={handleChange}
                    className="block w-full rounded-md border-gray-300 pl-12 focus:border-blue-500 focus:ring-blue-500"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">Estimasi Waktu</label>
                <div className="mt-1 relative rounded-md shadow-sm">
                  <input
                    type="text"
                    name="estimasiWaktu"
                    value={formData.estimasiWaktu}
                    onChange={handleChange}
                    className="block w-full rounded-md border-gray-300 pl-4 focus:border-blue-500 focus:ring-blue-500"
                    placeholder="e.g., 3 months"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">Manfaat</label>
                <div className="mt-1">
                  <textarea
                    name="manfaat"
                    value={formData.manfaat}
                    onChange={handleChange}
                    rows={3}
                    className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">Dokumen Tambahan (Optional)</label>
                <div className="mt-1 relative rounded-md shadow-sm">
                  <input
                    type="text"
                    name="dokumenTambahan"
                    value={formData.dokumenTambahan}
                    onChange={handleChange}
                    className="block w-full rounded-md border-gray-300 pl-4 focus:border-blue-500 focus:ring-blue-500"
                    placeholder="Link to additional documents"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Navigation Buttons */}
          <div className="flex justify-between pt-6 border-t border-gray-200">
            <button
              type="button"
              onClick={() => {
                const currentIndex = sections.findIndex(s => s.id === activeSection);
                if (currentIndex > 0) {
                  setActiveSection(sections[currentIndex - 1].id);
                }
              }}
              className={`px-4 py-2 text-sm font-medium rounded-md ${
                activeSection === 'basic'
                  ? 'text-gray-400 cursor-not-allowed'
                  : 'text-gray-700 hover:bg-gray-50 border border-gray-300'
              }`}
              disabled={activeSection === 'basic'}
            >
              Previous
            </button>

            <div className="flex space-x-3">
              <button
                type="button"
                onClick={() => navigate('/dashboard')}
                className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 border border-gray-300 rounded-md"
              >
                Cancel
              </button>
              {activeSection === 'estimation' ? (
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-2 text-sm font-medium text-white bg-blue-900 hover:bg-blue-800 rounded-md shadow-sm disabled:opacity-50"
                >
                  {loading ? 'Submitting...' : 'Submit BRD Request'}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    const currentIndex = sections.findIndex(s => s.id === activeSection);
                    if (currentIndex < sections.length - 1) {
                      setActiveSection(sections[currentIndex + 1].id);
                    }
                  }}
                  className="px-4 py-2 text-sm font-medium text-white bg-blue-900 hover:bg-blue-800 rounded-md shadow-sm"
                >
                  Next
                </button>
              )}
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreateBRD; 