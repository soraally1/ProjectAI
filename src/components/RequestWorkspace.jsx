import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { collection, doc, getDoc, getDocs, updateDoc, addDoc, onSnapshot, serverTimestamp, deleteDoc, query, orderBy } from 'firebase/firestore';
import { db } from '../firebase';
import { useUser } from '../context/UserContext';
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import bankLogo from '../assets/i-BRDSystem.svg';
import { Document, Packer, Paragraph, HeadingLevel, Table, TableRow, TableCell, WidthType, AlignmentType } from 'docx';

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
      
      // Check if it's a new comment from another user
      const shouldNotify = 
        latestComment.userId !== user.uid && 
        (!lastSeenComment || latestComment.timestamp > lastSeenComment) &&
        activeTab !== 'discussion';

      if (shouldNotify) {
        // Show toast notification
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

        // Show desktop notification
        try {
          // Double check permission
          if (Notification.permission === "granted") {
            console.log("Creating desktop notification"); // Debug log
            const notification = new Notification(`New Comment from ${latestComment.userName}`, {
              body: latestComment.text.substring(0, 100) + (latestComment.text.length > 100 ? '...' : ''),
              icon: '/src/assets/i-BRDSystem.svg',
              badge: '/src/assets/i-BRDSystem.svg',
              tag: `brd-comment-${Date.now()}`, // Unique tag for each notification
              requireInteraction: true,
              silent: false
            });

            notification.onclick = function() {
              window.focus();
              setActiveTab('discussion');
              this.close();
            };

            console.log("Desktop notification created"); // Debug log
          } else {
            console.log("Notification permission not granted:", Notification.permission); // Debug log
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
      setSelectedTemplate(template);
      
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
      
      setFormData(initialData);
      
      // Update request document with template selection
      const requestRef = doc(db, 'brd_requests', requestId);
      await updateDoc(requestRef, {
        templateId: template.id,
        templateName: template.name,
        templateStructure: template.structure,
        formData: initialData,
        currentEditor: 'analyst', // Reset to analyst when template changes
        updatedAt: serverTimestamp(),
        updatedBy: user.uid,
        updatedByName: profile.namaLengkap
      });

      toast.success('Template berhasil dipilih');
      
    } catch (error) {
      console.error('Error selecting template:', error);
      toast.error('Gagal memilih template. Silakan coba lagi.');
    }
  };

  const handleChangeTemplate = () => {
    if (window.confirm('Mengubah template akan menghapus semua kolom yang telah diisi. Apakah Anda yakin ingin melanjutkan?')) {
      setSelectedTemplate(null);
      setFormData({});
      
      // Update request document to remove template data
      const requestRef = doc(db, 'brd_requests', requestId);
      updateDoc(requestRef, {
        templateId: null,
        templateName: null,
        templateStructure: null,
        formData: {},
        currentEditor: 'analyst',
        updatedAt: serverTimestamp(),
        updatedBy: user.uid,
        updatedByName: profile.namaLengkap
      }).catch(error => {
        console.error('Error resetting template:', error);
        toast.error('Gagal mengatur ulang template');
      });
    }
  };

  const handleFieldChange = async (fieldName, value) => {
    try {
      const updatedFormData = {
        ...formData,
        [fieldName]: value
      };
      
      setFormData(updatedFormData);
      
      // Update request document with new form data
      const requestRef = doc(db, 'brd_requests', requestId);
      await updateDoc(requestRef, {
        formData: updatedFormData,
        updatedAt: serverTimestamp(),
        updatedBy: user.uid,
        updatedByName: profile.namaLengkap
      });
    } catch (error) {
      console.error('Error updating field:', error);
      toast.error('Gagal memperbarui kolom. Silakan coba lagi.');
    }
  };

  const handleGenerateBRD = async () => {
    // Check if it's the user's turn to generate
    if (
      (request?.currentEditor === 'analyst' && profile.role !== 'Business Analyst') ||
      (request?.currentEditor === 'requester' && profile.role === 'Business Analyst')
    ) {
      toast.error("You can't generate BRD when it's not your turn");
      return;
    }

    try {
      setGenerating(true);
      setError(null);
      
      // Get system settings for prompts
      const settingsRef = doc(db, 'system_settings', 'general');
      const settingsSnap = await getDoc(settingsRef);
      const systemSettings = settingsSnap.data();
      
      // Use custom prompts from settings or fall back to defaults
      const defaultSystemPrompt = `You are an expert Business Analyst at Bank Jateng with over 10 years of experience in creating Business Requirements Documents (BRD).
Your task is to generate content ONLY for the filled fields and sections in the BRD, following banking industry standards.
Use formal Indonesian language, technical banking terminology, and ensure compliance with banking regulations.
Do not generate content for unfilled fields or sections.`;

      const defaultInstructions = [
        "Generate content ONLY for sections with filled fields",
        "Use formal Bahasa Indonesia throughout the document",
        "Include specific banking industry context and terminology",
        "Consider regulatory compliance and banking regulations",
        "Focus on security and risk aspects",
        "Generate detailed content only for provided field values",
        "Use clear and concise language while maintaining technical accuracy",
        "Format currency values in Indonesian Rupiah format",
        "Maintain proper paragraph structure and formatting",
        "Only reference and elaborate on the provided field values",
        "Do not generate content for unfilled fields or sections",
        "Add context and elaboration only around the provided values"
      ];

      const systemPrompt = systemSettings?.defaultPrompts?.brdGeneration || defaultSystemPrompt;
      const customInstructions = systemSettings?.defaultPrompts?.brdInstructions?.split('\n').filter(Boolean) || defaultInstructions;
      
      // Validate template selection
      if (!selectedTemplate?.id) {
        setError('Please select a template first');
        return;
      }

      // Get template structure and validate
      const templateStructure = selectedTemplate.structure;
      if (!templateStructure?.sections) {
        throw new Error('Selected template does not have a valid structure');
      }

      // Get filled fields and their values
      const filledFields = {};
      templateStructure.sections.forEach(section => {
        section.fieldConfigs?.forEach(field => {
          if (formData[field.name]) {
            filledFields[field.name] = {
              value: formData[field.name],
              label: field.label,
              type: field.type,
              section: section.title
            };
          }
        });
      });

      // Check if any fields are filled
      if (Object.keys(filledFields).length === 0) {
        setError('Please fill in at least one field before generating');
        return;
      }

      const apiKey = import.meta.env.VITE_GROQ_API_KEY;
      if (!apiKey) {
        throw new Error('GROQ API key not found');
      }

      // Create structured input only from filled fields
      const structuredInput = templateStructure.sections
        .map(section => {
          const sectionFields = section.fieldConfigs?.filter(field => filledFields[field.name]) || [];
          
          if (sectionFields.length === 0) return null;

          return `${section.title.toUpperCase()}:
${sectionFields.map(field => {
  const value = formData[field.name];
  let formattedValue = value;
  
  // Format value based on field type
  switch (field.type) {
    case 'textarea':
      formattedValue = value.split('\n').map(line => `  ${line}`).join('\n');
      break;
    case 'select':
      formattedValue = `[${value}]`;
      break;
    case 'currency':
      formattedValue = new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR' }).format(value || 0);
      break;
  }
  
  return `${field.label}:
  ${formattedValue}`;
}).join('\n')}`;
        })
        .filter(Boolean)
        .join('\n\n');

      // Create prompt focusing only on filled sections
      const promptContent = `
${systemSettings?.defaultPrompts?.brdInstruction || 'Generate a Business Requirements Document (BRD) based on the following filled template parameters:'}

${structuredInput}

Document Structure (Only for filled sections):
${templateStructure.sections
  .filter(section => section.fieldConfigs?.some(field => filledFields[field.name]))
  .map((section, index) => `
${toRomanNumeral(index + 1)}. ${section.title}
${section.description ? `Description: ${section.description}` : ''}
${(section.points || [])
  .filter(point => {
    const fieldName = section.fieldConfigs?.find(f => point.includes(f.label))?.name;
    return !fieldName || filledFields[fieldName];
  })
  .map((point, pointIndex) => `${pointIndex + 1}. ${point}`)
  .join('\n')}`).join('\n')}

Important Instructions:
${customInstructions.map((instruction, index) => `${index + 1}. ${instruction}`).join('\n')}`;

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
              content: systemPrompt
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
        throw new Error('Failed to generate BRD content');
      }

      const data = await response.json();
      const generatedText = data.choices[0].message.content;

      // Parse and format the generated content only for sections with filled fields
      const sections = {};
      templateStructure.sections
        .filter(section => section.fieldConfigs?.some(field => filledFields[field.name]))
        .forEach((section, index) => {
          const currentRoman = toRomanNumeral(index + 1);
          const nextRoman = index < templateStructure.sections.length - 1 ? toRomanNumeral(index + 2) : '';
          
          const pattern = nextRoman 
            ? new RegExp(`${currentRoman}\\. ${section.title}[\\s\\S]*?(?=${nextRoman}\\. |$)`)
            : new RegExp(`${currentRoman}\\. ${section.title}[\\s\\S]*$`);
          
          const sectionContent = generatedText.match(pattern)?.[0] || '';
          const sectionKey = section.title.toLowerCase().replace(/\s+/g, '_');
          
          // Format section content with field references
          const formattedContent = formatSectionContent(
            sectionContent,
            section,
            section.fieldConfigs?.filter(field => filledFields[field.name]) || []
          );
          sections[sectionKey] = formattedContent;
        });

      // Update request with generated content
      const requestRef = doc(db, 'brd_requests', requestId);
      await updateDoc(requestRef, {
        generatedContent: sections,
        templateId: selectedTemplate.id,
        templateName: selectedTemplate.name,
        formData,
        templateStructure,
        status: 'Generated',
        currentEditor: request?.currentEditor === 'analyst' ? 'requester' : 'analyst',
        lastSavedBy: {
          uid: user.uid,
          name: profile.namaLengkap,
          role: profile.role,
          timestamp: serverTimestamp()
        },
        updatedAt: serverTimestamp(),
        updatedBy: user.uid,
        updatedByName: profile.namaLengkap,
        generatedBy: {
          uid: user.uid,
          name: profile.namaLengkap,
          role: profile.role,
          timestamp: serverTimestamp()
        }
      });

      setGeneratedContent(sections);
      setActiveTab('view');
      toast.success('BRD berhasil dibuat. Sekarang giliran ' + 
        (request?.currentEditor === 'analyst' ? 'pemohon' : 'analyst') + '.');
    } catch (error) {
      console.error('Error generating BRD:', error);
      setError(error.message);
      toast.error('Gagal membuat BRD. Silakan coba lagi.');
    } finally {
      setGenerating(false);
    }
  };

  // Helper function to format section content
  const formatSectionContent = (content, section, fields) => {
    if (!content) return '';

    // Add field references if not already present
    const contentWithRefs = fields.reduce((acc, field) => {
      const fieldValue = formData[field.name];
      if (!fieldValue) return acc;

      const fieldRef = `[${field.label}: ${fieldValue}]`;
      if (!acc.includes(fieldRef)) {
        return acc + `\n\nReference: ${fieldRef}`;
      }
      return acc;
    }, content);

    // Format currency values
    let formattedContent = contentWithRefs.replace(/Rp\s*\d+([.,]\d{3})*/g, match => {
      const number = match.replace(/[^\d]/g, '');
      return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR' }).format(number);
    });

    // Add section description if available
    if (section.description) {
      formattedContent = `${section.description}\n\n${formattedContent}`;
    }

    return formattedContent;
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
    return (
      (currentTurn === 'analyst' && profile.role === 'Business Analyst') ||
      (currentTurn === 'requester' && profile.role === 'Business Requester')
    );
  };

  useEffect(() => {
    if (requestId) {
      const unsubscribe = onSnapshot(doc(db, 'brd_requests', requestId), (doc) => {
        if (doc.exists()) {
          const data = doc.data();
          setRequest(data);
          setFormData(data.formData || {});
          setCurrentTurn(data.currentTurn || 'analyst');
          setSavedSections(data.savedSections || {});
          if (data.generatedContent) {
            setGeneratedContent(data.generatedContent);
          }
        }
      });

      return () => unsubscribe();
    }
  }, [requestId]);

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
                    new TableCell({ children: [new Paragraph('Nomor Permintaan')] }),
                    new TableCell({ children: [new Paragraph(requestId)] })
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
                    new TableCell({ children: [new Paragraph('Nama Proyek')] }),
                    new TableCell({ children: [new Paragraph(request?.namaProject || '-')] })
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

            // Template Information
            new Paragraph({
              text: 'Informasi Template',
              heading: HeadingLevel.HEADING_2,
              spacing: { before: 400, after: 200 }
            }),
            new Table({
              width: { size: 100, type: WidthType.PERCENTAGE },
              rows: [
                new TableRow({
                  children: [
                    new TableCell({ children: [new Paragraph('Nama Template')] }),
                    new TableCell({ children: [new Paragraph(selectedTemplate?.name || '-')] })
                  ]
                }),
                new TableRow({
                  children: [
                    new TableCell({ children: [new Paragraph('Terakhir Diperbarui Oleh')] }),
                    new TableCell({ 
                      children: [new Paragraph(
                        request?.generatedBy ?
                        `${request.generatedBy.name} (${request.generatedBy.role})` : 
                        'Belum dibuat'
                      )]
                    })
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
              <div class="label">Nomor Permintaan:</div>
              <div class="value">${requestId}</div>
              
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
              
              <div class="label">Nama Proyek:</div>
              <div class="value">${request?.namaProject || '-'}</div>
              
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

          <div class="section">
            <div class="section-title">Informasi Template</div>
            <div class="info-grid">
              <div class="label">Nama Template:</div>
              <div class="value">${selectedTemplate?.name || '-'}</div>
              
              <div class="label">Terakhir Diperbarui Oleh:</div>
              <div class="value">
                ${request?.generatedBy ?
                  `${request.generatedBy.name} (${request.generatedBy.role})` :
                  'Belum dibuat'}
              </div>
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
        status: 'Completed',
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
            {profile.role === 'Business Analyst' && (request?.status === 'Generated' || request?.status === 'In Progress') && (
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
            <p className="text-sm text-gray-600">{request?.assignedAnalystId|| '-'}</p>
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
              <span>Buat BRD</span>
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
                          <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-green-100 to-green-200 flex items-center justify-center">
                            <span className="text-green-700 font-semibold text-lg">{request?.createdByName?.charAt(0).toUpperCase()}</span>
                          </div>
                          <div>
                            <p className="text-base text-gray-900 font-medium">{request?.createdByName}</p>
                            <p className="text-sm text-gray-500">{request?.unitBisnis}</p>
                            <p className="text-sm text-gray-500">{request?.createdByEmail}</p>
                          </div>
                        </div>
                        <div className="pt-4 border-t border-gray-100">
                          <label className="block text-sm font-medium text-gray-500 mb-1.5">Contact Information</label>
                          <p className="text-base text-gray-900">{request?.nomorSurat || '-'}</p>
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
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          <div>
                            <label className="block text-sm font-medium text-gray-500 mb-1.5">Status</label>
                            <p className="mt-1">
                              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium
                                ${request?.status === 'New' ? 'bg-blue-100 text-blue-800' :
                                request?.status === 'Generated' ? 'bg-green-100 text-green-800' :
                                request?.status === 'In Review' ? 'bg-yellow-100 text-yellow-800' :
                                request?.status === 'Approved' ? 'bg-green-100 text-green-800' :
                                request?.status === 'Rejected' ? 'bg-red-100 text-red-800' :
                                'bg-gray-100 text-gray-800'}`}>
                                {request?.status}
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

                    {/* Approval Information */}
                    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden lg:col-span-2 hover:shadow-md transition-shadow duration-200">
                      <div className="px-6 py-4 bg-gradient-to-r from-indigo-50 to-white border-b border-gray-200">
                        <div className="flex items-center space-x-2">
                          <div className="p-2 bg-indigo-100 rounded-lg">
                            <svg className="h-5 w-5 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
                            </svg>
                          </div>
                          <h3 className="text-lg font-medium text-gray-900">Approval Information</h3>
                        </div>
                      </div>
                      <div className="px-6 py-4 space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                          <div className="bg-gray-50 rounded-lg p-4 flex flex-col items-center justify-center">
                            <div className="p-2 bg-blue-100 rounded-lg mb-2">
                              <svg className="h-5 w-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
                              </svg>
                            </div>
                            <p className="text-sm font-medium text-gray-900">Created By</p>
                            <p className="text-base font-semibold text-gray-900">{request?.createdByName}</p>
                            <p className="text-sm text-gray-500">{request?.unitBisnis}</p>
                            <p className="text-xs text-gray-500">
                              {request?.createdAt?.toDate().toLocaleDateString('id-ID')}
                            </p>
                          </div>
                          <div className="bg-gray-50 rounded-lg p-4 flex flex-col items-center justify-center">
                            <div className="p-2 bg-yellow-100 rounded-lg mb-2">
                              <svg className="h-5 w-5 text-yellow-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                            </div>
                            <p className="text-sm font-medium text-gray-900">Reviewed By</p>
                            <p className="text-base font-semibold text-gray-900">{approvalStatus?.reviewer?.name || '-'}</p>
                            <p className="text-sm text-gray-500">{approvalStatus?.reviewer?.role || '-'}</p>
                            <p className="text-xs text-gray-500">
                              {approvalStatus?.reviewedAt ? 
                                new Date(approvalStatus.reviewedAt.toDate()).toLocaleDateString('id-ID') : 
                                '-'}
                            </p>
                          </div>
                          <div className="bg-gray-50 rounded-lg p-4 flex flex-col items-center justify-center">
                            <div className="p-2 bg-green-100 rounded-lg mb-2">
                              <svg className="h-5 w-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                              </svg>
                            </div>
                            <p className="text-sm font-medium text-gray-900">Approved By</p>
                            <p className="text-base font-semibold text-gray-900">{approvalStatus?.approver?.name || '-'}</p>
                            <p className="text-sm text-gray-500">{approvalStatus?.approver?.role || '-'}</p>
                            <p className="text-xs text-gray-500">
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
                        className={`relative group rounded-lg border-2 ${
                          selectedTemplate?.id === template.id
                            ? 'border-blue-500 ring-2 ring-blue-200'
                            : 'border-gray-200 hover:border-blue-500'
                        } bg-white p-6 hover:shadow-lg transition-all duration-200 cursor-pointer`}
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
                            <div className="mt-3 flex items-center space-x-4 text-sm text-gray-500">
                              <div className="flex items-center">
                                <svg className="w-4 h-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
                                </svg>
                                <span>{template.structure?.sections?.length || 0} bagian</span>
                              </div>
                              <div className="flex items-center">
                                <svg className="w-4 h-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 14v6m-3-3h6M6 10h2a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v2a2 2 0 002 2zm10 0h2a2 2 0 002-2V6a2 2 0 00-2-2h-2a2 2 0 00-2 2v2a2 2 0 002 2z" />
                                </svg>
                                <span>
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
                          <svg className="h-6 w-6 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (!request?.templateId && !selectedTemplate && profile.role !== 'Business Analyst') ? (
                <div className="text-center py-12">
                  <div className="mx-auto h-16 w-16 flex items-center justify-center rounded-full bg-blue-100">
                    <svg className="h-8 w-8 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                  </div>
                  <h3 className="mt-4 text-lg font-medium text-gray-900">Menunggu Pemilihan Template</h3>
                  <p className="mt-2 text-sm text-gray-500">
                    Mohon tunggu Business Analyst untuk memilih template untuk permintaan BRD ini.
                  </p>
                </div>
              ) : (selectedTemplate || request?.templateId) && (
                <div className="space-y-8">
                  {/* Show selected template info */}
                  <div className="flex justify-between items-center bg-white rounded-lg border border-gray-200 p-4 shadow-sm">
                    <div className="flex items-center space-x-4">
                      <div className="h-12 w-12 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center">
                        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                      </div>
                      <div>
                        <h3 className="text-lg font-medium text-gray-900">{selectedTemplate?.name || request?.templateName}</h3>
                        <p className="text-sm text-gray-500">{selectedTemplate?.description || request?.templateDescription}</p>
                      </div>
                    </div>
                    {profile.role === 'Business Analyst' && (
                    <button
                      onClick={handleChangeTemplate}
                      className="inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                    >
                      <svg className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                      Ganti Template
                    </button>
                    )}
                  </div>

                  {/* Template Fields Form */}
                  <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
                    <div className="p-6">
                      <div className="flex justify-between items-center mb-6">
                        <h4 className="text-lg font-medium text-gray-900">Kolom Template</h4>
                        <div className="flex items-center space-x-4">
                          <div className="flex items-center space-x-2">
                            <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                              request?.currentEditor === 'analyst' ? 'bg-blue-100 text-blue-800' : 'bg-green-100 text-green-800'
                            }`}>
                              Editor Saat Ini: {request?.currentEditor === 'analyst' ? 'Business Analyst' : 'Pemohon'}
                            </span>
                            {((request?.currentEditor === 'analyst' && profile.role === 'Business Analyst') ||
                              (request?.currentEditor === 'requester' && profile.role !== 'Business Analyst')) && (
                              <button
                                onClick={async () => {
                                  try {
                                    const requestRef = doc(db, 'brd_requests', requestId);
                                    await updateDoc(requestRef, {
                                      savedFields: formData,
                                      currentEditor: request.currentEditor === 'analyst' ? 'requester' : 'analyst',
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
                                    toast.success('Kolom berhasil disimpan. Sekarang giliran ' + 
                                      (request.currentEditor === 'analyst' ? 'pemohon' : 'analyst') + '.');
                                  } catch (error) {
                                    console.error('Error saving fields:', error);
                                    toast.error('Gagal menyimpan kolom');
                                  }
                                }}
                                className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                              >
                                <svg className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
                                </svg>
                                Simpan & Serahkan ke {request?.currentEditor === 'analyst' ? 'Pemohon' : 'Analyst'}
                              </button>
                            )}
                          </div>
                          {request?.lastSavedBy && (
                            <p className="text-sm text-gray-500">
                              Terakhir disimpan oleh {request.lastSavedBy.name} ({request.lastSavedBy.role})
                            </p>
                          )}
                        </div>
                      </div>
                      <div className={`space-y-8 ${
                        ((request?.currentEditor === 'analyst' && profile.role !== 'Business Analyst') ||
                         (request?.currentEditor === 'requester' && profile.role === 'Business Analyst'))
                        ? 'opacity-50 pointer-events-none'
                        : ''
                      }`}>
                        {(selectedTemplate?.structure?.sections || request?.templateStructure?.sections)?.map((section, sectionIndex) => (
                          <div key={sectionIndex} className="space-y-4">
                            <div className="flex items-center space-x-2">
                              <h5 className="text-base font-medium text-gray-900">{section.title}</h5>
                              {section.description && (
                                <span className="text-sm text-gray-500">({section.description})</span>
                              )}
                            </div>
                            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 pl-4 border-l-2 border-gray-200">
                              {section.fieldConfigs?.map((field) => (
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
                                        onChange={(e) => handleFieldChange(field.name, e.target.value)}
                                        className="block w-full rounded-md border-gray-300 shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                                        placeholder={`Masukkan ${field.label.toLowerCase()}`}
                                        required={field.required}
                                      />
                                    ) : field.type === 'select' ? (
                                      <select
                                        id={field.name}
                                        name={field.name}
                                        value={formData[field.name] || ''}
                                        onChange={(e) => handleFieldChange(field.name, e.target.value)}
                                        className="block w-full rounded-md border-gray-300 shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                                        required={field.required}
                                      >
                                        <option value="">Pilih {field.label.toLowerCase()}</option>
                                        {field.options?.map(option => (
                                          <option key={option} value={option}>{option}</option>
                                        ))}
                                      </select>
                                    ) : field.type === 'currency' ? (
                                      <div className="relative">
                                        <span className="absolute left-3 top-2 text-gray-500">Rp</span>
                                        <input
                                          type="text"
                                          id={field.name}
                                          name={field.name}
                                          value={formData[field.name] || ''}
                                          onChange={(e) => {
                                            const numericValue = e.target.value.replace(/[^0-9]/g, '');
                                            handleFieldChange(field.name, numericValue);
                                          }}
                                          className="block w-full pl-8 rounded-md border-gray-300 shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                                          placeholder="0"
                                          required={field.required}
                                        />
                                      </div>
                                    ) : (
                                      <input
                                        type={field.type || 'text'}
                                        id={field.name}
                                        name={field.name}
                                        value={formData[field.name] || ''}
                                        onChange={(e) => handleFieldChange(field.name, e.target.value)}
                                        className="block w-full rounded-md border-gray-300 shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                                        placeholder={`Masukkan ${field.label.toLowerCase()}`}
                                        required={field.required}
                                      />
                                    )}
                                  </div>
                                  {field.description && (
                                    <p className="mt-1 text-sm text-gray-500">{field.description}</p>
                                  )}
                                </div>
                              ))}
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
                              {request.lastSavedBy.timestamp?.toDate().toLocaleString()}
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
                            ) ? 'bg-gray-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'
                          } inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500`}
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
                              Buat BRD
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
            <div className="space-y-8">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-medium text-gray-900">Generated BRD Document</h3>
                <div className="flex items-center space-x-4">
                  {profile.role === 'Business Analyst' && (
                    <button
                      onClick={exportToWord}
                      className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
                    >
                      <svg className="h-5 w-5 mr-2 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                      </svg>
                      Ekspor ke Word
                    </button>
                  )}
                </div>
              </div>

              {generatedContent ? (
                <div className="bg-white shadow rounded-lg">
                  {/* Document Header */}
                  <div className="px-8 py-6 border-b border-gray-200">
                    <div className="flex justify-between items-start">
                      <div>
                        <h1 className="text-2xl font-bold text-gray-900">Business Requirements Document</h1>
                        <p className="mt-2 text-sm text-gray-500">Template: {selectedTemplate?.name || request?.templateName}</p>
                      </div>
                      <img src={bankLogo} alt="Bank Logo" className="h-12" />
                    </div>
                  </div>

                  {/* Document Content */}
                  <div className="px-8 py-6">
                    <div className="space-y-8">
                      {(selectedTemplate?.structure?.sections || []).map((section, index) => {
                        const sectionKey = section.title.toLowerCase().replace(/\s+/g, '_');
                        const content = generatedContent[sectionKey];

                        return (
                          <div key={index} className="space-y-4">
                            <h2 className="text-xl font-semibold text-gray-900">
                              {toRomanNumeral(index + 1)}. {section.title}
                            </h2>
                            {section.description && (
                              <p className="text-sm text-gray-500 italic">{section.description}</p>
                            )}
                            <div className="prose prose-blue max-w-none">
                              {content ? (
                                <div className="whitespace-pre-wrap text-gray-700">
                                  {content.split('\n').map((line, i) => (
                                    <p key={i} className="mb-2">
                                      {line.startsWith('Reference:') ? (
                                        <span className="text-sm text-blue-600 font-medium">{line}</span>
                                      ) : (
                                        line
                                      )}
                                    </p>
                                  ))}
                                </div>
                              ) : (
                                <p className="text-gray-500 italic">No content generated for this section</p>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Document Footer */}
                  <div className="px-8 py-6 bg-gray-50 border-t border-gray-200">
                    <div className="grid grid-cols-3 gap-8">
                      <div>
                        <h4 className="text-sm font-medium text-gray-900">Generated By</h4>
                        <p className="mt-1 text-sm text-gray-500">{request?.generatedBy?.name || profile.namaLengkap}</p>
                        <p className="text-xs text-gray-400">{request?.generatedBy?.role || profile.role}</p>
                      </div>
                      <div>
                        <h4 className="text-sm font-medium text-gray-900">Generated On</h4>
                        <p className="mt-1 text-sm text-gray-500">
                          {request?.updatedAt?.toDate().toLocaleDateString('id-ID', {
                            day: 'numeric',
                            month: 'long',
                            year: 'numeric'
                          })}
                        </p>
                      </div>
                      <div>
                        <h4 className="text-sm font-medium text-gray-900">Document Status</h4>
                        <span className="mt-1 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                          Generated
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-12 bg-white rounded-lg border border-gray-200">
                  <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <h3 className="mt-2 text-sm font-medium text-gray-900">No BRD Generated</h3>
                  <p className="mt-1 text-sm text-gray-500">Generate a BRD first to view it here.</p>
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
    </div>
  );
};

export default RequestWorkspace; 