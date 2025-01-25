import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { collection, doc, getDoc, getDocs, updateDoc, addDoc, onSnapshot, serverTimestamp, deleteDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useUser } from '../context/UserContext';
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import bankLogo from '../assets/i-BRDSystem.svg';

export const RequestWorkspace = () => {
  const { requestId } = useParams();
  const navigate = useNavigate();
  const { user, profile } = useUser();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [request, setRequest] = useState(null);
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState('');
  const [activeTab, setActiveTab] = useState('details');
  const [generatedContent, setGeneratedContent] = useState('');
  const [approvalStatus, setApprovalStatus] = useState({});
  const [lastSeenComment, setLastSeenComment] = useState(null);

  // BRD Generation states
  const [templates, setTemplates] = useState([]);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [formData, setFormData] = useState({});
  const [generating, setGenerating] = useState(false);
  const [generatedBRD, setGeneratedBRD] = useState('');

  // Add this state for delete confirmation
  const [commentToDelete, setCommentToDelete] = useState(null);

  useEffect(() => {
    fetchRequest();
    fetchTemplates();
    const unsubscribe = subscribeToComments();
    return () => unsubscribe();
  }, [requestId]);

  // Handle notifications for new comments
  useEffect(() => {
    if (!comments.length) return;

    const handleNewComments = () => {
      // Get the latest comment
      const latestComment = comments[0];
      
      // Check if it's a new comment from another user
      const shouldNotify = 
        latestComment.userId !== user.uid && 
        (!lastSeenComment || latestComment.timestamp > lastSeenComment) &&
        activeTab !== 'discussion';

      if (shouldNotify) {
        toast.info(
          <div className="flex flex-col">
            <strong>New Comment from {latestComment.userName}</strong>
            <span className="text-sm">{latestComment.text.substring(0, 100)}{latestComment.text.length > 100 ? '...' : ''}</span>
          </div>,
          {
            position: "top-right",
            autoClose: 5000,
            hideProgressBar: false,
            closeOnClick: true,
            pauseOnHover: true,
            draggable: true,
            progress: undefined,
            onClick: () => {
              setActiveTab('discussion');
            },
          }
        );
      }
    };

    handleNewComments();
  }, [comments, user.uid, lastSeenComment, activeTab]);

  const fetchRequest = async () => {
    try {
      const requestDoc = await getDoc(doc(db, 'brd_requests', requestId));
      if (!requestDoc.exists()) {
        setError('Request not found');
        return;
      }
      const requestData = requestDoc.data();
      setRequest(requestData);
      setGeneratedContent(requestData.generatedContent || '');
      setApprovalStatus(requestData.approvalStatus || {});
      
      // If request already has template data, load it
      if (requestData.templateId) {
        const templateDoc = await getDoc(doc(db, 'brd_templates', requestData.templateId));
        if (templateDoc.exists()) {
          setSelectedTemplate({ id: requestData.templateId, ...templateDoc.data() });
          setFormData(requestData.formData || {});
        }
      }
    } catch (error) {
      console.error('Error fetching request:', error);
      setError('Failed to fetch request details');
    } finally {
      setLoading(false);
    }
  };

  const fetchTemplates = async () => {
    try {
      const templatesRef = collection(db, 'brd_templates');
      const snapshot = await getDocs(templatesRef);
      const templatesData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setTemplates(templatesData);
    } catch (error) {
      console.error('Error fetching templates:', error);
    }
  };

  const subscribeToComments = () => {
    try {
      const commentsRef = collection(db, 'brd_requests', requestId, 'comments');
      const unsubscribe = onSnapshot(commentsRef, (snapshot) => {
        const commentsData = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          timestamp: doc.data().timestamp?.toDate() || new Date()
        }));
        
        // Sort comments by timestamp
        const sortedComments = commentsData.sort((a, b) => b.timestamp - a.timestamp);
        setComments(sortedComments);

        // Update last seen timestamp only if we're in the discussion tab
        if (activeTab === 'discussion' && sortedComments.length > 0) {
          setLastSeenComment(sortedComments[0].timestamp);
        }
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

  // Calculate unread comments count
  const unreadCount = lastSeenComment 
    ? comments.filter(comment => 
        comment.timestamp > lastSeenComment && 
        comment.userId !== user.uid
      ).length 
    : 0;

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

  const handleTemplateSelect = (template) => {
    setSelectedTemplate(template);
    // Initialize form data with empty values for each field
    const initialData = template.fields.reduce((acc, field) => ({
      ...acc,
      [field.name]: ''
    }), {});
    setFormData(initialData);
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
      
      // Validate template selection
      if (!selectedTemplate?.id) {
        setError('Please select a template first');
        return;
      }

      // Validate required fields
      const missingFields = selectedTemplate.fields
        .filter(field => field.required && !formData[field.name])
        .map(field => field.label);
      
      if (missingFields.length > 0) {
        setError(`Please fill in the following required fields: ${missingFields.join(', ')}`);
        return;
      }

      const apiKey = import.meta.env.VITE_GROQ_API_KEY;
      if (!apiKey) {
        throw new Error('GROQ API key not found');
      }

      console.log('Sending request to GROQ...'); // Debug log

      // Group fields by categories
      const groupedFields = {
        projectInfo: selectedTemplate.fields
          .filter(field => field.name.toLowerCase().includes('project') || field.name.toLowerCase().includes('dokumen'))
          .map(field => ({ label: field.label, value: formData[field.name] || '' })),
        background: selectedTemplate.fields
          .filter(field => field.name.toLowerCase().includes('kondisi') || field.name.toLowerCase().includes('latar'))
          .map(field => ({ label: field.label, value: formData[field.name] || '' })),
        businessNeeds: selectedTemplate.fields
          .filter(field => field.name.toLowerCase().includes('kebutuhan') || field.name.toLowerCase().includes('dampak'))
          .map(field => ({ label: field.label, value: formData[field.name] || '' })),
        scope: selectedTemplate.fields
          .filter(field => field.name.toLowerCase().includes('lingkup') || field.name.toLowerCase().includes('scope'))
          .map(field => ({ label: field.label, value: formData[field.name] || '' })),
        requirements: selectedTemplate.fields
          .filter(field => field.name.toLowerCase().includes('requirement') || field.name.toLowerCase().includes('sistem'))
          .map(field => ({ label: field.label, value: formData[field.name] || '' })),
        planning: selectedTemplate.fields
          .filter(field => field.name.toLowerCase().includes('jadwal') || field.name.toLowerCase().includes('anggaran'))
          .map(field => ({ label: field.label, value: formData[field.name] || '' }))
      };

      // Create structured prompt
      const promptContent = `Hasilkan BRD lengkap berdasarkan informasi berikut:

${Object.entries(groupedFields).map(([category, fields]) => `
${category.toUpperCase()}:
${fields.map(f => `${f.label}: ${f.value}`).join('\n')}
`).join('\n')}

Generate a comprehensive BRD with the following structure:

I. INFORMASI PROYEK
- Informasi dasar proyek
- Detail dokumen
- Informasi pemohon dan unit bisnis

II. LATAR BELAKANG
- Kondisi saat ini
- Permasalahan yang dihadapi
- Justifikasi kebutuhan

III. KEBUTUHAN BISNIS
- Kebutuhan utama
- Dampak bisnis
- Manfaat yang diharapkan

IV. RUANG LINGKUP
- Batasan proyek
- Yang termasuk dalam scope
- Yang tidak termasuk dalam scope

V. KEBUTUHAN SISTEM
- Kebutuhan fungsional
- Kebutuhan non-fungsional
- Integrasi sistem

VI. PERENCANAAN
- Jadwal implementasi
- Estimasi anggaran
- Risiko dan mitigasi

Important: 
- Maintain the exact section numbering format
- Use formal Bahasa Indonesia
- Include specific banking industry context
- Consider regulatory compliance
- Focus on security and risk aspects`;

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
- Aspek keamanan dan kepatuhan yang relevan`
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

      // Parse the content into sections
      const sections = {
        informasiProyek: generatedText.match(/I\. INFORMASI PROYEK[\s\S]*?(?=II\. LATAR BELAKANG|$)/)?.[0] || '',
        latarBelakang: generatedText.match(/II\. LATAR BELAKANG[\s\S]*?(?=III\. KEBUTUHAN BISNIS|$)/)?.[0] || '',
        kebutuhanBisnis: generatedText.match(/III\. KEBUTUHAN BISNIS[\s\S]*?(?=IV\. RUANG LINGKUP|$)/)?.[0] || '',
        ruangLingkup: generatedText.match(/IV\. RUANG LINGKUP[\s\S]*?(?=V\. KEBUTUHAN SISTEM|$)/)?.[0] || '',
        kebutuhanSistem: generatedText.match(/V\. KEBUTUHAN SISTEM[\s\S]*?(?=VI\. PERENCANAAN|$)/)?.[0] || '',
        perencanaan: generatedText.match(/VI\. PERENCANAAN[\s\S]*/)?.[0] || ''
      };

      // Update request with generated content
      const requestRef = doc(db, 'brd_requests', requestId);
      await updateDoc(requestRef, {
        generatedContent: sections,
        templateId: selectedTemplate.id,
        templateName: selectedTemplate.name,
        formData,
        status: 'Generated',
        updatedAt: serverTimestamp(),
        updatedBy: user.uid,
        updatedByName: profile.namaLengkap
      });

      // Set the generated content and switch to view tab
      setGeneratedContent(sections);
      setActiveTab('view');
    } catch (error) {
      console.error('Error generating BRD:', error);
      setError('Error generating BRD: ' + error.message);
    } finally {
      setGenerating(false);
    }
  };

  const exportToWord = () => {
    const preHtml = `<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
      <head>
        <meta charset='utf-8'>
        <title>Business Requirements Document</title>
        <style>
          @page Section1 {
            size: 21cm 29.7cm;
            margin: 2.54cm 2.54cm 2.54cm 2.54cm;
            mso-header-margin: 35.4pt;
            mso-footer-margin: 35.4pt;
            mso-paper-source: 0;
          }
          div.Section1 { page: Section1; }
          body {
            font-family: 'Times New Roman', Times, serif;
            font-size: 12pt;
            line-height: 1.6;
            color: #1a1a1a;
          }
          .header {
            text-align: center;
            margin-bottom: 2cm;
          }
          .logo-container {
            margin-bottom: 1cm;
            text-align: center;
          }
          .logo { width: 200px; height: auto; }
          .company-name {
            font-size: 14pt;
            font-weight: bold;
            margin-bottom: 0.5cm;
          }
          .divider {
            width: 80%;
            margin: 0.5cm auto;
            border-top: 2px solid black;
          }
          h1, h2 { font-family: 'Times New Roman', Times, serif; }
          h1 {
            font-size: 14pt;
            font-weight: bold;
            margin-top: 1cm;
            margin-bottom: 0.5cm;
          }
          h2 {
            font-size: 12pt;
            font-weight: bold;
            margin-top: 0.8cm;
            margin-bottom: 0.4cm;
          }
          p { margin-bottom: 0.8em; text-align: justify; }
          .approval-section {
            margin-top: 2cm;
            page-break-inside: avoid;
          }
          .signature-grid {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 2cm;
            margin-top: 1cm;
          }
          .signature-box {
            text-align: center;
          }
          .signature-line {
            border-bottom: 1px solid black;
            margin: 3cm 0 0.5cm 0;
          }
        </style>
      </head>
      <body>
        <div class="Section1">
          <div class="header">
            <div class="logo-container">
              <img src="${bankLogo}" alt="Bank Logo" class="logo">
            </div>
            <h1 class="company-name">PT BANK PEMBANGUNAN DAERAH JAWA TENGAH</h1>
            <div class="divider"></div>
            <h2>DOKUMEN KEBUTUHAN BISNIS</h2>
            <h3>${request?.namaProject || 'Untitled Project'}</h3>
            <p>SEMARANG</p>
            <p>${new Date().toLocaleDateString('id-ID', {
              day: 'numeric',
              month: 'long',
              year: 'numeric'
            })}</p>
          </div>
          <div class="content">`;

    const postHtml = `
          </div>
          <div class="approval-section">
            <h1>PERSETUJUAN</h1>
            <div className="signature-grid">
              <div className="signature-box">
                <div className="signature-line"></div>
                <p>Dibuat oleh:</p>
                <p>${request?.createdByName || ''}</p>
                <p>${request?.unitBisnis || ''}</p>
                <p>${new Date(request?.createdAt?.toDate()).toLocaleDateString('id-ID')}</p>
              </div>
              <div className="signature-box">
                <div className="signature-line"></div>
                <p>Diperiksa oleh:</p>
                <p>${approvalStatus?.reviewer?.name || ''}</p>
                <p>${approvalStatus?.reviewer?.role || ''}</p>
                <p>${approvalStatus?.reviewedAt ? new Date(approvalStatus.reviewedAt.toDate()).toLocaleDateString('id-ID') : ''}</p>
              </div>
              <div className="signature-box">
                <div className="signature-line"></div>
                <p>Disetujui oleh:</p>
                <p>${approvalStatus?.approver?.name || ''}</p>
                <p>${approvalStatus?.approver?.role || ''}</p>
                <p>${approvalStatus?.approvedAt ? new Date(approvalStatus.approvedAt.toDate()).toLocaleDateString('id-ID') : ''}</p>
              </div>
            </div>
          </div>
        </div>
      </body>
    </html>`;

    // Convert the generatedContent to properly formatted HTML
    const formattedContent = generatedContent
      .split('\n')
      .map(line => {
        if (/^[IVX]+\./.test(line)) {
          return `<h1>${line.trim()}</h1>`;
        }
        else if (/^\d+\.\d+\./.test(line)) {
          return `<h2>${line.trim()}</h2>`;
        }
        else if (line.trim()) {
          return `<p>${line.trim()}</p>`;
        }
        return '';
      })
      .join('\n');

    const html = preHtml + formattedContent + postHtml;

    // Create a new Blob with HTML content
    const blob = new Blob(['\ufeff', html], {
      type: 'application/msword'
    });

    // Create download link
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${request?.namaProject || 'BRD'}.doc`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Add this function after handleCommentSubmit
  const handleDeleteComment = async (commentId) => {
    try {
      const commentRef = doc(db, 'brd_requests', requestId, 'comments', commentId);
      await deleteDoc(commentRef);
      toast.success('Comment deleted successfully');
      setCommentToDelete(null);
    } catch (error) {
      console.error('Error deleting comment:', error);
      toast.error('Failed to delete comment');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-900"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-lg">
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
    );
  }

  return (
    <div className="max-w-7xl mx-auto py-6 space-y-8">
      <ToastContainer
        position="top-right"
        autoClose={5000}
        hideProgressBar={false}
        newestOnTop
        closeOnClick
        rtl={false}
        pauseOnFocusLoss
        draggable
        pauseOnHover
        theme="light"
      />
      {/* Header */}
      <div className="bg-white rounded-2xl shadow-lg p-6">
        <div className="flex justify-between items-center">
          <div>
            <div className="flex items-center space-x-3">
              <div className="h-12 w-12 rounded-full bg-blue-600 flex items-center justify-center">
                <span className="text-white font-bold text-lg">
                  {request?.namaProject?.charAt(0).toUpperCase() || 'P'}
                </span>
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">{request?.namaProject}</h1>
                <div className="flex items-center space-x-3 mt-1">
                  <span className="text-sm text-gray-500">BRD No: {request?.noBRD}</span>
                  <span className="text-gray-300">•</span>
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium
                    ${request?.status === 'New' ? 'bg-gray-100 text-gray-800' :
                    request?.status === 'Pending Review' ? 'bg-yellow-100 text-yellow-800' :
                    request?.status === 'In Progress' ? 'bg-blue-100 text-blue-800' :
                    request?.status === 'Generated' ? 'bg-green-100 text-green-800' :
                    'bg-gray-100 text-gray-800'}`}>
                    {request?.status}
                  </span>
                </div>
              </div>
            </div>
          </div>
          <div className="flex items-center space-x-4">
            {request?.generatedContent && (
              <button
                onClick={exportToWord}
                className="inline-flex items-center px-4 py-2 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                <svg className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                Export to Word
              </button>
            )}
            <button
              onClick={() => navigate(-1)}
              className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              <svg className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              Back
            </button>
          </div>
        </div>

        {/* Request Meta Info */}
        <div className="mt-6 grid grid-cols-3 gap-6 border-t border-gray-200 pt-6">
          <div>
            <div className="flex items-center space-x-2">
              <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
              <span className="text-sm font-medium text-gray-500">Created By</span>
            </div>
            <p className="mt-1 text-sm text-gray-900">{request?.createdByName}</p>
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
              <span className="text-sm font-medium text-gray-500">Unit Bisnis</span>
            </div>
            <p className="mt-1 text-sm text-gray-900">{request?.unitBisnis}</p>
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <span className="text-sm font-medium text-gray-500">Created At</span>
            </div>
            <p className="mt-1 text-sm text-gray-900">
              {request?.createdAt?.toDate().toLocaleDateString('id-ID', {
                day: 'numeric',
                month: 'long',
                year: 'numeric'
              })}
            </p>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="bg-white rounded-2xl shadow-lg">
        {/* Tabs */}
        <div className="border-b border-gray-200">
          <nav className="-mb-px flex space-x-8 px-6" aria-label="Tabs">
            <button
              onClick={() => setActiveTab('details')}
              className={`${
                activeTab === 'details'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center space-x-2`}
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <span>Request Details</span>
            </button>
            <button
              onClick={() => setActiveTab('generate')}
              className={`${
                activeTab === 'generate'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center space-x-2`}
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
              <span>Generate BRD</span>
            </button>
            {request?.generatedContent && (
              <button
                onClick={() => setActiveTab('view')}
                className={`${
                  activeTab === 'view'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center space-x-2`}
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
                <span>View BRD</span>
              </button>
            )}
            <button
              onClick={() => {
                setActiveTab('discussion');
                // Reset unread count when entering discussion tab
                setLastSeenComment(Math.max(...comments.map(c => c.timestamp)));
              }}
              className={`${
                activeTab === 'discussion'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center space-x-2 relative`}
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
              <span>Discussion</span>
              {unreadCount > 0 && activeTab !== 'discussion' && (
                <span className="absolute -top-1 -right-1 flex h-5 w-5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-5 w-5 bg-blue-500 text-white text-xs items-center justify-center">
                    {unreadCount}
                  </span>
                </span>
              )}
            </button>
          </nav>
        </div>

        {/* Tab Content */}
        <div className="p-6">
          {error && (
            <div className="mb-6 rounded-lg bg-red-50 p-4">
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
                <div className="ml-auto pl-3">
                  <div className="-mx-1.5 -my-1.5">
                    <button
                      onClick={() => setError(null)}
                      className="inline-flex rounded-md p-1.5 text-red-500 hover:bg-red-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                    >
                      <span className="sr-only">Dismiss</span>
                      <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'details' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-medium text-gray-900">Request Information</h3>
                <div className="mt-4 grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm font-medium text-gray-500">Created By</p>
                    <p className="mt-1">{request?.createdByName}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-500">Unit Bisnis</p>
                    <p className="mt-1">{request?.unitBisnis}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-500">Status</p>
                    <p className="mt-1">{request?.status}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-500">Created At</p>
                    <p className="mt-1">{request?.createdAt?.toDate().toLocaleDateString('id-ID')}</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'generate' && (
            <div className="space-y-8">
              {/* Template Selection */}
              {!selectedTemplate ? (
                <div>
                  <div className="flex items-center justify-between mb-6">
                    <div>
                      <h3 className="text-lg font-medium text-gray-900">Select a Template</h3>
                      <p className="mt-1 text-sm text-gray-500">Choose a template to generate your Business Requirements Document.</p>
                    </div>
                    <div className="text-sm text-gray-500">
                      {templates.length} {templates.length === 1 ? 'template' : 'templates'} available
                    </div>
                  </div>
                  <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
                    {templates.map(template => (
                      <div
                        key={template.id}
                        onClick={() => handleTemplateSelect(template)}
                        className="relative group rounded-lg border-2 border-gray-200 bg-white p-6 hover:border-blue-500 hover:shadow-lg transition-all duration-200 cursor-pointer"
                      >
                        <div className="flex items-start space-x-4">
                          <div className="flex-shrink-0">
                            <div className="h-10 w-10 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center">
                              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                              </svg>
                            </div>
                          </div>
                          <div className="flex-1 min-w-0">
                            <h4 className="text-lg font-semibold text-gray-900 group-hover:text-blue-600 transition-colors">
                              {template.name}
                            </h4>
                            <p className="mt-1 text-sm text-gray-500">{template.description}</p>
                            <div className="mt-3 flex items-center text-sm text-gray-500">
                              <svg className="h-4 w-4 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                              </svg>
                              {template.fields?.length || 0} fields
                            </div>
                          </div>
                        </div>
                        <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
                          <svg className="h-6 w-6 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="space-y-8">
                  <div className="flex justify-between items-center bg-white rounded-lg border border-gray-200 p-4 shadow-sm">
                    <div className="flex items-center space-x-4">
                      <div className="h-12 w-12 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center">
                        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                      </div>
                      <div>
                        <h3 className="text-lg font-medium text-gray-900">{selectedTemplate.name}</h3>
                        <p className="text-sm text-gray-500">{selectedTemplate.description}</p>
                      </div>
                    </div>
                    <button
                      onClick={() => setSelectedTemplate(null)}
                      className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                    >
                      <svg className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
                      </svg>
                      Change Template
                    </button>
                  </div>

                  <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
                    <div className="p-6">
                      <h4 className="text-lg font-medium text-gray-900 mb-4">Template Fields</h4>
                      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                        {selectedTemplate.fields.map(field => (
                          <div key={field.name} className="relative">
                            <label htmlFor={field.name} className="block text-sm font-medium text-gray-700">
                              {field.label} {field.required && <span className="text-red-500">*</span>}
                            </label>
                            <div className="mt-1 relative rounded-md shadow-sm">
                              {field.type === 'textarea' ? (
                                <textarea
                                  id={field.name}
                                  name={field.name}
                                  rows={4}
                                  value={formData[field.name] || ''}
                                  onChange={(e) => handleInputChange(field.name, e.target.value)}
                                  className="block w-full rounded-md border-gray-300 shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                                  placeholder={`Enter ${field.label.toLowerCase()}`}
                                />
                              ) : field.type === 'select' ? (
                                <select
                                  id={field.name}
                                  name={field.name}
                                  value={formData[field.name] || ''}
                                  onChange={(e) => handleInputChange(field.name, e.target.value)}
                                  className="block w-full rounded-md border-gray-300 shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                                >
                                  <option value="">Select {field.label.toLowerCase()}</option>
                                  {field.options?.map(option => (
                                    <option key={option} value={option}>{option}</option>
                                  ))}
                                </select>
                              ) : (
                                <input
                                  type={field.type || 'text'}
                                  id={field.name}
                                  name={field.name}
                                  value={formData[field.name] || ''}
                                  onChange={(e) => handleInputChange(field.name, e.target.value)}
                                  className="block w-full rounded-md border-gray-300 shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                                  placeholder={`Enter ${field.label.toLowerCase()}`}
                                />
                              )}
                              {field.required && !formData[field.name] && (
                                <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                                  <svg className="h-5 w-5 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                  </svg>
                                </div>
                              )}
                            </div>
                            {field.description && (
                              <p className="mt-1 text-sm text-gray-500">{field.description}</p>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="px-6 py-4 bg-gray-50 border-t border-gray-200">
                      <div className="flex items-center justify-between">
                        <p className="text-sm text-gray-500">
                          {selectedTemplate.fields.filter(f => f.required && !formData[f.name]).length} required fields remaining
                        </p>
                        <button
                          onClick={handleGenerateBRD}
                          disabled={generating}
                          className={`${
                            generating
                              ? 'bg-gray-400 cursor-not-allowed'
                              : 'bg-blue-600 hover:bg-blue-700'
                          } inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500`}
                        >
                          {generating ? (
                            <>
                              <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                              </svg>
                              Generating...
                            </>
                          ) : (
                            <>
                              <svg className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                              </svg>
                              Generate BRD
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'view' && generatedContent && (
            <div className="space-y-8">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-medium text-gray-900">Generated BRD Document</h3>
                <button
                  onClick={exportToWord}
                  className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  Export to Word
                </button>
              </div>

              <div className="bg-white border border-gray-200 rounded-lg shadow-sm">
                <div className="p-8 space-y-6">
                  {/* Header */}
                  <div className="text-center space-y-4">
                    <img src={bankLogo} alt="Bank Logo" className="h-16 mx-auto" />
                    <h1 className="text-2xl font-bold">PT BANK PEMBANGUNAN DAERAH JAWA TENGAH</h1>
                    <div className="w-32 mx-auto border-t-2 border-gray-900"></div>
                    <h2 className="text-xl font-semibold">DOKUMEN KEBUTUHAN BISNIS</h2>
                    <h3 className="text-lg">{request?.namaProject}</h3>
                    <p>SEMARANG</p>
                    <p>{new Date().toLocaleDateString('id-ID', {
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric'
                    })}</p>
                  </div>

                  {/* Content */}
                  <div className="prose max-w-none">
                    {generatedContent && typeof generatedContent === 'object' ? (
                      <>
                        {Object.entries(generatedContent).map(([section, content]) => (
                          <div key={section} className="mb-8">
                            <div className="bg-white rounded-lg border border-gray-200 p-6">
                              <div className="prose max-w-none">
                                <div className="whitespace-pre-wrap leading-relaxed">
                                  {typeof content === 'string' && content.split('\n').map((line, index) => (
                                    <div key={index} className={`${
                                      line.match(/^[IVX]+\./) ? 'text-2xl font-bold text-gray-900 mb-6' :
                                      line.match(/^\d+\.\d+\./) ? 'font-semibold text-lg mt-4' :
                                      'ml-4 mt-2'
                                    }`}>
                                      {line}
                                    </div>
                                  ))}
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </>
                    ) : (
                      <div className="text-center text-gray-500">
                        No content generated yet. Please select a template and generate the BRD.
                      </div>
                    )}
                  </div>

                  {/* Approval Section */}
                  <div className="mt-12">
                    <h2 className="text-xl font-bold mb-6">PERSETUJUAN</h2>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                      <div className="text-center">
                        <div className="h-24"></div>
                        <div className="border-t border-gray-400"></div>
                        <p className="mt-2">Dibuat oleh:</p>
                        <p className="font-medium">{request?.createdByName}</p>
                        <p className="text-sm text-gray-600">{request?.unitBisnis}</p>
                        <p className="text-sm text-gray-600">
                          {request?.createdAt?.toDate().toLocaleDateString('id-ID')}
                        </p>
                      </div>
                      <div className="text-center">
                        <div className="h-24"></div>
                        <div className="border-t border-gray-400"></div>
                        <p className="mt-2">Diperiksa oleh:</p>
                        <p className="font-medium">{approvalStatus?.reviewer?.name || '-'}</p>
                        <p className="text-sm text-gray-600">{approvalStatus?.reviewer?.role || '-'}</p>
                        <p className="text-sm text-gray-600">
                          {approvalStatus?.reviewedAt ? 
                            new Date(approvalStatus.reviewedAt.toDate()).toLocaleDateString('id-ID') : 
                            '-'}
                        </p>
                      </div>
                      <div className="text-center">
                        <div className="h-24"></div>
                        <div className="border-t border-gray-400"></div>
                        <p className="mt-2">Disetujui oleh:</p>
                        <p className="font-medium">{approvalStatus?.approver?.name || '-'}</p>
                        <p className="text-sm text-gray-600">{approvalStatus?.approver?.role || '-'}</p>
                        <p className="text-sm text-gray-600">
                          {approvalStatus?.approvedAt ? 
                            new Date(approvalStatus.approvedAt.toDate()).toLocaleDateString('id-ID') : 
                            '-'}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'discussion' && (
            <div className="space-y-6">
              {/* Comments Header */}
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-medium text-gray-900">Discussion</h3>
                <div className="text-sm text-gray-500">
                  {comments.length} {comments.length === 1 ? 'comment' : 'comments'}
                </div>
              </div>

              {/* Comments List */}
              <div className="space-y-4">
                {comments.length === 0 ? (
                  <div className="text-center py-8">
                    <div className="text-gray-400">
                      <svg className="mx-auto h-12 w-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                      </svg>
                    </div>
                    <p className="mt-2 text-sm text-gray-500">No comments yet. Start the discussion!</p>
                  </div>
                ) : (
                  comments.map(comment => (
                    <div key={comment.id} className="bg-white rounded-lg border border-gray-200 shadow-sm p-4">
                      <div className="flex space-x-3">
                        {/* User Avatar */}
                        <div className="flex-shrink-0">
                          <div className="h-10 w-10 rounded-full bg-blue-600 flex items-center justify-center">
                            <span className="text-white font-medium text-sm">
                              {comment.userName.split(' ').map(n => n[0]).join('').toUpperCase()}
                            </span>
                          </div>
                        </div>
                        
                        {/* Comment Content */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="font-medium text-gray-900">{comment.userName}</p>
                              <p className="text-xs text-gray-500">
                                {comment.timestamp.toLocaleString('id-ID', {
                                  year: 'numeric',
                                  month: 'long',
                                  day: 'numeric',
                                  hour: '2-digit',
                                  minute: '2-digit'
                                })}
                              </p>
                            </div>
                            {comment.userId === user.uid && (
                              <button
                                onClick={() => setCommentToDelete(comment)}
                                className="text-gray-400 hover:text-red-500"
                              >
                                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                              </button>
                            )}
                          </div>
                          <div className="mt-2 text-sm text-gray-700 whitespace-pre-wrap">{comment.text}</div>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Comment Form */}
              <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-4">
                <form onSubmit={handleCommentSubmit}>
                  <div className="flex space-x-3">
                    {/* Current User Avatar */}
                    <div className="flex-shrink-0">
                      <div className="h-10 w-10 rounded-full bg-blue-600 flex items-center justify-center">
                        <span className="text-white font-medium text-sm">
                          {profile.namaLengkap.split(' ').map(n => n[0]).join('').toUpperCase()}
                        </span>
                      </div>
                    </div>

                    {/* Comment Input */}
                    <div className="flex-1 min-w-0">
                      <div className="relative">
                        <textarea
                          id="comment"
                          name="comment"
                          rows={3}
                          value={newComment}
                          onChange={(e) => setNewComment(e.target.value)}
                          className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                          placeholder="Add your comment..."
                        />
                        <div className="absolute bottom-0 right-0 p-2">
                          <button
                            type="submit"
                            disabled={!newComment.trim()}
                            className={`inline-flex items-center px-3 py-1.5 border border-transparent text-sm font-medium rounded-md shadow-sm text-white 
                              ${!newComment.trim() ? 'bg-gray-300 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500'}`}
                          >
                            <svg className="h-4 w-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                            </svg>
                            Comment
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Add delete confirmation dialog */}
      {commentToDelete && (
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-sm mx-4">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Delete Comment</h3>
            <p className="text-sm text-gray-500 mb-4">Are you sure you want to delete this comment? This action cannot be undone.</p>
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => setCommentToDelete(null)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDeleteComment(commentToDelete.id)}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 border border-transparent rounded-md hover:bg-red-700"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}; 