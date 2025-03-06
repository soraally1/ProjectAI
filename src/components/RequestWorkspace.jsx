import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { collection, doc, getDoc, getDocs, updateDoc, addDoc, onSnapshot, serverTimestamp, deleteDoc, query, orderBy, where, limit } from 'firebase/firestore';
import { db } from '../firebase';
import { useUser } from '../context/UserContext';
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import bankLogo from '../assets/i-BRDSystem.svg';
import { Document, Packer, Paragraph, HeadingLevel, Table, TableRow, TableCell, WidthType, AlignmentType } from 'docx';
import { marked } from 'marked';
import ReactMarkdown from 'react-markdown';
import cookie from 'react-cookies';

const RequestWorkspace = () => {
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
  const [isSubmitting, setIsSubmitting] = useState(false);

  // BRD Generation states
  const [templates, setTemplates] = useState([]);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [formData, setFormData] = useState({});
  const [generating, setGenerating] = useState(false);
  const [generatedBRD, setGeneratedBRD] = useState('');

  // Add this state for delete confirmation
  const [commentToDelete, setCommentToDelete] = useState(null);

  const [notificationPermission, setNotificationPermission] = useState('default');

  // Add new state for prompts
  const [prompts, setPrompts] = useState({
    brdGeneration: '',
    brdInstruction: ''
  });

  const [isSaving, setIsSaving] = useState(false);
  const [currentTurn, setCurrentTurn] = useState('analyst');
  const [savedSections, setSavedSections] = useState({});
  const [currentEditor, setCurrentEditor] = useState(null);
  const [savedFields, setSavedFields] = useState({});

  // Add this state near the top with other state declarations
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [modifiedFields, setModifiedFields] = useState(new Set());

  // Add new states for parameter-wise generation
  const [generatingSection, setGeneratingSection] = useState(null);
  const [generatedSections, setGeneratedSections] = useState({});
  const [sectionStatus, setSectionStatus] = useState({});

  // Add new state for field-level generation
  const [generatingField, setGeneratingField] = useState(null);
  const [generatedFields, setGeneratedFields] = useState({});

  // Add new state for BRD preview
  const [brdPreview, setBrdPreview] = useState(null);

  // Add a new state for storing previous generations history
  const [generationHistory, setGenerationHistory] = useState({});
  const [showHistoryFor, setShowHistoryFor] = useState(null);

  // Helper function to convert numbers to Roman numerals
  const toRomanNumeral = (num) => {
    const romanNumerals = [
      { value: 10, numeral: 'X' },
      { value: 9, numeral: 'IX' },
      { value: 5, numeral: 'V' },
      { value: 4, numeral: 'IV' },
      { value: 1, numeral: 'I' }
    ];
    
    let result = '';
    for (let i = 0; i < romanNumerals.length; i++) {
      while (num >= romanNumerals[i].value) {
        result += romanNumerals[i].numeral;
        num -= romanNumerals[i].value;
      }
    }
    return result;
  };

  // Add this useEffect for requesting notification permission
  useEffect(() => {
    const requestNotificationPermission = async () => {
      try {
        // Check if the browser supports notifications
        if (!("Notification" in window)) {
          console.log("This browser does not support desktop notifications");
          return;
        }

        // Check if we already have permission
        if (Notification.permission === "granted") {
          setNotificationPermission("granted");
          return;
        }

        // Request permission
        if (Notification.permission !== "denied") {
          const permission = await Notification.requestPermission();
          setNotificationPermission(permission);
          console.log("Notification permission:", permission); // Debug log
        }
      } catch (error) {
        console.error('Error requesting notification permission:', error);
      }
    };

    requestNotificationPermission();
  }, []);

  // Update the notification handling in the comments useEffect
  useEffect(() => {
    if (!comments.length) return;

    const handleNewComments = async () => {
      // Get the latest comment
      const latestComment = comments[0];
      
      // Check if it's a new comment from another user and discussion tab is not active
      const shouldNotify = 
        latestComment.userId !== user.uid && 
        (!lastSeenComment || latestComment.timestamp > lastSeenComment) &&
        activeTab !== 'discussion';

      if (shouldNotify) {
        // Show single toast notification with action
        toast.info(
          <div className="flex flex-col">
            <strong>Komentar baru dari {latestComment.userName}</strong>
            <span className="text-sm">{latestComment.text.substring(0, 100)}{latestComment.text.length > 100 ? '...' : ''}</span>
          </div>,
          {
            position: "top-right",
            autoClose: 5000,
            hideProgressBar: false,
            closeOnClick: true,
            pauseOnHover: true,
            draggable: true,
            onClick: () => {
              setActiveTab('discussion');
            },
          }
        );

        // Show desktop notification only if permission is granted and discussion tab is not active
        try {
          if (Notification.permission === "granted" && activeTab !== 'discussion') {
            const notification = new Notification(`Komentar baru dari ${latestComment.userName}`, {
              body: latestComment.text.substring(0, 100) + (latestComment.text.length > 100 ? '...' : ''),
              icon: '/src/assets/i-BRDSystem.svg',
              badge: '/src/assets/i-BRDSystem.svg',
              tag: `brd-comment-${Date.now()}`,
              requireInteraction: false,
              silent: true
            });

            notification.onclick = function() {
              window.focus();
              setActiveTab('discussion');
              this.close();
            };
          }
        } catch (error) {
          console.error('Error showing desktop notification:', error);
        }
      }
    };

    handleNewComments();
  }, [comments, user.uid, lastSeenComment, activeTab]);

  useEffect(() => {
    fetchRequest();
    fetchTemplates();
    fetchSystemSettings();
    const unsubscribe = subscribeToComments();
    return () => unsubscribe();
  }, [requestId]);

  // Add new useEffect for completed BRD handling
  useEffect(() => {
    if (request?.status === 'Selesai') {
      toast.info('BRD telah selesai. Anda akan diarahkan ke dashboard.');
      setTimeout(() => {
        navigate('/dashboard');
      }, 2000);
    }
  }, [request?.status, navigate]);

  useEffect(() => {
    // Set initial editor as analyst if request is new
    if (!request?.currentEditor) {
      setCurrentEditor('analyst');
    } else {
      setCurrentEditor(request.currentEditor);
    }
    
    // Load saved fields if they exist
    if (request?.savedFields) {
      setSavedFields(request.savedFields);
      setFormData(request.savedFields);
    }
  }, [request]);

  // Add at the beginning of the component
  useEffect(() => {
    console.log('Current state:', {
      currentEditor: request?.currentEditor,
      userRole: profile?.role,
      canEdit: canEdit(),
      formData
    });
  }, [request?.currentEditor, profile?.role, formData]);

  // Update the real-time listener useEffect
  useEffect(() => {
    if (requestId) {
      const unsubscribe = onSnapshot(doc(db, 'brd_requests', requestId), (doc) => {
        if (doc.exists()) {
          const data = doc.data();
          setRequest(data);
          
          // Update formData and reset states when changes come from another user
          if (data.lastSavedBy?.uid !== user.uid) {
            setFormData(data.formData || {});
            setModifiedFields(new Set());
            setHasUnsavedChanges(false);
            
            // Only show notification for significant changes
            if (data.currentEditor !== request?.currentEditor) {
              const editorType = data.currentEditor === 'analyst' ? 'Business Analyst' : 'Requester';
              toast.info(
                `Giliran telah beralih ke ${editorType}`,
                {
                  position: "top-right",
                  autoClose: 3000
                }
              );
            }
          }

          // Update editor state regardless of who made the change
          setCurrentEditor(data.currentEditor || 'analyst');
        }
      });

      return () => unsubscribe();
    }
  }, [requestId, user.uid, request?.currentEditor]);

  const fetchRequest = async () => {
    try {
      const requestDoc = await getDoc(doc(db, 'brd_requests', requestId));
      if (!requestDoc.exists()) {
        setError('Permintaan tidak ditemukan');
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
      setError('Gagal mengambil detail permintaan');
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
      toast.error('Gagal mengambil template');
    }
  };

  const fetchSystemSettings = async () => {
    try {
      const settingsRef = doc(db, 'system_settings', 'general');
      const settingsSnap = await getDoc(settingsRef);
      
      if (settingsSnap.exists()) {
        const settings = settingsSnap.data();
        setPrompts({
          brdGeneration: settings.defaultPrompts?.brdGeneration || `Anda adalah seorang Business Analyst profesional di Bank Jateng dengan pengalaman lebih dari 10 tahun dalam menyusun Business Requirements Document (BRD).
Tugas Anda adalah menghasilkan konten BRD yang sangat detail, terstruktur, dan profesional sesuai standar perbankan.
Gunakan bahasa Indonesia yang formal, teknis, dan mudah dipahami.
Setiap bagian harus mencakup:
- Penjelasan detail dan komprehensif
- Contoh spesifik yang relevan dengan perbankan
- Referensi ke best practices industri perbankan
- Pertimbangan regulasi perbankan yang berlaku
- Aspek keamanan dan kepatuhan yang relevan`,
          brdInstruction: settings.defaultPrompts?.brdInstruction || 'Hasilkan BRD lengkap berdasarkan informasi berikut:'
        });
      }
    } catch (error) {
      console.error('Error fetching system settings:', error);
      // Use default prompts if there's an error
      setPrompts({
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
      });
    }
  };

  const subscribeToComments = () => {
    try {
      const commentsQuery = query(
        collection(db, 'brd_requests', requestId, 'comments'),
        orderBy('timestamp', 'desc')
      );

      const unsubscribe = onSnapshot(commentsQuery, (snapshot) => {
      const commentsData = snapshot.docs.map(doc => ({
        id: doc.id,
          ...doc.data(),
          timestamp: doc.data().timestamp?.toDate() || new Date()
      }));
        setComments(commentsData);
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

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (newComment.trim() && !isSubmitting) {
        handleCommentSubmit(e);
      }
    }
  };

  const handleCommentSubmit = async (e) => {
    e.preventDefault();
    if (!newComment.trim()) return;

    setIsSubmitting(true);
    try {
      await addDoc(collection(db, 'brd_requests', requestId, 'comments'), {
        text: newComment.trim(),
      userId: user.uid,
      userName: profile.namaLengkap,
        userRole: profile.role || 'Business Requester',
        userPhotoURL: profile.photoURL,
      timestamp: serverTimestamp()
    });
    setNewComment('');
      toast.success('Komentar berhasil ditambahkan');
    } catch (error) {
      console.error('Error adding comment:', error);
      toast.error('Gagal menambahkan komentar');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleTemplateSelect = async (template) => {
    try {
      setIsSubmitting(true);
      
      // Initialize form data based on template structure
      const initialData = {};
      
      if (template.structure?.sections) {
        template.structure.sections.forEach(section => {
          if (section.fieldConfigs) {
            section.fieldConfigs.forEach(field => {
              // Keep existing values if they exist
              initialData[field.name] = formData[field.name] || '';
            });
          }
        });
      }
      
      // Update local state first
      setSelectedTemplate(template);
      setFormData(initialData);
      setModifiedFields(new Set());
      setHasUnsavedChanges(false);
      
      // Update request document with template selection
      const requestRef = doc(db, 'brd_requests', requestId);
      await updateDoc(requestRef, {
        templateId: template.id,
        templateName: template.name,
        templateStructure: template.structure,
        formData: initialData,
        currentEditor: 'requester',
        lastSavedBy: {
          uid: user.uid,
          name: profile.namaLengkap,
          role: profile.role,
          timestamp: serverTimestamp()
        },
        updatedAt: serverTimestamp(),
        updatedBy: user.uid,
        updatedByName: profile.namaLengkap
      });

      toast.success('Template berhasil dipilih');
      
    } catch (error) {
      console.error('Error selecting template:', error);
      toast.error('Gagal memilih template. Silakan coba lagi.');
      // Revert local state on error
      fetchRequest();
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleChangeTemplate = () => {
    if (window.confirm('Mengubah template akan menghapus semua kolom yang telah diisi. Apakah Anda yakin ingin melanjutkan?')) {
      // First update local state
      setSelectedTemplate(null);
      setFormData({});
      setModifiedFields(new Set());
      setHasUnsavedChanges(false);
      
      // Update request document to remove template data
      const requestRef = doc(db, 'brd_requests', requestId);
      const updateData = {
        templateId: null,
        templateName: null,
        templateStructure: null,
        formData: {},
        currentEditor: profile.role === 'Business Analyst' ? 'analyst' : 'requester',
        lastSavedBy: {
          uid: user.uid,
          name: profile.namaLengkap,
          role: profile.role,
          timestamp: serverTimestamp()
        },
        updatedAt: serverTimestamp(),
        updatedBy: user.uid,
        updatedByName: profile.namaLengkap,
        status: request.status // Preserve existing status
      };

      updateDoc(requestRef, updateData)
        .then(() => {
          toast.success('Template berhasil diatur ulang');
        })
        .catch(error => {
        console.error('Error resetting template:', error);
          toast.error('Gagal mengatur ulang template. Silakan coba lagi.');
          // Revert local state on error
          fetchRequest();
      });
    }
  };

  const handleFieldChange = (fieldName, value) => {
    if (request?.status === 'Selesai') {
      toast.warning('BRD telah selesai dan tidak dapat diubah.');
      return;
    }

    if (!canEdit()) {
      console.log('Edit blocked - not allowed to edit');
      return;
    }

    // Update local state
    setFormData(prevData => ({
      ...prevData,
        [fieldName]: value
    }));

    // Track modified fields
    setModifiedFields(prev => {
      const newSet = new Set(prev);
      newSet.add(fieldName);
      return newSet;
    });
    
    setHasUnsavedChanges(true);
  };

  // Update the useEffect for fetching generated content
  useEffect(() => {
    const fetchGeneratedContent = async () => {
      if (request?.generatedContent) {
        console.log('Raw generatedContent:', request.generatedContent);
        
        // If generatedContent is a string, parse it into sections
        if (typeof request.generatedContent === 'string') {
          const sections = {};
          const lines = request.generatedContent.split('\n');
          let currentSection = '';
          let currentContent = [];

          for (const line of lines) {
            const sectionMatch = line.match(/^([IVX]+)\.\s+(.*)/);
            if (sectionMatch) {
              if (currentSection && currentContent.length > 0) {
                sections[currentSection] = currentContent.join('\n');
              }
              currentSection = sectionMatch[2];
              currentContent = [];
            } else if (line.trim() && currentSection) {
              currentContent.push(line);
            }
          }

          // Save the last section
          if (currentSection && currentContent.length > 0) {
            sections[currentSection] = currentContent.join('\n');
          }

          console.log('Parsed sections:', sections);
          setGeneratedContent(sections);
        } else {
          // If it's already an object, use it directly
          console.log('Using existing object:', request.generatedContent);
          setGeneratedContent(request.generatedContent);
        }
      } else {
        console.log('No generated content found');
        setGeneratedContent(null);
      }
    };

    fetchGeneratedContent();
  }, [request?.generatedContent]);

  // Function to generate single section
  const handleGenerateSection = async (section, index) => {
    if (!canEdit()) {
      toast.error('Anda tidak memiliki akses untuk mengedit dokumen ini');
      return;
    }

    setGeneratingSection(section.title);
    
    // Create prompt for single section
    const promptContent = `Anda adalah Business Analyst senior di Bank Jateng dengan pengalaman lebih dari 10 tahun.
Tugas: Buat konten untuk bagian "${section.title}" dari BRD berdasarkan data berikut:

BAGIAN YANG AKAN DIBUAT:
${section.number}. ${section.title}
${section.description ? `Deskripsi Bagian: ${section.description}` : ''}

DATA YANG TERSEDIA:
${section.fieldConfigs?.map(field => {
    const value = formData[field.name];
  return value ? `${field.label}:\n${value}` : null;
}).filter(Boolean).join('\n\n') || 'Bagian ini belum memiliki data yang diisi'}

INSTRUKSI:
1. Buat konten HANYA untuk bagian "${section.title}"
2. HANYA gunakan data yang tersedia di atas
3. Jika tidak ada data, tulis "Bagian ini belum memiliki data yang diisi"
4. Gunakan Bahasa Indonesia yang baku dan formal
5. DILARANG menambah informasi di luar data yang ada

FORMAT OUTPUT:
${section.number}. ${section.title}
[Isi sesuai data]`;

    // Call Gemini API for single section
    const response = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro:generateContent?key=' + import.meta.env.VITE_GEMINI_API_KEY, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
        contents: [{
          parts: [{
            text: promptContent
          }]
        }],
        generationConfig: {
          temperature: 0.1,
          maxOutputTokens: 8192,
          topK: 1,
          topP: 0.1
        }
        })
      });

      if (!response.ok) {
      throw new Error(`Gagal generate bagian: ${response.statusText}`);
      }

      const data = await response.json();
    if (!data.candidates?.[0]?.content?.parts?.[0]?.text) {
      throw new Error('Format response tidak valid');
    }

    // Clean up generated text
    let sectionContent = data.candidates[0].content.parts[0].text
      .replace(/^\s*\d+\.\s*[^\n]+\n/, '') // Remove section number and title
      .trim();

    // Update generated sections
    setGeneratedSections(prev => ({
      ...prev,
      [section.title]: sectionContent
    }));

    // Save to Firestore
      const requestRef = doc(db, 'brd_requests', requestId);
      await updateDoc(requestRef, {
      [`generatedContent.${section.title}`]: sectionContent,
      status: 'Sedang Diproses',
        updatedAt: serverTimestamp(),
        updatedBy: user.uid,
        updatedByName: profile.namaLengkap
      });

    // Update local state
      setRequest(prev => ({
        ...prev,
      status: 'Sedang Diproses'
    }));

    // Show success message
    toast.success(`Bagian "${section.title}" berhasil digenerate`);
  };

  // Function to handle section approval
  const handleSectionApproval = async (section, isApproved) => {
    try {
      setSectionStatus(prev => ({
        ...prev,
        [section.title]: isApproved ? 'approved' : 'questioned'
      }));

      // Save status to Firestore
      const requestRef = doc(db, 'brd_requests', requestId);
      await updateDoc(requestRef, {
        [`sectionStatus.${section.title}`]: isApproved ? 'approved' : 'questioned',
        updatedAt: serverTimestamp(),
        updatedBy: user.uid,
        updatedByName: profile.namaLengkap
      });

      toast.success(`Status bagian "${section.title}" berhasil diperbarui`);
    } catch (error) {
      console.error('Error updating section status:', error);
      toast.error(`Gagal update status bagian: ${error.message}`);
    }
  };

  // Modify the existing handleGenerateBRD function
  const handleGenerateBRD = async () => {
    try {
      setGenerating(true);
      
      // Gather all generated fields and organize them by section
      const consolidatedContent = {};
      let hasGeneratedContent = false;

      (selectedTemplate?.structure?.sections || request?.templateStructure?.sections || []).forEach(section => {
        if (section.fieldConfigs) {
          consolidatedContent[section.title] = {};
          section.fieldConfigs.forEach(field => {
            if (generatedFields[field.name]) {
              hasGeneratedContent = true;
              consolidatedContent[section.title][field.name] = {
                label: field.label,
                content: typeof generatedFields[field.name] === 'object' 
                  ? generatedFields[field.name].content 
                  : generatedFields[field.name],
                input: typeof generatedFields[field.name] === 'object'
                  ? generatedFields[field.name].originalInput
                  : (formData[field.name] || '')
              };
            }
          });
        }
      });

      if (!hasGeneratedContent) {
        toast.warning('Belum ada konten yang digenerate. Silakan generate konten untuk setiap field terlebih dahulu.');
        return;
      }

      // Create formatted content for preview
      let formattedContent = `# Business Requirements Document\n\n`;
      formattedContent += `Nomor: ${request?.nomorSurat || ''}\n`;
      formattedContent += `Tanggal: ${new Date().toLocaleDateString('id-ID')}\n\n`;

      Object.entries(consolidatedContent).forEach(([sectionTitle, fields]) => {
        formattedContent += `## ${sectionTitle}\n\n`;
        Object.entries(fields).forEach(([fieldName, data]) => {
          formattedContent += `### ${data.label}\n`;
          formattedContent += `${data.content}\n\n`;
        });
      });

      const brdData = {
        content: formattedContent,
        generatedAt: serverTimestamp(),
        generatedBy: {
          uid: user?.uid || null,
          name: profile?.namaLengkap || null,
          role: profile?.role || null
        },
        sections: consolidatedContent,
        version: (request?.consolidatedBRD?.version || 0) + 1
      };

      // Update request document
      const requestRef = doc(db, 'brd_requests', requestId);
      await updateDoc(requestRef, {
        consolidatedBRD: brdData,
        status: 'Pembuatan Dokumen',
        updatedAt: serverTimestamp(),
        updatedBy: user?.uid || null,
        updatedByName: profile?.namaLengkap || null
      });

      // Update local states
      setBrdPreview(brdData);
      setRequest(prev => ({
        ...prev,
        consolidatedBRD: {
          ...brdData,
          generatedAt: new Date() // Use JavaScript Date for local state
        },
        status: 'Pembuatan Dokumen'
      }));

      setActiveTab('preview');
      toast.success('BRD berhasil dibuat dan dapat dilihat di tab Lihat BRD');
    } catch (error) {
      console.error('Error generating BRD:', error);
      toast.error('Gagal membuat BRD: ' + error.message);
    } finally {
      setGenerating(false);
    }
  };

  // Update the formatSectionContent function
  const formatSectionContent = (content, section, fields) => {
    if (!content) return '';

    // Add section description if available
    let formattedContent = section.description 
      ? `${section.description}\n\n${content}`
      : content;

    // Format currency values
    formattedContent = formattedContent.replace(/Rp\s*\d+([.,]\d{3})*/g, match => {
      const number = match.replace(/[^\d]/g, '');
      return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR' }).format(number);
    });

    // Add field references and analysis
    const fieldAnalysis = fields.map(field => {
      const fieldValue = formData[field.name];
      if (!fieldValue) return '';

      let analysis = '';
      switch (field.type) {
        case 'currency':
          const amount = new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR' }).format(fieldValue);
          analysis = `\nAnalisis Dampak Finansial:\n- Nilai: ${amount}\n- Pertimbangan biaya dan manfaat\n- Analisis ROI`;
          break;
        case 'date':
          const date = new Date(fieldValue).toLocaleDateString('id-ID', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
          });
          analysis = `\nAnalisis Timeline:\n- Target: ${date}\n- Milestone dan deliverables\n- Pertimbangan durasi`;
          break;
        default:
          analysis = `\nAnalisis ${field.label}:\n- Dampak bisnis\n- Pertimbangan teknis\n- Rekomendasi`;
      }

      return `\nReferensi ${field.label}:\n${fieldValue}${analysis}`;
    }).filter(Boolean).join('\n\n');

    return formattedContent + (fieldAnalysis ? `\n\n${fieldAnalysis}` : '');
  };

  const exportToWord = () => {
    // Check if user is a Business Analyst
    if (profile?.role !== 'Business Analyst') {
      toast.error('Hanya Business Analyst yang dapat mengekspor dokumen');
      return;
    }

    // Format the content with proper structure and data
    let formattedContent = '';
    if (request?.generatedContent?.info_project) {
      const content = request.generatedContent.info_project;
      formattedContent = content.split('\n').map((line, i) => {
        if (!line.trim()) return '';

        // Section Title (e.g., "1. Introduction")
        if (line.match(/^\d+\.\s+[A-Z]/)) {
          return `
            <div class="section" style="margin-bottom: 25pt; page-break-inside: avoid;">
              <div class="section-header" style="background-color: #f8fafc; padding: 10pt; border-left: 3pt solid #1e40af; margin-bottom: 15pt;">
                <h2 style="font-size: 14pt; font-weight: bold; color: #1e40af; margin: 0;">
                  ${line}
                </h2>
              </div>
            </div>
          `;
        }

        // Subsection Title (e.g., "1.1. Background")
        if (line.match(/^\d+\.\d+\.\s+[A-Z]/)) {
          return `
            <div style="margin: 15pt 0 10pt 0;">
              <h3 style="font-size: 12pt; font-weight: bold; color: #2d3748; margin: 0;">
                ${line}
              </h3>
            </div>
          `;
        }

        // Regular Paragraph
        return `
          <p style="font-size: 11pt; color: #4a5568; margin: 8pt 0; text-align: justify; line-height: 1.5;">
            ${line}
          </p>
        `;
      }).join('');
    }

    // Create document info table
    const documentInfo = `
      <div class="document-info" style="margin: 20pt 0; page-break-inside: avoid;">
        <table style="width: 100%; border-collapse: collapse; border: 1pt solid #e2e8f0;">
          <tr>
            <th colspan="4" style="background-color: #1e40af; color: white; padding: 10pt; text-align: center; font-size: 12pt;">
              INFORMASI DOKUMEN
            </th>
          </tr>
          <tr>
            <td style="width: 25%; padding: 8pt; border: 1pt solid #e2e8f0; background-color: #f8fafc; font-weight: bold;">Nomor Dokumen</td>
            <td style="width: 25%; padding: 8pt; border: 1pt solid #e2e8f0;">${request?.nomorSurat || '-'}</td>
            <td style="width: 25%; padding: 8pt; border: 1pt solid #e2e8f0; background-color: #f8fafc; font-weight: bold;">Tanggal Dibuat</td>
            <td style="width: 25%; padding: 8pt; border: 1pt solid #e2e8f0;">${request?.createdAt ? new Date(request.createdAt.seconds * 1000).toLocaleDateString('id-ID', {
              weekday: 'long',
              year: 'numeric',
              month: 'long',
              day: 'numeric'
            }) : '-'}</td>
          </tr>
          <tr>
            <td style="padding: 8pt; border: 1pt solid #e2e8f0; background-color: #f8fafc; font-weight: bold;">Unit Bisnis</td>
            <td style="padding: 8pt; border: 1pt solid #e2e8f0;">${request?.unitBisnis || '-'}</td>
            <td style="padding: 8pt; border: 1pt solid #e2e8f0; background-color: #f8fafc; font-weight: bold;">Status</td>
            <td style="padding: 8pt; border: 1pt solid #e2e8f0;">${request?.status || '-'}</td>
          </tr>
          <tr>
            <td style="padding: 8pt; border: 1pt solid #e2e8f0; background-color: #f8fafc; font-weight: bold;">Aplikasi</td>
            <td style="padding: 8pt; border: 1pt solid #e2e8f0;">${request?.aplikasiDikembangkan || '-'}</td>
            <td style="padding: 8pt; border: 1pt solid #e2e8f0; background-color: #f8fafc; font-weight: bold;">Fitur</td>
            <td style="padding: 8pt; border: 1pt solid #e2e8f0;">${request?.fiturDikembangkan || '-'}</td>
          </tr>
        </table>
      </div>
    `;

    const header = `
      <div style="text-align: center; margin-bottom: 30pt;">
        <div style="margin-bottom: 20pt;">
          <img src="${bankLogo}" alt="Bank Logo" style="height: 60pt;" />
        </div>
        <div style="border-bottom: 2pt solid #1e40af; padding-bottom: 15pt; margin-bottom: 15pt;">
          <div style="font-size: 16pt; font-weight: bold; color: #1e40af; margin-bottom: 5pt;">
            PT BANK PEMBANGUNAN DAERAH JAWA TENGAH
          </div>
          <div style="font-size: 24pt; font-weight: bold; color: #1e40af; margin: 15pt 0; text-transform: uppercase;">
            BUSINESS REQUIREMENTS DOCUMENT
          </div>
        </div>
      </div>
    `;

    const tableOfContents = `
      <div class="table-of-contents" style="margin: 30pt 0; page-break-after: always;">
        <h2 style="font-size: 14pt; font-weight: bold; color: #1e40af; margin-bottom: 15pt; text-align: center;">
          DAFTAR ISI
        </h2>
        <div style="padding: 15pt;">
          ${selectedTemplate?.structure?.sections.map((section, index) => `
            <div style="display: flex; justify-content: space-between; margin: 5pt 0; border-bottom: 1pt dotted #e2e8f0; padding: 3pt 0;">
              <span style="font-weight: ${index === 0 ? 'bold' : 'normal'};">
                ${toRomanNumeral(index + 1)}. ${section.title}
              </span>
              <span style="font-weight: ${index === 0 ? 'bold' : 'normal'};">
                ${index + 1}
              </span>
            </div>
          `).join('')}
        </div>
      </div>
    `;

    const signatures = `
      <div style="margin-top: 40pt; page-break-inside: avoid;">
        <h2 style="font-size: 14pt; font-weight: bold; color: #1e40af; margin-bottom: 20pt; text-align: center; text-transform: uppercase;">
          Persetujuan Dokumen
        </h2>
        <table style="width: 100%; border-collapse: collapse;">
          <tr>
            <td style="width: 33.33%; text-align: center; padding: 15pt; vertical-align: top;">
              <div style="font-weight: bold; color: #666666; margin-bottom: 60pt;">Dibuat oleh:</div>
              <div style="border-bottom: 1pt solid #000000; width: 80%; margin: 10pt auto;"></div>
              <div style="font-weight: bold; margin-top: 10pt;">${request?.createdByName || ''}</div>
              <div style="font-size: 9pt; color: #666666; margin-top: 5pt;">${request?.createdAt ? new Date(request.createdAt.seconds * 1000).toLocaleDateString('id-ID', {
                year: 'numeric',
                month: 'long',
                day: 'numeric'
              }) : ''}</div>
            </td>
            <td style="width: 33.33%; text-align: center; padding: 15pt; vertical-align: top;">
              <div style="font-weight: bold; color: #666666; margin-bottom: 60pt;">Diperiksa oleh:</div>
              <div style="border-bottom: 1pt solid #000000; width: 80%; margin: 10pt auto;"></div>
              <div style="font-weight: bold; margin-top: 10pt;">${request?.assignedAnalystName || ''}</div>
              <div style="font-size: 9pt; color: #666666; margin-top: 5pt;">${request?.assignedAt ? new Date(request.assignedAt.seconds * 1000).toLocaleDateString('id-ID', {
                year: 'numeric',
                month: 'long',
                day: 'numeric'
              }) : ''}</div>
            </td>
            <td style="width: 33.33%; text-align: center; padding: 15pt; vertical-align: top;">
              <div style="font-weight: bold; color: #666666; margin-bottom: 60pt;">Disetujui oleh:</div>
              <div style="border-bottom: 1pt solid #000000; width: 80%; margin: 10pt auto;"></div>
              <div style="font-weight: bold; margin-top: 10pt;">${request?.approvedByName || ''}</div>
              <div style="font-size: 9pt; color: #666666; margin-top: 5pt;">${request?.approvedAt ? new Date(request.approvedAt.seconds * 1000).toLocaleDateString('id-ID', {
                year: 'numeric',
                month: 'long',
                day: 'numeric'
              }) : ''}</div>
            </td>
          </tr>
        </table>
      </div>
    `;

    const footer = `
      <div style="margin-top: 40pt; padding-top: 15pt; border-top: 2pt solid #1e40af; text-align: center; font-size: 9pt; color: #666666;">
        <div style="margin: 3pt 0;">PT Bank Pembangunan Daerah Jawa Tengah © ${new Date().getFullYear()}</div>
        <div style="margin: 3pt 0;">Dokumen ini diekspor secara otomatis dari sistem BRD</div>
        <div style="margin: 3pt 0;">Diekspor pada: ${new Date().toLocaleDateString('id-ID', { 
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        })}</div>
      </div>
    `;

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
          <meta charset="UTF-8">
          <title>Business Requirements Document - ${request?.nomorSurat || ''}</title>
        <style>
            @page {
              size: A4;
              margin: 2.54cm;
            }
          body {
              font-family: 'Calibri', sans-serif;
            line-height: 1.6;
              color: #333333;
              margin: 0;
              padding: 0;
            }
            table {
              width: 100%;
              border-collapse: collapse;
              margin: 10pt 0;
            }
            th, td {
              border: 1pt solid #e2e8f0;
              padding: 8pt;
              text-align: left;
            }
            th {
              background-color: #f8fafc;
            font-weight: bold;
              color: #1e40af;
            }
            tr:nth-child(even) {
              background-color: #f8fafc;
            }
            ul, ol {
              margin: 8pt 0;
              padding-left: 20pt;
            }
            li {
              margin: 5pt 0;
            }
            .field-group {
              margin: 12pt 0;
              padding: 8pt;
              background-color: #f8fafc;
              border-radius: 3pt;
            }
            .field-label {
            font-weight: bold;
              color: #1e40af;
              margin-bottom: 3pt;
            }
            .field-value {
              color: #333333;
            }
            @media print {
              body {
                -webkit-print-color-adjust: exact !important;
                print-color-adjust: exact !important;
              }
              .page-break {
                page-break-before: always;
              }
          }
        </style>
      </head>
      <body>
          ${header}
          ${documentInfo}
          ${tableOfContents}
          <div style="margin: 30pt 0;">
            ${formattedContent}
            </div>
          ${signatures}
          ${footer}
      </body>
      </html>
    `;

    const blob = new Blob([htmlContent], { type: 'application/msword' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `BRD_${request?.nomorSurat || 'Document'}.doc`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    toast.success('Dokumen BRD berhasil diekspor ke Word');
  };

  const handleDeleteComment = async (comment) => {
    if (!comment || comment.userId !== user.uid) return;

    try {
      await deleteDoc(doc(db, 'brd_requests', requestId, 'comments', comment.id));
      toast.success('Komentar berhasil dihapus');
      setCommentToDelete(null);
    } catch (error) {
      console.error('Error deleting comment:', error);
      toast.error('Gagal menghapus komentar');
    }
  };

  const handleSaveProgress = async () => {
    try {
      setIsSaving(true);
      const requestRef = doc(db, 'brd_requests', requestId);
      
      await updateDoc(requestRef, {
        formData,
        currentTurn: currentTurn === 'analyst' ? 'requester' : 'analyst',
        savedSections: {
          ...savedSections,
          [currentTurn]: Object.keys(formData).filter(key => formData[key])
        },
        updatedAt: serverTimestamp(),
        updatedBy: user.uid,
        updatedByName: profile.namaLengkap
      });

      setCurrentTurn(currentTurn === 'analyst' ? 'requester' : 'analyst');
      toast.success('Progress berhasil disimpan dan giliran telah diserahkan');
    } catch (error) {
      console.error('Error saving progress:', error);
      toast.error('Gagal menyimpan progress');
    } finally {
      setIsSaving(false);
    }
  };

  const canEdit = () => {
    if (request?.status === 'Selesai') {
      return false;
    }

    if (!profile || !request) return false;

    const isRequester = profile.role === 'Business Requester';
    const isAnalyst = profile.role === 'Business Analyst';
    
    if (isRequester) {
      return request.currentEditor === 'requester' && request.createdBy === user.uid;
    }
    
    if (isAnalyst) {
      return request.currentEditor === 'analyst' && 
             (request.assignedAnalystId === user.uid || request.assignedTo === user.uid);
    }
    
    return false;
  };

  const handleSaveFields = async () => {
    if (!requestId) return;
    
    setIsSaving(true);
    try {
      const requestRef = doc(db, 'brd_requests', requestId);
      await updateDoc(requestRef, {
        savedFields: formData,
        currentEditor: currentEditor === 'analyst' ? 'requester' : 'analyst',
        lastSavedBy: {
          uid: user.uid,
          name: profile.namaLengkap,
          role: profile.role,
          timestamp: serverTimestamp()
        },
        updatedAt: serverTimestamp(),
        updatedBy: user.uid,
        updatedByName: profile.namaLengkap
      });

      setSavedFields(formData);
      setCurrentEditor(currentEditor === 'analyst' ? 'requester' : 'analyst');
      toast.success('Fields saved successfully. Now it\'s ' + (currentEditor === 'analyst' ? 'requester' : 'analyst') + '\'s turn.');
    } catch (error) {
      console.error('Error saving fields:', error);
      toast.error('Failed to save fields');
    } finally {
      setIsSaving(false);
    }
  };

  const exportRequestDetailsToWord = async () => {
    try {
      const doc = new Document({
        sections: [{
          properties: {},
          children: [
            // Header with logo and title
            new Paragraph({
              text: 'PT BANK PEMBANGUNAN DAERAH JAWA TENGAH',
              heading: HeadingLevel.HEADING_1,
              alignment: AlignmentType.CENTER,
              spacing: { after: 200 }
            }),
            new Paragraph({
              text: 'DOKUMEN DETAIL PERMINTAAN BRD',
              heading: HeadingLevel.HEADING_1,
              alignment: AlignmentType.CENTER,
              spacing: { after: 400 }
            }),
            
            // Basic Request Info
            new Paragraph({
              text: 'Informasi Permintaan',
              heading: HeadingLevel.HEADING_2,
              spacing: { before: 400, after: 200 }
            }),
            new Table({
              width: { size: 100, type: WidthType.PERCENTAGE },
              rows: [
                new TableRow({
                  children: [
                    new TableCell({ children: [new Paragraph('Nomor BRD')] }),
                    new TableCell({ children: [new Paragraph(request?.nomorSurat)] })
                  ]
                }),
                new TableRow({
                  children: [
                    new TableCell({ children: [new Paragraph('Status')] }),
                    new TableCell({ children: [new Paragraph(
                      request?.status === 'New' ? 'Baru' :
                      request?.status === 'Generated' ? 'Selesai Dibuat' :
                      request?.status === 'In Review' ? 'Dalam Review' :
                      request?.status === 'Approved' ? 'Disetujui' :
                      request?.status === 'Rejected' ? 'Ditolak' :
                      request?.status || 'Baru'
                    )] })
                  ]
                }),
                new TableRow({
                  children: [
                    new TableCell({ children: [new Paragraph('Nama Aplikasi')] }),
                    new TableCell({ children: [new Paragraph(request?.aplikasiDikembangkan || '-')] })
                  ]
                })
              ]
            }),

            // Requester Information
            new Paragraph({
              text: 'Informasi Pemohon',
              heading: HeadingLevel.HEADING_2,
              spacing: { before: 400, after: 200 }
            }),
            new Table({
              width: { size: 100, type: WidthType.PERCENTAGE },
              rows: [
                new TableRow({
                  children: [
                    new TableCell({ children: [new Paragraph('Nama Lengkap')] }),
                    new TableCell({ children: [new Paragraph(request?.createdByName || '-')] })
                  ]
                }),
                new TableRow({
                  children: [
                    new TableCell({ children: [new Paragraph('Unit Kerja')] }),
                    new TableCell({ children: [new Paragraph(request?.unitBisnis || '-')] })
                  ]
                }),
                new TableRow({
                  children: [
                    new TableCell({ children: [new Paragraph('Tanggal Pengajuan')] }),
                    new TableCell({ 
                      children: [new Paragraph(
                        request?.createdAt?.toDate().toLocaleDateString('id-ID', {
                          day: 'numeric',
                          month: 'long',
                          year: 'numeric'
                        }) || '-'
                      )]
                    })
                  ]
                })
              ]
            }),

            // Development Details
            new Paragraph({
              text: 'Detail Pengembangan',
              heading: HeadingLevel.HEADING_2,
              spacing: { before: 400, after: 200 }
            }),
            new Table({
              width: { size: 100, type: WidthType.PERCENTAGE },
              rows: [
                new TableRow({
                  children: [
                    new TableCell({ children: [new Paragraph('Latar Belakang')] }),
                    new TableCell({ children: [new Paragraph(request?.latarBelakang || '-')] })
                  ]
                }),
                new TableRow({
                  children: [
                    new TableCell({ children: [new Paragraph('Tujuan Pengembangan')] }),
                    new TableCell({ children: [new Paragraph(request?.tujuanPengembangan || '-')] })
                  ]
                }),
                new TableRow({
                  children: [
                    new TableCell({ children: [new Paragraph('Fitur yang Dikembangkan')] }),
                    new TableCell({ children: [new Paragraph(request?.fiturDikembangkan || '-')] })
                  ]
                }),
                new TableRow({
                  children: [
                    new TableCell({ children: [new Paragraph('Manfaat yang Diharapkan')] }),
                    new TableCell({ children: [new Paragraph(request?.manfaatDiharapkan || '-')] })
                  ]
                }),
                new TableRow({
                  children: [
                    new TableCell({ children: [new Paragraph('Risiko Terkait')] }),
                    new TableCell({ children: [new Paragraph(request?.risikoTerkait || '-')] })
                  ]
                })
              ]
            }),

            // Footer
            new Paragraph({
              text: `Dicetak pada: ${new Date().toLocaleDateString('id-ID', {
                day: 'numeric',
                month: 'long',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
              })}`,
              spacing: { before: 400 },
              alignment: AlignmentType.RIGHT
            })
          ]
        }]
      });

      Packer.toBlob(doc).then(blob => {
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `Detail_Permintaan_BRD_${requestId}.docx`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
      });

      toast.success('Detail permintaan berhasil diunduh');
    } catch (error) {
      console.error('Error exporting request details:', error);
      toast.error('Gagal mengunduh detail permintaan');
    }
  };

  const handlePrintRequestDetails = () => {
    const printWindow = window.open('', '_blank');
    
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Detail Permintaan BRD - ${requestId}</title>
          <style>
            @page {
              size: A4;
              margin: 2cm;
            }
            body {
              font-family: Arial, sans-serif;
              line-height: 1.6;
              color: #333;
              margin: 0;
              padding: 20px;
            }
            .header {
              text-align: center;
              margin-bottom: 40px;
              padding-bottom: 20px;
              border-bottom: 2px solid #1a4f7c;
            }
            .bank-name {
              font-size: 24px;
              font-weight: bold;
              color: #1a4f7c;
              margin-bottom: 10px;
            }
            .doc-title {
              font-size: 20px;
              color: #2c5282;
              margin-bottom: 5px;
            }
            .print-date {
              font-size: 12px;
              color: #666;
            }
            .section {
              margin-bottom: 30px;
              break-inside: avoid;
            }
            .section-title {
              font-size: 18px;
              font-weight: bold;
              color: #2c5282;
              margin-bottom: 15px;
              padding-bottom: 5px;
              border-bottom: 1px solid #e2e8f0;
            }
            .info-grid {
              display: grid;
              grid-template-columns: 200px 1fr;
              gap: 10px;
              margin-bottom: 15px;
            }
            .label {
              font-weight: bold;
              color: #4a5568;
            }
            .value {
              color: #2d3748;
            }
            .status-badge {
              display: inline-block;
              padding: 4px 8px;
              border-radius: 4px;
              font-size: 12px;
              font-weight: bold;
            }
            .status-new { background: #ebf8ff; color: #2b6cb0; }
            .status-generated { background: #f0fff4; color: #2f855a; }
            .status-review { background: #fffff0; color: #975a16; }
            .footer {
              margin-top: 40px;
              padding-top: 20px;
              border-top: 1px solid #e2e8f0;
              font-size: 12px;
              color: #666;
              text-align: center;
            }
            @media print {
              body { padding: 0; }
              button { display: none; }
            }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="bank-name">PT BANK PEMBANGUNAN DAERAH JAWA TENGAH</div>
            <div class="doc-title">DETAIL PERMINTAAN BRD</div>
            <div class="print-date">
              Dicetak pada: ${new Date().toLocaleString('id-ID', {
                day: 'numeric',
                month: 'long',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
              })}
            </div>
          </div>

          <div class="section">
            <div class="section-title">Informasi Permintaan</div>
            <div class="info-grid">
              <div class="label">Nomor BRD:</div>
              <div class="value">${request?.nomorSurat}</div>
              <div class="label">Status:</div>
              <div class="value">
                <span class="status-badge ${
                  request?.status === 'New' ? 'status-new' :
                  request?.status === 'Generated' ? 'status-generated' :
                  'status-review'
                }">
                  ${request?.status === 'New' ? 'Baru' :
                    request?.status === 'Generated' ? 'Selesai Dibuat' :
                    request?.status === 'In Review' ? 'Dalam Review' :
                    request?.status === 'Approved' ? 'Disetujui' :
                    request?.status === 'Rejected' ? 'Ditolak' :
                    request?.status || 'Baru'}
                </span>
              </div>
              <div class="label">Nama Aplikasi:</div>
              <div class="value">${request?.aplikasiDikembangkan || '-'}</div>
            </div>
          </div>

          <div class="section">
            <div class="section-title">Informasi Pemohon</div>
            <div class="info-grid">
              <div class="label">Nama Lengkap:</div>
              <div class="value">${request?.createdByName || '-'}</div>
              
              <div class="label">Unit Kerja:</div>
              <div class="value">${request?.unitBisnis || '-'}</div>
              
              <div class="label">Tanggal Pengajuan:</div>
              <div class="value">
                ${request?.createdAt?.toDate().toLocaleDateString('id-ID', {
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric'
                }) || '-'}
              </div>
            </div>
          </div>

          <div class="section">
            <div class="section-title">Detail Pengembangan</div>
            <div class="info-grid">
              <div class="label">Latar Belakang:</div>
              <div class="value">${request?.latarBelakang || '-'}</div>
              
              <div class="label">Tujuan Pengembangan:</div>
              <div class="value">${request?.tujuanPengembangan || '-'}</div>
              
              <div class="label">Fitur yang Dikembangkan:</div>
              <div class="value">${request?.fiturDikembangkan || '-'}</div>
              
              <div class="label">Manfaat yang Diharapkan:</div>
              <div class="value">${request?.manfaatDiharapkan || '-'}</div>
              
              <div class="label">Risiko Terkait:</div>
              <div class="value">${request?.risikoTerkait || '-'}</div>
            </div>
          </div>

          <div class="footer">
            PT Bank Pembangunan Daerah Jawa Tengah © ${new Date().getFullYear()} - Dokumen ini dicetak secara otomatis dari sistem BRD
          </div>

          <script>
            window.onload = function() {
              window.print();
            }
          </script>
        </body>
      </html>
    `);
    
    printWindow.document.close();
  };

  // Add this new function for handling request completion
  const handleCompleteRequest = async () => {
    if (!requestId || !user) return;

    try {
      const requestRef = doc(db, 'brd_requests', requestId);
      
      await updateDoc(requestRef, {
        status: 'Selesai',
        completedAt: serverTimestamp(),
        completedBy: {
          uid: user.uid,
          name: profile.namaLengkap,
          role: profile.role
        },
        updatedAt: serverTimestamp(),
        updatedBy: user.uid,
        updatedByName: profile.namaLengkap
      });

      // Add completion activity to request
      const activityRef = collection(requestRef, 'activities');
      await addDoc(activityRef, {
        type: 'completion',
        description: `BRD telah diselesaikan oleh ${profile.namaLengkap}`,
        timestamp: serverTimestamp(),
        userId: user.uid,
        userName: profile.namaLengkap,
        userRole: profile.role
      });

      toast.success('BRD telah berhasil diselesaikan');
      
      // Refresh request data
      fetchRequest();
    } catch (error) {
      console.error('Error completing request:', error);
      toast.error('Gagal menyelesaikan BRD');
    }
  };

  // Update handleSaveForm function
  const handleSaveForm = async () => {
    try {
      setIsSaving(true);

      // Get all generated content
      const allGeneratedContent = {};
      (selectedTemplate?.structure?.sections || request?.templateStructure?.sections || []).forEach(section => {
        if (section.fieldConfigs) {
          section.fieldConfigs.forEach(field => {
            if (generatedFields[field.name]) {
              if (!allGeneratedContent[section.title]) {
                allGeneratedContent[section.title] = {};
              }
              
              // Extract content and originalInput based on the structure
              const content = typeof generatedFields[field.name] === 'object' 
                ? generatedFields[field.name].content 
                : generatedFields[field.name];
                
              const originalInput = typeof generatedFields[field.name] === 'object'
                ? generatedFields[field.name].originalInput
                : formData[field.name] || null;
              
              allGeneratedContent[section.title][field.name] = {
                content: content,
                generatedAt: serverTimestamp(),
                generatedBy: user?.uid || null,
                generatedByName: profile?.namaLengkap || null,
                fieldType: field?.type || 'text',
                sectionTitle: section.title,
                originalInput: originalInput
              };
            }
          });
        }
      });
      
      // Get current request data to preserve existing fields
      const requestRef = doc(db, 'brd_requests', requestId);
      const currentRequest = await getDoc(requestRef);
      
      if (!currentRequest.exists()) {
        throw new Error('Request not found');
      }

      const currentData = currentRequest.data();
      
      // Merge existing generated fields with new ones
      const mergedGeneratedFields = {
        ...(currentData.generatedFields || {}),
        ...allGeneratedContent
      };

      // Update Firestore
      await updateDoc(requestRef, {
        formData: formData,
        generatedFields: mergedGeneratedFields,
        currentEditor: currentEditor === 'analyst' ? 'requester' : 'analyst',
        lastSavedBy: {
          uid: user?.uid || null,
          name: profile?.namaLengkap || null,
          role: profile?.role || null,
          timestamp: serverTimestamp()
        },
        updatedAt: serverTimestamp(),
        updatedBy: user?.uid || null,
        updatedByName: profile?.namaLengkap || null
      });

      // Reset states
      setHasUnsavedChanges(false);
      setModifiedFields(new Set());
      setCurrentEditor(currentEditor === 'analyst' ? 'requester' : 'analyst');

      // Show success message
      const nextEditor = currentEditor === 'analyst' ? 'Requester' : 'Business Analyst';
      toast.success(`Dokumen berhasil diserahkan ke ${nextEditor}.`);

      // Add activity log
      const activityLogRef = collection(db, 'brd_requests', requestId, 'activityLogs');
      await addDoc(activityLogRef, {
        type: 'TURN_CHANGE',
        fromEditor: currentEditor,
        toEditor: currentEditor === 'analyst' ? 'requester' : 'analyst',
        timestamp: serverTimestamp(),
        performedBy: user?.uid || null,
        performedByName: profile?.namaLengkap || null,
        performedByRole: profile?.role || null,
        details: {
          hasGeneratedContent: Object.keys(allGeneratedContent).length > 0
        }
      });

    } catch (error) {
      console.error('Error saving form:', error);
      toast.error('Gagal menyerahkan dokumen. Silakan coba lagi.');
    } finally {
      setIsSaving(false);
    }
  };

  // Update handleRefreshForm to load generated content
  const handleRefreshForm = async () => {
    try {
      const requestDoc = await getDoc(doc(db, 'brd_requests', requestId));
      if (!requestDoc.exists()) {
        throw new Error('Request not found');
      }
      const requestData = requestDoc.data();
      
      // Update form data
      setFormData(requestData.formData || {});
    
      // Load generated content
      if (requestData.generatedFields) {
        const loadedGeneratedFields = {};
        Object.values(requestData.generatedFields).forEach(section => {
          Object.entries(section).forEach(([fieldName, fieldData]) => {
            // Store both content and original input
            loadedGeneratedFields[fieldName] = {
              content: fieldData.content,
              originalInput: fieldData.originalInput || requestData.formData?.[fieldName] || ''
            };
          });
        });
        setGeneratedFields(loadedGeneratedFields);
      }

      setModifiedFields(new Set());
      setHasUnsavedChanges(false);
      toast.success('Form dan hasil generate berhasil diperbarui');
    } catch (error) {
      console.error('Error refreshing form:', error);
      toast.error('Gagal memperbarui form dan hasil generate');
    }
  };

  const handlePrintBRD = () => {
    // Check if user is a Business Analyst
    if (profile?.role !== 'Business Analyst') {
      toast.error('Hanya Business Analyst yang dapat mencetak dokumen');
      return;
    }

    const printWindow = window.open('', '_blank');
    
    // Parse and format the content properly
    let formattedContent = '';
    if (request?.generatedContent?.info_project) {
      const content = request.generatedContent.info_project;
      formattedContent = content.split('\n').map((line, i) => {
        if (!line.trim()) return '';

        // Main Section Title (e.g., "1. Introduction")
        if (line.match(/^\d+\.\s+[A-Z]/)) {
          return `
            <div class="main-section">
              <div class="section-header">
                <span class="section-number">${line.split('.')[0]}</span>
                <h2>${line.split('.')[1].trim()}</h2>
              </div>
            </div>
          `;
        }

        // Subsection Title (e.g., "1.1. Background")
        if (line.match(/^\d+\.\d+\.\s+[A-Z]/)) {
          return `
            <div class="subsection">
              <h3>
                <span class="subsection-number">${line.split('.').slice(0, 2).join('.')}.</span>
                ${line.split('.').slice(2).join('.').trim()}
              </h3>
            </div>
          `;
        }

        // Sub-subsection Title (e.g., "1.1.1. Context")
        if (line.match(/^\d+\.\d+\.\d+\.\s+[A-Z]/)) {
          return `
            <div class="sub-subsection">
              <h4>
                <span class="sub-subsection-number">${line.split('.').slice(0, 3).join('.')}.</span>
                ${line.split('.').slice(3).join('.').trim()}
              </h4>
            </div>
          `;
        }

        // Bullet Points
        if (line.trim().startsWith('-') || line.trim().startsWith('•')) {
          return `
            <div class="bullet-point">
              <span class="bullet">•</span>
              <span class="bullet-content">${line.substring(1).trim()}</span>
            </div>
          `;
        }

        // Reference Block
        if (line.toLowerCase().includes('referensi')) {
          return `
            <div class="reference-block">
              <div class="reference-icon">
                <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
                  <path d="M12 6v3m0 0v3m0-3h3m-3 0H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z"/>
                </svg>
              </div>
              <div class="reference-content">${line}</div>
            </div>
          `;
        }

        // Analysis Block
        if (line.toLowerCase().includes('analisis')) {
          return `
            <div class="analysis-block">
              <div class="analysis-icon">
                <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
                  <path d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/>
            </svg>
          </div>
          <div class="analysis-content">${line}</div>
        </div>
          `;
        }

        // Regular Paragraph
        return `<p class="content-paragraph">${line}</p>`;
      }).join('');
    }

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8">
          <title>Business Requirements Document - ${request?.nomorSurat || ''}</title>
          <style>
            @page {
              size: A4;
              margin: 2.54cm;
            }
            
            body {
              font-family: 'Calibri', sans-serif;
              line-height: 1.6;
              color: #1a202c;
              margin: 0;
              padding: 0;
              background: white;
            }

            .container {
              max-width: 210mm;
              margin: 0 auto;
              padding: 20px;
            }

            .header {
              text-align: center;
              margin-bottom: 40px;
              padding-bottom: 20px;
              border-bottom: 2px solid #1e40af;
            }

            .bank-logo {
              height: 60px;
              margin-bottom: 15px;
            }

            .bank-name {
              font-size: 16px;
              font-weight: bold;
              color: #1e40af;
              margin-bottom: 5px;
            }

            .doc-title {
              font-size: 24px;
              font-weight: bold;
              color: #1e40af;
              margin: 15px 0;
              text-transform: uppercase;
            }

            .doc-meta {
              display: grid;
              grid-template-columns: repeat(2, 1fr);
              gap: 15px;
              margin: 20px auto;
              padding: 15px;
              background: #f8fafc;
              border-radius: 8px;
              font-size: 12px;
            }

            .main-section {
              margin: 30px 0;
              page-break-inside: avoid;
            }

            .section-header {
              display: flex;
              align-items: center;
              background: linear-gradient(to right, #f8fafc, white);
              padding: 12px 15px;
              border-left: 4px solid #1e40af;
              margin-bottom: 20px;
            }

            .section-number {
              font-size: 18px;
              font-weight: bold;
              color: #1e40af;
              margin-right: 10px;
            }

            .section-header h2 {
              font-size: 18px;
              font-weight: bold;
              color: #1e40af;
              margin: 0;
            }

            .subsection {
              margin: 20px 0;
              padding-left: 20px;
            }

            .subsection h3 {
              font-size: 14px;
              font-weight: bold;
              color: #2d3748;
              margin: 0 0 10px 0;
            }

            .sub-subsection {
              margin: 15px 0;
              padding-left: 40px;
            }

            .sub-subsection h4 {
              font-size: 12px;
              font-weight: bold;
              color: #4a5568;
              margin: 0 0 8px 0;
            }

            .bullet-point {
              display: flex;
              align-items: start;
              margin: 8px 0;
              padding-left: 40px;
            }

            .bullet {
              color: #4a5568;
              margin-right: 10px;
            }

            .bullet-content {
              flex: 1;
              color: #4a5568;
            }

            .reference-block, .analysis-block {
              display: flex;
              align-items: start;
              margin: 15px 0;
              padding: 12px;
              border-radius: 6px;
            }

            .reference-block {
              background-color: #ebf8ff;
              border-left: 4px solid #4299e1;
            }

            .analysis-block {
              background-color: #e6fffa;
              border-left: 4px solid #38b2ac;
            }

            .reference-icon, .analysis-icon {
              margin-right: 12px;
              padding-top: 2px;
            }

            .reference-content, .analysis-content {
              flex: 1;
              font-size: 12px;
            }

            .content-paragraph {
              font-size: 12px;
              color: #4a5568;
              margin: 12px 0;
              text-align: justify;
              line-height: 1.8;
              padding-left: 40px;
            }

            .signature-section {
              margin-top: 50px;
              page-break-inside: avoid;
            }

            .signature-title {
              font-size: 16px;
              font-weight: bold;
              text-align: center;
              margin-bottom: 30px;
              color: #1e40af;
            }

            .signature-grid {
              display: grid;
              grid-template-columns: repeat(3, 1fr);
              gap: 30px;
            }

            .signature-box {
              text-align: center;
            }

            .signature-role {
              font-size: 12px;
              color: #666;
              margin-bottom: 50px;
            }

            .signature-line {
              width: 80%;
              margin: 10px auto;
              border-bottom: 1px solid #000;
            }

            .signature-name {
              font-size: 12px;
              font-weight: bold;
              margin-top: 5px;
            }

            .signature-date {
              font-size: 10px;
              color: #666;
              margin-top: 5px;
            }

            .footer {
              margin-top: 50px;
              padding-top: 20px;
              border-top: 2px solid #1e40af;
              text-align: center;
              font-size: 10px;
              color: #666;
              page-break-inside: avoid;
            }

            @media print {
              body {
                -webkit-print-color-adjust: exact !important;
                print-color-adjust: exact !important;
              }
              .page-break {
                page-break-before: always;
              }
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <img src="${bankLogo}" alt="Bank Logo" class="bank-logo" />
              <div class="bank-name">PT BANK PEMBANGUNAN DAERAH JAWA TENGAH</div>
              <div class="doc-title">BUSINESS REQUIREMENTS DOCUMENT</div>
              <div class="doc-number">Nomor: ${request?.nomorSurat || ''}</div>
            </div>

            <div class="doc-meta">
              <div>
                <strong>Nomor Dokumen:</strong><br/>
                ${request?.nomorSurat || '-'}
              </div>
              <div>
                <strong>Tanggal Dibuat:</strong><br/>
                ${request?.createdAt ? new Date(request.createdAt.seconds * 1000).toLocaleDateString('id-ID', {
                  weekday: 'long',
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric'
                }) : '-'}
              </div>
              <div>
                <strong>Unit Bisnis:</strong><br/>
                ${request?.unitBisnis || '-'}
              </div>
              <div>
                <strong>Aplikasi:</strong><br/>
                ${request?.aplikasiDikembangkan || '-'}
              </div>
            </div>

            <div class="content">
              ${formattedContent}
            </div>

            <div class="signature-section">
              <div class="signature-title">Persetujuan Dokumen</div>
              <div class="signature-grid">
                <div class="signature-box">
                  <div class="signature-role">Dibuat oleh:</div>
                  <div class="signature-line"></div>
                  <div class="signature-name">${request?.createdByName || ''}</div>
                  <div class="signature-date">${request?.createdAt ? new Date(request.createdAt.seconds * 1000).toLocaleDateString('id-ID', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                  }) : ''}</div>
                </div>
                <div class="signature-box">
                  <div class="signature-role">Diperiksa oleh:</div>
                  <div class="signature-line"></div>
                  <div class="signature-name">${request?.assignedAnalystName || ''}</div>
                  <div class="signature-date">${request?.assignedAt ? new Date(request.assignedAt.seconds * 1000).toLocaleDateString('id-ID', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                  }) : ''}</div>
                </div>
                <div class="signature-box">
                  <div class="signature-role">Disetujui oleh:</div>
                  <div class="signature-line"></div>
                  <div class="signature-name">${request?.approvedByName || ''}</div>
                  <div class="signature-date">${request?.approvedAt ? new Date(request.approvedAt.seconds * 1000).toLocaleDateString('id-ID', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                  }) : ''}</div>
                </div>
              </div>
            </div>

            <div class="footer">
              <div>PT Bank Pembangunan Daerah Jawa Tengah © ${new Date().getFullYear()}</div>
              <div>Dokumen ini dicetak secara otomatis dari sistem BRD</div>
              <div>Dicetak pada: ${new Date().toLocaleDateString('id-ID', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
              })}</div>
            </div>
          </div>

          <script>
            window.onload = function() {
              window.print();
            }
          </script>
        </body>
      </html>
    `);
    
    printWindow.document.close();
  };

  const handlePrint = () => {
    const printWindow = window.open('', '_blank');
    
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>Business Requirement Document</title>
        <style>
          @page {
            size: A4;
            margin: 2cm;
          }
          body {
            font-family: 'Times New Roman', Times, serif;
            font-size: 12pt;
            line-height: 1.5;
            margin: 0;
            padding: 2cm;
          }
          .header {
            text-align: center;
            margin-bottom: 30px;
          }
          .logo {
            width: 150px;
            margin-bottom: 20px;
          }
          .title {
            font-size: 16pt;
            font-weight: bold;
            margin: 20px 0;
          }
          .section {
            margin: 20px 0;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            margin: 20px 0;
          }
          th, td {
            border: 1px solid black;
            padding: 8px;
            text-align: left;
          }
          .signature-section {
            margin-top: 50px;
          }
          .signature-box {
            height: 80px;
          }
          @media print {
            body { padding: 0; }
            button { display: none; }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <img src="${bankLogo}" class="logo" alt="Bank Logo" />
          <div class="title">BUSINESS REQUIREMENT DOCUMENT</div>
          <div>No. BRD: ${request?.noBRD || ''}</div>
          <div>Tanggal: ${formatDate(new Date())}</div>
        </div>

        <div class="section">
          <table>
            <tr>
              <td class="field-label">Tanggal Permintaan</td>
              <td>${formatDate(formData?.tanggalPermintaan)}</td>
            </tr>
            <tr>
              <td class="field-label">Unit Bisnis</td>
              <td>${formData?.unitBisnis || ''}</td>
            </tr>
            <tr>
              <td class="field-label">Nama Pemohon</td>
              <td>${formData?.namaPemohon || ''}</td>
            </tr>
            <tr>
              <td class="field-label">Jabatan Pemohon</td>
              <td>${formData?.jabatanPemohon || ''}</td>
            </tr>
            <tr>
              <td class="field-label">Nama Project</td>
              <td>${formData?.namaProject || ''}</td>
            </tr>
            <tr>
              <td class="field-label">Jenis Permintaan</td>
              <td>${formData?.jenisPermintaan || ''}</td>
            </tr>
            <tr>
              <td class="field-label">Prioritas</td>
              <td>${formData?.prioritas || ''}</td>
            </tr>
            <tr>
              <td class="field-label">Target Implementasi</td>
              <td>${formatDate(formData?.targetImplementasi)}</td>
            </tr>
          </table>
        </div>
        
        ${Object.entries(generatedContent).map(([section, content]) => `
          <div class="section">
            ${content}
          </div>
        `).join('')}

        <div class="signature-section">
          <table>
            <tr>
              <th>Dibuat Oleh</th>
              <th>Diperiksa Oleh</th>
              <th>Disetujui Oleh</th>
            </tr>
            <tr>
              <td class="signature-box"></td>
              <td class="signature-box"></td>
              <td class="signature-box"></td>
            </tr>
            <tr>
              <td>${formData?.dibuatOleh || ''}</td>
              <td>${formData?.diperiksaOleh || ''}</td>
              <td>${formData?.disetujuiOleh || ''}</td>
            </tr>
            <tr>
              <td>${formatDate(formData?.dibuatTanggal)}</td>
              <td>${formatDate(formData?.diperiksaTanggal)}</td>
              <td>${formatDate(formData?.disetujuiTanggal)}</td>
            </tr>
          </table>
        </div>

        <script>
          window.onload = function() {
            window.print();
          }
        </script>
      </body>
      </html>
    `);
    
    printWindow.document.close();
  };

  // Add generateContent function before handleGenerateField
  const generateContent = async (field, formData) => {
    try {
      // Check if API key exists
      const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
      if (!apiKey) {
        throw new Error('Gemini API key is missing. Please check your environment variables.');
      }

      // Create a simple prompt that just processes the input
      const promptContent = `Anda adalah Business Analyst di Bank Jateng.
Input: ${formData[field.name] || 'Belum ada input'}
Field: ${field.label}

Tugas: Berikan output berupa kalimat sederhana yang menjelaskan nilai dari field ${field.label} adalah ${formData[field.name] || 'belum diisi'}.

Format Output:
[Satu kalimat yang menjelaskan nilai field]`;

      // Call Gemini API with simplified parameters
      try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro:generateContent?key=${apiKey}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            contents: [{
              parts: [{
                text: promptContent
              }]
            }],
            generationConfig: {
              temperature: 0.1,
              maxOutputTokens: 100,
              topK: 1,
              topP: 0.1
            }
          })
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error('Gemini API Error Response:', errorText);
          throw new Error(`Gemini API Error (${response.status}): ${errorText}`);
        }

        const data = await response.json();
        if (!data.candidates?.[0]?.content?.parts?.[0]?.text) {
          throw new Error('Format response tidak valid dari Gemini API');
        }

        const generatedText = data.candidates[0].content.parts[0].text;
        console.log('Generated Text:', generatedText);

        return generatedText;

      } catch (apiError) {
        console.error('Gemini API Call Error:', apiError);
        throw new Error(`Error calling Gemini API: ${apiError.message}`);
      }
    } catch (error) {
      console.error('Error in generateContent:', error);
      // Provide more specific error message to the user
      if (error.message.includes('API key is missing')) {
        throw new Error('Konfigurasi API key belum lengkap. Silakan hubungi administrator.');
      } else if (error.message.includes('429')) {
        throw new Error('Terlalu banyak permintaan. Silakan coba lagi dalam beberapa saat.');
      } else if (error.message.includes('403')) {
        throw new Error('Akses ke API ditolak. Silakan periksa konfigurasi API key.');
      } else {
        throw new Error(`Gagal generate konten: ${error.message}`);
      }
    }
  };

  const handleGenerateField = async (section, field) => {
    try {
      setGeneratingField(field.name);
      
      // Log the input data
      console.log('Generating for field:', field.name);
      console.log('Section:', section.title);
      console.log('Current form data:', formData[field.name]);

      const response = await generateContent(field, formData);
      
      // Log the response
      console.log('Generation response:', response);

      if (response) {
        // Create the field key consistently using both section and field identifiers
        const fieldKey = `${section.title || section.id || ''}-${field.name || field.id || ''}`;
        console.log('Generated fieldKey:', fieldKey);

        // Update the generatedFields state with the new content
        setGeneratedFields(prev => {
          const newState = {
            ...prev,
            [fieldKey]: {
              content: response,
              originalInput: formData[field.name] || '',
              timestamp: new Date().toISOString()
            },
            // Also store with just the field name for backward compatibility
            [field.name]: {
              content: response,
              originalInput: formData[field.name] || '',
              timestamp: new Date().toISOString()
            }
          };
          console.log('New generatedFields state:', newState);
          return newState;
        });

        // Save to generation history
        await saveGenerationToHistory({
          sectionId: section.title || section.id || '',
          sectionTitle: section.title || '',
          fieldId: field.name || field.id || '',
          fieldLabel: field.label || field.name || '',
          content: response,
          originalInput: formData[field.name] || ''
        });

        toast.success('Konten berhasil digenerate');
      }
    } catch (error) {
      console.error('Error generating field content:', error);
      toast.error('Gagal generate konten');
    } finally {
      setGeneratingField(null);
    }
  };

  // Add print styles
  useEffect(() => {
    const style = document.createElement('style');
    style.textContent = `
      @media print {
        body * {
          visibility: hidden;
        }
        .prose, .prose * {
          visibility: visible;
        }
        .prose {
          position: absolute;
          left: 0;
          top: 0;
          width: 100%;
          padding: 2cm;
        }
        .prose h1 {
          font-size: 24pt;
          margin-bottom: 1cm;
        }
        .prose h2 {
          font-size: 18pt;
          margin-top: 1cm;
          margin-bottom: 0.5cm;
          page-break-after: avoid;
        }
        .prose h3 {
          font-size: 14pt;
          margin-top: 0.5cm;
          margin-bottom: 0.3cm;
          page-break-after: avoid;
        }
        .prose p {
          font-size: 12pt;
          margin-bottom: 0.3cm;
        }
        .prose strong {
          font-weight: bold;
        }
        @page {
          margin: 2cm;
          size: A4;
        }
      }
    `;
    document.head.appendChild(style);
    return () => document.head.removeChild(style);
  }, []);

  // Add useEffect to load BRD data when component mounts or tab changes
  useEffect(() => {
    if (activeTab === 'preview' && requestId) {
      const loadBRD = async () => {
        try {
          const requestRef = doc(db, 'brd_requests', requestId);
          const requestDoc = await getDoc(requestRef);
          if (requestDoc.exists() && requestDoc.data().consolidatedBRD) {
            setBrdPreview(requestDoc.data().consolidatedBRD);
          }
        } catch (error) {
          console.error('Error loading BRD:', error);
          toast.error('Gagal memuat BRD');
        }
      };
      loadBRD();
    }
  }, [activeTab, requestId]);

  // Add new export function
  const exportConsolidatedBRD = () => {
    if (!request?.consolidatedBRD?.content) {
      toast.error('Tidak ada BRD yang dapat diekspor');
      return;
    }

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
          }
          .header {
            text-align: center;
            margin-bottom: 2cm;
          }
          .content {
            text-align: justify;
          }
          h1 { font-size: 16pt; font-weight: bold; margin: 12pt 0; }
          h2 { font-size: 14pt; font-weight: bold; margin: 10pt 0; }
          h3 { font-size: 12pt; font-weight: bold; margin: 8pt 0; }
          p { margin: 6pt 0; }
          .metadata {
            margin: 1cm 0;
            font-size: 10pt;
            color: #666;
          }
        </style>
      </head>
      <body>
        <div class="Section1">
          <div class="header">
            <img src="${bankLogo}" alt="Bank Logo" style="width: 150px; margin-bottom: 1cm;">
            <h1>PT BANK PEMBANGUNAN DAERAH JAWA TENGAH</h1>
            <h2>BUSINESS REQUIREMENTS DOCUMENT</h2>
            <p>Nomor: ${request?.nomorSurat || ''}</p>
            <p>Generated by: ${request.consolidatedBRD.generatedBy?.name || 'Unknown'}</p>
            <p>Version: ${request.consolidatedBRD.version || 1}</p>
          </div>
          <div class="content">`;

    const postHtml = `
          </div>
          <div class="metadata">
            <p>Generated at: ${new Date().toLocaleString('id-ID')}</p>
            <p>PT Bank Pembangunan Daerah Jawa Tengah © ${new Date().getFullYear()}</p>
          </div>
        </div>
      </body>
    </html>`;

    // Convert markdown to HTML
    const contentHtml = marked.parse(request.consolidatedBRD.content);
    const html = preHtml + contentHtml + postHtml;

    // Convert image to base64
    const canvas = document.createElement('canvas');
    const img = new Image();
    img.src = bankLogo;
    
    img.onload = () => {
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0);
      
      const base64Logo = canvas.toDataURL('image/png');
      const finalHtml = html.replace(bankLogo, base64Logo);
      
      const blob = new Blob(['\ufeff', finalHtml], {
        type: 'application/msword'
      });

      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `BRD_${request?.nomorSurat || 'Document'}_v${request.consolidatedBRD.version || 1}.doc`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast.success('BRD berhasil diekspor ke Word');
    };
  };

  // Add new print function
  const printConsolidatedBRD = () => {
    if (!request?.consolidatedBRD?.content) {
      toast.error('Tidak ada BRD yang dapat dicetak');
      return;
    }

    const printWindow = window.open('', '_blank');
    
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8">
          <title>Business Requirements Document</title>
          <style>
            @page {
              size: A4;
              margin: 2.54cm;
            }
            body {
              font-family: 'Times New Roman', Times, serif;
              font-size: 12pt;
              line-height: 1.6;
              margin: 0;
              padding: 0;
            }
            .header {
              text-align: center;
              margin-bottom: 2cm;
            }
            .logo {
              width: 150px;
              margin-bottom: 1cm;
            }
            .content {
              text-align: justify;
            }
            h1 { font-size: 16pt; font-weight: bold; margin: 12pt 0; }
            h2 { font-size: 14pt; font-weight: bold; margin: 10pt 0; }
            h3 { font-size: 12pt; font-weight: bold; margin: 8pt 0; }
            p { margin: 6pt 0; }
            .metadata {
              margin-top: 2cm;
              padding-top: 1cm;
              border-top: 1px solid #ccc;
              font-size: 10pt;
              color: #666;
              text-align: center;
            }
            @media print {
              body { padding: 0; }
              button { display: none; }
            }
          </style>
        </head>
        <body>
          <div class="header">
            <img src="${bankLogo}" alt="Bank Logo" class="logo">
            <h1>PT BANK PEMBANGUNAN DAERAH JAWA TENGAH</h1>
            <h2>BUSINESS REQUIREMENTS DOCUMENT</h2>
            <p>Nomor: ${request?.nomorSurat || ''}</p>
            <p>Generated by: ${request.consolidatedBRD.generatedBy?.name || 'Unknown'}</p>
            <p>Version: ${request.consolidatedBRD.version || 1}</p>
          </div>
          <div class="content">
            ${marked.parse(request.consolidatedBRD.content)}
          </div>
          <div class="metadata">
            <p>Generated at: ${new Date().toLocaleString('id-ID')}</p>
            <p>PT Bank Pembangunan Daerah Jawa Tengah © ${new Date().getFullYear()}</p>
          </div>
          <script>
            window.onload = function() {
              window.print();
            }
          </script>
        </body>
      </html>
    `);
    
    printWindow.document.close();
  };

  // Add function to fetch generation history
  const fetchGenerationHistory = async (section, field) => {
    try {
      // Create consistent field key using section title and field name
      const fieldKey = `${section.title}-${field.name}`;
      setShowHistoryFor(fieldKey);
      
      // Check if we already have history loaded
      if (generationHistory[fieldKey]) {
        return;
      }
      
      // Check if the request document exists
      const requestDocRef = doc(db, 'brd_requests', requestId);
      const requestDocSnap = await getDoc(requestDocRef);
      
      if (!requestDocSnap.exists()) {
        console.log('Request document does not exist');
        setGenerationHistory(prev => ({
          ...prev,
          [fieldKey]: []
        }));
        return;
      }
      
      // Fetch history from Firestore
      const historyRef = collection(db, 'brd_requests', requestId, 'generation_history');
      const q = query(
        historyRef, 
        where('fieldKey', '==', fieldKey),
        orderBy('timestamp', 'desc'),
        limit(5)
      );
      
      try {
        const historySnap = await getDocs(q);
        const history = [];
        
        historySnap.forEach(doc => {
          history.push({
            id: doc.id,
            ...doc.data(),
            timestamp: doc.data().timestamp?.toDate() || new Date()
          });
        });
        
        setGenerationHistory(prev => ({
          ...prev,
          [fieldKey]: history
        }));
      } catch (error) {
        console.error('Error in query execution:', error);
        setGenerationHistory(prev => ({
          ...prev,
          [fieldKey]: []
        }));
        
        if (error.code === 'permission-denied') {
          toast.error('Tidak memiliki izin untuk mengakses riwayat generasi');
        }
      }
    } catch (error) {
      console.error('Error fetching generation history:', error);
      toast.error('Gagal memuat riwayat generasi');
    }
  };

  // Add function to save current generation to history
  const saveGenerationToHistory = async (data) => {
    try {
      const {
        sectionId,
        sectionTitle,
        fieldId,
        fieldLabel,
        content,
        originalInput
      } = data;

      if (!sectionId || !fieldId) {
        console.warn('Missing required fields for generation history:', { sectionId, fieldId });
        return;
      }

      // Ensure all string fields have valid values
      const sanitizedData = {
        sectionId: String(sectionId),
        sectionTitle: String(sectionTitle || ''),
        fieldId: String(fieldId),
        fieldLabel: String(fieldLabel || fieldId),
        content: String(content || ''),
        originalInput: String(originalInput || '')
      };

      const fieldKey = `${sanitizedData.sectionId}-${sanitizedData.fieldId}`;
      
      // Save to Firestore
      try {
        const historyRef = collection(db, 'brd_requests', requestId, 'generation_history');
        await addDoc(historyRef, {
          fieldKey,
          ...sanitizedData,
          timestamp: serverTimestamp(),
          savedBy: {
            uid: user?.uid || '',
            name: profile?.namaLengkap || '',
            role: profile?.role || ''
          }
        });
        
        // Update local history state
        const newHistoryItem = {
          id: 'temp-' + Date.now(),
          fieldKey,
          ...sanitizedData,
          timestamp: new Date(),
          savedBy: {
            uid: user?.uid || '',
            name: profile?.namaLengkap || '',
            role: profile?.role || ''
          }
        };
        
        setGenerationHistory(prev => ({
          ...prev,
          [fieldKey]: [newHistoryItem, ...(prev[fieldKey] || [])]
        }));
        
        toast.success('Hasil generasi berhasil disimpan');
      } catch (error) {
        console.error('Error saving to Firestore:', error);
        
        if (error.code === 'permission-denied') {
          toast.error('Tidak memiliki izin untuk menyimpan riwayat generasi. Silakan hubungi administrator.');
        } else {
          toast.error('Gagal menyimpan ke database. Coba lagi nanti.');
        }
        
        // Still update local state even if Firestore save fails
        const newHistoryItem = {
          id: 'local-' + Date.now(),
          fieldKey,
          ...sanitizedData,
          timestamp: new Date(),
          savedBy: {
            uid: user?.uid || '',
            name: profile?.namaLengkap || '',
            role: profile?.role || ''
          },
          isLocalOnly: true
        };
        
        setGenerationHistory(prev => ({
          ...prev,
          [fieldKey]: [newHistoryItem, ...(prev[fieldKey] || [])]
        }));
      }
    } catch (error) {
      console.error('Error saving generation to history:', error);
      toast.error('Gagal menyimpan hasil generasi');
    }
  };

  // Add function to use a previous generation
  const usePreviousGeneration = (historyItem) => {
    if (!historyItem) return;
    
    const { fieldKey, content } = historyItem;
    
    // Get the current input value for this field
    const currentInputValue = formData[fieldKey] || '';
    
    // Update the generated fields state
    setGeneratedFields(prev => {
      // Check if we already have a structure for this field
      const existingField = prev[fieldKey];
      const originalInput = existingField && typeof existingField === 'object' 
        ? existingField.originalInput || currentInputValue
        : currentInputValue;
        
      return {
        ...prev,
        [fieldKey]: {
          content,
          originalInput,
          metadata: {
            ...(existingField && typeof existingField === 'object' ? existingField.metadata : {}),
            usedFromHistory: true,
            originalTimestamp: historyItem.timestamp
          }
        }
      };
    });
    
    // Save to cookies with the updated structure
    saveGeneratedContentToCookies(fieldKey, {
      content,
      originalInput: formData[fieldKey] || '',
      metadata: {
        generatedBy: historyItem.savedBy,
        usedFromHistory: true,
        originalTimestamp: historyItem.timestamp
      }
    });
    
    setShowHistoryFor(null);
    toast.success('Hasil generasi sebelumnya berhasil digunakan');
  };

  // Add function to save generated content to cookies
  const saveGeneratedContentToCookies = (fieldKey, data) => {
    try {
      // Create a cookie name based on the request ID and field key
      const cookieName = `generated_${requestId}_${fieldKey}`;
      
      // Add timestamp to the data
      const dataWithTimestamp = {
        ...data,
        savedAt: new Date().toISOString()
      };
      
      // Save to cookie with 7 days expiry
      cookie.save(cookieName, dataWithTimestamp, {
        path: '/',
        maxAge: 7 * 24 * 60 * 60, // 7 days
        secure: true
      });
    } catch (error) {
      console.error('Error saving to cookies:', error);
      // Continue without error - cookies are non-critical
    }
  };

  useEffect(() => {
    const loadGeneratedContent = async () => {
      try {
        if (!requestId) return;
        
        const requestRef = doc(db, 'brd_requests', requestId);
        const requestDoc = await getDoc(requestRef);
        
        if (requestDoc.exists()) {
          const data = requestDoc.data();
          
          // Load generated fields if they exist
          if (data.generatedFields) {
            const loadedGeneratedFields = {};
            
            // Iterate through sections
            Object.entries(data.generatedFields).forEach(([sectionTitle, sectionData]) => {
              // Iterate through fields in each section
              Object.entries(sectionData).forEach(([fieldName, fieldData]) => {
                // Create consistent field key
                const fieldKey = `${sectionTitle}-${fieldName}`;
                
                // Store with both the field key and the field name for backward compatibility
                loadedGeneratedFields[fieldKey] = {
                  content: fieldData.content,
                  originalInput: fieldData.originalInput || '',
                  timestamp: fieldData.generatedAt
                };
                
                loadedGeneratedFields[fieldName] = {
                  content: fieldData.content,
                  originalInput: fieldData.originalInput || '',
                  timestamp: fieldData.generatedAt
                };
              });
            });
            
            console.log('Loaded generated fields:', loadedGeneratedFields);
            setGeneratedFields(loadedGeneratedFields);
          }

          // Load consolidated BRD if it exists
          if (data.consolidatedBRD) {
            setGeneratedBRD(data.consolidatedBRD);
          }
        }
      } catch (error) {
        console.error('Error loading generated content:', error);
        if (error.code === 'permission-denied') {
          toast.error('Anda tidak memiliki akses untuk melihat konten yang di-generate');
        } else {
          toast.error('Gagal memuat konten yang di-generate');
        }
      }
    };

    loadGeneratedContent();
  }, [requestId]);

  // Add this helper function at the top of the component
  const getGeneratedContent = (section, field) => {
    // Create the field key consistently
    const fieldKey = `${section.title || section.id || ''}-${field.name || field.id || ''}`;
    
    // First try to get content directly from generatedFields using the fieldKey
    if (generatedFields[fieldKey]?.content) {
      return generatedFields[fieldKey].content;
    }
    
    // If not found with fieldKey, try to get from section data
    if (request?.generatedFields?.[section.title]?.[field.name]?.content) {
      return request.generatedFields[section.title][field.name].content;
    }
    
    // If still not found, try with just the field name
    if (generatedFields[field.name]?.content) {
      return generatedFields[field.name].content;
    }
    
    // If no content is found, return empty string
    return '';
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
        newestOnTop={false}
        closeOnClick
        rtl={false}
        pauseOnFocusLoss
        draggable
        pauseOnHover
      />
      {/* Header */}
      <div className="bg-gradient-to-r from-white to-blue-50 rounded-2xl shadow-lg p-6 mb-6">
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
          <div className="flex items-start space-x-4">
            <div className="h-14 w-14 rounded-full bg-gradient-to-br from-blue-600 to-blue-700 flex items-center justify-center shadow-md">
              <span className="text-white font-bold text-xl">
                  {request?.namaProject?.charAt(0).toUpperCase() || 'P'}
                </span>
              </div>
          <div>
              <h1 className="text-2xl font-bold text-gray-900 mb-2">{request?.namaProject}</h1>
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center space-x-2">
                  <span className="text-gray-500">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </span>
                  <span className="text-sm font-medium text-gray-700">BRD No: {request?.nomorSurat}</span>
                </div>
                <div className="h-4 w-px bg-gray-300"></div>
                <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium
                  ${request?.status === 'New' ? 'bg-blue-100 text-blue-800' :
                  request?.status === 'Pending Review' ? 'bg-amber-100 text-amber-800' :
                  request?.status === 'In Progress' ? 'bg-indigo-100 text-indigo-800' :
                  request?.status === 'Generated' ? 'bg-emerald-100 text-emerald-800' :
                    'bg-gray-100 text-gray-800'}`}>
                  {request?.status === 'New' ? 'Baru' :
                   request?.status === 'Pending Review' ? 'Menunggu Review' :
                   request?.status === 'In Progress' ? 'Sedang Diproses' :
                   request?.status === 'Generated' ? 'Selesai Dibuat' :
                   request?.status === 'In Review' ? 'Dalam Review' :
                   request?.status === 'Approved' ? 'Disetujui' :
                   request?.status === 'Rejected' ? 'Ditolak' :
                   request?.status || 'Baru'}
                  </span>
          </div>
              </div>
            </div>
          
          <div className="flex items-center space-x-4">
            {/* Complete Button */}
            {profile.role === 'Business Analyst' && 
             (request?.status === 'Pembuatan Dokumen' || request?.status === 'Sedang Diproses') && 
             request?.currentEditor !== 'requester' && (
              <button
                onClick={() => {
                  if (window.confirm('Apakah Anda yakin ingin menyelesaikan BRD ini? Status akan diubah menjadi Selesai.')) {
                    handleCompleteRequest();
                  }
                }}
                className="inline-flex items-center px-6 py-3 bg-gradient-to-r from-green-600 to-green-500 rounded-lg shadow-md text-white font-medium hover:from-green-700 hover:to-green-600 transform hover:scale-105 transition-all duration-200"
              >
                <svg className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Selesaikan BRD
              </button>
            )}

            
            {request?.lastUpdated && (
              <div className="text-right">
                <p className="text-sm text-gray-500">Terakhir diperbarui</p>
                <p className="text-sm font-medium text-gray-900">
                  {new Date(request.lastUpdated.toDate()).toLocaleDateString('id-ID', {
                    day: 'numeric',
                    month: 'long',
            year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                  })}
                </p>
              </div>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mt-6">
          <div className="bg-white p-4 rounded-xl shadow-sm">
            <h3 className="text-sm font-medium text-gray-500 mb-2">Pemohon</h3>
            <p className="text-base font-semibold text-gray-900">{request?.createdByName}</p>
            <p className="text-sm text-gray-600">{request?.unitBisnis}</p>
          </div>
          
          <div className="bg-white p-4 rounded-xl shadow-sm">
            <h3 className="text-sm font-medium text-gray-500 mb-2">Business Analyst</h3>
            <p className="text-base font-semibold text-gray-900">{request?.assignedAnalystName || 'Belum ditugaskan'}</p>
            <p className="text-sm text-gray-600">{profile?.unitBisnis|| '-'}</p>
          </div>
          
          <div className="bg-white p-4 rounded-xl shadow-sm">
            <h3 className="text-sm font-medium text-gray-500 mb-2">Aplikasi</h3>
            <p className="text-base font-semibold text-gray-900">{request?.aplikasiDikembangkan || '-'}</p>
            <p className="text-sm text-gray-600">{request?.nomorSurat|| '-'}</p>
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
              <span>Detail Permintaan</span>
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
              <span>Buat DraftBRD</span>
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
                <span>Lihat BRD</span>
              </button>
            )}
            <button
              onClick={() => {
                setActiveTab('discussion');
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
              <span>Diskusi</span>
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
            <div className="space-y-8">
              {/* Request Details Card */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="px-6 py-5 border-b border-gray-200">
                  <div className="flex justify-between items-center">
                    <div className="flex items-center space-x-4">
                      <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-blue-600 to-blue-700 flex items-center justify-center shadow-lg">
                        <span className="text-white font-bold text-xl">
                          {request?.namaProject?.charAt(0).toUpperCase() || 'P'}
              </span>
                      </div>
                      <div>
                        <h3 className="text-xl font-semibold text-gray-900">Request Details</h3>
                        <p className="text-sm text-gray-500 mt-0.5">BRD Request #{requestId?.slice(-6)}</p>
                      </div>
                      {profile.role === 'Business Analyst' && (
                      <div className="flex items-center space-x-3">
                        <button
                          onClick={exportRequestDetailsToWord}
                          className="inline-flex items-center px-4 py-2.5 border border-blue-600 rounded-lg shadow-sm text-sm font-medium text-blue-600 bg-white hover:bg-blue-50 hover:shadow transition-all duration-200 group"
                        >
                          <svg className="h-5 w-5 mr-2 text-blue-500 group-hover:text-blue-600 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                          </svg>
                          Ekspor ke Word
                        </button>
                        <button
                          onClick={handlePrintRequestDetails}
                          className="inline-flex items-center px-4 py-2.5 border border-gray-300 rounded-lg shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 hover:border-gray-400 hover:shadow transition-all duration-200 group"
                        >
                          <svg className="h-5 w-5 mr-2 text-gray-400 group-hover:text-gray-500 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                          </svg>
                          Cetak Dokumen
                        </button>
                      </div>
                    )}
                    </div>
                  </div>
                </div>
                <div className="p-6">
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    {/* Project Information */}
                    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden hover:shadow-md transition-shadow duration-200">
                      <div className="px-6 py-4 bg-gradient-to-r from-blue-50 to-white border-b border-gray-200">
                        <div className="flex items-center space-x-2">
                          <div className="p-2 bg-blue-100 rounded-lg">
                            <svg className="h-5 w-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                          </div>
                          <h3 className="text-lg font-medium text-gray-900">Informasi Proyek</h3>
                        </div>
                      </div>
                      <div className="px-6 py-4 space-y-6">
                        <div>
                          <label className="block text-sm font-medium text-gray-500 mb-1.5">Nama Aplikasi</label>
                          <p className="text-base text-gray-900 font-medium">{request?.aplikasiDikembangkan || '-'}</p>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-500 mb-1.5">Nomor BRD</label>
                          <p className="text-base text-gray-900 font-medium">{request?.nomorSurat || '-'}</p>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-500 mb-1.5">Fitur yang Dikembangkan</label>
                          <div className="bg-gray-50 rounded-lg p-3">
                            <p className="text-base text-gray-900 whitespace-pre-wrap">{request?.fiturDikembangkan || '-'}</p>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Requester Information */}
                    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden hover:shadow-md transition-shadow duration-200">
                      <div className="px-6 py-4 bg-gradient-to-r from-green-50 to-white border-b border-gray-200">
                        <div className="flex items-center space-x-2">
                          <div className="p-2 bg-green-100 rounded-lg">
                            <svg className="h-5 w-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                            </svg>
                          </div>
                          <h3 className="text-lg font-medium text-gray-900">Requester Information</h3>
                        </div>
                      </div>
                      <div className="px-6 py-4 space-y-6">
                        <div className="flex items-start space-x-4">
                          <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-green-100 to-green-200 flex items-center justify-center overflow-hidden">
                            {profile?.photoURL ? (
                              <img 
                                src={profile.photoURL} 
                                alt={profile.namaLengkap} 
                                className="h-full w-full object-cover"
                              />
                            ) : (
                              <span className="text-green-700 font-semibold text-lg">
                                {request?.createdByName?.charAt(0).toUpperCase()}
              </span>
                            )}
            </div>
                          <div>
                            <p className="text-base text-gray-900 font-medium">{request?.createdByName}</p>
                            <p className="text-sm text-gray-500">{request?.unitBisnis}</p>
                            <p className="text-sm text-gray-500">{request?.createdByEmail}</p>
        </div>
      </div>
                        <div className="pt-4 border-t border-gray-100">
                          <label className="block text-sm font-medium text-gray-500 mb-1.5">Contact Information</label>
                          <div className="space-y-2">
                            <div className="flex items-center space-x-2">
                              <svg className="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                              </svg>
                              <p className="text-base text-gray-900">{profile?.noTelp || '-'}</p>
                            </div>
                            <div className="flex items-center space-x-2">
                              <svg className="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                              </svg>
                              <p className="text-base text-gray-900">{request?.createdByEmail || profile?.email || '-'}</p>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Development Information */}
                    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden lg:col-span-2 hover:shadow-md transition-shadow duration-200">
                      <div className="px-6 py-4 bg-gradient-to-r from-purple-50 to-white border-b border-gray-200">
                        <div className="flex items-center space-x-2">
                          <div className="p-2 bg-purple-100 rounded-lg">
                            <svg className="h-5 w-5 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                            </svg>
      </div>
                          <h3 className="text-lg font-medium text-gray-900">Development Information</h3>
                        </div>
                      </div>
                      <div className="px-6 py-4 space-y-6">
                        <div className="grid grid-cols-1  md:grid-cols-1 gap-6">
                          <div>
                            <label className="block text-sm font-medium text-gray-500 mb-1.5">Background</label>
                            <div className="bg-gray-50 rounded-lg p-3">
                              <p className="text-base text-gray-900 whitespace-pre-wrap">{request?.latarBelakang || '-'}</p>
                            </div>
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-500 mb-1.5">Development Goals</label>
                            <div className="bg-gray-50 rounded-lg p-3">
                              <p className="text-base text-gray-900 whitespace-pre-wrap">{request?.tujuanPengembangan || '-'}</p>
                            </div>
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-500 mb-1.5">Expected Benefits</label>
                            <div className="bg-gray-50 rounded-lg p-3">
                              <p className="text-base text-gray-900 whitespace-pre-wrap">{request?.manfaatDiharapkan || '-'}</p>
                            </div>
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-500 mb-1.5">Related Risks</label>
                            <div className="bg-gray-50 rounded-lg p-3">
                              <p className="text-base text-gray-900 whitespace-pre-wrap">{request?.risikoTerkait || '-'}</p>
                            </div>
                          </div>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-500 mb-1.5">Implementation Strategy</label>
                          <div className="bg-gray-50 rounded-lg p-3">
                            <p className="text-base text-gray-900 whitespace-pre-wrap">{request?.strategiPelaksanaan || '-'}</p>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Status Information */}
                    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden lg:col-span-2 hover:shadow-md transition-shadow duration-200">
                      <div className="px-6 py-4 bg-gradient-to-r from-yellow-50 to-white border-b border-gray-200">
                        <div className="flex items-center space-x-2">
                          <div className="p-2 bg-yellow-100 rounded-lg">
                            <svg className="h-5 w-5 text-yellow-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                          </div>
                          <h3 className="text-lg font-medium text-gray-900">Status Information</h3>
                        </div>
                      </div>
                      <div className="px-6 py-4 space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-1 gap-6">
                          <div>
                            <label className="block text-sm font-medium text-gray-500 mb-1.5">Status</label>
                            <p className="mt-1">
                              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium
                                ${request?.status === 'New' ? 'bg-blue-100 text-blue-800' :
                                request?.status === 'Pending Review' ? 'bg-amber-100 text-amber-800' :
                                request?.status === 'Sedang Diproses' ? 'bg-indigo-100 text-indigo-800' :
                                request?.status === 'Pembuatan Dokumen' ? 'bg-emerald-100 text-emerald-800' :
                                request?.status === 'Selesai' ? 'bg-green-100 text-green-800' :
                                'bg-gray-100 text-gray-800'}`}>
                                {request?.status === 'New' ? 'Baru' :
                                 request?.status === 'Pending Review' ? 'Menunggu Review' :
                                 request?.status === 'Sedang Diproses' ? 'Sedang Diproses' :
                                 request?.status === 'Pembuatan Dokumen' ? 'Pembuatan Dokumen' :
                                 request?.status === 'Selesai' ? 'Selesai' :
                                 request?.status === 'In Review' ? 'Dalam Review' :
                                 request?.status === 'Approved' ? 'Disetujui' :
                                 request?.status === 'Rejected' ? 'Ditolak' :
                                 request?.status || 'Baru'}
                              </span>
                            </p>
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-500 mb-1.5">Submission Date</label>
                            <p className="text-base text-gray-900">
                              {request?.createdAt?.toDate().toLocaleDateString('id-ID', {
                                day: 'numeric',
          month: 'long',
                                year: 'numeric'
                              })}
                            </p>
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-500 mb-1.5">Last Updated</label>
                            <p className="text-base text-gray-900">
                              {request?.updatedAt?.toDate().toLocaleDateString('id-ID', {
          day: 'numeric',
                                month: 'long',
                                year: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
                              })}
                            </p>
      </div>
                          {request?.assignedTo && (
                            <div>
                              <label className="block text-sm font-medium text-gray-500 mb-1.5">Business Analyst</label>
                              <p className="text-base text-gray-900">{request?.assignedAnalystName}</p>
                            </div>
                          )}
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-500 mb-1.5">Progress Timeline</label>
                          <div className="flex items-center space-x-4">
                            <div className="flex-1 h-2 bg-gray-200 rounded-full">
                              <div className={`h-2 rounded-full ${request?.status === 'New' ? 'bg-blue-500' : request?.status === 'Generated' ? 'bg-green-500' : request?.status === 'In Review' ? 'bg-yellow-500' : request?.status === 'Approved' ? 'bg-green-500' : request?.status === 'Rejected' ? 'bg-red-500' : 'bg-gray-500'}`} style={{ width: `${request?.status === 'New' ? '20%' : request?.status === 'Generated' ? '40%' : request?.status === 'In Review' ? '60%' : request?.status === 'Approved' ? '100%' : request?.status === 'Rejected' ? '100%' : '0%'}` }}></div>
                            </div>
                            <div className="flex items-center space-x-2">
                              <div className={`h-4 w-4 rounded-full ${request?.status === 'New' ? 'bg-blue-500' : request?.status === 'Generated' ? 'bg-green-500' : request?.status === 'In Review' ? 'bg-yellow-500' : request?.status === 'Approved' ? 'bg-green-500' : request?.status === 'Rejected' ? 'bg-red-500' : 'bg-gray-500'}`}></div>
                              <span className="text-sm font-medium text-gray-900">{request?.status}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                          </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'generate' && (
            <div className="space-y-8">
              {/* Template Selection - Only visible to analysts when no template is selected */}
              {!request?.templateId && !selectedTemplate && profile.role === 'Business Analyst' ? (
                <div>
                  <div className="flex items-center justify-between mb-6">
                    <div>
                      <h3 className="text-lg font-medium text-gray-900">Pilih Template</h3>
                      <p className="mt-1 text-sm text-gray-500">Pilih template untuk membuat Dokumen Kebutuhan Bisnis.</p>
            </div>
                    <div className="text-sm text-gray-500">
                      {templates.length} {templates.length === 1 ? 'template tersedia' : 'template tersedia'}
                    </div>
                  </div>
                  {/* Template selection grid */}
                  <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
                    {templates.map(template => (
                      <div
                        key={template.id}
                        onClick={() => handleTemplateSelect(template)}
                        className={`relative group rounded-xl border-2 ${
                          selectedTemplate?.id === template.id
                            ? 'border-blue-500 ring-4 ring-blue-100'
                            : 'border-gray-200 hover:border-blue-500 hover:shadow-lg'
                        } bg-white p-6 transition-all duration-200 cursor-pointer transform hover:-translate-y-1`}
                      >
                        <div className="flex items-start space-x-4">
                          <div className="flex-shrink-0">
                            <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-blue-50 to-blue-100 text-blue-600 flex items-center justify-center shadow-sm group-hover:shadow-md transition-all">
                              <svg className="h-6 w-6 transform group-hover:scale-110 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                              </svg>
                            </div>
                          </div>
                          <div className="flex-1 min-w-0">
                            <h4 className="text-lg font-semibold text-gray-900 group-hover:text-blue-600 transition-colors line-clamp-2">
                              {template.name}
                            </h4>
                            <p className="mt-1 text-sm text-gray-500 line-clamp-3">{template.description}</p>
                            <div className="mt-4 flex items-center space-x-4 text-sm">
                              <div className="flex items-center px-2.5 py-1 rounded-full bg-blue-50 text-blue-700">
                                <svg className="w-4 h-4 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
                                </svg>
                                <span className="font-medium">{template.structure?.sections?.length || 0} bagian</span>
                              </div>
                              <div className="flex items-center px-2.5 py-1 rounded-full bg-green-50 text-green-700">
                                <svg className="w-4 h-4 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 14v6m-3-3h6M6 10h2a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v2a2 2 0 002 2zm10 0h2a2 2 0 002-2V6a2 2 0 00-2-2h-2a2 2 0 00-2 2v2a2 2 0 002 2z" />
                                </svg>
                                <span className="font-medium">
                                  {template.structure?.sections?.reduce(
                                    (total, section) => total + (section.fieldConfigs?.length || 0),
                                    0
                                  ) || 0} kolom
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                        <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
                          <div className="p-2 rounded-full bg-blue-500 text-white transform rotate-45">
                            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (!request?.templateId && !selectedTemplate && profile.role !== 'Business Analyst') ? (
                <div className="text-center py-12 bg-gray-50 rounded-xl border-2 border-dashed border-gray-300">
                  <div className="mx-auto h-20 w-20 flex items-center justify-center rounded-full bg-blue-100">
                    <svg className="h-10 w-10 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                  </div>
                  <h3 className="mt-4 text-xl font-medium text-gray-900">Menunggu Pemilihan Template</h3>
                  <p className="mt-2 text-sm text-gray-500 max-w-md mx-auto">
                    Mohon tunggu Business Analyst untuk memilih template yang sesuai untuk permintaan BRD ini.
                  </p>
                </div>
              ) : (selectedTemplate || request?.templateId) && (
                <div className="space-y-8">
                  {/* Show selected template info */}
                  <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm hover:shadow-md transition-all duration-200">
                    <div className="flex justify-between items-center">
                    <div className="flex items-center space-x-4">
                        <div className="h-14 w-14 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 text-white flex items-center justify-center shadow-md">
                          <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                      </div>
                      <div>
                          <h3 className="text-xl font-semibold text-gray-900">{selectedTemplate?.name || request?.templateName}</h3>
                          <p className="text-sm text-gray-500 mt-1">{selectedTemplate?.description || request?.templateDescription}</p>
                      </div>
                    </div>
                    {profile.role === 'Business Analyst' && (
                    <button
                      onClick={handleChangeTemplate}
                          className="inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-lg text-gray-700 bg-white hover:bg-gray-50 hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-all duration-200"
                    >
                          <svg className="h-4 w-4 mr-2 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                      Ganti Template
                    </button>
                    )}
                    </div>
                  </div>

                  {/* Template Fields Form */}
                  <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                    <div className="p-6">
                      <div className="flex justify-between items-center mb-6">
                        <div className="flex items-center space-x-3">
                          <h4 className="text-lg font-medium text-gray-900">Form Template</h4>
                          <span className={`inline-flex items-center px-3 py-1.5 rounded-full text-sm font-medium ${
                            request?.currentEditor === 'analyst' ? 'bg-gradient-to-r from-blue-100 to-blue-200 text-blue-800 shadow-sm' : 'bg-gradient-to-r from-green-100 to-green-200 text-green-800 shadow-sm'
                          }`}>
                            Editor: {request?.currentEditor === 'analyst' ? 'Business Analyst' : 'Requester'}
                            </span>
                        </div>
                      </div>

                      {/* Enhanced instruction panel with better visual hierarchy */}
                      <div className="mb-6 bg-gradient-to-r from-blue-50 to-white border-l-4 border-blue-500 rounded-lg overflow-hidden shadow-sm">
                        <div className="p-4">
                          <div className="flex">
                            <div className="flex-shrink-0">
                              <div className="p-2 bg-blue-100 rounded-lg">
                                <svg className="h-6 w-6 text-blue-600" viewBox="0 0 24 24" fill="currentColor">
                                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                                </svg>
                              </div>
                            </div>
                            <div className="ml-4 flex-1">
                              <h3 className="text-lg font-semibold text-blue-900 mb-2">Petunjuk Penggunaan Form</h3>
                              <div className="space-y-4">
                                {/* Current Editor Status */}
                                <div className="p-3 bg-white rounded-lg border border-blue-100">
                                  <span className="text-sm font-medium text-blue-800">
                                    Status Editor Saat Ini: {request?.currentEditor === 'analyst' ? 'Business Analyst' : 'Requester'}
                                  </span>
                                </div>

                                {/* Role-specific instructions */}
                                <div className="text-sm text-gray-700 space-y-4">
                                  {profile.role === 'Business Analyst' ? (
                                    <>
                                      <div className="space-y-2">
                                        <p className="font-medium text-blue-900">Sebagai Business Analyst:</p>
                                        <div className="ml-4 space-y-2">
                                          <p className="flex items-center">
                                            <span className="flex-shrink-0 w-6 h-6 flex items-center justify-center rounded-full bg-blue-100 text-blue-600 mr-2">1</span>
                                            Anda dapat mengedit form saat status "Editor: Business Analyst"
                                          </p>
                                          <p className="flex items-center">
                                            <span className="flex-shrink-0 w-6 h-6 flex items-center justify-center rounded-full bg-blue-100 text-blue-600 mr-2">2</span>
                                            Setelah selesai mengisi, klik "Tanyakan & Serahkan" untuk menyimpan dan mengirim ke Requester
                                          </p>
                                          <p className="flex items-center">
                                            <span className="flex-shrink-0 w-6 h-6 flex items-center justify-center rounded-full bg-blue-100 text-blue-600 mr-2">3</span>
                                            Form akan terkunci sampai Requester mengirimkan kembali
                                          </p>
                                        </div>
                                      </div>
                                      
                                      {/* Refresh button instruction */}
                                      <div className="p-3 bg-yellow-50 rounded-lg border border-yellow-200">
                                        <p className="flex items-center text-yellow-800">
                                          <svg className="h-5 w-5 mr-2 text-yellow-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                          </svg>
                                          <strong>Penting:</strong> Klik tombol "Refresh" saat giliran Anda untuk memuat perubahan terbaru dari Requester
                                        </p>
                                      </div>
                                    </>
                                  ) : (
                                    <>
                                      <div className="space-y-2">
                                        <p className="font-medium text-blue-900">Sebagai Requester:</p>
                                        <div className="ml-4 space-y-2">
                                          <p className="flex items-center">
                                            <span className="flex-shrink-0 w-6 h-6 flex items-center justify-center rounded-full bg-blue-100 text-blue-600 mr-2">1</span>
                                            Anda dapat mengedit form saat status "Editor: Requester"
                                          </p>
                                          <p className="flex items-center">
                                            <span className="flex-shrink-0 w-6 h-6 flex items-center justify-center rounded-full bg-blue-100 text-blue-600 mr-2">2</span>
                                            Setelah selesai mengisi, klik "Setujui & Serahkan" untuk menyimpan dan mengirim ke Business Analyst
                                          </p>
                                          <p className="flex items-center">
                                            <span className="flex-shrink-0 w-6 h-6 flex items-center justify-center rounded-full bg-blue-100 text-blue-600 mr-2">3</span>
                                            Form akan terkunci sampai Business Analyst mengirimkan kembali
                                          </p>
                                        </div>
                                      </div>
                                      
                                      {/* Refresh button instruction */}
                                      <div className="p-3 bg-yellow-50 rounded-lg border border-yellow-200">
                                        <p className="flex items-center text-yellow-800">
                                          <svg className="h-5 w-5 mr-2 text-yellow-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                          </svg>
                                          <strong>Penting:</strong> Klik tombol "Refresh" saat giliran Anda untuk memuat perubahan terbaru dari Business Analyst
                                        </p>
                                      </div>
                                    </>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center space-x-4 pb-5">
                            {((request?.currentEditor === 'analyst' && profile.role === 'Business Analyst') ||
                              (request?.currentEditor === 'requester' && profile.role !== 'Business Analyst')) && (
                          <div className="flex items-center space-x-3">
                              <button
                              onClick={handleRefreshForm}
                              className="inline-flex items-center px-4 py-2.5 border border-blue-300 rounded-lg shadow-sm text-sm font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 hover:border-blue-400 hover:shadow focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-all duration-200 group relative"
                            >
                              <svg className="h-4 w-4 mr-1.5 text-blue-600 group-hover:animate-spin" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                              </svg>
                              Refresh Form
                            </button>
                            <button
                              onClick={handleSaveForm}
                              disabled={isSaving} // Remove the hasUnsavedChanges check
                              className={`inline-flex items-center px-6 py-2 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white transition-all duration-200
                                ${isSaving 
                                  ? 'bg-gray-400 cursor-not-allowed' 
                                  : 'bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-700 hover:to-blue-600 focus:ring-2 focus:ring-offset-2 focus:ring-blue-500'}`}
                            >
                              {isSaving ? (
                                <>
                                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                  </svg>
                                  Saving...
                                </>
                              ) : (
                                <>
                                <svg className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
                                </svg>
                                  {profile.role === 'Business Analyst' ? 'Tanyakan & Serahkan' : 'Setujui & Serahkan'}
                                </>
                            )}
                            </button>
                          </div>
                          )}
                        </div>

                      <div className={`space-y-8 ${!canEdit() ? 'opacity-50' : ''}`}>
                        {(selectedTemplate?.structure?.sections || request?.templateStructure?.sections)?.map((section, sectionIndex) => (
                          <div key={sectionIndex} className="bg-white rounded-xl border border-gray-200 overflow-hidden transition-all duration-200 hover:shadow-md">
                            <div className="px-6 py-4 bg-gradient-to-r from-gray-50 to-white border-b border-gray-200">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center space-x-3">
                                  <div className="flex items-center justify-center h-8 w-8 rounded-lg bg-blue-100 text-blue-600">
                                    <span className="text-sm font-semibold">{toRomanNumeral(sectionIndex + 1)}</span>
                                  </div>
                                  <div>
                              <h5 className="text-base font-medium text-gray-900">{section.title}</h5>
                              {section.description && (
                                      <p className="text-sm text-gray-500 mt-0.5">{section.description}</p>
                              )}
                            </div>
                                </div>
                                <span className="text-sm text-gray-500">
                                  {section.fieldConfigs?.length || 0} fields
                                </span>
                              </div>
                            </div>

                            <div className="p-6">
                              <div className="grid grid-cols-1 md:grid-cols-1 gap-6">
                              {section.fieldConfigs?.map((field) => (
                                <div key={field.name} className="relative group space-y-4">
                                  <div>
                                    <label htmlFor={field.name} className="block text-sm font-medium text-gray-700 mb-1">
                                    {field.label} {field.required && <span className="text-red-500">*</span>}
                                  </label>
                                  <div className="mt-1 relative rounded-md shadow-sm">
                                    {field.type === 'textarea' ? (
                                        <div className="relative">
                                      <textarea
                                        id={field.name}
                                        name={field.name}
                                        rows={4}
                                        value={formData[field.name] || ''}
                                        onChange={(e) => handleFieldChange(field.name, e.target.value)}
                                            className={`block w-full rounded-lg shadow-sm sm:text-sm transition-all duration-200 ${
                                              !canEdit() ? 'bg-gray-50 border-gray-200 cursor-not-allowed' :
                                              modifiedFields.has(field.name) 
                                                ? 'border-yellow-300 focus:ring-yellow-500 focus:border-yellow-500 bg-yellow-50' 
                                                : 'border-gray-300 focus:ring-blue-500 focus:border-blue-500 hover:border-blue-300'
                                            }`}
                                        placeholder={`Masukkan ${field.label.toLowerCase()}`}
                                        required={field.required}
                                            disabled={!canEdit()}
                                          />
                                          {modifiedFields.has(field.name) && (
                                            <div className="absolute right-2 top-2">
                                              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                                                Modified
                                              </span>
                                            </div>
                                          )}
                                        </div>
                                    ) : field.type === 'select' ? (
                                        <div className="relative">
                                      <select
                                        id={field.name}
                                        name={field.name}
                                        value={formData[field.name] || ''}
                                        onChange={(e) => handleFieldChange(field.name, e.target.value)}
                                            className={`block w-full rounded-lg shadow-sm sm:text-sm transition-all duration-200 ${
                                              !canEdit() ? 'bg-gray-50 border-gray-200 cursor-not-allowed' :
                                              modifiedFields.has(field.name) 
                                                ? 'border-yellow-300 focus:ring-yellow-500 focus:border-yellow-500 bg-yellow-50' 
                                                : 'border-gray-300 focus:ring-blue-500 focus:border-blue-500 hover:border-blue-300'
                                            }`}
                                        required={field.required}
                                            disabled={!canEdit()}
                                      >
                                        <option value="">Pilih {field.label.toLowerCase()}</option>
                                        {field.options?.map(option => (
                                          <option key={option} value={option}>{option}</option>
                                        ))}
                                      </select>
                                          {modifiedFields.has(field.name) && (
                                            <div className="absolute right-2 top-2">
                                              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                                                Modified
                                              </span>
                                            </div>
                                          )}
                                        </div>
                                    ) : field.type === 'currency' ? (
                                      <div className="relative">
                                          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                            <span className="text-gray-500 sm:text-sm">Rp</span>
                                          </div>
                                        <input
                                          type="text"
                                          id={field.name}
                                          name={field.name}
                                          value={formData[field.name] || ''}
                                          onChange={(e) => {
                                            const numericValue = e.target.value.replace(/[^0-9]/g, '');
                                            handleFieldChange(field.name, numericValue);
                                          }}
                                            className={`block w-full pl-12 rounded-lg shadow-sm sm:text-sm transition-all duration-200 ${
                                              !canEdit() ? 'bg-gray-50 border-gray-200 cursor-not-allowed' :
                                              modifiedFields.has(field.name) 
                                                ? 'border-yellow-300 focus:ring-yellow-500 focus:border-yellow-500 bg-yellow-50' 
                                                : 'border-gray-300 focus:ring-blue-500 focus:border-blue-500 hover:border-blue-300'
                                            }`}
                                          placeholder="0"
                                          required={field.required}
                                            disabled={!canEdit()}
                                          />
                                          {modifiedFields.has(field.name) && (
                                            <div className="absolute right-2 top-2">
                                              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                                                Modified
                                              </span>
                                            </div>
                                          )}
                                        </div>
                                      ) : field.type === 'date' ? (
                                        <div className="relative">
                                          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                            <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                            </svg>
                                          </div>
                                          <input
                                            type="date"
                                            id={field.name}
                                            name={field.name}
                                            value={formData[field.name] || ''}
                                            min={field.validation?.min || ''}
                                            max={field.validation?.max || ''}
                                            onChange={(e) => handleFieldChange(field.name, e.target.value)}
                                            className={`block w-full pl-10 rounded-lg shadow-sm sm:text-sm transition-all duration-200 ${
                                              !canEdit() ? 'bg-gray-50 border-gray-200 cursor-not-allowed' :
                                              modifiedFields.has(field.name) 
                                                ? 'border-yellow-300 focus:ring-yellow-500 focus:border-yellow-500 bg-yellow-50' 
                                                : 'border-gray-300 focus:ring-blue-500 focus:border-blue-500 hover:border-blue-300'
                                            }`}
                                            required={field.required}
                                            disabled={!canEdit()}
                                          />
                                          {modifiedFields.has(field.name) && (
                                            <div className="absolute right-2 top-2">
                                              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                                                Modified
                                              </span>
                                            </div>
                                          )}
                                      </div>
                                    ) : (
                                        <div className="relative">
                                      <input
                                        type={field.type || 'text'}
                                        id={field.name}
                                        name={field.name}
                                        value={formData[field.name] || ''}
                                        onChange={(e) => handleFieldChange(field.name, e.target.value)}
                                            className={`block w-full rounded-lg shadow-sm sm:text-sm transition-all duration-200 ${
                                              !canEdit() ? 'bg-gray-50 border-gray-200 cursor-not-allowed' :
                                              modifiedFields.has(field.name) 
                                                ? 'border-yellow-300 focus:ring-yellow-500 focus:border-yellow-500 bg-yellow-50' 
                                                : 'border-gray-300 focus:ring-blue-500 focus:border-blue-500 hover:border-blue-300'
                                            }`}
                                        placeholder={`Masukkan ${field.label.toLowerCase()}`}
                                        required={field.required}
                                            disabled={!canEdit()}
                                          />
                                          {modifiedFields.has(field.name) && (
                                            <div className="absolute right-2 top-2">
                                              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                                                Modified
                                              </span>
                                            </div>
                                          )}
                                        </div>
                                    )}
                                  </div>
                                  </div>

                                  {field.description && (
                                    <p className="mt-1 text-sm text-gray-500">{field.description}</p>
                                  )}

                                  {/* Generate by AI button and results */}
                                  <div className="space-y-2">
                                    <div className="flex space-x-2">
                                      <button
                                        onClick={() => handleGenerateField(section, field)}
                                        disabled={generatingField === field.name || !canEdit()}
                                        className={`inline-flex items-center px-3 py-1 rounded-md text-xs font-medium ${
                                          generatingField === field.name || !canEdit()
                                            ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                                            : 'bg-blue-50 text-blue-700 hover:bg-blue-100'
                                        }`}
                                      >
                                        {generatingField === field.name ? (
                                          <span className="flex items-center">
                                            <svg className="animate-spin -ml-1 mr-1 h-3 w-3" fill="none" viewBox="0 0 24 24">
                                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                            </svg>
                                            Generating...
                                          </span>
                                        ) : (
                                          'Generate by AI'
                                        )}
                                      </button>
                                      
                                      {/* Generated Sebelumnya button */}
                                      <button
                                        onClick={() => fetchGenerationHistory(section, field)}
                                        disabled={generatingField === field.name || !canEdit()}
                                        className={`inline-flex items-center px-3 py-1 rounded-md text-xs font-medium ${
                                          generatingField === field.name || !canEdit()
                                            ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                                            : 'bg-gray-50 text-gray-700 hover:bg-gray-100'
                                        }`}
                                      >
                                        <svg className="-ml-0.5 mr-1 h-3 w-3" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-11a1 1 0 10-2 0v3.586L7.707 9.293a1 1 0 00-1.414 1.414l3 3a1 1 0 001.414 0l3-3a1 1 0 00-1.414-1.414L11 10.586V7z" clipRule="evenodd" />
                                        </svg>
                                        Generated Sebelumnya
                                      </button>
                                      
                                      {/* Save button */}
                                      {generatedFields[`${section.id}-${field.id}`] && (
                                        <button
                                          onClick={() => saveGenerationToHistory({
                                            sectionId: section.id,
                                            sectionTitle: section.title,
                                            fieldId: field.id,
                                            fieldLabel: field.label,
                                            content: generatedFields[`${section.id}-${field.id}`].content,
                                            originalInput: generatedFields[`${section.id}-${field.id}`].originalInput
                                          })}
                                          disabled={
                                            (request?.currentEditor === 'analyst' && profile.role !== 'Business Analyst') ||
                                            (request?.currentEditor === 'requester' && profile.role === 'Business Analyst')
                                          }
                                          className={`inline-flex items-center px-3 py-1 rounded-md text-xs font-medium ${
                                            (request?.currentEditor === 'analyst' && profile.role !== 'Business Analyst') ||
                                            (request?.currentEditor === 'requester' && profile.role === 'Business Analyst')
                                              ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                                              : 'bg-green-50 text-green-700 hover:bg-green-100'
                                          }`}
                                          title={
                                            (request?.currentEditor === 'analyst' && profile.role !== 'Business Analyst') ||
                                            (request?.currentEditor === 'requester' && profile.role === 'Business Analyst')
                                              ? "Anda tidak dapat menyimpan saat bukan giliran Anda"
                                              : ""
                                          }
                                        >
                                          <svg className="-ml-0.5 mr-1 h-3 w-3" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                                            <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM6.293 6.707a1 1 0 010-1.414l3-3a1 1 0 011.414 0l3 3a1 1 0 01-1.414 1.414L11 5.414V13a1 1 0 11-2 0V5.414L7.707 6.707a1 1 0 01-1.414 0z" clipRule="evenodd" />
                                          </svg>
                                          Save
                                        </button>
                                      )}
                                    </div>

                                    {/* History dropdown */}
                                    {showHistoryFor === `${section.title}-${field.name}` && generationHistory[`${section.title}-${field.name}`] && (
                                      <div className="mt-2 border border-gray-200 rounded-md p-2 bg-gray-50">
                                        <div className="flex justify-between items-center mb-2">
                                          <h6 className="text-xs font-medium text-gray-700">Riwayat Generasi</h6>
                                          <button
                                            onClick={() => setShowHistoryFor(null)}
                                            className="text-gray-400 hover:text-gray-500"
                                          >
                                            <svg className="h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                                              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                                            </svg>
                                          </button>
                                        </div>
                                        
                                        {generationHistory[`${section.title}-${field.name}`].length === 0 ? (
                                          <p className="text-xs text-gray-500">Tidak ada riwayat generasi</p>
                                        ) : (
                                          <div className="space-y-2 max-h-40 overflow-y-auto">
                                            {generationHistory[`${section.title}-${field.name}`].map((item) => (
                                              <div key={item.id} className="border border-gray-200 rounded p-2 bg-white">
                                                <div className="flex justify-between items-start mb-1">
                                                  <span className="text-xs text-gray-500">
                                                    {new Date(item.timestamp).toLocaleString('id-ID')}
                                                  </span>
                                                  <button
                                                    onClick={() => usePreviousGeneration(item)}
                                                    className="text-xs text-blue-600 hover:text-blue-800"
                                                  >
                                                    Gunakan
                                                  </button>
                                                </div>
                                                <div className="text-xs text-gray-700 line-clamp-2">
                                                  {item.content.substring(0, 100)}...
                                                </div>
                                </div>
                              ))}
                              </div>
                                        )}
                                      </div>
                                    )}

                                    {/* Generated content - Always visible */}
                                    <div className="mt-2 bg-white rounded-lg border border-gray-200 p-3">
                                      <h6 className="text-xs font-medium text-gray-700 mb-2">Hasil Generate:</h6>
                                      <div className="space-y-3">
                                        {/* Display original input */}
                                        <div className="bg-gray-50 p-2.5 rounded-md">
                                          <span className="block text-sm font-medium text-gray-600 mb-1">Input Awal:</span>
                                          <div className="text-sm text-gray-700 whitespace-pre-wrap">
                                            {formData[field.name] || 'Belum ada input'}
                                          </div>
                                        </div>
                                        
                                        {/* Display generated content */}
                                        <div className="bg-blue-50 p-2.5 rounded-md">
                                          <span className="block text-sm font-medium text-gray-600 mb-1">Hasil Generate:</span>
                                          <div className="text-sm text-gray-900 whitespace-pre-wrap">
                                            {(() => {
                                              const content = getGeneratedContent(section, field);
                                              console.log('Displaying content for:', {
                                                sectionTitle: section.title,
                                                fieldName: field.name,
                                                fieldKey: `${section.title}-${field.name}`,
                                                content,
                                                generatedFields: generatedFields
                                              });
                                              return content || 'Belum ada hasil generate. Klik tombol "Generate by AI" untuk membuat konten.';
                                            })()}
                                          </div>
                                        </div>

                                        {/* Generation metadata if available */}
                                        {generatedFields[`${section.title}-${field.name}`]?.timestamp && (
                                          <div className="text-xs text-gray-500 mt-1">
                                            Terakhir di-generate: {new Date(generatedFields[`${section.title}-${field.name}`].timestamp).toLocaleString('id-ID')}
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              ))}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="px-6 py-4 bg-gray-50 border-t border-gray-200">
                      <div className="flex items-center justify-between">
                        <div className="space-y-1">
                          <p className="text-sm text-gray-500">
                            {selectedTemplate?.structure?.sections?.reduce((count, section) => 
                              count + (section.fieldConfigs?.filter(f => f.required && !formData[f.name])?.length || 0), 0)
                            } kolom wajib belum diisi
                          </p>
                          {request?.lastSavedBy && (
                            <p className="text-xs text-gray-400">
                              Terakhir disimpan oleh {request.lastSavedBy.name} ({request.lastSavedBy.role}) pada{' '}
                              {request.lastSavedBy.timestamp?.seconds ? 
                                new Date(request.lastSavedBy.timestamp.seconds * 1000).toLocaleString('id-ID', {
                                  day: 'numeric',
                                  month: 'long',
                                  year: 'numeric',
                                  hour: '2-digit',
                                  minute: '2-digit'
                                }) : 
                                'waktu tidak tersedia'
                              }
                            </p>
                          )}
                        </div>
                        <button
                          onClick={handleGenerateBRD}
                          disabled={generating || (
                            (request?.currentEditor === 'analyst' && profile.role !== 'Business Analyst') ||
                            (request?.currentEditor === 'requester' && profile.role === 'Business Analyst')
                          )}
                          className={`${
                            generating || (
                              (request?.currentEditor === 'analyst' && profile.role !== 'Business Analyst') ||
                              (request?.currentEditor === 'requester' && profile.role === 'Business Analyst')
                            ) ? 'bg-gray-400 cursor-not-allowed' : 'bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-700 hover:to-blue-600'
                          } inline-flex items-center px-6 py-2.5 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-all duration-200`}
                          title={
                            (request?.currentEditor === 'analyst' && profile.role !== 'Business Analyst') ||
                            (request?.currentEditor === 'requester' && profile.role === 'Business Analyst')
                              ? "Anda tidak dapat membuat BRD saat bukan giliran Anda"
                              : ""
                          }
                        >
                          {generating ? (
                            <>
                              <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                              </svg>
                              Membuat...
                            </>
                          ) : (
                            <>
                              <svg className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                              </svg>
                              Jadikan Dokumen BRD
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

          {activeTab === 'view' && (
            <div className="bg-white shadow sm:rounded-lg">
              {request?.consolidatedBRD?.content ? (
                <div>
                  {/* Header Section */}
                  <div className="px-6 py-5 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-white">
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="flex items-center space-x-3">
                          <div className="flex items-center justify-center h-10 w-10 rounded-lg bg-blue-100 text-blue-600">
                            <span className="text-lg font-semibold">BRD</span>
                          </div>
                          <div>
                            <h2 className="text-xl font-bold text-gray-900">Business Requirements Document</h2>
                            <p className="text-sm text-gray-500 mt-1">
                              Generated by: {request.consolidatedBRD.generatedBy?.name || 'Unknown'} ({request.consolidatedBRD.generatedBy?.role || 'Unknown'})
                              <br />
                              Version: {request.consolidatedBRD.version || 1}
                            </p>
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-2">
                          {profile.role === 'Business Analyst' && (
                            <>
                          <button
                              onClick={printConsolidatedBRD}
                              className="inline-flex items-center px-3 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                          >
                              <svg className="-ml-1 mr-2 h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M5 4v3H4a2 2 0 00-2 2v3a2 2 0 002 2h1v2a2 2 0 002 2h6a2 2 0 002-2v-2h1a2 2 0 002-2V9a2 2 0 00-2-2h-1V4a2 2 0 00-2-2H7a2 2 0 00-2 2zm8 0H7v3h6V4zm0 8H7v4h6v-4z" clipRule="evenodd" />
                            </svg>
                              Print BRD
                          </button>
                          <button
                              onClick={exportConsolidatedBRD}
                              className="inline-flex items-center px-3 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
                          >
                              <svg className="-ml-1 mr-2 h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" />
                            </svg>
                              Export to Word
                          </button>
                            </>
                          )}
                  </div>
                </div>
              </div>

                  {/* Content Section */}
                  <div className="px-8 py-6">
                        <div className="prose prose-blue max-w-none">
                      {request.consolidatedBRD.content.split('\n').map((line, i) => {
                            if (!line.trim()) return null;

                        // Section Title (e.g., "## Introduction")
                        if (line.match(/^##\s+/)) {
                        return (
                                <div key={i} className="mt-8 first:mt-0">
                                  <h2 className="text-2xl font-bold text-gray-900 mb-4 pb-2 border-b border-gray-200">
                                {line.replace(/^##\s+/, '')}
                            </h2>
                                </div>
                              );
                            }
                            
                        // Subsection Title (e.g., "### Background")
                        if (line.match(/^###\s+/)) {
                              return (
                                <h3 key={i} className="text-xl font-semibold text-gray-800 mt-6 mb-3">
                              {line.replace(/^###\s+/, '')}
                                </h3>
                              );
                            }

                            // Regular Paragraph
                            return (
                              <p key={i} className="text-gray-700 my-3 text-justify leading-relaxed">
                                {line.split(/(\*\*[^*]+\*\*)/).map((part, index) => {
                                  if (part.startsWith('**') && part.endsWith('**')) {
                                    return <strong key={index}>{part.slice(2, -2)}</strong>;
                                  }
                                  return part;
                                })}
                              </p>
                        );
                      })}
                    </div>
                  </div>

                  {/* Footer Section */}
                  <div className="px-8 py-4 bg-gray-50 border-t border-gray-200">
                    <div className="flex justify-between items-center text-sm text-gray-500">
                      <div className="flex space-x-6">
                      <div>
                          <span className="font-medium text-gray-900">Generated by:</span>{' '}
                          {request.consolidatedBRD.generatedBy?.name || 'Unknown'}
                      </div>
                      <div>
                          <span className="font-medium text-gray-900">Version:</span>{' '}
                          {request.consolidatedBRD.version || 1}
                        </div>
                  </div>
                  <div>
                        <span className="font-medium text-gray-900">Last updated:</span>{' '}
                        {new Date(request.consolidatedBRD.updatedAt).toLocaleString('id-ID', {
                          weekday: 'long',
                        year: 'numeric',
                          month: 'long',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </div>
                      </div>
                    </div>
                </div>
              ) : (
                <div className="text-center py-12">
                  <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <h3 className="mt-2 text-sm font-medium text-gray-900">No BRD Generated</h3>
                  <p className="mt-1 text-sm text-gray-500">Generate the BRD first to preview it here.</p>
                </div>
              )}
            </div>
          )}

          {activeTab === 'discussion' && (
            <div className="space-y-6">
              {/* Comment Form */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
                <form onSubmit={handleCommentSubmit} className="space-y-4">
                  <div className="flex items-start space-x-3">
                    {profile?.photoURL ? (
                      <img 
                        src={profile.photoURL} 
                        alt={profile.namaLengkap}
                        className="h-10 w-10 rounded-lg object-cover ring-2 ring-white shadow-sm"
                      />
                    ) : (
                      <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-blue-100 to-blue-200 flex items-center justify-center ring-2 ring-white shadow-sm">
                        <span className="text-blue-700 text-sm font-semibold">
                          {profile?.namaLengkap?.charAt(0).toUpperCase()}
                        </span>
                      </div>
                    )}
                    <div className="flex-1">
                      <textarea
                        value={newComment}
                        onChange={(e) => setNewComment(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder="Tambahkan komentar... (Tekan Enter untuk mengirim, Shift+Enter untuk baris baru)"
                        className="w-full px-4 py-3 rounded-lg border border-gray-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none transition-all duration-200"
                        rows={3}
                      />
                      <p className="mt-1 text-xs text-gray-400">
                        Tekan Enter untuk mengirim, Shift+Enter untuk baris baru
                      </p>
                    </div>
                  </div>
                  <div className="flex justify-end">
                    <button
                      type="submit"
                      disabled={!newComment.trim() || isSubmitting}
                      className={`inline-flex items-center px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                        !newComment.trim() || isSubmitting
                          ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                          : 'bg-gradient-to-r from-blue-900 to-blue-700 text-white shadow-md hover:shadow-lg hover:scale-105 active:scale-100'
                      }`}
                    >
                      {isSubmitting ? (
                        <>
                          <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                          </svg>
                          Mengirim...
                        </>
                      ) : (
                        <>
                          <svg className="h-4 w-4 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                          </svg>
                          Kirim Komentar
                        </>
                      )}
                    </button>
                  </div>
                </form>
              </div>

              {/* Comments List */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-gray-900">
                    Discussion ({comments.length})
                  </h3>
                      <div className="text-sm text-gray-500">
                    {comments.length === 0 ? 'Belum ada komentar' : 
                      comments.length === 1 ? '1 komentar' : 
                      `${comments.length} komentar`}
                      </div>
                    </div>

                {comments.length === 0 ? (
                  <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 text-center">
                    <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                    </svg>
                    <p className="mt-4 text-sm text-gray-500">Belum ada komentar</p>
                    <p className="mt-2 text-xs text-gray-400">Jadilah yang pertama memulai diskusi</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {comments.map((comment) => (
                      <div 
                        key={comment.id}
                        className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 hover:shadow-md transition-shadow duration-200"
                      >
                        <div className="flex items-start space-x-3">
                          {comment.userPhotoURL ? (
                            <img 
                              src={comment.userPhotoURL} 
                              alt={comment.userName}
                              className="h-10 w-10 rounded-lg object-cover ring-2 ring-white shadow-sm"
                            />
                          ) : (
                            <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-blue-100 to-blue-200 flex items-center justify-center ring-2 ring-white shadow-sm">
                              <span className="text-blue-700 text-sm font-semibold">
                                {comment.userName?.charAt(0).toUpperCase()}
                              </span>
              </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between">
                <div>
                                <p className="text-sm font-medium text-gray-900">
                                  {comment.userName}
                                </p>
                                <p className="text-xs text-gray-500">
                                  {comment.userRole}
                                </p>
                </div>
                              <div className="flex items-center space-x-2">
                                <p className="text-xs text-gray-400 whitespace-nowrap">
                                  {comment.timestamp.toLocaleString('id-ID', {
                                    year: 'numeric',
                                    month: 'long',
                                    day: 'numeric',
                                    hour: '2-digit',
                                    minute: '2-digit'
                                  })}
                                </p>
                                {comment.userId === user.uid && (
                  <button
                                    onClick={() => setCommentToDelete(comment)}
                                    className="p-1 text-gray-400 hover:text-red-500 rounded-full hover:bg-red-50 transition-colors duration-200"
                                    title="Delete comment"
                  >
                                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                    </svg>
                  </button>
                                )}
                </div>
                            </div>
                            <p className="mt-2 text-sm text-gray-600 whitespace-pre-wrap break-words">
                              {comment.text}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
            </div>
          )}
        </div>
      </div>
          )}
        </div>
      </div>

      {/* Delete Confirmation Dialog */}
      {commentToDelete && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full mx-4 overflow-hidden transform transition-all">
            <div className="bg-red-50 px-6 py-4 border-b border-red-100">
              <div className="flex items-center space-x-2">
                <svg className="h-6 w-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <h3 className="text-lg font-medium text-red-900">Hapus Komentar</h3>
              </div>
            </div>
            <div className="px-6 py-4">
              <p className="text-sm text-gray-600">
                Apakah Anda yakin ingin menghapus komentar ini? Tindakan ini tidak dapat dibatalkan.
              </p>
              <div className="mt-4 text-sm text-gray-500 bg-gray-50 rounded-lg p-3">
                "{commentToDelete.text}"
              </div>
            </div>
            <div className="px-6 py-4 bg-gray-50 flex justify-end space-x-3">
              <button
                onClick={() => setCommentToDelete(null)}
                className="px-4 py-2 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-100 transition-colors duration-200"
              >
                Batal
              </button>
              <button
                onClick={() => handleDeleteComment(commentToDelete)}
                className="px-4 py-2 rounded-lg text-sm font-medium bg-red-600 text-white hover:bg-red-700 transition-colors duration-200"
              >
                Hapus
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Replace the existing BRD generation button with this new section */}
      {activeTab === 'isi_brd' && selectedTemplate && (
        <div className="mt-6 space-y-8">
          <div className="bg-blue-50 p-4 rounded-md">
            <h3 className="text-lg font-semibold text-blue-900">Generate BRD Per Bagian</h3>
            <p className="text-sm text-blue-700 mt-1">
              Generate setiap bagian BRD satu per satu. Anda dapat menyetujui atau menanyakan setiap bagian yang telah di-generate.
            </p>
          </div>

          {selectedTemplate?.structure?.sections.map((section, index) => (
            <div key={section.title} className="bg-white rounded-lg shadow-sm border p-4">
              <div className="flex items-center justify-between mb-4">
                <h4 className="text-lg font-medium text-gray-900">
                  {section.number}. {section.title}
                </h4>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleGenerateSection(section, index)}
                    disabled={generatingSection === section.title}
                    className={`px-4 py-2 rounded-md text-sm font-medium ${
                      generatingSection === section.title
                        ? 'bg-gray-100 text-gray-400'
                        : 'bg-blue-50 text-blue-700 hover:bg-blue-100'
                    }`}
                  >
                    {generatingSection === section.title ? (
                      <span className="flex items-center">
                        <svg className="animate-spin -ml-1 mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Generating...
                      </span>
                    ) : (
                      'Generate Bagian Ini'
                    )}
                  </button>
                  
                  {generatedSections[section.title] && (
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleSectionApproval(section, true)}
                        className={`px-3 py-1 rounded-md text-sm font-medium ${
                          sectionStatus[section.title] === 'approved'
                            ? 'bg-green-600 text-white'
                            : 'bg-green-50 text-green-700 hover:bg-green-100'
                        }`}
                      >
                        Setujui
                      </button>
                      <button
                        onClick={() => handleSectionApproval(section, false)}
                        className={`px-3 py-1 rounded-md text-sm font-medium ${
                          sectionStatus[section.title] === 'questioned'
                            ? 'bg-yellow-600 text-white'
                            : 'bg-yellow-50 text-yellow-700 hover:bg-yellow-100'
                        }`}
                      >
                        Tanyakan
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Section fields */}
              <div className="space-y-4 mb-4">
                {section.fieldConfigs?.map(field => (
                  <div key={field.name} className="border rounded-lg p-4">
                    <div className="flex justify-between items-start mb-2">
                      <label className="block text-sm font-medium text-gray-700">
                        {field.label}
                      </label>
                      <button
                        onClick={() => handleGenerateField(section, field)}
                        disabled={generatingField === field.name || !canEdit()}
                        className={`px-3 py-1 rounded-md text-xs font-medium ${
                          generatingField === field.name || !canEdit()
                            ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                            : 'bg-blue-50 text-blue-700 hover:bg-blue-100'
                        }`}
                      >
                        {generatingField === field.name ? (
                          <span className="flex items-center">
                            <svg className="animate-spin -ml-1 mr-1 h-3 w-3" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            Generating...
                          </span>
                        ) : (
                          'Generate by AI'
                        )}
                      </button>
                    </div>
                    
                    <div className="text-sm text-gray-900 mb-2">
                      <span className="text-gray-500">Input Value:</span>
                      <div className="mt-1 p-2 bg-gray-50 rounded">
                        {formData[field.name] || 'Belum diisi'}
                      </div>
                    </div>

                    {/* Show generated content for this field if available */}
                    {generatedFields[field.name] && (
                      <div className="mt-3">
                        <h6 className="text-xs font-medium text-gray-500 mb-1">Hasil Generate:</h6>
                        <div className="space-y-2">
                          {/* Display original input */}
                          <div className="bg-gray-50 p-2 rounded-md text-sm text-gray-700 whitespace-pre-wrap">
                            <span className="font-medium">Input Awal:</span> 
                            {typeof generatedFields[field.name] === 'object' 
                              ? generatedFields[field.name].originalInput || 'Tidak ada input'
                              : formData[field.name] || 'Tidak ada input'}
                          </div>
                          {/* Display generated content */}
                          <div className="bg-blue-50 p-2 rounded-md text-sm text-gray-900 whitespace-pre-wrap">
                            <span className="font-medium">Hasil Generate:</span>
                            <div className="mt-1">
                              {getGeneratedContent(section, field)}
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Generated content */}
              {generatedSections[section.title] && (
                <div className="mt-4">
                  <h5 className="text-sm font-medium text-gray-700 mb-2">Hasil Generate:</h5>
                  <div className="bg-gray-50 p-3 rounded-md text-sm text-gray-900 whitespace-pre-wrap">
                    {generatedSections[section.title]}
                  </div>
                </div>
              )}
            </div>
          ))}

          {/* Control buttons */}
          <div className="flex justify-between items-center pt-6 border-t">
            <button
              onClick={handleGenerateBRD}
              disabled={generating || Object.keys(generatedSections).length === 0}
              className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {generating ? 'Menyimpan...' : 'Simpan Semua & Selesai'}
            </button>

            <button
              onClick={() => {
                const newEditor = request?.currentEditor === 'analyst' ? 'requester' : 'analyst';
                const requestRef = doc(db, 'brd_requests', requestId);
                updateDoc(requestRef, {
                  currentEditor: newEditor,
                  updatedAt: serverTimestamp()
                }).then(() => {
                  setCurrentEditor(newEditor);
                  setRequest(prev => ({
                    ...prev,
                    currentEditor: newEditor
                  }));
                  toast.success(`Berhasil diserahkan ke ${newEditor === 'analyst' ? 'Business Analyst' : 'Requester'}`);
                });
              }}
              disabled={!Object.values(sectionStatus).some(status => status === 'approved' || status === 'questioned')}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Serahkan ke {request?.currentEditor === 'analyst' ? 'Requester' : 'Business Analyst'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default RequestWorkspace; 