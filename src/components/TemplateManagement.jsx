import { useState, useEffect, useRef } from 'react';
import { collection, addDoc, getDocs, doc, updateDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { useUser } from '../context/UserContext';
import { toast } from 'react-toastify';
import { DragDropContext, Droppable, Draggable } from 'react-beautiful-dnd';

// Define predefinedFields at the top level
const predefinedFields = [
  { 
    name: 'noBRD', 
    label: 'No. BRD', 
    required: true,
    description: 'Nomor identifikasi unik untuk dokumen BRD'
  },
  { 
    name: 'tanggalPermintaan', 
    label: 'Tanggal Permintaan', 
    required: true,
    description: 'Tanggal saat permintaan BRD diajukan'
  },
  { 
    name: 'unitBisnis', 
    label: 'Unit Bisnis', 
    required: true,
    description: 'Unit atau divisi bisnis yang mengajukan permintaan'
  },
  { 
    name: 'namaPemohon', 
    label: 'Nama Pemohon', 
    required: true,
    description: 'Nama lengkap pemohon yang mengajukan BRD'
  },
  { 
    name: 'jabatanPemohon', 
    label: 'Jabatan Pemohon', 
    required: true,
    description: 'Posisi atau jabatan pemohon dalam organisasi'
  },
  { 
    name: 'namaProject', 
    label: 'Nama Project', 
    required: true,
    description: 'Nama proyek atau inisiatif yang diusulkan'
  },
  { 
    name: 'jenisPermintaan', 
    label: 'Jenis Permintaan', 
    required: true, 
    options: ['New Development', 'Enhancement', 'Bug Fix'],
    description: 'Kategori permintaan pengembangan yang diajukan'
  },
  { 
    name: 'prioritas', 
    label: 'Prioritas', 
    required: true, 
    options: ['High', 'Medium', 'Low'],
    description: 'Tingkat urgensi dan kepentingan dari permintaan'
  },
  { 
    name: 'targetImplementasi', 
    label: 'Target Implementasi', 
    required: true,
    description: 'Tanggal atau periode target penyelesaian implementasi'
  },
  { 
    name: 'latarBelakang', 
    label: 'Latar Belakang', 
    required: true, 
    type: 'textarea',
    description: 'Penjelasan mengenai alasan dan konteks dari permintaan'
  },
  { 
    name: 'kondisiSaatIni', 
    label: 'Kondisi Saat Ini', 
    required: true, 
    type: 'textarea',
    description: 'Deskripsi situasi atau kondisi sistem saat ini'
  },
  { 
    name: 'kondisiYangDiharapkan', 
    label: 'Kondisi Yang Diharapkan', 
    required: true, 
    type: 'textarea',
    description: 'Deskripsi kondisi atau hasil yang diinginkan setelah implementasi'
  },
  { 
    name: 'potentialRisk', 
    label: 'Potential Risk', 
    required: false, 
    type: 'textarea',
    description: 'Identifikasi potensi risiko dan dampak yang mungkin timbul'
  },
  { 
    name: 'estimasiBiaya', 
    label: 'Estimasi Biaya', 
    required: false, 
    type: 'currency',
    description: 'Perkiraan biaya yang dibutuhkan untuk implementasi'
  },
  { 
    name: 'estimasiWaktu', 
    label: 'Estimasi Waktu', 
    required: false,
    description: 'Perkiraan durasi waktu yang dibutuhkan untuk implementasi'
  },
  { 
    name: 'manfaat', 
    label: 'Manfaat', 
    required: true, 
    type: 'textarea',
    description: 'Penjelasan tentang manfaat dan nilai tambah yang akan diperoleh'
  },
  { 
    name: 'dokumenTambahan', 
    label: 'Dokumen Tambahan', 
    required: false, 
    type: 'file',
    description: 'Lampiran dokumen pendukung yang relevan'
  },
  { 
    name: 'disetujuiOleh', 
    label: 'Disetujui Oleh', 
    required: true,
    description: 'Nama pejabat yang memberikan persetujuan'
  },
  { 
    name: 'disetujuiTanggal', 
    label: 'Disetujui Tanggal', 
    required: true, 
    type: 'date',
    description: 'Tanggal persetujuan diberikan'
  },
  { 
    name: 'dibuatOleh', 
    label: 'Dibuat Oleh', 
    required: true,
    description: 'Nama pembuat dokumen BRD'
  },
  { 
    name: 'dibuatTanggal', 
    label: 'Dibuat Tanggal', 
    required: true, 
    type: 'date',
    description: 'Tanggal pembuatan dokumen BRD'
  },
  { 
    name: 'diperiksaOleh', 
    label: 'Diperiksa Oleh', 
    required: true,
    description: 'Nama pemeriksa atau reviewer dokumen BRD'
  },
  { 
    name: 'diperiksaTanggal', 
    label: 'Diperiksa Tanggal', 
    required: true, 
    type: 'date',
    description: 'Tanggal pemeriksaan dokumen BRD dilakukan'
  }
];

// Define field types at the top level
const fieldTypes = [
  { value: 'text', label: 'Text Input' },
  { value: 'textarea', label: 'Text Area' },
  { value: 'currency', label: 'Currency' },
  { value: 'select', label: 'Select/Dropdown' }
];

// Add fieldBelongsToCategory helper function
const fieldBelongsToCategory = (field, category) => {
  if (!category?.keywords) return false;
  const fieldNameLower = field.name.toLowerCase();
  const fieldLabelLower = field.label.toLowerCase();
  return category.keywords.some(keyword => 
    fieldNameLower.includes(keyword.toLowerCase()) || 
    fieldLabelLower.includes(keyword.toLowerCase())
  );
};

// Add QuickAction component for common actions
const QuickAction = ({ icon, label, onClick, disabled = false }) => (
  <button
    onClick={onClick}
    disabled={disabled}
    className={`flex items-center p-3 rounded-lg border transition-all duration-200 ${
      disabled 
        ? 'border-gray-200 bg-gray-50 cursor-not-allowed' 
        : 'border-gray-200 hover:border-blue-300 hover:bg-blue-50'
    }`}
    data-tooltip-id="action-tooltip"
    data-tooltip-content={label}
  >
    {icon}
    <span className="ml-2 text-sm font-medium text-gray-700">{label}</span>
  </button>
);

// Add SearchBar component for template filtering
const SearchBar = ({ value, onChange }) => (
  <div className="relative">
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder="Search templates..."
      className="w-full pl-10 pr-4 py-2 rounded-lg border border-gray-300 focus:border-blue-500 focus:ring-blue-500"
    />
    <svg
      className="absolute left-3 top-2.5 h-5 w-5 text-gray-400"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
      />
    </svg>
  </div>
);

// Modify Field Selection Modal Component
const FieldSelectionModal = ({ isOpen, onClose, onSelect, predefinedFields, customFields, existingPoints }) => {
  const [selectedCategory, setSelectedCategory] = useState('all');
  const categories = {
    all: 'Semua Field',
    project: 'Informasi Proyek',
    background: 'Latar Belakang & Konteks',
    requirements: 'Kebutuhan',
    planning: 'Perencanaan & Implementasi',
    approval: 'Persetujuan & Dokumentasi',
    custom: 'Field Kustom'
  };

  const categorizedFields = {
    project: ['noBRD', 'tanggalPermintaan', 'unitBisnis', 'namaPemohon', 'jabatanPemohon', 'namaProject'],
    background: ['latarBelakang', 'kondisiSaatIni', 'kondisiYangDiharapkan'],
    requirements: ['functionalRequirements', 'nonFunctionalRequirements', 'mainNeeds', 'businessImpact'],
    planning: ['targetImplementasi', 'estimasiBiaya', 'estimasiWaktu', 'potentialRisk'],
    approval: ['disetujuiOleh', 'diperiksaOleh', 'dibuatOleh', 'dokumenTambahan'],
    custom: customFields?.map(field => field.name) || []
  };

  const getFieldsByCategory = () => {
    if (selectedCategory === 'all') {
      return [...predefinedFields, ...customFields];
    }
    if (selectedCategory === 'custom') {
      return customFields;
    }
    return [...predefinedFields, ...customFields].filter(field => 
      categorizedFields[selectedCategory]?.includes(field.name)
    );
  };

  const handleFieldSelect = (field) => {
    const fieldConfig = {
      name: field.name,
      label: field.label,
      type: field.type || 'text',
      required: field.required || false,
      options: field.options,
      description: field.description
    };

    onSelect(fieldConfig);
  };

  return isOpen ? (
    <div className="fixed inset-0 z-[60] overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
        <div className="fixed inset-0 transition-opacity bg-gray-500 bg-opacity-75" onClick={onClose}></div>

        <div className="inline-block w-full max-w-4xl p-6 my-8 overflow-hidden text-left align-middle transition-all transform bg-white shadow-xl rounded-2xl">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-lg font-medium text-gray-900">Pilih Field untuk Bagian Template</h3>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-500">
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Category Selection */}
          <div className="mb-6">
            <div className="flex space-x-2 overflow-x-auto pb-2">
              {Object.entries(categories).map(([key, label]) => (
                <button
                  key={key}
                  onClick={() => setSelectedCategory(key)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap ${
                    selectedCategory === key
                      ? 'bg-blue-100 text-blue-700 border-blue-200'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[60vh] overflow-y-auto">
            {getFieldsByCategory().map((field) => {
              const isSelected = existingPoints.includes(field.label);
              return (
                <div
                  key={field.name}
                  className={`p-4 rounded-lg border ${
                    isSelected 
                      ? 'border-blue-500 bg-blue-50' 
                      : 'border-gray-200 hover:border-blue-300'
                  } transition-all duration-200 cursor-pointer`}
                  onClick={() => !isSelected && handleFieldSelect(field)}
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-medium text-gray-900">{field.label}</p>
                      <div className="mt-1 flex flex-wrap gap-2">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                          field.required ? 'bg-red-100 text-red-800' : 'bg-gray-100 text-gray-800'
                        }`}>
                          {field.required ? 'Wajib' : 'Opsional'}
                        </span>
                        {field.type && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                            {field.type === 'text' ? 'Teks' : 
                             field.type === 'textarea' ? 'Area Teks' :
                             field.type === 'select' ? 'Pilihan' :
                             field.type === 'date' ? 'Tanggal' :
                             field.type === 'file' ? 'Berkas' :
                             field.type === 'currency' ? 'Mata Uang' : field.type}
                          </span>
                        )}
                        {field.options && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-800">
                            {field.options.length} pilihan
                          </span>
                        )}
                      </div>
                    </div>
                    {isSelected && (
                      <span className="text-blue-600">
                        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-6 flex justify-end space-x-3">
            <button
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Selesai
            </button>
          </div>
        </div>
      </div>
    </div>
  ) : null;
};

// Modify AddSectionModal Component
const AddSectionModal = ({ isOpen, onClose, onAdd, predefinedFields, customFields, selectedFields, dataModalContainer, editingSectionIndex = -1, sectionData, setSectionData, handleUpdateSection }) => {
  const modalRef = useRef(null);
  const [isFieldSelectionOpen, setIsFieldSelectionOpen] = useState(false);

  // Only keep the scroll effect
  useEffect(() => {
    if (isOpen && editingSectionIndex >= 0) {
      const section = document.querySelector(`[data-section-index="${editingSectionIndex}"]`);
      if (section) {
        section.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  }, [isOpen, editingSectionIndex]);

  const handleFieldSelect = (field) => {
    const isFieldSelected = sectionData.fields.includes(field.name);
    if (isFieldSelected) {
      setSectionData(prev => ({
        ...prev,
        fields: prev.fields.filter(f => f !== field.name),
        points: prev.points.filter(p => p !== field.label),
        fieldConfigs: prev.fieldConfigs.filter(f => f.name !== field.name)
      }));
    } else {
      setSectionData(prev => ({
        ...prev,
        fields: [...prev.fields, field.name],
        points: [...prev.points, field.label],
        fieldConfigs: [...(prev.fieldConfigs || []), {
          name: field.name,
          label: field.label,
          type: field.type || 'text',
          required: field.required || false,
          options: field.options,
          description: field.description,
          isCustom: field.isCustom
        }]
      }));
    }
  };

  // Add handleRemovePoint function
  const handleRemovePoint = (index) => {
    setSectionData(prev => ({
      ...prev,
      points: prev.points.filter((_, i) => i !== index),
      fields: prev.fields.filter((_, i) => i !== index),
      fieldConfigs: prev.fieldConfigs.filter((_, i) => i !== index)
    }));
  };

  const handleSubmit = () => {
    if (!sectionData.title.trim()) {
      toast.error('Judul bagian harus diisi');
      return;
    }

    if (sectionData.points.length === 0) {
      toast.error('Minimal satu sub bab harus ditambahkan');
      return;
    }

    if (editingSectionIndex >= 0) {
      handleUpdateSection(sectionData, editingSectionIndex);
    } else {
      onAdd(sectionData);
    }
    onClose();
  };

  return isOpen ? (
    <div className="fixed inset-0 z-50 overflow-y-auto" ref={modalRef}>
      <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
        <div className="fixed inset-0 transition-opacity bg-gray-500 bg-opacity-75" onClick={onClose}></div>

        <div className="inline-block w-full max-w-3xl p-6 my-8 overflow-hidden text-left align-middle transition-all transform bg-white shadow-xl rounded-2xl">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-lg font-medium text-gray-900">Tambah Bagian Baru</h3>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-500">
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700">Judul Bagian</label>
              <input
                type="text"
                value={sectionData.title}
                onChange={(e) => setSectionData(prev => ({ ...prev, title: e.target.value }))}
                className="mt-1 block w-full rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                placeholder="Masukkan judul bagian"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Deskripsi</label>
              <textarea
                value={sectionData.description}
                onChange={(e) => setSectionData(prev => ({ ...prev, description: e.target.value }))}
                rows={3}
                className="mt-1 block w-full rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                placeholder="Masukkan deskripsi bagian"
              />
            </div>

            <div>
              <div className="flex justify-between items-center mb-4">
                <label className="block text-sm font-medium text-gray-700">Field yang Dipilih</label>
                <button
                  onClick={() => setIsFieldSelectionOpen(true)}
                  className="inline-flex items-center px-3 py-2 border border-transparent text-sm font-medium rounded-lg text-white bg-blue-600 hover:bg-blue-700"
                >
                  <svg className="w-4 h-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                  </svg>
                  Tambah Field
                </button>
              </div>

              <div className="space-y-2">
                {sectionData.points.length === 0 ? (
                  <div className="text-center py-8 border-2 border-dashed border-gray-300 rounded-lg">
                    <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    <p className="mt-2 text-sm text-gray-500">Belum ada field yang dipilih</p>
                    <p className="text-xs text-gray-400">Klik "Tambah Field" untuk memilih field</p>
                  </div>
                ) : (
                  sectionData.points.map((point, index) => (
                    <div key={index} className="flex items-center justify-between bg-gray-50 p-3 rounded-lg">
                      <span className="text-sm text-gray-700">• {point}</span>
                      <button
                        onClick={() => handleRemovePoint(index)}
                        className="text-red-600 hover:text-red-800 p-1"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="flex justify-end space-x-3">
              <button
                onClick={onClose}
                className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Batal
              </button>
              <button
                onClick={handleSubmit}
                disabled={!sectionData.title || sectionData.points.length === 0}
                className="px-4 py-2 border border-transparent text-sm font-medium rounded-lg text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {editingSectionIndex >= 0 ? 'Perbarui Bagian' : 'Tambah Bagian'}
              </button>
            </div>
          </div>
        </div>
      </div>
      
      <FieldSelectionModal
        isOpen={isFieldSelectionOpen}
        onClose={() => setIsFieldSelectionOpen(false)}
        onSelect={handleFieldSelect}
        predefinedFields={predefinedFields}
        customFields={customFields}
        existingPoints={sectionData.points}
      />
    </div>
  ) : null;
};

const TemplateManagement = () => {
  const { user, profile } = useUser();
  const [templates, setTemplates] = useState([]);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('structure');
  const [sortBy, setSortBy] = useState('date');
  const [newTemplate, setNewTemplate] = useState({
    name: '',
    description: '',
    fields: [],
    structure: {
      sections: []
    }
  });
  const [newField, setNewField] = useState({
    name: '',
    label: '',
    required: true,
    type: 'text',
    options: [],
    description: '' // Add description field
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFields, setSelectedFields] = useState([]);
  const [fieldCategory, setFieldCategory] = useState('all');
  const [showFieldPreview, setShowFieldPreview] = useState(false);
  const [previewField, setPreviewField] = useState(null);
  const [isAddingField, setIsAddingField] = useState(false);
  const [newOption, setNewOption] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [customFields, setCustomFields] = useState([]); // Add state for custom fields
  const [editingSectionIndex, setEditingSectionIndex] = useState(-1);

  // Add version history state
  const [versionHistory, setVersionHistory] = useState([]);
  const [currentVersionIndex, setCurrentVersionIndex] = useState(-1);
  const [isDirty, setIsDirty] = useState(false);

  // In TemplateManagement component, add this state
  const [sectionData, setSectionData] = useState({
    title: '',
    description: '',
    points: [],
    fields: [],
    fieldConfigs: []
  });

  // Add function to save version history
  const saveToHistory = (template) => {
    const newHistory = versionHistory.slice(0, currentVersionIndex + 1);
    newHistory.push(JSON.parse(JSON.stringify(template)));
    setVersionHistory(newHistory);
    setCurrentVersionIndex(newHistory.length - 1);
    setIsDirty(true);
  };

  // Add undo function
  const handleUndo = () => {
    if (currentVersionIndex > 0) {
      const previousVersion = versionHistory[currentVersionIndex - 1];
      setSelectedTemplate(JSON.parse(JSON.stringify(previousVersion)));
      setCurrentVersionIndex(currentVersionIndex - 1);
      setIsDirty(true);
    }
  };

  // Add redo function
  const handleRedo = () => {
    if (currentVersionIndex < versionHistory.length - 1) {
      const nextVersion = versionHistory[currentVersionIndex + 1];
      setSelectedTemplate(JSON.parse(JSON.stringify(nextVersion)));
      setCurrentVersionIndex(currentVersionIndex + 1);
      setIsDirty(true);
    }
  };

  // Add function to fetch custom fields
  const fetchCustomFields = async () => {
    try {
      console.log('Fetching custom fields, user:', user?.uid, 'isAdmin:', profile?.isAdmin);
      const customFieldsRef = collection(db, 'custom_fields');
      const snapshot = await getDocs(customFieldsRef);
      const customFieldsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        isCustom: true
      }));
      setCustomFields(customFieldsData);
      console.log('Successfully fetched custom fields:', customFieldsData.length);
    } catch (error) {
      console.error('Error fetching custom fields:', error);
      console.error('Error details:', {
        code: error.code,
        message: error.message,
        userId: user?.uid,
        isAdmin: profile?.isAdmin,
        role: profile?.role
      });
      toast.error('Error loading custom fields: ' + error.message);
    }
  };

  // Update useEffect to fetch both templates and custom fields
  useEffect(() => {
    if (!profile?.isAdmin) {
      setError('You do not have permission to manage templates. Please contact an administrator.');
      setLoading(false);
      return;
    }
    Promise.all([fetchTemplates(), fetchCustomFields()]);
  }, [profile]);

  // Function to handle both custom and regular field addition
  const handleAddField = async (isCustom = false) => {
    try {
      // Log the current state
      console.log('Adding field, current state:', {
        isCustom,
        userId: user?.uid,
        isAdmin: profile?.isAdmin,
        role: profile?.role,
        fieldData: newField
      });

      // Validate user permissions first
      if (!profile?.isAdmin) {
        console.error('Permission denied: User is not admin', {
          userId: user?.uid,
          profile: profile
        });
        toast.error('Anda tidak memiliki izin untuk menambah field');
        return;
      }

      // Basic validation
      if (!newField.name || !newField.label) {
        toast.error('Nama dan label field harus diisi');
        return;
      }

      // Validate field name format
      const nameRegex = /^[a-zA-Z][a-zA-Z0-9_]*$/;
      if (!nameRegex.test(newField.name)) {
        toast.error('Nama field harus diawali huruf dan hanya boleh mengandung huruf, angka, dan underscore');
        return;
      }

      // Type-specific validation
      let isValid = true;
      let errorMessage = '';

      switch (newField.type) {
        case 'select':
          if (!newField.options || newField.options.length === 0) {
            isValid = false;
            errorMessage = 'Field tipe pilihan harus memiliki minimal satu opsi';
          }
          break;
        case 'date':
          // Add any specific validation for date fields if needed
          break;
        case 'currency':
          // Add any specific validation for currency fields if needed
          break;
        case 'file':
          // Add any specific validation for file fields if needed
          break;
        case 'textarea':
          // Add any specific validation for textarea fields if needed
          break;
        case 'text':
          // Add any specific validation for text fields if needed
          break;
        default:
          // Default text field doesn't need special validation
          break;
      }

      if (!isValid) {
        toast.error(errorMessage);
        return;
      }

      const fieldConfig = {
        name: newField.name.trim(),
        label: newField.label.trim(),
        description: newField.description.trim() || undefined, // Only include if not empty
        isCustom,
        type: newField.type || 'text',
        required: newField.required ?? true
      };

      // Only add options if they exist and the type is select
      if (newField.type === 'select' && newField.options && newField.options.length > 0) {
        fieldConfig.options = newField.options;
      }

      // Check if field name already exists (case-insensitive)
      const existingFields = [...predefinedFields, ...customFields];
      const fieldExists = existingFields.some(
        f => f.name.toLowerCase() === fieldConfig.name.toLowerCase()
      );

      if (fieldExists) {
        toast.error('Nama field sudah digunakan, silakan gunakan nama lain');
        return;
      }

      if (isCustom) {
        // Save to Firestore with explicit error handling
        try {
          console.log('Attempting to save custom field to Firestore:', fieldConfig);
          const customFieldsRef = collection(db, 'custom_fields');
          
          // Create Firestore document data without undefined values
          const firestoreData = {
            ...fieldConfig,
            createdAt: new Date(),
            createdBy: user.uid,
            createdByName: profile.namaLengkap
          };

          // Remove any undefined values
          Object.keys(firestoreData).forEach(key => {
            if (firestoreData[key] === undefined) {
              delete firestoreData[key];
            }
          });

          const docRef = await addDoc(customFieldsRef, firestoreData);

          console.log('Successfully added custom field:', docRef.id);

          // Add to local state
          const newCustomField = {
            id: docRef.id,
            ...fieldConfig
          };
          
          setCustomFields(prev => [...prev, newCustomField]);
          
          // Add to selected fields if in editing mode
          if (isEditing) {
            setSelectedTemplate(prev => ({
              ...prev,
              fields: [...(prev?.fields || []), newCustomField]
            }));
          } else {
            setNewTemplate(prev => ({
              ...prev,
              fields: [...(prev?.fields || []), newCustomField]
            }));
          }
        } catch (firestoreError) {
          console.error('Firestore error details:', {
            code: firestoreError.code,
            message: firestoreError.message,
            userId: user?.uid,
            isAdmin: profile?.isAdmin,
            role: profile?.role,
            fieldConfig
          });
          toast.error('Gagal menyimpan field ke database: ' + firestoreError.message);
          return;
        }
      } else {
        // Add to template fields
        if (isEditing) {
          setSelectedTemplate(prev => ({
            ...prev,
            fields: [...(prev?.fields || []), fieldConfig]
          }));
        } else {
          setNewTemplate(prev => ({
            ...prev,
            fields: [...(prev?.fields || []), fieldConfig]
          }));
        }
      }

      // Reset form
      setNewField({
        name: '',
        label: '',
        required: true,
        type: 'text',
        options: [],
        description: '' // Reset description field
      });
      setNewOption('');
      setIsAddingField(false);
      setError(null);

      // Show success message
      toast.success('Field berhasil ditambahkan');
    } catch (error) {
      console.error('Error in handleAddField:', error);
      console.error('Error context:', {
        userId: user?.uid,
        isAdmin: profile?.isAdmin,
        role: profile?.role,
        fieldData: newField
      });
      toast.error('Gagal menambahkan field: ' + error.message);
    }
  };

  // Combine predefined and custom fields for display
  const allFields = [...predefinedFields, ...customFields];

  // Add this function to handle option addition
  const handleAddOption = () => {
    if (!newOption.trim()) {
      setError('Opsi tidak boleh kosong');
      return;
    }

    // Check if option already exists
    if (newField.options?.includes(newOption.trim())) {
      setError('Opsi ini sudah ada');
      return;
    }

    setNewField(prev => ({
      ...prev,
      options: [...(prev.options || []), newOption.trim()]
    }));
    setNewOption('');
    setError(null);
  };

  // Add this function to handle option removal
  const handleRemoveOption = (indexToRemove) => {
    setNewField(prev => ({
      ...prev,
      options: prev.options.filter((_, index) => index !== indexToRemove)
    }));
  };

  // Track selected predefined fields
  const [selectedPredefinedFields, setSelectedPredefinedFields] = useState(
    predefinedFields.reduce((acc, field) => ({ ...acc, [field.name]: false }), {})
  );

  useEffect(() => {
    if (!profile?.isAdmin) {
      setError('You do not have permission to manage templates. Please contact an administrator.');
      setLoading(false);
      return;
    }
    fetchTemplates();
  }, [profile]);

  const fetchTemplates = async () => {
    try {
      setLoading(true);
      const templatesRef = collection(db, 'brd_templates');
      const snapshot = await getDocs(templatesRef);
      const templatesData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        structure: doc.data().structure || { sections: [] } // Ensure structure exists
      }));
      setTemplates(templatesData);
    } catch (error) {
      console.error('Error fetching templates:', error);
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleAddTemplate = async () => {
    try {
      if (!profile?.isAdmin) {
        throw new Error('Anda tidak memiliki izin untuk membuat template');
      }

      if (!newTemplate.name.trim()) {
        setError('Nama template harus diisi');
        return;
      }

      if (!newTemplate.description.trim()) {
        setError('Deskripsi template harus diisi');
        return;
      }

      if (newTemplate.structure.sections.length === 0) {
        setError('Template harus memiliki minimal satu bagian');
        return;
      }

      setError(null);
      const templatesRef = collection(db, 'brd_templates');
      await addDoc(templatesRef, {
        name: newTemplate.name,
        description: newTemplate.description,
        structure: newTemplate.structure,
        createdAt: new Date(),
        createdBy: user.uid,
        createdByName: profile.namaLengkap,
        updatedAt: new Date(),
        status: 'active'
      });
      
      await fetchTemplates();
      setNewTemplate({
        name: '',
        description: '',
        fields: [],
        structure: {
          sections: []
        }
      });

      // Show success message or notification here if needed
    } catch (error) {
      console.error('Error menambahkan template:', error);
      setError(error.message);
    }
  };

  // Update the handleUpdateTemplate function
  const handleUpdateTemplate = async () => {
    try {
      if (!profile?.isAdmin) {
        throw new Error('Anda tidak memiliki izin untuk memperbarui template');
      }

      if (!selectedTemplate?.id) {
        toast.error('Template ID tidak valid');
        return;
      }

      // Enhanced validation
      const validationErrors = [];
      if (!selectedTemplate.name?.trim()) {
        validationErrors.push('Nama template harus diisi');
      }
      if (!selectedTemplate.description?.trim()) {
        validationErrors.push('Deskripsi template harus diisi');
      }
      if (!selectedTemplate.structure?.sections?.length) {
        validationErrors.push('Template harus memiliki minimal satu bagian');
      }

      // Section validation
      selectedTemplate.structure?.sections?.forEach((section, index) => {
        if (!section.title?.trim()) {
          validationErrors.push(`Bagian ${index + 1} harus memiliki judul`);
        }
        if (!section.points?.length) {
          validationErrors.push(`Bagian ${index + 1} harus memiliki minimal satu poin`);
        }
      });

      if (validationErrors.length > 0) {
        toast.error(
          <div>
            <p className="font-medium mb-2">Mohon perbaiki kesalahan berikut:</p>
            <ul className="list-disc pl-4">
              {validationErrors.map((error, index) => (
                <li key={index}>{error}</li>
              ))}
            </ul>
          </div>
        );
        return;
      }

      setError(null);
      const templateRef = doc(db, 'brd_templates', selectedTemplate.id);
      
      // Create update data without undefined values
      const updateData = {
        name: selectedTemplate.name.trim(),
        description: selectedTemplate.description.trim(),
        structure: {
          sections: selectedTemplate.structure?.sections?.map(section => ({
            title: section.title || '',
            description: section.description || '',
            points: Array.isArray(section.points) ? section.points : [],
            fields: Array.isArray(section.fields) ? section.fields : [],
            fieldConfigs: Array.isArray(section.fieldConfigs) ? section.fieldConfigs : []
          })) || []
        },
        updatedAt: serverTimestamp(),
        updatedBy: user.uid,
        updatedByName: profile.namaLengkap,
        status: selectedTemplate.status || 'active',
        version: (selectedTemplate.version || 0) + 1,
        previousVersion: selectedTemplate.id,
        versionHistory: versionHistory.map(version => ({
          timestamp: new Date(),
          data: version
        }))
      };

      // Remove any undefined or null values recursively
      const cleanData = (obj) => {
        if (Array.isArray(obj)) {
          return obj.map(item => {
            if (item && typeof item === 'object') {
              return cleanData(item);
            }
            return item;
          });
        }
        
        const cleaned = {};
        Object.keys(obj).forEach(key => {
          if (obj[key] === null || obj[key] === undefined) {
            return;
          }
          if (typeof obj[key] === 'object') {
            cleaned[key] = cleanData(obj[key]);
          } else {
            cleaned[key] = obj[key];
          }
        });
        return cleaned;
      };

      const cleanedData = cleanData(updateData);
      console.log('Updating template with data:', cleanedData);

      await updateDoc(templateRef, cleanedData);
      
      toast.success('Template berhasil diperbarui');
      await fetchTemplates();
      setIsEditing(false);
      setSelectedTemplate(null);
      setVersionHistory([]);
      setCurrentVersionIndex(-1);
      setIsDirty(false);
    } catch (error) {
      console.error('Error updating template:', error);
      console.error('Template data:', selectedTemplate);
      toast.error('Gagal memperbarui template: ' + error.message);
    }
  };

  const handleDeleteTemplate = async (templateId) => {
    try {
      if (!profile?.isAdmin) {
        throw new Error('You do not have permission to delete templates');
      }
      setError(null);
      await deleteDoc(doc(db, 'brd_templates', templateId));
      await fetchTemplates();
    } catch (error) {
      console.error('Error deleting template:', error);
      setError(error.message);
    }
  };

  const handleTogglePredefinedField = (field) => {
    const currentFields = isEditing ? selectedTemplate.fields : newTemplate.fields;
    const isFieldSelected = selectedPredefinedFields[field.name];
    
    setSelectedPredefinedFields({
      ...selectedPredefinedFields,
      [field.name]: !isFieldSelected
    });

    if (!isFieldSelected) {
      // Add field
      if (isEditing) {
        setSelectedTemplate({
          ...selectedTemplate,
          fields: [...currentFields, field]
        });
      } else {
        setNewTemplate({
          ...newTemplate,
          fields: [...currentFields, field]
        });
      }
      // Update structure based on the new field
      updateStructureFromFields([...currentFields, field], isEditing);
    } else {
      // Remove field
      const updatedFields = currentFields.filter(f => f.name !== field.name);
      if (isEditing) {
        setSelectedTemplate({
          ...selectedTemplate,
          fields: updatedFields
        });
      } else {
        setNewTemplate({
          ...newTemplate,
          fields: updatedFields
        });
      }
      // Update structure after removing field
      updateStructureFromFields(updatedFields, isEditing);
    }
  };

  // New function to update structure based on selected fields
  const updateStructureFromFields = (fields, isEditing) => {
    // Define field categories with their keywords and titles
    const categories = [
      {
        id: 'project_info',
        title: 'INFORMASI PROYEK',
        keywords: ['project', 'dokumen', 'pemohon', 'unit', 'brd', 'tanggal', 'no', 'nama', 'jabatan', 'divisi'],
        description: 'Informasi dasar proyek dan detail dokumen'
      },
      {
        id: 'background',
        title: 'LATAR BELAKANG',
        keywords: ['kondisi', 'latar', 'current', 'masalah', 'problem', 'situasi', 'existing', 'saat ini'],
        description: 'Kondisi saat ini dan permasalahan yang dihadapi'
      },
      {
        id: 'business_needs',
        title: 'KEBUTUHAN BISNIS',
        keywords: ['kebutuhan', 'dampak', 'manfaat', 'needs', 'benefit', 'impact', 'bisnis', 'business', 'target', 'objective', 'tujuan'],
        description: 'Kebutuhan dan dampak bisnis yang diharapkan'
      },
      {
        id: 'scope',
        title: 'RUANG LINGKUP',
        keywords: ['lingkup', 'scope', 'batasan', 'limit', 'cakupan', 'boundary', 'include', 'exclude', 'termasuk', 'tidak termasuk'],
        description: 'Batasan dan cakupan proyek'
      },
      {
        id: 'system_requirements',
        title: 'KEBUTUHAN SISTEM',
        keywords: ['sistem', 'system', 'functional', 'requirement', 'technical', 'fungsi', 'teknis', 'non-functional', 'integration', 'integrasi'],
        description: 'Kebutuhan fungsional dan non-fungsional sistem'
      },
      {
        id: 'planning',
        title: 'PERENCANAAN',
        keywords: ['jadwal', 'anggaran', 'schedule', 'budget', 'timeline', 'cost', 'biaya', 'implementasi', 'risiko', 'mitigasi', 'risk'],
        description: 'Perencanaan implementasi dan manajemen risiko'
      },
      {
        id: 'stakeholders',
        title: 'PEMANGKU KEPENTINGAN',
        keywords: ['stakeholder', 'pemangku', 'kepentingan', 'pihak', 'terkait', 'responsible', 'accountable', 'consulted', 'informed'],
        description: 'Pihak-pihak yang terlibat dalam proyek'
      }
    ];

    // Initialize sections array
    const sections = [];
    
    // Helper function to check if a field belongs to a category
    const fieldBelongsToCategory = (field, category) => {
      if (!category.keywords) return false;
      const fieldNameLower = field.name.toLowerCase();
      const fieldLabelLower = field.label.toLowerCase();
      return category.keywords.some(keyword => 
        fieldNameLower.includes(keyword.toLowerCase()) || 
        fieldLabelLower.includes(keyword.toLowerCase())
      );
    };

    // Group fields by category
    categories.forEach(category => {
      const categoryFields = fields.filter(field => fieldBelongsToCategory(field, category));
      
      if (categoryFields.length > 0) {
        const section = {
          title: category.title,
          description: category.description,
          points: [],
          fields: categoryFields.map(field => field.name) // Store field references
        };

        // Add points based on field labels and types
        categoryFields.forEach(field => {
          let point = field.label;
          
          // Add type-specific information to points
          switch (field.type) {
            case 'textarea':
              point += ' (Deskripsi detail)';
              break;
            case 'select':
              point += ' (Pilihan: ' + (field.options?.join(', ') || '') + ')';
              break;
            case 'currency':
              point += ' (Nilai dalam Rupiah)';
              break;
          }

          // Add required/optional status
          point += field.required ? ' *' : ' (Opsional)';
          
          section.points.push(point);
        });

        sections.push(section);
      }
    });

    // Find uncategorized fields
    const categorizedFieldNames = new Set(
      sections.flatMap(section => section.fields)
    );
    
    const uncategorizedFields = fields.filter(
      field => !categorizedFieldNames.has(field.name)
    );

    if (uncategorizedFields.length > 0) {
      sections.push({
        title: 'INFORMASI TAMBAHAN',
        description: 'Informasi pendukung lainnya',
        points: uncategorizedFields.map(field => {
          let point = field.label;
          if (field.type === 'textarea') point += ' (Deskripsi detail)';
          if (field.type === 'select') point += ' (Pilihan: ' + (field.options?.join(', ') || '') + ')';
          if (field.type === 'currency') point += ' (Nilai dalam Rupiah)';
          return point + (field.required ? ' *' : ' (Opsional)');
        }),
        fields: uncategorizedFields.map(field => field.name)
      });
    }

    // Update the structure in the state
    const newStructure = { 
      sections,
      lastUpdated: new Date().toISOString(),
      totalFields: fields.length,
      categorizedFields: fields.length - uncategorizedFields.length
    };
    
    if (isEditing) {
      setSelectedTemplate(prev => ({
        ...prev,
        structure: newStructure
      }));
    } else {
      setNewTemplate(prev => ({
        ...prev,
        structure: newStructure
      }));
    }
  };

  const handleAddPredefinedField = (field) => {
    setSelectedPredefinedFields(prev => [...prev, field.name]);
    setNewTemplate(prev => ({
      ...prev,
      fields: [...prev.fields, field]
    }));
  };

  const handleRemovePredefinedField = (fieldName) => {
    setSelectedPredefinedFields(prev => prev.filter(name => name !== fieldName));
    setNewTemplate(prev => ({
      ...prev,
      fields: prev.fields.filter(field => field.name !== fieldName)
    }));
  };

  const handleAddSection = (sectionData) => {
    const newSection = {
      title: sectionData.title || '',
      description: sectionData.description || '',
      points: sectionData.points || [],
      fields: sectionData.fields || [],
      fieldConfigs: (sectionData.fields || []).map(fieldName => {
        const customField = customFields.find(f => f.name === fieldName);
        const predefinedField = predefinedFields.find(f => f.name === fieldName);
        return customField || predefinedField || {
          name: fieldName,
          label: fieldName,
          type: 'text',
          required: false
        };
      })
    };

    if (isEditing) {
      setSelectedTemplate(prev => ({
        ...prev,
        structure: {
          ...prev.structure,
          sections: [...(prev.structure?.sections || []), newSection]
        }
      }));
    } else {
      setNewTemplate(prev => ({
        ...prev,
        structure: {
          ...prev.structure,
          sections: [...(prev.structure?.sections || []), newSection]
        }
      }));
    }
    setIsModalOpen(false);
  };

  const handleRemoveSection = (index) => {
    if (isEditing && selectedTemplate?.structure) {
      const updatedSections = [...(selectedTemplate.structure.sections || [])];
      updatedSections.splice(index, 1);
      setSelectedTemplate({
        ...selectedTemplate,
        structure: {
          ...selectedTemplate.structure,
          sections: updatedSections
        }
      });
    } else {
      const updatedSections = [...(newTemplate.structure.sections || [])];
      updatedSections.splice(index, 1);
      setNewTemplate({
        ...newTemplate,
        structure: {
          ...newTemplate.structure,
          sections: updatedSections
        }
      });
    }
  };

  // Filter and sort templates with null checks
  const filteredTemplates = (templates || [])
    .filter(template => 
      (template?.name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (template?.description || '').toLowerCase().includes(searchQuery.toLowerCase())
    )
    .sort((a, b) => {
      switch (sortBy) {
        case 'name':
          return (a?.name || '').localeCompare(b?.name || '');
        case 'date':
          return new Date(b?.createdAt || 0) - new Date(a?.createdAt || 0);
        case 'fields':
          return (b?.fields?.length || 0) - (a?.fields?.length || 0);
        default:
          return 0;
      }
    });

  // Field categories
  const fieldCategories = [
    { id: 'all', label: 'Semua Sub Bab' },
    { id: 'project_info', label: 'Informasi Proyek', keywords: ['project', 'dokumen', 'pemohon', 'unit', 'brd', 'tanggal', 'no', 'nama', 'jabatan', 'divisi'] },
    { id: 'background', label: 'Latar Belakang', keywords: ['kondisi', 'latar', 'current', 'masalah', 'problem', 'situasi', 'existing', 'saat ini'] },
    { id: 'business_needs', label: 'Kebutuhan Bisnis', keywords: ['kebutuhan', 'dampak', 'manfaat', 'needs', 'benefit', 'impact', 'bisnis', 'business', 'target', 'objective', 'tujuan'] },
    { id: 'scope', label: 'Ruang Lingkup', keywords: ['lingkup', 'scope', 'batasan', 'limit', 'cakupan', 'boundary', 'include', 'exclude', 'termasuk', 'tidak termasuk'] },
    { id: 'system_requirements', label: 'Kebutuhan Sistem', keywords: ['sistem', 'system', 'functional', 'requirement', 'technical', 'fungsi', 'teknis', 'non-functional', 'integration', 'integrasi'] },
    { id: 'planning', label: 'Perencanaan', keywords: ['jadwal', 'anggaran', 'schedule', 'budget', 'timeline', 'cost', 'biaya', 'implementasi', 'risiko', 'mitigasi', 'risk'] },
    { id: 'stakeholders', label: 'Pemangku Kepentingan', keywords: ['stakeholder', 'pemangku', 'kepentingan', 'pihak', 'terkait', 'responsible', 'accountable', 'consulted', 'informed'] },
    { id: 'custom', label: 'Sub Bab Kustom' }
  ];

  // Handle field selection
  const handleFieldSelect = (field) => {
    const isSelected = selectedFields.some(f => f.name === field.name);
    if (isSelected) {
      setSelectedFields(selectedFields.filter(f => f.name !== field.name));
    } else {
      setSelectedFields([...selectedFields, field]);
    }
  };

  // Handle field preview
  const handleFieldPreview = (field) => {
    setPreviewField(field);
    setShowFieldPreview(true);
  };

  // Field preview component
  const FieldPreview = ({ field, onClose }) => (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
        <div className="fixed inset-0 transition-opacity bg-gray-500 bg-opacity-75" onClick={onClose}></div>
        <div className="inline-block w-full max-w-2xl p-6 my-8 overflow-hidden text-left align-middle transition-all transform bg-white shadow-xl rounded-2xl">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-lg font-medium text-gray-900">Preview: {field.label}</h3>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-500">
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{field.label}</label>
              {field.type === 'text' && (
                <input type="text" className="w-full p-2 border rounded-md" placeholder="Sample text input" />
              )}
              {field.type === 'textarea' && (
                <textarea rows={4} className="w-full p-2 border rounded-md" placeholder="Sample text area"></textarea>
              )}
              {field.type === 'select' && field.options && (
                <select className="w-full p-2 border rounded-md">
                  <option value="">Select an option</option>
                  {field.options.map((opt, i) => (
                    <option key={i} value={opt}>{opt}</option>
                  ))}
                </select>
              )}
              {field.type === 'currency' && (
                <div className="relative">
                  <span className="absolute left-3 top-2 text-gray-500">Rp</span>
                  <input type="text" className="w-full p-2 pl-8 border rounded-md" placeholder="1,000,000" />
                </div>
              )}
            </div>
            
            <div className="bg-gray-50 p-4 rounded-md">
              <h4 className="text-sm font-medium text-gray-900 mb-2">Field Properties</h4>
              <dl className="grid grid-cols-2 gap-4">
                <div>
                  <dt className="text-sm text-gray-500">Field Name</dt>
                  <dd className="text-sm font-medium text-gray-900">{field.name}</dd>
                </div>
                <div>
                  <dt className="text-sm text-gray-500">Type</dt>
                  <dd className="text-sm font-medium text-gray-900">{field.type}</dd>
                </div>
                <div>
                  <dt className="text-sm text-gray-500">Required</dt>
                  <dd className="text-sm font-medium text-gray-900">{field.required ? 'Yes' : 'No'}</dd>
                </div>
                {field.description && (
                  <div className="col-span-2">
                    <dt className="text-sm text-gray-500">Description</dt>
                    <dd className="text-sm font-medium text-gray-900">{field.description}</dd>
                  </div>
                )}
                {field.options && (
                  <div className="col-span-2">
                    <dt className="text-sm text-gray-500">Options</dt>
                    <dd className="text-sm font-medium text-gray-900">{field.options.join(', ')}</dd>
                  </div>
                )}
              </dl>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  const addToRecent = (template) => {
    // Simplified version that just updates the state without localStorage
    setRecentTemplates(prev => [template, ...prev.filter(t => t.id !== template.id)].slice(0, 5));
  };

  // Add safety check for sections
  const getSections = () => {
    if (isEditing && selectedTemplate?.structure?.sections) {
      return selectedTemplate.structure.sections;
    }
    return newTemplate?.structure?.sections || [];
  };

  const handleOpenModal = () => {
    setIsModalOpen(true);
    // Small delay to ensure modal is rendered before scrolling
    setTimeout(() => {
      const modalElement = document.querySelector('[data-modal-container]');
      if (modalElement) {
        modalElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 100);
  };

  // Update the field type selection handler
  const handleFieldTypeChange = (type) => {
    setNewField(prev => ({
      ...prev,
      type,
      // Reset options only if changing from select to another type
      options: type === 'select' ? (prev.type === 'select' ? prev.options : []) : undefined
    }));
  };

  const handleRemovePoint = (sectionIndex, pointIndex) => {
    if (isEditing) {
      setSelectedTemplate(prev => {
        const updatedSections = [...prev.structure.sections];
        const section = { ...updatedSections[sectionIndex] };
        
        // Remove the point and its corresponding field
        section.points = section.points.filter((_, idx) => idx !== pointIndex);
        section.fields = section.fields.filter((_, idx) => idx !== pointIndex);
        section.fieldConfigs = section.fieldConfigs?.filter((_, idx) => idx !== pointIndex);
        
        updatedSections[sectionIndex] = section;
        
        return {
          ...prev,
          structure: {
            ...prev.structure,
            sections: updatedSections
          }
        };
      });
    } else {
      setNewTemplate(prev => {
        const updatedSections = [...prev.structure.sections];
        const section = { ...updatedSections[sectionIndex] };
        
        // Remove the point and its corresponding field
        section.points = section.points.filter((_, idx) => idx !== pointIndex);
        section.fields = section.fields.filter((_, idx) => idx !== pointIndex);
        section.fieldConfigs = section.fieldConfigs?.filter((_, idx) => idx !== pointIndex);
        
        updatedSections[sectionIndex] = section;
        
        return {
          ...prev,
          structure: {
            ...prev.structure,
            sections: updatedSections
          }
        };
      });
    }
  };

  // Update the handleEditTemplate function
  const handleEditTemplate = (template) => {
    const initialVersion = {
      ...template,
      structure: {
        sections: template.structure?.sections?.map(section => ({
          ...section,
          points: section.points || [],
          fields: section.fields || [],
          fieldConfigs: section.fieldConfigs || []
        })) || []
      }
    };
    setSelectedTemplate(initialVersion);
    setVersionHistory([initialVersion]);
    setCurrentVersionIndex(0);
    setIsDirty(false);
    setIsEditing(true);
  };

  const handleDeleteCustomField = async (fieldId) => {
    try {
      if (!profile?.isAdmin) {
        toast.error('Anda tidak memiliki izin untuk menghapus field');
        return;
      }

      // Delete from Firestore
      const fieldRef = doc(db, 'custom_fields', fieldId);
      await deleteDoc(fieldRef);

      // Update local state
      setCustomFields(prev => prev.filter(field => field.id !== fieldId));
      
      // Remove from selected fields if selected
      setSelectedFields(prev => prev.filter(field => field.id !== fieldId));

      // Update template fields if in editing mode
      if (isEditing) {
        setSelectedTemplate(prev => ({
          ...prev,
          fields: prev.fields.filter(field => field.id !== fieldId)
        }));
      } else {
        setNewTemplate(prev => ({
          ...prev,
          fields: prev.fields.filter(field => field.id !== fieldId)
        }));
      }

      toast.success('Field berhasil dihapus');
    } catch (error) {
      console.error('Error deleting custom field:', error);
      toast.error('Gagal menghapus field: ' + error.message);
    }
  };

  // Update the handleEditSection function
  const handleEditSection = (sectionIndex) => {
    const section = isEditing 
      ? selectedTemplate.structure.sections[sectionIndex] 
      : newTemplate.structure.sections[sectionIndex];
    
    // Deep clone the section data to avoid reference issues
    setSectionData({
      title: section.title || '',
      description: section.description || '',
      points: [...(section.points || [])],
      fields: [...(section.fields || [])],
      fieldConfigs: JSON.parse(JSON.stringify(section.fieldConfigs || []))
    });
    
    setEditingSectionIndex(sectionIndex);
    setIsModalOpen(true);
    
    // Save current state to history before editing
    if (isEditing) {
      saveToHistory(selectedTemplate);
    }
  };

  // Update the handleUpdateSection function
  const handleUpdateSection = (sectionData, sectionIndex) => {
    try {
      const updatedSection = {
        ...sectionData,
        points: sectionData.points || [],
        fields: sectionData.fields || [],
        fieldConfigs: sectionData.fieldConfigs || []
      };

      if (isEditing) {
        const newTemplate = {
          ...selectedTemplate,
          structure: {
            ...selectedTemplate.structure,
            sections: selectedTemplate.structure.sections.map((section, idx) =>
              idx === sectionIndex ? updatedSection : section
            )
          }
        };
        setSelectedTemplate(newTemplate);
        saveToHistory(newTemplate);
      } else {
        setNewTemplate(prev => ({
          ...prev,
          structure: {
            ...prev.structure,
            sections: prev.structure.sections.map((section, idx) =>
              idx === sectionIndex ? updatedSection : section
            )
          }
        }));
      }
      
      setIsModalOpen(false);
      setEditingSectionIndex(-1);
      toast.success('Bagian berhasil diperbarui');
    } catch (error) {
      console.error('Error updating section:', error);
      toast.error('Gagal memperbarui bagian: ' + error.message);
    }
  };

  return (
    <div className="space-y-8">
      {/* Header Section */}
      <div className="bg-gradient-to-r from-blue-900 via-blue-800 to-blue-700 rounded-3xl shadow-xl p-8 relative overflow-hidden">
        <div className="absolute inset-0 bg-pattern opacity-10"></div>
        <div className="relative z-10">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-3xl font-bold text-white mb-2 flex items-center">
                <svg className="w-8 h-8 mr-3 text-blue-200" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
                Manajemen Template
              </h2>
              <p className="text-blue-100 text-lg max-w-2xl">Buat dan kelola template BRD untuk memastikan konsistensi dan efisiensi dalam pengembangan proyek</p>
            </div>
            {!isEditing && (
              <button
                onClick={() => {
                  setNewTemplate({
                    name: '',
                    description: '',
                    fields: [],
                    structure: {
                      sections: []
                    }
                  });
                  setError(null);
                }}
                className="px-6 py-3 bg-white/10 backdrop-blur-lg text-white rounded-xl font-medium hover:bg-white/20 transition-all duration-200 flex items-center space-x-2"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                <span>Reset Form</span>
              </button>
            )}
          </div>
          
          {/* Quick Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-8">
            <div className="bg-white/10 backdrop-blur-lg rounded-xl p-4 flex items-center space-x-4">
              <div className="p-3 bg-white/10 rounded-lg">
                <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
              </div>
              <div>
                <p className="text-blue-100 text-sm">Total Template</p>
                <p className="text-white text-2xl font-bold">{templates.length}</p>
              </div>
            </div>
            <div className="bg-white/10 backdrop-blur-lg rounded-xl p-4 flex items-center space-x-4">
              <div className="p-3 bg-white/10 rounded-lg">
                <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 14v6m-3-3h6M6 10h2a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v2a2 2 0 002 2zm10 0h2a2 2 0 002-2V6a2 2 0 00-2-2h-2a2 2 0 00-2 2v2a2 2 0 002 2zM6 20h2a2 2 0 002-2v-2a2 2 0 00-2-2H6a2 2 0 00-2 2v2a2 2 0 002 2z" />
                </svg>
              </div>
              <div>
                <p className="text-blue-100 text-sm">Custom Fields</p>
                <p className="text-white text-2xl font-bold">{customFields.length}</p>
              </div>
            </div>
            <div className="bg-white/10 backdrop-blur-lg rounded-xl p-4 flex items-center space-x-4">
              <div className="p-3 bg-white/10 rounded-lg">
                <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
                </svg>
              </div>
              <div>
                <p className="text-blue-100 text-sm">Total Sections</p>
                <p className="text-white text-2xl font-bold">
                  {templates.reduce((acc, template) => acc + (template.structure?.sections?.length || 0), 0)}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {error && (
        <div className="animate-fade-in bg-red-50 border border-red-200 rounded-2xl p-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800">Error</h3>
              <p className="mt-1 text-sm text-red-700">{error}</p>
            </div>
          </div>
        </div>
      )}

      {!profile?.isAdmin ? (
        <div className="bg-yellow-50 border border-yellow-200 rounded-2xl p-6">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-6 w-6 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <h3 className="text-lg font-medium text-yellow-800">Access Restricted</h3>
              <p className="mt-2 text-yellow-700">
                You need administrator privileges to manage templates. Please contact your system administrator for access.
              </p>
            </div>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Left Column - Template List */}
          <div className="bg-white rounded-2xl shadow-xl overflow-hidden border border-gray-100">
            <div className="p-6 border-b border-gray-100 bg-gradient-to-r from-gray-50 to-white">
              <div className="flex justify-between items-center">
                <h3 className="text-xl font-bold text-gray-900 flex items-center">
                  <svg className="w-5 h-5 mr-2 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                  Templates Tersedia
                </h3>
                <div className="flex items-center space-x-2">
                  <SearchBar value={searchQuery} onChange={setSearchQuery} />
                </div>
              </div>
            </div>
            
            {loading ? (
              <div className="flex flex-col items-center justify-center py-12">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-900"></div>
                <p className="mt-4 text-sm text-gray-500">Loading templates...</p>
              </div>
            ) : filteredTemplates.length === 0 ? (
              <div className="text-center py-12 px-4">
                <div className="mx-auto w-24 h-24 bg-gray-50 rounded-full flex items-center justify-center mb-4">
                  <svg className="w-12 h-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">No templates found</h3>
                <p className="text-gray-500 mb-6">Get started by creating your first template</p>
                <button
                  onClick={() => setActiveTab('structure')}
                  className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-lg text-white bg-blue-600 hover:bg-blue-700"
                >
                  <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                  </svg>
                  Create Template
                </button>
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {filteredTemplates.map((template) => (
                  <div 
                    key={template.id} 
                    className={`group hover:bg-gray-50 transition-all duration-200 ${
                      selectedTemplate?.id === template.id ? 'bg-blue-50' : ''
                    }`}
                  >
                    <div className="p-6">
                      <div className="flex justify-between items-start">
                        <div className="flex-1 min-w-0 pr-6">
                          <h4 className="text-lg font-semibold text-gray-900 mb-1 flex items-center">
                            {template.name}
                            {selectedTemplate?.id === template.id && (
                              <span className="ml-2 px-2 py-1 text-xs font-medium text-blue-600 bg-blue-100 rounded-full">
                                Selected
                              </span>
                            )}
                          </h4>
                          <p className="text-gray-500 text-sm line-clamp-2 mb-4">{template.description}</p>
                          
                          <div className="flex flex-wrap gap-4 text-sm text-gray-500">
                            <div className="flex items-center">
                              <svg className="w-4 h-4 mr-1.5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
                              </svg>
                              {template.structure?.sections?.length || 0} sections
                            </div>
                            <div className="flex items-center">
                              <svg className="w-4 h-4 mr-1.5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 14v6m-3-3h6M6 10h2a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v2a2 2 0 002 2zm10 0h2a2 2 0 002-2V6a2 2 0 00-2-2h-2a2 2 0 00-2 2v2a2 2 0 002 2zM6 20h2a2 2 0 002-2v-2a2 2 0 00-2-2H6a2 2 0 00-2 2v2a2 2 0 002 2z" />
                              </svg>
                              {template.structure?.sections?.reduce((total, section) => total + (section.fields?.length || 0), 0) || 0} fields
                            </div>
                            <div className="flex items-center">
                              <svg className="w-4 h-4 mr-1.5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                              </svg>
                              {new Date(template.createdAt?.toDate()).toLocaleDateString()}
                            </div>
                          </div>
                        </div>
                        
                        <div className="flex flex-col space-y-2">
                          <button
                            onClick={() => handleEditTemplate(template)}
                            className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors duration-200"
                            title="Edit template"
                          >
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                          </button>
                          <button
                            onClick={() => {
                              if (window.confirm('Are you sure you want to delete this template?')) {
                                handleDeleteTemplate(template.id);
                              }
                            }}
                            className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors duration-200"
                            title="Delete template"
                          >
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Right Column - Template Form */}
          <div className="bg-white rounded-2xl shadow-xl overflow-hidden border border-gray-100">
            {/* Tab Navigation */}
            <div className="border-b border-gray-100">
              <div className="px-6 pt-6">
                <h3 className="text-xl font-bold text-gray-900 mb-4 flex items-center">
                  <svg className="w-6 h-6 mr-2 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v3m0 0v3m0-3h3m-3 0H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  {isEditing ? 'Edit Template' : 'Create New Template'}
                  {isEditing && (
                    <span className="ml-3 px-3 py-1 text-sm font-medium text-blue-600 bg-blue-50 rounded-full">
                      Editing Mode
                    </span>
                  )}
                </h3>
              </div>
              <div className="px-6">
                <nav className="-mb-px flex space-x-8" aria-label="Tabs">
                  <button
                    onClick={() => setActiveTab('structure')}
                    className={`${
                      activeTab === 'structure'
                        ? 'border-blue-500 text-blue-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    } group inline-flex items-center py-4 px-1 border-b-2 font-medium text-sm focus:outline-none transition-colors duration-200`}
                  >
                    <svg 
                      className={`${
                        activeTab === 'structure' ? 'text-blue-500' : 'text-gray-400 group-hover:text-gray-500'
                      } -ml-0.5 mr-2 h-5 w-5`} 
                      fill="none" 
                      viewBox="0 0 24 24" 
                      stroke="currentColor"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
                    </svg>
                    Struktur Template
                  </button>
                  <button
                    onClick={() => setActiveTab('fields')}
                    className={`${
                      activeTab === 'fields'
                        ? 'border-blue-500 text-blue-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    } group inline-flex items-center py-4 px-1 border-b-2 font-medium text-sm focus:outline-none transition-colors duration-200`}
                  >
                    <svg 
                      className={`${
                        activeTab === 'fields' ? 'text-blue-500' : 'text-gray-400 group-hover:text-gray-500'
                      } -ml-0.5 mr-2 h-5 w-5`} 
                      fill="none" 
                      viewBox="0 0 24 24" 
                      stroke="currentColor"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 14v6m-3-3h6M6 10h2a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v2a2 2 0 002 2zm10 0h2a2 2 0 002-2V6a2 2 0 00-2-2h-2a2 2 0 00-2 2v2a2 2 0 002 2zM6 20h2a2 2 0 002-2v-2a2 2 0 00-2-2H6a2 2 0 00-2 2v2a2 2 0 002 2z" />
                    </svg>
                    Kelola Sub Bab
                    {selectedFields.length > 0 && (
                      <span className={`ml-2 px-2 py-0.5 rounded-full text-xs ${
                        activeTab === 'fields' 
                          ? 'bg-blue-100 text-blue-600' 
                          : 'bg-gray-100 text-gray-600'
                      }`}>
                        {selectedFields.length}
                      </span>
                    )}
                  </button>
                </nav>
              </div>
            </div>

            {/* Form Content */}
            <div className="p-6">
              <div className="space-y-6">
                {activeTab === 'structure' && (
                  <>
                    <div className="grid grid-cols-1 gap-6">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Template Name</label>
                        <input
                          type="text"
                          value={isEditing ? selectedTemplate?.name : newTemplate.name}
                          onChange={(e) => {
                            if (isEditing) {
                              setSelectedTemplate({
                                ...selectedTemplate,
                                name: e.target.value
                              });
                            } else {
                              setNewTemplate({
                                ...newTemplate,
                                name: e.target.value
                              });
                            }
                          }}
                          className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors duration-200"
                          placeholder="Enter template name"
                        />
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                        <textarea
                          value={isEditing ? selectedTemplate?.description : newTemplate.description}
                          onChange={(e) => {
                            if (isEditing) {
                              setSelectedTemplate({
                                ...selectedTemplate,
                                description: e.target.value
                              });
                            } else {
                              setNewTemplate({
                                ...newTemplate,
                                description: e.target.value
                              });
                            }
                          }}
                          rows={3}
                          className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors duration-200"
                          placeholder="Enter template description"
                        />
                      </div>
                    </div>
                  </>
                )}

                {/* Tab Content */}
                <div className="mt-6">
                  {activeTab === 'structure' && (
                    <div className="border-t border-gray-100 pt-6">
                      <div className="flex justify-between items-center mb-6">
                        <div>
                          <h4 className="text-lg font-medium text-gray-900 flex items-center">
                            <svg className="w-5 h-5 mr-2 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
                            </svg>
                            Struktur Template
                          </h4>
                          <p className="mt-1 text-sm text-gray-500">Organize your template into logical sections</p>
                        </div>
                        <button
                          onClick={handleOpenModal}
                          className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-lg text-white bg-blue-600 hover:bg-blue-700 shadow-sm transition-all duration-200 hover:shadow focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                        >
                          <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                          </svg>
                          Add New Section
                        </button>
                      </div>

                      {/* Existing Structure Content */}
                      {getSections().length === 0 ? (
                        <div className="text-center py-12 px-6 border-2 border-dashed border-gray-200 rounded-xl bg-gray-50">
                          <div className="mx-auto w-24 h-24 bg-white rounded-full flex items-center justify-center mb-4 shadow-sm">
                            <svg className="w-12 h-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                          </div>
                          <h3 className="text-lg font-medium text-gray-900 mb-2">No Sections Added Yet</h3>
                          <p className="text-gray-500 mb-6 max-w-sm mx-auto">Start building your template by adding sections to organize your fields</p>
                          <button
                            onClick={handleOpenModal}
                            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-lg text-white bg-blue-600 hover:bg-blue-700 shadow-sm transition-all duration-200"
                          >
                            <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                            </svg>
                            Add Your First Section
                          </button>
                        </div>
                      ) : (
                        <DragDropContext
                          onDragEnd={({ source, destination, type }) => {
                            if (!destination) return;
                            
                            if (type === 'section') {
                              handleReorderSections(source.index, destination.index);
                            } else if (type === 'field') {
                              const [sectionIndex] = source.droppableId.split('-').map(Number);
                              handleReorderFields(sectionIndex, source.index, destination.index);
                            }
                          }}
                        >
                          <Droppable droppableId="sections" type="section">
                            {(provided) => (
                              <div
                                ref={provided.innerRef}
                                {...provided.droppableProps}
                                className="space-y-4"
                              >
                                {getSections().map((section, sectionIndex) => (
                                  <Draggable
                                    key={`section-${sectionIndex}`}
                                    draggableId={`section-${sectionIndex}`}
                                    index={sectionIndex}
                                  >
                                    {(provided, snapshot) => (
                                      <div
                                        ref={provided.innerRef}
                                        {...provided.draggableProps}
                                        className={`bg-white rounded-xl border ${
                                          snapshot.isDragging ? 'border-blue-500 shadow-lg' : 'border-gray-200'
                                        } p-4 hover:shadow-md transition-all duration-200`}
                                      >
                                        <div className="flex items-center justify-between mb-3">
                                          <div className="flex items-center">
                                            <div
                                              {...provided.dragHandleProps}
                                              className="p-2 mr-2 text-gray-400 hover:text-gray-600 cursor-move"
                                            >
                                              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8h16M4 16h16" />
                                              </svg>
                                            </div>
                                            <div>
                                              <h5 className="text-lg font-medium text-gray-900">{section.title}</h5>
                                              {section.description && (
                                                <p className="text-sm text-gray-500 mt-0.5">{section.description}</p>
                                              )}
                                            </div>
                                          </div>
                                          <div className="flex items-center space-x-2">
                                            <button
                                              onClick={() => handleEditSection(sectionIndex)}
                                              className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors duration-200"
                                            >
                                              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                              </svg>
                                            </button>
                                            <button
                                              onClick={() => handleRemoveSection(sectionIndex)}
                                              className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors duration-200"
                                            >
                                              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                              </svg>
                                            </button>
                                          </div>
                                        </div>
                                        
                                        <Droppable droppableId={`${sectionIndex}-fields`} type="field">
                                          {(provided) => (
                                            <div
                                              ref={provided.innerRef}
                                              {...provided.droppableProps}
                                              className="space-y-2"
                                            >
                                              {(section.points || []).map((point, pointIndex) => (
                                                <Draggable
                                                  key={`${sectionIndex}-point-${pointIndex}`}
                                                  draggableId={`${sectionIndex}-point-${pointIndex}`}
                                                  index={pointIndex}
                                                >
                                                  {(provided, snapshot) => (
                                                    <div
                                                      ref={provided.innerRef}
                                                      {...provided.draggableProps}
                                                      className={`flex items-center justify-between ${
                                                        snapshot.isDragging ? 'bg-blue-50' : 'bg-gray-50'
                                                      } p-3 rounded-lg group hover:bg-gray-100 transition-colors duration-200`}
                                                    >
                                                      <span className="text-sm text-gray-700 flex items-center">
                                                        <div
                                                          {...provided.dragHandleProps}
                                                          className="p-1 mr-2 text-gray-400 hover:text-gray-600 cursor-move"
                                                        >
                                                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8h16M4 16h16" />
                                                          </svg>
                                                        </div>
                                                        {point}
                                                      </span>
                                                      <button
                                                        onClick={() => handleRemovePoint(sectionIndex, pointIndex)}
                                                        className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-600 p-1 rounded transition-all duration-200"
                                                      >
                                                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                                        </svg>
                                                      </button>
                                                    </div>
                                                  )}
                                                </Draggable>
                                              ))}
                                              {provided.placeholder}
                                            </div>
                                          )}
                                        </Droppable>
                                      </div>
                                    )}
                                  </Draggable>
                                ))}
                                {provided.placeholder}
                              </div>
                            )}
                          </Droppable>
                        </DragDropContext>
                      )}
                    </div>
                  )}

                  {activeTab === 'fields' && (
                    <div className="border-t border-gray-200 pt-6">
                      <div className="flex justify-between items-center mb-6">
                        <h4 className="text-lg font-medium text-gray-900 flex items-center">
                          <svg className="w-5 h-5 mr-2 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 14v6m-3-3h6M6 10h2a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v2a2 2 0 002 2zm10 0h2a2 2 0 002-2V6a2 2 0 00-2-2h-2a2 2 0 00-2 2v2a2 2 0 002 2zM6 20h2a2 2 0 002-2v-2a2 2 0 00-2-2H6a2 2 0 00-2 2v2a2 2 0 002 2z" />
                          </svg>
                          Kelola Sub Bab
                        </h4>
                        <div className="flex items-center space-x-2">
                          <span className="text-sm text-gray-500">Selected: {selectedFields.length}</span>
                          {selectedFields.length > 0 && (
                            <button
                              onClick={() => setSelectedFields([])}
                              className="text-sm text-blue-600 hover:text-blue-800"
                            >
                              Clear
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Search and Filter */}
                      <div className="mb-6 flex space-x-4">
                        <div className="relative flex-1">
                          <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Cari sub bab berdasarkan nama atau label..."
                            className="w-full pl-10 pr-4 py-2 rounded-lg border border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                          />
                          <svg
                            className="absolute left-3 top-2.5 h-5 w-5 text-gray-400"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                            />
                          </svg>
                        </div>
                        <select
                          value={fieldCategory}
                          onChange={(e) => setFieldCategory(e.target.value)}
                          className="rounded-lg border border-gray-300 focus:border-blue-500 focus:ring-blue-500 px-4 py-2"
                        >
                          {fieldCategories.map(category => (
                            <option key={category.id} value={category.id}>{category.label}</option>
                          ))}
                        </select>
                      </div>

                      {/* Custom Field Creation Form */}
                      <div className="mb-6 bg-gray-50 rounded-lg p-4">
                        <div className="flex justify-between items-center mb-4">
                          <h5 className="text-sm font-medium text-gray-900">Buat Sub Bab Baru</h5>
                          <button
                            onClick={() => setIsAddingField(!isAddingField)}
                            className="text-blue-600 hover:text-blue-800"
                          >
                            {isAddingField ? 'Tutup' : 'Tambah Sub Bab Baru'}
                          </button>
                        </div>

                        {isAddingField && (
                          <div className="space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <div>
                                <label className="block text-sm font-medium text-gray-700">Sub Bab</label>
                                <input
                                  type="text"
                                  value={newField.name}
                                  onChange={(e) => setNewField({ 
                                    ...newField, 
                                    name: e.target.value.replace(/\s+/g, '_').toLowerCase() 
                                  })}
                                  className="mt-1 block w-full rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                                  placeholder="contoh: sub_bab_1"
                                />
                                <p className="mt-1 text-xs text-gray-500">Nama sub bab harus unik dan menggunakan underscore untuk spasi</p>
                              </div>
                              <div>
                                <label className="block text-sm font-medium text-gray-700">Label Sub Bab</label>
                                <input
                                  type="text"
                                  value={newField.label}
                                  onChange={(e) => setNewField({ ...newField, label: e.target.value })}
                                  className="mt-1 block w-full rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                                  placeholder="Contoh: Informasi Proyek"
                                />
                              </div>
                            </div>

                            <div>
                              <label className="block text-sm font-medium text-gray-700">Deskripsi Sub Bab</label>
                              <textarea
                                value={newField.description}
                                onChange={(e) => setNewField({ ...newField, description: e.target.value })}
                                rows={2}
                                className="mt-1 block w-full rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                                placeholder="Masukkan deskripsi atau petunjuk pengisian sub bab ini"
                              />
                              <p className="mt-1 text-xs text-gray-500">Deskripsi akan ditampilkan sebagai petunjuk saat mengisi sub bab</p>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <div>
                                <label className="block text-sm font-medium text-gray-700">Tipe Sub Bab</label>
                                <select
                                  value={newField.type}
                                  onChange={(e) => handleFieldTypeChange(e.target.value)}
                                  className="mt-1 block w-full rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                                >
                                  {fieldTypes.map((type) => (
                                    <option key={type.value} value={type.value}>
                                      {type.label}
                                    </option>
                                  ))}
                                </select>
                              </div>
                              <div className="flex items-center space-x-4">
                                <label className="flex items-center">
                                  <input
                                    type="checkbox"
                                    checked={newField.required}
                                    onChange={(e) => setNewField({ ...newField, required: e.target.checked })}
                                    className="rounded border-gray-300 text-blue-600 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                                  />
                                  <span className="ml-2 text-sm text-gray-700">Wajib diisi</span>
                                </label>
                              </div>
                            </div>

                            {newField.type === 'select' && (
                              <div>
                                <label className="block text-sm font-medium text-gray-700">Opsi Sub Bab</label>
                                <div className="mt-1 flex space-x-2">
                                  <input
                                    type="text"
                                    value={newOption}
                                    onChange={(e) => setNewOption(e.target.value)}
                                    className="flex-1 rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                                    placeholder="Tambah opsi baru"
                                    onKeyPress={(e) => {
                                      if (e.key === 'Enter') {
                                        e.preventDefault();
                                        handleAddOption();
                                      }
                                    }}
                                  />
                                  <button
                                    onClick={handleAddOption}
                                    type="button"
                                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors duration-200"
                                  >
                                    Tambah Opsi
                                  </button>
                                </div>
                                {newField.options && newField.options.length > 0 && (
                                  <div className="mt-2 flex flex-wrap gap-2">
                                    {newField.options.map((option, index) => (
                                      <span
                                        key={index}
                                        className="inline-flex items-center px-2 py-1 rounded-md bg-blue-100 text-blue-700 text-sm"
                                      >
                                        {option}
                                        <button
                                          onClick={() => handleRemoveOption(index)}
                                          className="ml-1 text-blue-600 hover:text-blue-800"
                                        >
                                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                          </svg>
                                        </button>
                                      </span>
                                    ))}
                                  </div>
                                )}
                              </div>
                            )}

                            <div className="flex justify-end space-x-3">
                              <button
                                onClick={() => {
                                  setNewField({
                                    name: '',
                                    label: '',
                                    required: true,
                                    type: 'text',
                                    options: [],
                                    description: '' // Reset description field
                                  });
                                  setNewOption('');
                                  setIsAddingField(false);
                                }}
                                type="button"
                                className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors duration-200"
                              >
                                Batal
                              </button>
                              <button
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  handleAddField(true);
                                }}
                                type="button"
                                disabled={!newField.name || !newField.label || (newField.type === 'select' && (!newField.options || newField.options.length === 0))}
                                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200 relative"
                              >
                                <span className="relative z-10">Tambah Field</span>
                              </button>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Field Cards */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[calc(100vh-400px)] overflow-y-auto pr-2">
                        {allFields
                          .filter(field => {
                            const matchesSearch = 
                              field.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
                              field.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                              field.description?.toLowerCase().includes(searchQuery.toLowerCase());
                              
                            if (fieldCategory === 'all') return matchesSearch;
                            if (fieldCategory === 'custom') return field.isCustom && matchesSearch;
                            
                            const selectedCategory = fieldCategories.find(cat => cat.id === fieldCategory);
                            return matchesSearch && fieldBelongsToCategory(field, selectedCategory);
                          })
                          .map((field, index) => (
                            <div
                              key={index}
                              className={`bg-white p-4 rounded-lg border ${
                                selectedFields.some(f => f.name === field.name)
                                  ? 'border-blue-500 ring-2 ring-blue-200'
                                  : field.isCustom 
                                    ? 'border-purple-200 hover:border-purple-300'
                                    : 'border-gray-200 hover:border-blue-300'
                              } transition-all duration-200 flex flex-col h-full group relative`}
                            >
                              {field.description && (
                                <div className="absolute z-50 invisible group-hover:visible bg-gray-900 text-white text-sm rounded-lg py-2 px-3 w-64 bottom-full left-1/2 transform -translate-x-1/2 mb-2 shadow-lg">
                                  <div className="relative">
                                    {field.description}
                                    <div className="absolute w-2 h-2 bg-gray-900 transform rotate-45 left-1/2 -translate-x-1/2 bottom-[-0.25rem]"></div>
                                  </div>
                                </div>
                              )}
                              <div className="flex justify-between items-start h-full">
                                <div className="flex-1 min-w-0">
                                  <h6 className="font-medium text-gray-900 flex items-center truncate">
                                    <span className="truncate">{field.label}</span>
                                    {field.required && <span className="text-red-500 ml-1 flex-shrink-0">*</span>}
                                    {field.isCustom && (
                                      <span className="ml-2 px-1.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                                        Custom
                                      </span>
                                    )}
                                  </h6>
                                  {field.description && (
                                    <p className="mt-1 text-sm text-gray-500 line-clamp-2">{field.description}</p>
                                  )}
                                  <div className="mt-1 space-y-1">
                                    <div className="flex items-center text-sm text-gray-500 overflow-hidden">
                                      <code className="bg-gray-100 px-1 py-0.5 rounded text-xs truncate max-w-[200px]">Sub Bab: {field.name}</code>
                                    </div>
                                    <div className="flex flex-wrap gap-1">
                                      <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium ${
                                        field.required ? 'bg-red-100 text-red-800' : 'bg-gray-100 text-gray-800'
                                      }`}>
                                        {field.required ? 'Required' : 'Optional'}
                                      </span>
                                      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                                        {field.type}
                                      </span>
                                      {field.options && (
                                        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-800">
                                          {field.options.length} options
                                        </span>
                          )}
                        </div>
                                  </div>
                                </div>
                                <div className="flex flex-col space-y-2 ml-2 flex-shrink-0">
                        <button
                                    onClick={() => handleFieldPreview(field)}
                                    className="text-gray-400 hover:text-gray-600 p-1"
                                    title="Preview field"
                        >
                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                          </svg>
                        </button>
                            <button
                                    onClick={() => handleFieldSelect(field)}
                                    className={`text-gray-400 hover:text-gray-600 p-1 ${
                                      selectedFields.some(f => f.name === field.name) ? 'text-blue-600' : ''
                                    }`}
                                    title={selectedFields.some(f => f.name === field.name) ? 'Deselect field' : 'Select field'}
                            >
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                              </svg>
                            </button>
                          {field.isCustom && (
                            <button
                              onClick={() => {
                                if (window.confirm('Apakah Anda yakin ingin menghapus field ini?')) {
                                  handleDeleteCustomField(field.id);
                                }
                              }}
                              className="text-red-400 hover:text-red-600 p-1"
                              title="Delete custom field"
                            >
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                      {/* Field Preview Modal */}
                      {showFieldPreview && previewField && (
                        <FieldPreview
                          field={previewField}
                          onClose={() => {
                            setShowFieldPreview(false);
                            setPreviewField(null);
                          }}
                        />
                      )}
                    </div>
                  )}
              </div>

              {/* Form Actions */}
              {activeTab === 'structure' && (
                <div className="flex justify-end space-x-3 border-t border-gray-200 pt-6">
                  {isEditing && (
                    <>
                      <button
                        onClick={() => {
                          setIsEditing(false);
                          setSelectedTemplate(null);
                          setError(null);
                        }}
                        className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50"
                      >
                        Batal
                      </button>
                      <button
                        onClick={handleUpdateTemplate}
                        className="px-6 py-2 border border-transparent text-sm font-medium rounded-lg text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Perbarui Template
                      </button>
                    </>
                  )}
                  {!isEditing && (
                    <button
                      onClick={handleAddTemplate}
                      disabled={!newTemplate.name.trim() || !newTemplate.description.trim() || !newTemplate.structure?.sections?.length}
                      className="px-6 py-2 border border-transparent text-sm font-medium rounded-lg text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Buat Template
                    </button>
                  )}
                </div>
              )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add Section Modal */}
      <AddSectionModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setSectionData({
            title: '',
            description: '',
            points: [],
            fields: [],
            fieldConfigs: []
          });
          setEditingSectionIndex(-1);
        }}
        onAdd={handleAddSection}
        predefinedFields={predefinedFields}
        customFields={customFields}
        selectedFields={selectedFields}
        sectionData={sectionData}
        setSectionData={setSectionData}
        dataModalContainer
        editingSectionIndex={editingSectionIndex}
        handleUpdateSection={handleUpdateSection}
      />

      {/* Field Preview Modal */}
      {showFieldPreview && previewField && (
        <FieldPreview
          field={previewField}
          onClose={() => {
            setShowFieldPreview(false);
            setPreviewField(null);
          }}
        />
      )}

      {isEditing && (
        <div className="flex items-center space-x-4 mb-4">
          <div className="flex items-center space-x-2">
            <button
              onClick={handleUndo}
              disabled={currentVersionIndex <= 0}
              className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
              title="Undo"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
              </svg>
            </button>
            <button
              onClick={handleRedo}
              disabled={currentVersionIndex >= versionHistory.length - 1}
              className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
              title="Redo"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 10h7m0 0l-6-6m6 6l-6 6" />
              </svg>
            </button>
          </div>
          {isDirty && (
            <span className="text-sm text-yellow-600 bg-yellow-50 px-2 py-1 rounded-full">
              Unsaved changes
            </span>
          )}
          <span className="text-sm text-gray-500">
            Version {selectedTemplate?.version || 1}
          </span>
        </div>
      )}
    </div>
  );
};

export default TemplateManagement; 