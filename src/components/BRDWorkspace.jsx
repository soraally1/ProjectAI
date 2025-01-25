import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { collection, doc, getDoc, getDocs, updateDoc, addDoc, onSnapshot, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { useUser } from '../context/UserContext';
import bankLogo from '../assets/i-BRDSystem.svg';

export const BRDWorkspace = () => {
  const { requestId } = useParams();
  const navigate = useNavigate();
  const { user, profile } = useUser();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [request, setRequest] = useState(null);
  const [templates, setTemplates] = useState([]);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [formData, setFormData] = useState({});
  const [generating, setGenerating] = useState(false);
  const [generatedContent, setGeneratedContent] = useState(null);
  const [activeTab, setActiveTab] = useState('details');
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState('');

  useEffect(() => {
    fetchRequestAndTemplates();
    const unsubscribe = subscribeToComments();
    return () => unsubscribe();
  }, [requestId]);

  const subscribeToComments = () => {
    try {
      const commentsRef = collection(db, 'brd_requests', requestId, 'comments');
      const unsubscribe = onSnapshot(commentsRef, (snapshot) => {
        const commentsData = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          timestamp: doc.data().timestamp?.toDate() || new Date()
        }));
        setComments(commentsData.sort((a, b) => b.timestamp - a.timestamp));
      }, (error) => {
        console.error('Error fetching comments:', error);
        setError('Unable to load comments. Please check your permissions.');
      });

      return unsubscribe;
    } catch (error) {
      console.error('Error setting up comments subscription:', error);
      return () => {};
    }
  };

  const handleCommentSubmit = async (e) => {
    e.preventDefault();
    if (!newComment.trim()) return;

    try {
      const commentsRef = collection(db, 'brd_requests', requestId, 'comments');
      await addDoc(commentsRef, {
        text: newComment,
        userId: user.uid,
        userName: profile.namaLengkap,
        timestamp: serverTimestamp()
      });

      setNewComment('');
    } catch (error) {
      console.error('Error adding comment:', error);
      setError('Failed to add comment. Please try again.');
    }
  };

  const fetchRequestAndTemplates = async () => {
    try {
      setLoading(true);
      // Fetch request details
      const requestDoc = await getDoc(doc(db, 'brd_requests', requestId));
      if (!requestDoc.exists()) {
        throw new Error('Request not found');
      }
      const requestData = { id: requestDoc.id, ...requestDoc.data() };
      setRequest(requestData);
      setFormData(requestData.formData || {});

      // Fetch templates
      const templatesSnapshot = await getDocs(collection(db, 'brd_templates'));
      const templatesData = templatesSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setTemplates(templatesData);
    } catch (error) {
      console.error('Error fetching data:', error);
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (fieldName, value) => {
    setFormData(prev => ({
      ...prev,
      [fieldName]: value
    }));
  };

  const handleGenerateBRD = async () => {
    try {
      setGenerating(true);
      setError(null);

      // Validate required fields
      if (!selectedTemplate) {
        throw new Error('Please select a template');
      }

      const requiredFields = selectedTemplate.fields.filter(field => field.required);
      const missingFields = requiredFields.filter(field => !formData[field.name]);
      if (missingFields.length > 0) {
        throw new Error(`Please fill in the following required fields: ${missingFields.map(f => f.label).join(', ')}`);
      }

      const apiKey = import.meta.env.VITE_GROQ_API_KEY;
      if (!apiKey) {
        throw new Error('GROQ API key not found');
      }

      console.log('Sending request to GROQ...'); // Debug log

      // Create a structured prompt based on template fields
      const templateFields = selectedTemplate.fields.map(field => ({
        label: field.label,
        value: formData[field.name] || ''
      }));

      // Group fields by their categories (based on field names or patterns)
      const groupedFields = {
        projectInfo: templateFields.filter(f => 
          f.label.toLowerCase().includes('project') || 
          f.label.toLowerCase().includes('dokumen')
        ),
        background: templateFields.filter(f => 
          f.label.toLowerCase().includes('kondisi') || 
          f.label.toLowerCase().includes('latar') ||
          f.label.toLowerCase().includes('permasalahan')
        ),
        businessNeeds: templateFields.filter(f => 
          f.label.toLowerCase().includes('kebutuhan') || 
          f.label.toLowerCase().includes('dampak') ||
          f.label.toLowerCase().includes('manfaat')
        ),
        scope: templateFields.filter(f => 
          f.label.toLowerCase().includes('lingkup') || 
          f.label.toLowerCase().includes('scope')
        ),
        requirements: templateFields.filter(f => 
          f.label.toLowerCase().includes('requirement') || 
          f.label.toLowerCase().includes('fungsional')
        ),
        planning: templateFields.filter(f => 
          f.label.toLowerCase().includes('jadwal') || 
          f.label.toLowerCase().includes('anggaran') ||
          f.label.toLowerCase().includes('risiko')
        )
      };

      // Create the prompt content
      const promptContent = `Hasilkan BRD lengkap berdasarkan informasi berikut:

${Object.entries(groupedFields).map(([category, fields]) => `
${category.toUpperCase()}:
${fields.map(f => `${f.label}: ${f.value}`).join('\n')}
`).join('\n')}

Generate content following this structure based on the template fields above:

${selectedTemplate.fields.map((field, index) => {
  // Create section headers based on field categories
  if (field.name.includes('project') || field.name.includes('document')) {
    return `I. INFORMASI PROYEK\n${index + 1}.1. ${field.label}`;
  } else if (field.name.includes('condition') || field.name.includes('problem')) {
    return `II. LATAR BELAKANG\n${index + 1}.1. ${field.label}`;
  } else if (field.name.includes('need') || field.name.includes('impact')) {
    return `III. KEBUTUHAN BISNIS\n${index + 1}.1. ${field.label}`;
  } else if (field.name.includes('scope')) {
    return `IV. RUANG LINGKUP\n${index + 1}.1. ${field.label}`;
  } else if (field.name.includes('requirement')) {
    return `V. KEBUTUHAN SISTEM\n${index + 1}.1. ${field.label}`;
  } else if (field.name.includes('risk') || field.name.includes('timeline') || field.name.includes('budget')) {
    return `VI. PERENCANAAN\n${index + 1}.1. ${field.label}`;
  }
  return '';
}).filter(Boolean).join('\n')}

Important: Keep the exact section numbering format as shown above.`;

      // Call GROQ API
      const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: "mixtral-8x7b-32768",
          messages: [
            {
              role: "system",
              content: `Anda adalah seorang Business Analyst profesional di Bank Jateng dengan pengalaman lebih dari 10 tahun dalam menyusun Business Requirements Document (BRD).
Tugas Anda adalah menghasilkan konten BRD yang sangat detail, terstruktur, dan profesional sesuai standar perbankan.
Gunakan bahasa Indonesia yang formal, teknis, dan mudah dipahami.
Setiap bagian harus mencakup:
- Penjelasan detail dan komprehensif
- Contoh spesifik yang relevan dengan perbankan
- Referensi ke best practices industri perbankan
- Pertimbangan regulasi perbankan yang berlaku
- Aspek keamanan dan kepatuhan yang relevan

Important: Generate content based on the provided template structure and maintain the exact section numbering format.`
            },
            {
              role: "user",
              content: promptContent
            }
          ],
          temperature: 0.7,
          max_tokens: 4000,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`GROQ API error: ${errorData.error?.message || response.statusText}`);
      }

      const data = await response.json();
      console.log('GROQ Response:', data); // Debug log

      const generatedText = data.choices[0].message.content;
      console.log('Generated Text:', generatedText); // Debug log

      // Update request with generated content
      const requestRef = doc(db, 'brd_requests', requestId);
      await updateDoc(requestRef, {
        generatedContent: generatedText,
        templateId: selectedTemplate.id,
        templateName: selectedTemplate.name,
        formData,
        status: 'Generated',
        updatedAt: new Date().toISOString(),
        updatedBy: user.uid,
        updatedByName: profile.namaLengkap
      });

      // Parse the content into sections based on template structure
      const sections = {};
      let currentSection = '';
      const lines = generatedText.split('\n');
      
      for (const line of lines) {
        if (line.match(/^[IVX]+\./)) {
          // Main section (e.g., "I.", "II.", etc.)
          currentSection = line.trim();
          sections[currentSection] = [];
        } else if (currentSection) {
          // Add content to current section
          sections[currentSection].push(line);
        }
      }

      // Convert sections to the format expected by the viewer
      const brdContent = {
        informasiProyek: sections['I.']?.join('\n') || '',
        latarBelakang: sections['II.']?.join('\n') || '',
        kebutuhanBisnis: sections['III.']?.join('\n') || '',
        ruangLingkup: sections['IV.']?.join('\n') || '',
        kebutuhanSistem: sections['V.']?.join('\n') || '',
        perencanaan: sections['VI.']?.join('\n') || ''
      };

      console.log('Parsed Content:', brdContent); // Debug log

      // Set the generated content and switch to view tab
      setGeneratedContent(brdContent);
      setActiveTab('view');
    } catch (error) {
      console.error('Error generating BRD:', error);
      setError('Error generating BRD: ' + error.message);
    } finally {
      setGenerating(false);
    }
  };

  const exportToWord = () => {
    const template = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: 'Times New Roman', Times, serif; }
          .header { text-align: center; margin-bottom: 20px; }
          .logo { width: 150px; }
          .title { font-size: 18px; font-weight: bold; margin: 10px 0; }
          .section { margin: 20px 0; }
          .section-title { font-weight: bold; }
          .content { margin-left: 20px; }
          table { width: 100%; border-collapse: collapse; }
          th, td { border: 1px solid black; padding: 8px; }
          .signature-section { margin-top: 50px; }
          .signature-box { margin: 20px 0; }
        </style>
      </head>
      <body>
        <div class="header">
          <img src="${bankLogo}" class="logo" />
          <div class="title">BUSINESS REQUIREMENT DOCUMENT</div>
        </div>
        
        ${Object.values(generatedContent).join('\n')}

        <div class="signature-section">
          <table>
            <tr>
              <th>Dibuat Oleh</th>
              <th>Diperiksa Oleh</th>
              <th>Disetujui Oleh</th>
            </tr>
            <tr>
              <td height="80px"></td>
              <td></td>
              <td></td>
            </tr>
            <tr>
              <td>${formData.dibuatOleh || ''}</td>
              <td>${formData.diperiksaOleh || ''}</td>
              <td>${formData.disetujuiOleh || ''}</td>
            </tr>
            <tr>
              <td>${formData.dibuatTanggal ? new Date(formData.dibuatTanggal).toLocaleDateString('id-ID') : ''}</td>
              <td>${formData.diperiksaTanggal ? new Date(formData.diperiksaTanggal).toLocaleDateString('id-ID') : ''}</td>
              <td>${formData.disetujuiTanggal ? new Date(formData.disetujuiTanggal).toLocaleDateString('id-ID') : ''}</td>
            </tr>
          </table>
        </div>
      </body>
      </html>
    `;

    const blob = new Blob([template], { type: 'application/msword' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `BRD_${request.noBRD || 'Document'}.doc`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-900"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white shadow rounded-lg p-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              {request?.namaProject || 'BRD Workspace'}
            </h1>
            <p className="mt-1 text-sm text-gray-500">
              BRD Number: {request?.noBRD}
            </p>
          </div>
          <div className="flex space-x-4">
            {generatedContent && (
              <button
                onClick={exportToWord}
                className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700"
              >
                <svg className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                Export to Word
              </button>
            )}
            <button
              onClick={() => navigate(-1)}
              className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Back
            </button>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white shadow rounded-lg">
        <div className="border-b border-gray-200">
          <nav className="-mb-px flex space-x-8 px-6" aria-label="Tabs">
            <button
              onClick={() => setActiveTab('details')}
              className={`${
                activeTab === 'details'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
            >
              Request Details
            </button>
            <button
              onClick={() => setActiveTab('generate')}
              className={`${
                activeTab === 'generate'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
            >
              Generate BRD
            </button>
            {generatedContent && (
              <button
                onClick={() => setActiveTab('view')}
                className={`${
                  activeTab === 'view'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
              >
                View BRD
              </button>
            )}
            <button
              onClick={() => setActiveTab('discussion')}
              className={`${
                activeTab === 'discussion'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
            >
              Discussion
            </button>
          </nav>
        </div>

        <div className="p-6">
          {/* Content */}
          <div className="space-y-6">
            {error && (
              <div className="mb-4 bg-red-50 border-l-4 border-red-400 p-4">
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

            {activeTab === 'details' && (
              <div className="space-y-6">
                <h2 className="text-lg font-medium text-gray-900">Request Details</h2>
                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Project Name</label>
                    <p className="mt-1 text-sm text-gray-900">{request?.namaProject}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Request Type</label>
                    <p className="mt-1 text-sm text-gray-900">{request?.jenisPermintaan}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Priority</label>
                    <p className="mt-1 text-sm text-gray-900">{request?.prioritas}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Target Implementation</label>
                    <p className="mt-1 text-sm text-gray-900">{request?.targetImplementasi}</p>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'generate' && (
              <div className="space-y-6">
                <div className="border-b border-gray-200 pb-6">
                  <h2 className="text-lg font-medium text-gray-900">Select Template</h2>
                  <div className="mt-4 grid grid-cols-1 gap-4">
                    {templates.map((template) => (
                      <div
                        key={template.id}
                        className={`relative rounded-lg border p-4 cursor-pointer ${
                          selectedTemplate?.id === template.id
                            ? 'border-blue-500 bg-blue-50'
                            : 'border-gray-300 hover:border-blue-500'
                        }`}
                        onClick={() => setSelectedTemplate(template)}
                      >
                        <div className="flex justify-between">
                          <div>
                            <h3 className="text-sm font-medium text-gray-900">{template.name}</h3>
                            <p className="mt-1 text-sm text-gray-500">{template.description}</p>
                          </div>
                          <div className="flex items-center">
                            <input
                              type="radio"
                              checked={selectedTemplate?.id === template.id}
                              onChange={() => setSelectedTemplate(template)}
                              className="h-4 w-4 text-blue-600 border-gray-300 focus:ring-blue-500"
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {selectedTemplate && (
                  <div className="space-y-6">
                    <h2 className="text-lg font-medium text-gray-900">Fill in BRD Details</h2>
                    <div className="grid grid-cols-1 gap-6">
                      {selectedTemplate.fields.map((field) => (
                        <div key={field.name}>
                          <label className="block text-sm font-medium text-gray-700">
                            {field.label}
                            {field.required && <span className="text-red-500">*</span>}
                          </label>
                          {field.type === 'textarea' ? (
                            <textarea
                              value={formData[field.name] || ''}
                              onChange={(e) => handleInputChange(field.name, e.target.value)}
                              rows={4}
                              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                            />
                          ) : field.type === 'select' || field.options ? (
                            <select
                              value={formData[field.name] || ''}
                              onChange={(e) => handleInputChange(field.name, e.target.value)}
                              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                            >
                              <option value="">Select {field.label}</option>
                              {field.options.map((option) => (
                                <option key={option} value={option}>
                                  {option}
                                </option>
                              ))}
                            </select>
                          ) : field.type === 'date' ? (
                            <input
                              type="date"
                              value={formData[field.name] || ''}
                              onChange={(e) => handleInputChange(field.name, e.target.value)}
                              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                            />
                          ) : field.type === 'currency' ? (
                            <div className="mt-1 relative rounded-md shadow-sm">
                              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                <span className="text-gray-500 sm:text-sm">Rp</span>
                              </div>
                              <input
                                type="number"
                                value={formData[field.name] || ''}
                                onChange={(e) => handleInputChange(field.name, e.target.value)}
                                className="block w-full pl-12 pr-12 sm:text-sm border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                                placeholder="0"
                              />
                            </div>
                          ) : (
                            <input
                              type="text"
                              value={formData[field.name] || ''}
                              onChange={(e) => handleInputChange(field.name, e.target.value)}
                              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                            />
                          )}
                        </div>
                      ))}
                    </div>

                    <div className="flex justify-end">
                      <button
                        onClick={handleGenerateBRD}
                        disabled={generating}
                        className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
                      >
                        {generating ? (
                          <>
                            <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            Generating...
                          </>
                        ) : (
                          'Generate BRD'
                        )}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'view' && generatedContent && (
              <div className="prose max-w-none">
                <div className="text-center mb-8">
                  <img src={bankLogo} alt="Bank Logo" className="mx-auto h-16" />
                  <h1 className="text-2xl font-bold mt-4">BUSINESS REQUIREMENT DOCUMENT</h1>
                  <p className="text-gray-600">No. BRD: {request?.noBRD}</p>
                </div>

                {Object.entries(generatedContent).map(([section, content]) => (
                  <div key={section} className="mb-8 whitespace-pre-wrap">
                    {content}
                  </div>
                ))}

                <div className="mt-12">
                  <table className="w-full border-collapse border border-gray-300">
                    <thead>
                      <tr>
                        <th className="border border-gray-300 p-2">Dibuat Oleh</th>
                        <th className="border border-gray-300 p-2">Diperiksa Oleh</th>
                        <th className="border border-gray-300 p-2">Disetujui Oleh</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td className="border border-gray-300 p-2 h-20"></td>
                        <td className="border border-gray-300 p-2 h-20"></td>
                        <td className="border border-gray-300 p-2 h-20"></td>
                      </tr>
                      <tr>
                        <td className="border border-gray-300 p-2">{formData.dibuatOleh}</td>
                        <td className="border border-gray-300 p-2">{formData.diperiksaOleh}</td>
                        <td className="border border-gray-300 p-2">{formData.disetujuiOleh}</td>
                      </tr>
                      <tr>
                        <td className="border border-gray-300 p-2">
                          {formData.dibuatTanggal && new Date(formData.dibuatTanggal).toLocaleDateString('id-ID')}
                        </td>
                        <td className="border border-gray-300 p-2">
                          {formData.diperiksaTanggal && new Date(formData.diperiksaTanggal).toLocaleDateString('id-ID')}
                        </td>
                        <td className="border border-gray-300 p-2">
                          {formData.disetujuiTanggal && new Date(formData.disetujuiTanggal).toLocaleDateString('id-ID')}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {activeTab === 'discussion' && (
              <div className="space-y-6">
                {/* Comments List */}
                <div className="space-y-4">
                  {comments.map(comment => (
                    <div key={comment.id} className="bg-gray-50 rounded-lg p-4">
                      <div className="flex justify-between items-start">
                        <div className="font-medium text-gray-900">{comment.userName}</div>
                        <div className="text-sm text-gray-500">
                          {comment.timestamp.toLocaleString('id-ID')}
                        </div>
                      </div>
                      <p className="mt-2 text-gray-700">{comment.text}</p>
                    </div>
                  ))}
                </div>

                {/* Comment Form */}
                <form onSubmit={handleCommentSubmit} className="mt-6">
                  <div>
                    <label htmlFor="comment" className="sr-only">
                      Add your comment
                    </label>
                    <textarea
                      id="comment"
                      name="comment"
                      rows={3}
                      value={newComment}
                      onChange={(e) => setNewComment(e.target.value)}
                      className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                      placeholder="Add your comment..."
                    />
                  </div>
                  <div className="mt-2 flex justify-end">
                    <button
                      type="submit"
                      className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                    >
                      Comment
                    </button>
                  </div>
                </form>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}; 