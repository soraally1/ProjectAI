import { useState, useEffect } from 'react';
import { collection, addDoc, getDocs, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useUser } from '../context/UserContext';

const TemplateManagement = () => {
  const { user, profile } = useUser();
  const [templates, setTemplates] = useState([]);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [newTemplate, setNewTemplate] = useState({
    name: '',
    description: '',
    fields: []
  });
  const [newField, setNewField] = useState({
    name: '',
    label: '',
    required: true
  });

  // Predefined fields from Bank Jateng BRD template
  const predefinedFields = [
    { name: 'noBRD', label: 'No. BRD', required: true },
    { name: 'tanggalPermintaan', label: 'Tanggal Permintaan', required: true },
    { name: 'unitBisnis', label: 'Unit Bisnis', required: true },
    { name: 'namaPemohon', label: 'Nama Pemohon', required: true },
    { name: 'jabatanPemohon', label: 'Jabatan Pemohon', required: true },
    { name: 'namaProject', label: 'Nama Project', required: true },
    { name: 'jenisPermintaan', label: 'Jenis Permintaan', required: true, options: ['New Development', 'Enhancement', 'Bug Fix'] },
    { name: 'prioritas', label: 'Prioritas', required: true, options: ['High', 'Medium', 'Low'] },
    { name: 'targetImplementasi', label: 'Target Implementasi', required: true },
    { name: 'latarBelakang', label: 'Latar Belakang', required: true, type: 'textarea' },
    { name: 'kondisiSaatIni', label: 'Kondisi Saat Ini', required: true, type: 'textarea' },
    { name: 'kondisiYangDiharapkan', label: 'Kondisi Yang Diharapkan', required: true, type: 'textarea' },
    { name: 'potentialRisk', label: 'Potential Risk', required: false, type: 'textarea' },
    { name: 'estimasiBiaya', label: 'Estimasi Biaya', required: false, type: 'currency' },
    { name: 'estimasiWaktu', label: 'Estimasi Waktu', required: false },
    { name: 'manfaat', label: 'Manfaat', required: true, type: 'textarea' },
    { name: 'dokumenTambahan', label: 'Dokumen Tambahan', required: false, type: 'file' },
    { name: 'disetujuiOleh', label: 'Disetujui Oleh', required: true },
    { name: 'disetujuiTanggal', label: 'Disetujui Tanggal', required: true, type: 'date' },
    { name: 'dibuatOleh', label: 'Dibuat Oleh', required: true },
    { name: 'dibuatTanggal', label: 'Dibuat Tanggal', required: true, type: 'date' },
    { name: 'diperiksaOleh', label: 'Diperiksa Oleh', required: true },
    { name: 'diperiksaTanggal', label: 'Diperiksa Tanggal', required: true, type: 'date' },
    { name: 'projectName', label: 'Nama Proyek', required: true },
    { name: 'documentNumber', label: 'Nomor Dokumen', required: true },
    { name: 'currentCondition', label: 'Kondisi Saat Ini', required: true, type: 'textarea' },
    { name: 'problems', label: 'Permasalahan', required: true, type: 'textarea' },
    { name: 'problemImpact', label: 'Dampak Permasalahan', required: true, type: 'textarea' },
    { name: 'mainNeeds', label: 'Kebutuhan Utama', required: true, type: 'textarea' },
    { name: 'businessImpact', label: 'Dampak terhadap Proses Bisnis', required: true, type: 'textarea' },
    { name: 'businessValue', label: 'Nilai Bisnis', required: true, type: 'textarea' },
    { name: 'mainObjective', label: 'Tujuan Utama', required: true, type: 'textarea' },
    { name: 'specificObjectives', label: 'Tujuan Spesifik', required: true, type: 'textarea' },
    { name: 'measurableTargets', label: 'Target yang Terukur', required: true, type: 'textarea' },
    { name: 'scope', label: 'Ruang Lingkup', required: true, type: 'textarea' },
    { name: 'inScope', label: 'Yang Termasuk', required: true, type: 'textarea' },
    { name: 'outScope', label: 'Yang Tidak Termasuk', required: true, type: 'textarea' },
    { name: 'stakeholders', label: 'Pemangku Kepentingan', required: true, type: 'textarea' },
    { name: 'functionalRequirements', label: 'Kebutuhan Fungsional', required: true, type: 'textarea' },
    { name: 'nonFunctionalRequirements', label: 'Kebutuhan Non-Fungsional', required: true, type: 'textarea' }
  ];

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
        ...doc.data()
      }));
      setTemplates(templatesData);
    } catch (error) {
      console.error('Error fetching templates:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddTemplate = async () => {
    try {
      if (!profile?.isAdmin) {
        throw new Error('You do not have permission to create templates');
      }
      setError(null);
      const templatesRef = collection(db, 'brd_templates');
      await addDoc(templatesRef, {
        name: newTemplate.name,
        description: newTemplate.description,
        fields: newTemplate.fields,
        createdAt: new Date(),
        createdBy: user.uid,
        createdByName: profile.namaLengkap
      });
      
      await fetchTemplates();
      setNewTemplate({
        name: '',
        description: '',
        fields: []
      });
    } catch (error) {
      console.error('Error adding template:', error);
      setError(error.message);
    }
  };

  const handleUpdateTemplate = async () => {
    try {
      if (!profile?.isAdmin) {
        throw new Error('You do not have permission to update templates');
      }
      setError(null);
      const templateRef = doc(db, 'brd_templates', selectedTemplate.id);
      await updateDoc(templateRef, {
        name: selectedTemplate.name,
        description: selectedTemplate.description,
        fields: selectedTemplate.fields,
        updatedAt: new Date(),
        updatedBy: user.uid,
        updatedByName: profile.namaLengkap
      });
      
      await fetchTemplates();
      setIsEditing(false);
      setSelectedTemplate(null);
    } catch (error) {
      console.error('Error updating template:', error);
      setError(error.message);
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

  const handleAddField = () => {
    if (newField.name && newField.label) {
      if (isEditing) {
        setSelectedTemplate({
          ...selectedTemplate,
          fields: [...selectedTemplate.fields, { ...newField }]
        });
      } else {
        setNewTemplate({
          ...newTemplate,
          fields: [...newTemplate.fields, { ...newField }]
        });
      }
      setNewField({ name: '', label: '', required: true });
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
    }
  };

  const handleRemoveField = (index) => {
    if (isEditing) {
      const updatedFields = [...selectedTemplate.fields];
      updatedFields.splice(index, 1);
      setSelectedTemplate({
        ...selectedTemplate,
        fields: updatedFields
      });
    } else {
      const updatedFields = [...newTemplate.fields];
      updatedFields.splice(index, 1);
      setNewTemplate({
        ...newTemplate,
        fields: updatedFields
      });
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

  return (
    <div className="space-y-8">
      {/* Header Section */}
      <div className="bg-gradient-to-r from-blue-900 to-blue-700 rounded-2xl shadow-lg p-8">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-3xl font-bold text-white mb-2">Template Management</h2>
            <p className="text-blue-100">Create and manage BRD templates for your organization</p>
          </div>
          {!isEditing && (
            <button
              onClick={() => {
                setNewTemplate({
                  name: '',
                  description: '',
                  fields: []
                });
                setSelectedPredefinedFields(
                  predefinedFields.reduce((acc, field) => ({ ...acc, [field.name]: false }), {})
                );
              }}
              className="px-6 py-3 bg-white text-blue-900 rounded-lg font-medium hover:bg-blue-50 transition-colors duration-200"
            >
              Reset Form
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="animate-fade-in bg-red-50 border-l-4 border-red-500 p-4 rounded-lg">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          </div>
        </div>
      )}

      {!profile?.isAdmin ? (
        <div className="bg-yellow-50 border-l-4 border-yellow-500 p-4 rounded-lg">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <p className="text-sm text-yellow-700">
                You need administrator privileges to manage templates. Please contact an administrator.
              </p>
            </div>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Left Column - Template List */}
          <div className="bg-white rounded-2xl shadow-lg p-6">
            <h3 className="text-xl font-bold text-gray-900 mb-6 flex items-center">
              <svg className="w-5 h-5 mr-2 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
              Existing Templates
            </h3>
            
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-900"></div>
              </div>
            ) : templates.length === 0 ? (
              <div className="text-center py-12 px-4">
                <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <h3 className="mt-2 text-sm font-medium text-gray-900">No templates</h3>
                <p className="mt-1 text-sm text-gray-500">Get started by creating a new template.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {templates.map((template) => (
                  <div 
                    key={template.id} 
                    className="border border-gray-200 rounded-lg p-4 hover:border-blue-300 transition-colors duration-200"
                  >
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <h4 className="font-medium text-gray-900">{template.name}</h4>
                        <p className="text-sm text-gray-500 mt-1">{template.description}</p>
                      </div>
                      <div className="flex space-x-2">
                        <button
                          onClick={() => {
                            setSelectedTemplate(template);
                            setIsEditing(true);
                            // Set selected fields based on template
                            const selectedFields = template.fields.reduce((acc, field) => ({
                              ...acc,
                              [field.name]: true
                            }), {});
                            setSelectedPredefinedFields(selectedFields);
                          }}
                          className="text-blue-600 hover:text-blue-800 flex items-center"
                        >
                          <svg className="w-4 h-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                          Edit
                        </button>
                        <button
                          onClick={() => handleDeleteTemplate(template.id)}
                          className="text-red-600 hover:text-red-800 flex items-center"
                        >
                          <svg className="w-4 h-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                          Delete
                        </button>
                      </div>
                    </div>
                    <div className="flex items-center mt-3 text-sm text-gray-500">
                      <svg className="w-4 h-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                      </svg>
                      {template.fields.length} fields
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Right Column - Template Form */}
          <div className="bg-white rounded-2xl shadow-lg p-6">
            <h3 className="text-xl font-bold text-gray-900 mb-6 flex items-center">
              <svg className="w-5 h-5 mr-2 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v3m0 0v3m0-3h3m-3 0H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {isEditing ? 'Edit Template' : 'Create New Template'}
            </h3>
            
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700">Template Name</label>
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
                  className="mt-1 block w-full rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  placeholder="Enter template name"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700">Description</label>
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
                  className="mt-1 block w-full rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  placeholder="Enter template description"
                />
              </div>

              {/* Predefined Fields Section */}
              <div className="border-t border-gray-200 pt-6">
                <h4 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
                  <svg className="w-5 h-5 mr-2 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                  Bank Jateng BRD Template Fields
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {predefinedFields.map((field) => (
                    <div
                      key={field.name}
                      className={`flex items-start space-x-3 p-4 rounded-lg border transition-all duration-200 ${
                        selectedPredefinedFields[field.name]
                          ? 'border-blue-500 bg-blue-50 shadow-sm'
                          : 'border-gray-200 hover:border-blue-300'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={selectedPredefinedFields[field.name]}
                        onChange={() => handleTogglePredefinedField(field)}
                        className="h-4 w-4 mt-1 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                      />
                      <div>
                        <p className="text-sm font-medium text-gray-900">{field.label}</p>
                        <div className="mt-1 flex flex-wrap gap-2">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                            field.required ? 'bg-red-100 text-red-800' : 'bg-gray-100 text-gray-800'
                          }`}>
                            {field.required ? 'Required' : 'Optional'}
                          </span>
                          {field.type && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                              {field.type}
                            </span>
                          )}
                          {field.options && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-800">
                              {field.options.length} options
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Current Fields Section */}
              <div className="border-t border-gray-200 pt-6">
                <h4 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
                  <svg className="w-5 h-5 mr-2 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                  </svg>
                  Selected Fields
                </h4>
                {(isEditing ? selectedTemplate?.fields : newTemplate.fields).length === 0 ? (
                  <div className="text-center py-8 px-4 border-2 border-dashed border-gray-300 rounded-lg">
                    <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    <h3 className="mt-2 text-sm font-medium text-gray-900">No fields selected</h3>
                    <p className="mt-1 text-sm text-gray-500">Select fields from above or add custom fields below.</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {(isEditing ? selectedTemplate?.fields : newTemplate.fields).map((field, index) => (
                      <div 
                        key={index} 
                        className="flex items-center justify-between bg-white p-3 rounded-lg border border-gray-200 hover:border-blue-300 transition-colors duration-200"
                      >
                        <div className="flex items-center space-x-3">
                          <div>
                            <p className="text-sm font-medium text-gray-900">{field.label}</p>
                            <p className="text-xs text-gray-500">{field.name}</p>
                          </div>
                          <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                            field.required ? 'bg-red-100 text-red-800' : 'bg-gray-100 text-gray-800'
                          }`}>
                            {field.required ? 'Required' : 'Optional'}
                          </span>
                          {field.type && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                              {field.type}
                            </span>
                          )}
                        </div>
                        <button
                          onClick={() => handleRemoveField(index)}
                          className="text-red-600 hover:text-red-800 p-1 rounded-full hover:bg-red-50 transition-colors duration-200"
                        >
                          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Custom Field Form */}
              <div className="border-t border-gray-200 pt-6">
                <h4 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
                  <svg className="w-5 h-5 mr-2 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                  </svg>
                  Add Custom Field
                </h4>
                <div className="bg-gray-50 p-4 rounded-lg">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Field Name</label>
                      <input
                        type="text"
                        value={newField.name}
                        onChange={(e) => setNewField({
                          ...newField,
                          name: e.target.value
                        })}
                        className="mt-1 block w-full rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                        placeholder="e.g., customerName"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Label</label>
                      <input
                        type="text"
                        value={newField.label}
                        onChange={(e) => setNewField({
                          ...newField,
                          label: e.target.value
                        })}
                        className="mt-1 block w-full rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                        placeholder="e.g., Customer Name"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Required</label>
                      <select
                        value={newField.required.toString()}
                        onChange={(e) => setNewField({
                          ...newField,
                          required: e.target.value === 'true'
                        })}
                        className="mt-1 block w-full rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                      >
                        <option value="true">Required</option>
                        <option value="false">Optional</option>
                      </select>
                    </div>
                  </div>
                  <button
                    onClick={handleAddField}
                    disabled={!newField.name || !newField.label}
                    className="mt-4 w-full inline-flex justify-center items-center px-4 py-2 border border-transparent text-sm font-medium rounded-lg text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
                  >
                    <svg className="w-5 h-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                    </svg>
                    Add Custom Field
                  </button>
                </div>
              </div>

              {/* Form Actions */}
              <div className="flex justify-end space-x-3 border-t border-gray-200 pt-6">
                {isEditing && (
                  <button
                    onClick={() => {
                      setIsEditing(false);
                      setSelectedTemplate(null);
                      setSelectedPredefinedFields(
                        predefinedFields.reduce((acc, field) => ({ ...acc, [field.name]: false }), {})
                      );
                    }}
                    className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors duration-200"
                  >
                    Cancel
                  </button>
                )}
                <button
                  onClick={isEditing ? handleUpdateTemplate : handleAddTemplate}
                  className="px-6 py-2 border border-transparent text-sm font-medium rounded-lg text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors duration-200"
                >
                  {isEditing ? 'Update Template' : 'Create Template'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TemplateManagement; 