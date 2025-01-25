import React, { useState, useEffect, useRef, forwardRef } from 'react';
import mammoth from 'mammoth';
import * as pdfjsLib from 'pdfjs-dist';
import bankLogo from '../Bank_Jateng_logo.svg.png';
import { diffChars } from 'diff';
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { createGlobalStyle } from 'styled-components';
import { db, auth } from '../../firebase';
import { collection, addDoc, serverTimestamp, query, orderBy, getDocs } from 'firebase/firestore';

// Set up PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

// Add this CSS class for document preview
const documentPreviewStyles = {
  preview: `
    font-family: 'Times New Roman', Times, serif;
    line-height: 1.6;
    padding: 40px;
    background: white;
    box-shadow: 0 4px 20px rgba(0,0,0,0.08);
    border: 1px solid #e5e7eb;
    max-height: 800px;
    overflow-y: auto;
    position: relative;
    border-radius: 12px;
  `,
  page: `
    max-width: 21cm;
    min-height: 29.7cm;
    padding: 2.54cm;
    margin: 0 auto;
    background: white;
    box-shadow: 0 0 10px rgba(0,0,0,0.1);
  `,
  header: `
    text-align: center;
    margin-bottom: 2cm;
  `,
  logo: `
    width: 200px;
    height: auto;
    margin: 0 auto 1cm auto;
  `,
  title: `
    font-size: 14pt;
    font-weight: bold;
    margin-bottom: 0.5cm;
  `,
  subtitle: `
    font-size: 12pt;
    font-weight: bold;
    margin-bottom: 0.3cm;
  `,
  divider: `
    width: 80%;
    margin: 0.5cm auto;
    border-top: 2px solid black;
  `,
  section: `
    margin-bottom: 1cm;
  `,
  sectionTitle: `
    font-size: 12pt;
    font-weight: bold;
    margin-bottom: 0.5cm;
    text-decoration: underline;
  `,
  content: `
    font-size: 12pt;
    text-align: justify;
    margin-bottom: 0.5cm;
  `,
  table: `
    width: 100%;
    border-collapse: collapse;
    margin-bottom: 1cm;
  `,
  tableCell: `
    border: 1px solid black;
    padding: 0.3cm;
    font-size: 12pt;
  `,
  approvalSection: `
    margin: 2cm 0;
  `,
  approvalTitle: `
    font-size: 12pt;
    font-weight: bold;
    text-align: center;
    margin-bottom: 1cm;
    text-decoration: underline;
  `,
  approvalGrid: `
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 2cm;
  `,
  signatureBox: `
    border: 1px solid black;
    padding: 1cm;
    text-align: left;
  `,
  signatureLine: `
    margin-top: 2cm;
    border-top: 1px solid black;
    padding-top: 0.3cm;
  `
};

const templates = {
  default: {
    name: 'Template Default',
    description: 'Template standar untuk BRD Bank Jateng',
    fields: [
      { name: 'projectName', label: 'Nama Proyek', required: true },
      { name: 'documentNumber', label: 'Nomor Dokumen', required: true },
      { name: 'currentCondition', label: 'Kondisi Saat Ini', required: true },
      { name: 'problems', label: 'Permasalahan', required: true },
      { name: 'problemImpact', label: 'Dampak Permasalahan', required: true },
      { name: 'mainNeeds', label: 'Kebutuhan Utama', required: true },
      { name: 'businessImpact', label: 'Dampak terhadap Proses Bisnis', required: true },
      { name: 'businessValue', label: 'Nilai Bisnis', required: true },
      { name: 'mainObjective', label: 'Tujuan Utama', required: true },
      { name: 'specificObjectives', label: 'Tujuan Spesifik', required: true },
      { name: 'measurableTargets', label: 'Target yang Terukur', required: true },
      { name: 'scope', label: 'Ruang Lingkup', required: true },
      { name: 'inScope', label: 'Yang Termasuk', required: true },
      { name: 'outScope', label: 'Yang Tidak Termasuk', required: true },
      { name: 'stakeholders', label: 'Pemangku Kepentingan', required: true },
      { name: 'functionalRequirements', label: 'Kebutuhan Fungsional', required: true },
      { name: 'nonFunctionalRequirements', label: 'Kebutuhan Non-Fungsional', required: true }
    ]
  },
  simplified: {
    name: 'Template Sederhana',
    description: 'Versi ringkas untuk proyek kecil',
    fields: [
      { name: 'projectName', label: 'Nama Proyek', required: true },
      { name: 'documentNumber', label: 'Nomor Dokumen', required: true },
      { name: 'currentCondition', label: 'Kondisi Saat Ini', required: true },
      { name: 'problems', label: 'Permasalahan', required: true },
      { name: 'mainNeeds', label: 'Kebutuhan Utama', required: true },
      { name: 'mainObjective', label: 'Tujuan Utama', required: true },
      { name: 'scope', label: 'Ruang Lingkup', required: true },
      { name: 'functionalRequirements', label: 'Kebutuhan Fungsional', required: true }
    ]
  },
  detailed: {
    name: 'Template Detail',
    description: 'Versi lengkap untuk proyek besar',
    fields: [
      { name: 'projectName', label: 'Nama Proyek', required: true },
      { name: 'documentNumber', label: 'Nomor Dokumen', required: true },
      { name: 'currentCondition', label: 'Kondisi Saat Ini', required: true },
      { name: 'problems', label: 'Permasalahan', required: true },
      { name: 'problemImpact', label: 'Dampak Permasalahan', required: true },
      { name: 'mainNeeds', label: 'Kebutuhan Utama', required: true },
      { name: 'businessImpact', label: 'Dampak terhadap Proses Bisnis', required: true },
      { name: 'businessValue', label: 'Nilai Bisnis', required: true },
      { name: 'mainObjective', label: 'Tujuan Utama', required: true },
      { name: 'specificObjectives', label: 'Tujuan Spesifik', required: true },
      { name: 'measurableTargets', label: 'Target yang Terukur', required: true },
      { name: 'scope', label: 'Ruang Lingkup', required: true },
      { name: 'inScope', label: 'Yang Termasuk', required: true },
      { name: 'outScope', label: 'Yang Tidak Termasuk', required: true },
      { name: 'stakeholders', label: 'Pemangku Kepentingan', required: true },
      { name: 'functionalRequirements', label: 'Kebutuhan Fungsional', required: true },
      { name: 'nonFunctionalRequirements', label: 'Kebutuhan Non-Fungsional', required: true },
      { name: 'assumptions', label: 'Asumsi', required: true },
      { name: 'constraints', label: 'Batasan', required: true },
      { name: 'risks', label: 'Risiko', required: true },
      { name: 'success_criteria', label: 'Kriteria Keberhasilan', required: true },
      { name: 'timeline', label: 'Jadwal', required: true },
      { name: 'budget', label: 'Anggaran', required: true }
    ]
  },
  technical: {
    name: 'Template Teknis',
    description: 'Fokus pada aspek teknis',
    fields: [
      { name: 'projectName', label: 'Nama Proyek', required: true },
      { name: 'documentNumber', label: 'Nomor Dokumen', required: true },
      { name: 'currentCondition', label: 'Kondisi Saat Ini', required: true },
      { name: 'scope', label: 'Ruang Lingkup', required: true },
      { name: 'functionalRequirements', label: 'Kebutuhan Fungsional', required: true },
      { name: 'nonFunctionalRequirements', label: 'Kebutuhan Non-Fungsional', required: true },
      { name: 'assumptions', label: 'Asumsi', required: true },
      { name: 'constraints', label: 'Batasan', required: true }
    ]
  }
};

const FormField = ({ label, name, value, onChange, error, type = 'text', required = false, placeholder }) => (
  <div className="mb-6">
    <label className="block text-sm font-medium text-[#00008B] mb-2">
      {label} {required && <span className="text-red-500">*</span>}
    </label>
    {type === 'textarea' ? (
      <textarea
        name={name}
        value={value || ''}
        onChange={onChange}
        rows="4"
        className={`block w-full px-4 py-3 rounded-lg border ${
          error ? 'border-red-500' : 'border-gray-300'
        } shadow-sm focus:ring-2 focus:ring-[#00008B] focus:border-[#00008B] transition duration-150 ease-in-out resize-none`}
        placeholder={placeholder || `Masukkan ${label.toLowerCase()}`}
      />
    ) : (
      <input
        type={type}
        name={name}
        value={value || ''}
        onChange={onChange}
        className={`block w-full px-4 py-3 rounded-lg border ${
          error ? 'border-red-500' : 'border-gray-300'
        } shadow-sm focus:ring-2 focus:ring-[#00008B] focus:border-[#00008B] transition duration-150 ease-in-out`}
        placeholder={placeholder || `Masukkan ${label.toLowerCase()}`}
      />
    )}
    {error && (
      <p className="mt-2 text-sm text-red-600">{error}</p>
    )}
  </div>
);

const BrdPreviewStyles = createGlobalStyle`
  .brd-preview {
    font-family: 'Times New Roman', Times, serif;
    line-height: 1.6;
  }
  
  .brd-preview h1, 
  .brd-preview h2, 
  .brd-preview h3 {
    font-family: 'Times New Roman', Times, serif;
  }
  
  .prose {
    max-width: none;
    color: #374151;
  }
  
  .prose p {
    margin-bottom: 1.5em;
  }
  
  @media print {
    .brd-preview {
      padding: 2cm;
    }
  }
`;

const Main = forwardRef(({ onBrdGenerated, initialData }, ref) => {
  const [formData, setFormData] = useState({
    projectName: '',
    documentNumber: '',
    currentCondition: '',
    problems: '',
    problemImpact: '',
    mainNeeds: '',
    businessImpact: '',
    businessValue: '',
    mainObjective: '',
    specificObjectives: '',
    measurableTargets: '',
    background: '',
    businessNeed: '',
    scope: '',
    inScope: '',
    outScope: '',
    objectives: '',
    stakeholders: '',
    functionalRequirements: '',
    nonFunctionalRequirements: '',
    assumptions: '',
    constraints: '',
    risks: '',
    success_criteria: '',
    timeline: '',
    budget: '',
    approvers: ''
  });

  const [validationErrors, setValidationErrors] = useState({});

  const [generatedBRD, setGeneratedBRD] = useState('');
  const [loading, setLoading] = useState(false);
  const [template, setTemplate] = useState('');
  const [showPreview, setShowPreview] = useState(false);
  const [error, setError] = useState(null);
  const [savedTime, setSavedTime] = useState(null);
  const [activeTab, setActiveTab] = useState('required');
  const [showSuccessToast, setShowSuccessToast] = useState(false);
  const [templateFormat, setTemplateFormat] = useState('docx');
  const [versions, setVersions] = useState([]);
  const [selectedVersion, setSelectedVersion] = useState(null);
  const [selectedTemplate, setSelectedTemplate] = useState('default');
  const [showDiffModal, setShowDiffModal] = useState(false);
  const [diffContent, setDiffContent] = useState(null);
  const [previewMode, setPreviewMode] = useState(false);
  const [showTemplateDetails, setShowTemplateDetails] = useState(false);
  const [selectedTemplateDetails, setSelectedTemplateDetails] = useState(null);
  const [lastSavedVersion, setLastSavedVersion] = useState(null);
  const [editableContent, setEditableContent] = useState({});
  const [isEditing, setIsEditing] = useState(false);

  // Add new state for Firestore integration
  const [isSaving, setIsSaving] = useState(false);

  // Function to save BRD to Firestore
  const saveBrdToFirestore = async (brdData) => {
    try {
      setIsSaving(true);
      const currentUser = auth.currentUser;
      
      if (!currentUser) {
        throw new Error('User not authenticated');
      }

      const brdRef = collection(db, 'brds');
      
      // Extract formData and generatedContent from brdData
      const { formData, generatedContent } = brdData;
      
      // Create a clean document structure
      const docData = {
        projectName: formData.projectName,
        documentNumber: formData.documentNumber,
        formData: {
          ...formData,
          timestamp: new Date().toISOString() // Use ISO string for nested timestamp
        },
        generatedContent,
        userId: currentUser.uid,
        userEmail: currentUser.email,
        createdAt: serverTimestamp(),
        lastModified: serverTimestamp(),
        templateType: selectedTemplate,
        status: 'draft',
        version: versions.length + 1,
        currentTurn: currentUser.uid
      };

      const docRef = await addDoc(brdRef, docData);
      
      toast.success('BRD berhasil disimpan ke database!', {
        position: "bottom-right",
        autoClose: 3000
      });

      return docRef.id;
    } catch (error) {
      console.error('Error saving BRD:', error);
      if (error.message === 'User not authenticated') {
        toast.error('Silakan login terlebih dahulu untuk menyimpan BRD', {
          position: "bottom-right",
          autoClose: 5000
        });
      } else {
        toast.error('Gagal menyimpan BRD: ' + error.message, {
          position: "bottom-right",
          autoClose: 5000
        });
      }
      throw error;
    } finally {
      setIsSaving(false);
    }
  };

  // Function to load BRDs from Firestore
  const loadBrdsFromFirestore = async () => {
    try {
      const brdRef = collection(db, 'brds');
      const q = query(brdRef, orderBy('createdAt', 'desc'));
      const querySnapshot = await getDocs(q);
      
      const loadedVersions = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        timestamp: doc.data().createdAt?.toDate().toISOString()
      }));

      setVersions(loadedVersions);
    } catch (error) {
      console.error('Error loading BRDs:', error);
      toast.error('Gagal memuat riwayat BRD: ' + error.message);
    }
  };

  // Load BRDs on component mount
  useEffect(() => {
    loadBrdsFromFirestore();
  }, []);

  // Initialize form with provided data if available
  useEffect(() => {
    if (initialData) {
      setFormData(prev => ({
        ...prev,
        ...initialData
      }));
    }
  }, [initialData]);

  const loadPdfTemplate = async () => {
    try {
      // Try loading from different possible locations
      let response;
      const possiblePaths = [
        '/Template.pdf',
        '/assets/Template.pdf',
        '/src/Template.pdf'
      ];

      for (const path of possiblePaths) {
        try {
          response = await fetch(path);
          if (response.ok) break;
        } catch (e) {
          console.warn(`Failed to load from ${path}`);
        }
      }

      if (!response?.ok) {
        throw new Error('Could not find Template.pdf in any of the expected locations');
      }

      const blob = await response.blob();
      const arrayBuffer = await blob.arrayBuffer();
      
      const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
      const pdf = await loadingTask.promise;
      let fullText = '';
      
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        const pageText = textContent.items.map(item => item.str).join(' ');
        fullText += pageText + '\n\n';
      }
      
      if (!fullText.trim()) {
        throw new Error('No text content found in PDF');
      }
      
      setTemplate(fullText);
      setError(null);
    } catch (error) {
      console.error('PDF Template processing error:', error);
      setError(`Error loading PDF template: ${error.message}. Please try DOCX format or contact support.`);
      setTemplate('');
    }
  };

  const loadDocxTemplate = async () => {
    try {
      // Try loading from different possible locations
      let response;
      const possiblePaths = [
        '/Template.docx',
        '/assets/Template.docx',
        '/src/Template.docx'
      ];

      for (const path of possiblePaths) {
        try {
          response = await fetch(path);
          if (response.ok) break;
        } catch (e) {
          console.warn(`Failed to load from ${path}`);
        }
      }

      if (!response?.ok) {
        throw new Error('Could not find Template.docx in any of the expected locations');
      }
      
      const blob = await response.blob();
      const arrayBuffer = await blob.arrayBuffer();
      
      // Convert DOCX to HTML while preserving styles
      const result = await mammoth.convertToHtml({ 
        arrayBuffer,
        styleMap: [
          "p[style-name='Blue'] => p.blue-text",
          "span[style-name='Blue'] => span.blue-text"
        ]
      });

      if (!result.value.trim()) {
        throw new Error('No content found in DOCX file');
      }

      setTemplate(result.value);
      
      if (result.messages.length > 0) {
        console.warn('Warnings while converting DOCX:', result.messages);
      }
      
      setError(null);
    } catch (error) {
      console.error('DOCX Template processing error:', error);
      setError(`Error loading DOCX template: ${error.message}. Please try again or contact support.`);
      setTemplate('');
      
      if (templateFormat === 'docx') {
        console.log('Attempting to load PDF template as fallback...');
        await loadPdfTemplate();
      }
    }
  };

  const extractPlaceholders = (htmlContent) => {
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = htmlContent;
    
    // Find all text nodes that contain angle brackets
    const placeholders = [];
    const walker = document.createTreeWalker(
      tempDiv,
      NodeFilter.SHOW_TEXT,
      null,
      false
    );

    let node;
    while (node = walker.nextNode()) {
      const text = node.textContent;
      // Updated regex to match angle brackets with content including spaces
      const matches = text.match(/<[^>]+>/g);
      if (matches) {
        matches.forEach(match => {
          // Only add if it's not already in placeholders
          if (!placeholders.some(p => p.text === match)) {
            placeholders.push({
              text: match,
              node: node,
              fullText: text,
              // Remove angle brackets and trim for prompt
              content: match.replace(/[<>]/g, '').trim()
            });
          }
        });
      }
    }
    
    return placeholders;
  };

  const insertGeneratedContentIntoTemplate = (generatedContent, templateHtml) => {
    // Split the generated content into sections
    const contentSections = generatedContent
      .split(/(?=Section \d+:)/)
      .map(section => section.trim())
      .filter(section => section)
      .map(section => section.replace(/^Section \d+:\s*/, '').trim());

    // Create a temporary div to work with the template HTML
    let processedHtml = templateHtml;

    // Find all placeholders (text within < >)
    const placeholderRegex = /<([^>]+)>/g;
    let match;
    let sectionIndex = 0;

    // Replace each placeholder with its corresponding generated content
    while ((match = placeholderRegex.exec(templateHtml)) !== null && sectionIndex < contentSections.length) {
      const placeholder = match[0]; // Full match including < >
      const content = contentSections[sectionIndex];
      
      // Replace the placeholder with the generated content
      processedHtml = processedHtml.replace(
        placeholder,
        `<span class="generated-content">${content}</span>`
      );
      
      sectionIndex++;
    }

    return processedHtml;
  };

  useEffect(() => {
    const loadTemplate = async () => {
      setTemplate(''); // Clear previous template
      setError(null); // Clear previous errors
      
      try {
        if (templateFormat === 'docx') {
          await loadDocxTemplate();
        } else {
          await loadPdfTemplate();
        }
      } catch (error) {
        console.error('Template loading error:', error);
        setError('Failed to load template. Please try again or contact support.');
      }
    };

    loadTemplate();
  }, [templateFormat]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value,
    }));
    
    // Clear validation error for this field when user types
    if (validationErrors[name]) {
      setValidationErrors(prev => ({
        ...prev,
        [name]: null
      }));
    }
  };

  const validateForm = () => {
    const errors = {};
    const templateConfig = templates[selectedTemplate];
    
    templateConfig.fields.forEach(field => {
      if (field.required && !formData[field.name]?.trim()) {
        errors[field.name] = `${field.label} wajib diisi`;
      }
    });

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const showToast = () => {
    setShowSuccessToast(true);
    setTimeout(() => setShowSuccessToast(false), 3000);
  };

  // Add sleep function for delays
  const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

  // Add retry logic for API calls
  const makeGroqRequest = async (chunk, apiKey, retryCount = 0, maxRetries = 3) => {
    try {
      const placeholderPrompt = chunk.map((p, i) => 
        `Section ${i + 1}: Generate content for: "${p.content}"`
      ).join('\n');

      const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: "mixtral-8x7b-32768",
          messages: [{
            role: "system",
            content: "You are a professional Business Analyst. Generate content for BRD sections based on the project information. Keep responses clear and concise."
          }, {
            role: "user",
            content: `Project Context:
Name: ${formData.projectName}
Background: ${formData.background}
Business Need: ${formData.businessNeed}
Scope: ${formData.scope}
In Scope: ${formData.inScope}
Out of Scope: ${formData.outScope}
Objectives: ${formData.objectives}
Stakeholders: ${formData.stakeholders}
Functional Requirements: ${formData.functionalRequirements}
Non-Functional Requirements: ${formData.nonFunctionalRequirements}

Generate content for these sections:
${placeholderPrompt}

Format: Start each section with "Section N:" and provide concise, relevant content.`
          }],
          temperature: 0.7,
          max_tokens: 1000,
        }),
      });

      if (response.status === 429) {
        // Extract retry delay from error message if available
        const errorData = await response.json();
        const retryAfter = errorData.error?.message.match(/try again in (\d+\.?\d*)s/)?.[1] || 3;
        
        if (retryCount < maxRetries) {
          console.log(`Rate limit hit, waiting ${retryAfter}s before retry ${retryCount + 1}/${maxRetries}`);
          await sleep(Math.ceil(retryAfter * 1000));
          return makeGroqRequest(chunk, apiKey, retryCount + 1, maxRetries);
        }
        throw new Error('Max retries reached for rate limit');
      }

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`API request failed: ${response.status} ${response.statusText}${errorData.error ? ` - ${errorData.error.message}` : ''}`);
      }

      const data = await response.json();
      return data.choices[0].message.content;
    } catch (error) {
      if (retryCount < maxRetries) {
        console.log(`Error occurred, retrying (${retryCount + 1}/${maxRetries}):`, error);
        await sleep(3000); // Wait 3 seconds before retry
        return makeGroqRequest(chunk, apiKey, retryCount + 1, maxRetries);
      }
      throw error;
    }
  };

  const generateBRD = async () => {
    if (!validateForm()) {
      toast.error('Harap isi semua field yang diperlukan', {
        position: "bottom-right",
        autoClose: 3000
      });
      return;
    }
    
    setLoading(true);
    try {
      const apiKey = import.meta.env.VITE_GROQ_API_KEY;
      if (!apiKey) {
        throw new Error('API key Groq tidak ditemukan');
      }

      console.log('Memulai generate BRD...'); // Debug log

      const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({
          model: "mixtral-8x7b-32768",
          messages: [{
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
          }, {
            role: "user",
            content: `Hasilkan BRD lengkap berdasarkan informasi berikut:

INFORMASI PROYEK:
Nama Proyek: ${formData.projectName}
Nomor Dokumen: ${formData.documentNumber}

LATAR BELAKANG:
Kondisi Saat Ini: ${formData.currentCondition}
Permasalahan: ${formData.problems}
Dampak Permasalahan: ${formData.problemImpact}

KEBUTUHAN BISNIS:
Kebutuhan Utama: ${formData.mainNeeds}
Dampak terhadap Proses Bisnis: ${formData.businessImpact}
Nilai Bisnis: ${formData.businessValue}

TUJUAN:
Tujuan Utama: ${formData.mainObjective}
Tujuan Spesifik: ${formData.specificObjectives}
Target yang Terukur: ${formData.measurableTargets}

RUANG LINGKUP:
Ruang Lingkup Umum: ${formData.scope}
Yang Termasuk: ${formData.inScope}
Yang Tidak Termasuk: ${formData.outScope}

PEMANGKU KEPENTINGAN:
${formData.stakeholders}

KEBUTUHAN:
Kebutuhan Fungsional: ${formData.functionalRequirements}
Kebutuhan Non-Fungsional: ${formData.nonFunctionalRequirements}

ASUMSI DAN BATASAN:
Asumsi: ${formData.assumptions}
Batasan: ${formData.constraints}

PERENCANAAN:
Risiko: ${formData.risks}
Kriteria Keberhasilan: ${formData.success_criteria}
Jadwal: ${formData.timeline}
Anggaran: ${formData.budget}

Hasilkan BRD lengkap dengan format berikut:

I. PENDAHULUAN
   1.1. Latar Belakang
   1.2. Tujuan
   1.3. Ruang Lingkup

II. KONDISI SAAT INI
    2.1. Analisis Situasi
    2.2. Permasalahan
    2.3. Dampak Bisnis

III. KEBUTUHAN BISNIS
     3.1. Kebutuhan Utama
     3.2. Nilai Bisnis
     3.3. Dampak terhadap Proses Bisnis

IV. RUANG LINGKUP PROYEK
    4.1. Yang Termasuk dalam Ruang Lingkup
    4.2. Yang Tidak Termasuk dalam Ruang Lingkup
    4.3. Asumsi dan Batasan

V. KEBUTUHAN SISTEM
   5.1. Kebutuhan Fungsional
   5.2. Kebutuhan Non-Fungsional
   5.3. Kebutuhan Keamanan

VI. PEMANGKU KEPENTINGAN
    6.1. Identifikasi Pemangku Kepentingan
    6.2. Peran dan Tanggung Jawab

VII. MANAJEMEN PROYEK
     7.1. Jadwal dan Milestone
     7.2. Anggaran
     7.3. Risiko dan Mitigasi
     7.4. Kriteria Keberhasilan

Berikan konten yang sangat detail dan profesional untuk setiap bagian.`
          }],
          temperature: 0.7,
          max_tokens: 4000,
        })
      });

      console.log('Response status:', response.status); // Debug log

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('API Error:', errorData); // Debug log
        throw new Error(`Gagal melakukan request ke API: ${response.status}${errorData.error ? ` - ${errorData.error.message}` : ''}`);
      }

      const data = await response.json();
      console.log('Response received'); // Debug log

      if (!data.choices?.[0]?.message?.content) {
        console.error('Invalid response format:', data); // Debug log
        throw new Error('Format response tidak valid dari API');
      }

      const generatedContent = data.choices[0].message.content;

      // Save to Firestore
      const brdData = {
        formData,
        generatedContent,
        projectName: formData.projectName,
        documentNumber: formData.documentNumber
      };

      const docId = await saveBrdToFirestore(brdData);

      // Update local state
      const newVersion = {
        id: docId,
        timestamp: new Date().toISOString(),
        projectName: formData.projectName,
        data: { ...formData },
        generatedContent
      };

      setVersions(prev => [newVersion, ...prev]);
      setLastSavedVersion(newVersion);
      setGeneratedBRD(generatedContent);

      if (onBrdGenerated) {
        onBrdGenerated(generatedContent);
      }

      toast.success('BRD berhasil dibuat!', {
        position: "bottom-right",
        autoClose: 3000
      });
    } catch (error) {
      console.error('Error generating BRD:', error);
      toast.error(`Error: ${error.message}`, {
        position: "bottom-right",
        autoClose: 5000
      });
    } finally {
      setLoading(false);
    }
  };

  const exportToWord = () => {
    if (!generatedBRD) return;

    // Create a new Blob with HTML content
    const preHtml = `<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
      <head>
        <meta charset='utf-8'>
        <title>Business Requirements Document</title>
        <style>
          /* Page Setup */
          @page Section1 {
            size: 21cm 29.7cm;
            margin: 2.54cm 2.54cm 2.54cm 2.54cm;
            mso-header-margin: 35.4pt;
            mso-footer-margin: 35.4pt;
            mso-paper-source: 0;
          }
          div.Section1 {
            page: Section1;
          }
          
          /* General Styles */
          body {
            font-family: 'Times New Roman', Times, serif;
            font-size: 12pt;
            line-height: 1.6;
            color: #1a1a1a;
          }
          
          /* Header Styles */
          .header {
            text-align: center;
            margin-bottom: 2cm;
          }
          
          .logo-container {
            margin-bottom: 1cm;
            text-align: center;
          }
          
          .logo {
            width: 200px;
            height: auto;
          }
          
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
          
          .document-title {
            font-size: 12pt;
            font-weight: bold;
            margin-bottom: 0.3cm;
          }
          
          .project-name {
            font-size: 12pt;
            font-weight: bold;
            margin-bottom: 1cm;
          }
          
          /* Content Styles */
          .content {
            text-align: justify;
            margin-top: 1cm;
          }
          
          h1, h2, h3, h4 {
            font-family: 'Times New Roman', Times, serif;
            color: #1a1a1a;
          }
          
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
          
          h3 {
            font-size: 12pt;
            font-weight: bold;
            margin-top: 0.6cm;
            margin-bottom: 0.3cm;
          }
          
          p {
            margin-bottom: 0.8em;
            text-align: justify;
          }
          
          /* Table Styles */
          table {
            width: 100%;
            border-collapse: collapse;
            margin: 1cm 0;
          }
          
          td, th {
            border: 1px solid black;
            padding: 0.3cm;
            vertical-align: top;
          }
          
          /* List Styles */
          ul, ol {
            margin: 0.5cm 0;
            padding-left: 1cm;
          }
          
          li {
            margin-bottom: 0.3cm;
          }
        </style>
      </head>
      <body>
        <div class="Section1">
          <div class="header">
            <div class="logo-container">
              <img src="${bankLogo}" alt="Bank Jateng Logo" class="logo">
            </div>
            <h1 class="company-name">PT BANK PEMBANGUNAN DAERAH JAWA TENGAH</h1>
            <div class="divider"></div>
            <h2 class="document-title">DOKUMEN KEBUTUHAN BISNIS</h2>
            <h3 class="project-name">${formData.projectName || 'Untitled Project'}</h3>
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
        </div>
      </body>
    </html>`;

    // Convert the generatedBRD content to properly formatted HTML
    const formattedContent = generatedBRD
      .split('\n')
      .map(line => {
        // Format section headers (e.g., "I. PENDAHULUAN")
        if (/^[IVX]+\./.test(line)) {
          return `<h1>${line.trim()}</h1>`;
        }
        // Format subsection headers (e.g., "1.1. Latar Belakang")
        else if (/^\d+\.\d+\./.test(line)) {
          return `<h2>${line.trim()}</h2>`;
        }
        // Format regular paragraphs
        else if (line.trim()) {
          return `<p>${line.trim()}</p>`;
        }
        return '';
      })
      .join('\n');

    const html = preHtml + formattedContent + postHtml;

    // Convert image to base64
    const canvas = document.createElement('canvas');
    const img = new Image();
    img.src = bankLogo;
    
    img.onload = () => {
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0);
      
      // Replace the image src with base64 data
      const base64Logo = canvas.toDataURL('image/png');
      const finalHtml = html.replace(bankLogo, base64Logo);
      
      const blob = new Blob(['\ufeff', finalHtml], {
      type: 'application/msword'
    });

    // Create download link
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${formData.projectName || 'BRD'}.doc`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    };
  };

  // Version comparison function
  const compareVersions = (version1, version2) => {
    const differences = {};
    Object.keys(version1.data).forEach(key => {
      const diff = diffChars(version1.data[key] || '', version2.data[key] || '');
      if (diff.some(part => part.added || part.removed)) {
        differences[key] = diff;
      }
    });
    return differences;
  };

  // Enhanced template selection
  const handleTemplateChange = (template) => {
    setSelectedTemplate(template);
    const templateConfig = templates[template];
    
    // Update form validation based on template requirements
    const newValidationErrors = {};
    templateConfig.fields.forEach(field => {
      if (!formData[field.name]?.trim()) {
        newValidationErrors[field.name] = `${field.label} wajib diisi`;
      }
    });
    setValidationErrors(newValidationErrors);

    // Show template details
    setSelectedTemplateDetails(templateConfig);
    setShowTemplateDetails(true);

    // Auto-scroll to first required empty field
    const firstEmptyField = templateConfig.fields.find(field => !formData[field.name]?.trim());
    if (firstEmptyField) {
      document.getElementsByName(firstEmptyField.name)[0]?.scrollIntoView({ behavior: 'smooth' });
    }
  };

  // Enhanced version comparison
  const showVersionDiff = (version1, version2) => {
    const differences = compareVersions(version1, version2);
    const formattedDiff = Object.entries(differences).map(([field, diff]) => ({
      field,
      changes: diff.map(part => ({
        text: part.value,
        type: part.added ? 'addition' : part.removed ? 'deletion' : 'unchanged'
      }))
    }));
    
    setDiffContent({
      version1: {
        timestamp: version1.timestamp,
        number: versions.findIndex(v => v.id === version1.id) + 1
      },
      version2: {
        timestamp: version2.timestamp,
        number: versions.findIndex(v => v.id === version2.id) + 1
      },
      differences: formattedDiff
    });
    setShowDiffModal(true);
  };

  // Add this JSX for the version diff modal
  const VersionDiffModal = () => showDiffModal && (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto p-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold">
            Comparing Version {diffContent.version1.number} and {diffContent.version2.number}
          </h3>
          <button
            onClick={() => setShowDiffModal(false)}
            className="text-gray-500 hover:text-gray-700"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="space-y-4">
          {diffContent.differences.map(({ field, changes }) => (
            <div key={field} className="border rounded-lg p-4">
              <h4 className="font-medium mb-2">{field}</h4>
              <div className="space-y-1">
                {changes.map((change, i) => (
                  <span
                    key={i}
                    className={`inline ${
                      change.type === 'addition'
                        ? 'bg-green-100 text-green-800'
                        : change.type === 'deletion'
                        ? 'bg-red-100 text-red-800'
                        : ''
                    }`}
                  >
                    {change.text}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  // Add this JSX for the template details modal
  const TemplateDetailsModal = () => showTemplateDetails && (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full p-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold">{selectedTemplateDetails.name}</h3>
          <button
            onClick={() => setShowTemplateDetails(false)}
            className="text-gray-500 hover:text-gray-700"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <p className="text-gray-600 mb-4">{selectedTemplateDetails.description}</p>
        <div className="space-y-2">
          <h4 className="font-medium">Required Fields:</h4>
          <ul className="list-disc list-inside space-y-1">
            {selectedTemplateDetails.fields.map(field => (
              <li key={field.name} className="text-gray-600">
                {field.label}
                {!formData[field.name]?.trim() && (
                  <span className="text-red-500 ml-2">(not filled)</span>
                )}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );

  const handleContentEdit = (section, content) => {
    setEditableContent(prev => ({
      ...prev,
      [section]: content
    }));
  };

  const saveEditedContent = () => {
    const updatedVersion = {
      ...lastSavedVersion,
      id: Date.now(),
      timestamp: new Date().toISOString(),
      editedContent: editableContent
    };

    setVersions(prev => {
      const newVersions = [updatedVersion, ...prev].slice(0, 10);
      setLastSavedVersion(updatedVersion);
      return newVersions;
    });

    toast.success('Perubahan berhasil disimpan!', {
      position: "bottom-right",
      autoClose: 3000
    });
    setIsEditing(false);
  };

  return (
    <>
      <div className="min-h-screen bg-gradient-to-br from-[#00008B]/10 via-white to-[#00008B]/5 py-12 px-4 sm:px-6 lg:px-8">
        <BrdPreviewStyles />
        <ToastContainer />
        <VersionDiffModal />
        <TemplateDetailsModal />
        
        {/* Enhanced Header Section */}
        <div className="max-w-7xl mx-auto mb-12">
          <div className="bg-white/50 backdrop-blur-sm rounded-2xl shadow-xl p-8 border border-white/20">
            <div className="flex flex-col items-center">
              <div className="relative mb-6">
                <div className="absolute -inset-1 "></div>
                <img src={bankLogo} alt="Bank Jateng Logo" className="relative h-20 w-auto" />
              </div>
              <h1 className="text-4xl font-bold bg-gradient-to-r from-[#00008B] to-[#4169E1] bg-clip-text text-transparent mb-4 text-center">
                Sistem Pembuatan Dokumen Kebutuhan Bisnis
              </h1>
              <p className="text-gray-600 text-lg font-medium">
                Divisi Digital & Development Innovation
              </p>
            </div>
          </div>
        </div>

        {/* Enhanced Template Selection */}
        <div className="max-w-7xl mx-auto mb-8">
          <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg p-8 border border-white/20">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-semibold bg-gradient-to-r from-[#00008B] to-[#4169E1] bg-clip-text text-transparent">
                Pilih Template
              </h2>
              <button
                onClick={() => setPreviewMode(!previewMode)}
                className={`px-5 py-2.5 rounded-xl text-sm font-medium transition-all duration-300 ${
                  previewMode
                    ? 'bg-gradient-to-r from-[#00008B] to-[#4169E1] text-white shadow-lg shadow-blue-500/30'
                    : 'bg-gray-100 text-[#00008B] hover:bg-gray-200'
                }`}
              >
                {previewMode ? 'Mode Edit' : 'Mode Preview'}
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {Object.entries(templates).map(([key, template]) => (
                <div
                  key={key}
                  className={`relative rounded-2xl transition-all duration-300 transform hover:scale-[1.02] ${
                    selectedTemplate === key
                      ? 'bg-gradient-to-br from-[#00008B] to-[#4169E1] text-white shadow-lg shadow-blue-500/30'
                      : 'bg-white border-2 border-gray-100 hover:border-[#00008B]/30 hover:shadow-lg'
                  }`}
                >
                  <button
                    onClick={() => handleTemplateChange(key)}
                    className="w-full p-6 text-left"
                  >
                    <div className="flex flex-col h-full">
                      <h3 className={`font-semibold mb-3 ${
                        selectedTemplate === key ? 'text-white' : 'text-[#00008B]'
                      }`}>{template.name}</h3>
                      <p className={`text-sm mb-4 ${
                        selectedTemplate === key ? 'text-white/90' : 'text-gray-600'
                      }`}>{template.description}</p>
                      <div className="mt-auto">
                        <span className={`text-xs font-medium px-3 py-1 rounded-full ${
                          selectedTemplate === key
                            ? 'bg-white/20 text-white'
                            : 'bg-[#00008B]/5 text-[#00008B]'
                        }`}>
                          {template.fields.length} field diperlukan
                        </span>
                      </div>
                    </div>
                  </button>
                  {selectedTemplate === key && (
                    <div className="absolute -top-2 -right-2">
                      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-white text-[#00008B] shadow-lg">
                        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
                        </svg>
                      </span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Enhanced Version History */}
        {versions.length > 0 && (
          <div className="max-w-7xl mx-auto mb-8">
            <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg p-8 border border-white/20">
              <div className="flex justify-between items-center mb-6">
                <div>
                  <h2 className="text-xl font-semibold bg-gradient-to-r from-[#00008B] to-[#4169E1] bg-clip-text text-transparent">
                    Riwayat Hasil Generate
                  </h2>
                  <p className="text-sm text-gray-500 mt-2">
                    Menyimpan {versions.length} hasil generate terakhir
                  </p>
                </div>
              </div>
              <div className="space-y-4">
                {versions.map((version, index) => (
                  <div
                    key={version.id}
                    className="flex items-center justify-between p-6 rounded-xl border border-gray-100 bg-white hover:shadow-lg transition-all duration-300 transform hover:scale-[1.01]"
                  >
                    <div>
                      <div className="flex items-center space-x-3">
                        <p className="font-semibold text-[#00008B]">Generate #{versions.length - index}</p>
                        {lastSavedVersion?.id === version.id && (
                          <span className="px-3 py-1 text-xs font-medium text-[#00008B] bg-[#00008B]/10 rounded-full">
                            Hasil Terbaru
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-gray-500 mt-2">
                        {new Date(version.timestamp).toLocaleString('id-ID', {
                          weekday: 'long',
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </p>
                      <div className="mt-3">
                        <span className="inline-flex items-center px-3 py-1 rounded-full bg-[#00008B]/5 text-[#00008B] text-xs font-medium">
                          Proyek: {version.projectName || 'Untitled'}
                        </span>
                      </div>
                    </div>
                    <div className="flex space-x-3">
                      <button
                        onClick={() => {
                          setFormData(version.data);
                          setGeneratedBRD(version.generatedContent);
                          toast.success('Berhasil memuat hasil generate #' + (versions.length - index));
                        }}
                        className="px-5 py-2.5 text-sm font-medium rounded-xl bg-gradient-to-r from-[#00008B] to-[#4169E1] text-white hover:shadow-lg shadow-blue-500/30 transition-all duration-300"
                      >
                        Tampilkan
                      </button>
                      {index > 0 && (
                        <button
                          onClick={() => showVersionDiff(version, versions[index - 1])}
                          className="px-5 py-2.5 text-sm font-medium rounded-xl border-2 border-[#00008B] text-[#00008B] hover:bg-[#00008B]/5 transition-all duration-300"
                        >
                          Bandingkan
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Enhanced Main Form Section */}
        <div className="max-w-7xl mx-auto bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg border border-white/20 overflow-hidden">
          <div className="px-8 py-12">
            <div className="max-w-3xl mx-auto">
              {error && (
                <div className="mb-8 bg-red-50 border-l-4 border-red-400 p-6 rounded-xl">
                  <div className="flex">
                    <div className="flex-shrink-0">
                      <svg className="h-6 w-6 text-red-400" viewBox="0 0 24 24" fill="currentColor">
                        <path fillRule="evenodd" d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10zm-1.5-5.5l-4-4 1.5-1.5L11 14l6.5-6.5 1.5 1.5-8 8z" clipRule="evenodd" />
                      </svg>
                    </div>
                    <div className="ml-4">
                      <p className="text-sm text-red-700">{error}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Enhanced Form Tabs */}
              <div className="mb-8">
                <div className="border-b border-gray-200">
                  <nav className="-mb-px flex space-x-8" aria-label="Tabs">
                    {['info', 'scope', 'requirements', 'planning'].map((tab) => (
                      <button
                        key={tab}
                        onClick={() => setActiveTab(tab)}
                        className={`${
                          activeTab === tab
                            ? 'border-[#00008B] text-[#00008B]'
                            : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                        } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-all duration-300`}
                      >
                        {tab === 'info' && 'Informasi Dasar'}
                        {tab === 'scope' && 'Ruang Lingkup'}
                        {tab === 'requirements' && 'Kebutuhan'}
                        {tab === 'planning' && 'Perencanaan'}
                      </button>
                    ))}
                  </nav>
                </div>

                {/* Form Content */}
                {activeTab === 'info' && (
                  <div className="grid grid-cols-1 gap-8 mt-8">
                    {templates[selectedTemplate].fields
                      .filter(field => ['projectName', 'documentNumber', 'currentCondition', 'problems', 'problemImpact', 'mainNeeds', 'businessImpact', 'businessValue', 'mainObjective', 'specificObjectives', 'measurableTargets'].includes(field.name))
                      .map(field => (
                        <div key={field.name} className="bg-white p-8 rounded-xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow duration-300">
                          <h3 className="text-lg font-semibold bg-gradient-to-r from-[#00008B] to-[#4169E1] bg-clip-text text-transparent mb-6">
                            {field.label}
                          </h3>
                          <FormField
                            label={field.label}
                            name={field.name}
                            value={formData[field.name]}
                            onChange={handleInputChange}
                            error={validationErrors[field.name]}
                            type={['projectName', 'documentNumber'].includes(field.name) ? 'text' : 'textarea'}
                            required={field.required}
                          />
                        </div>
                      ))}
                  </div>
                )}

                {activeTab === 'scope' && (
                  <div className="grid grid-cols-1 gap-8 mt-8">
                    {templates[selectedTemplate].fields
                      .filter(field => ['scope', 'inScope', 'outScope', 'stakeholders'].includes(field.name))
                      .map(field => (
                        <div key={field.name} className="bg-white p-8 rounded-xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow duration-300">
                          <h3 className="text-lg font-semibold bg-gradient-to-r from-[#00008B] to-[#4169E1] bg-clip-text text-transparent mb-6">
                            {field.label}
                          </h3>
                          <FormField
                            label={field.label}
                            name={field.name}
                            value={formData[field.name]}
                            onChange={handleInputChange}
                            error={validationErrors[field.name]}
                            type="textarea"
                            required={field.required}
                          />
                        </div>
                      ))}
                  </div>
                )}

                {activeTab === 'requirements' && (
                  <div className="grid grid-cols-1 gap-8 mt-8">
                    {templates[selectedTemplate].fields
                      .filter(field => ['functionalRequirements', 'nonFunctionalRequirements', 'assumptions', 'constraints'].includes(field.name))
                      .map(field => (
                        <div key={field.name} className="bg-white p-8 rounded-xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow duration-300">
                          <h3 className="text-lg font-semibold bg-gradient-to-r from-[#00008B] to-[#4169E1] bg-clip-text text-transparent mb-6">
                            {field.label}
                          </h3>
                          <FormField
                            label={field.label}
                            name={field.name}
                            value={formData[field.name]}
                            onChange={handleInputChange}
                            error={validationErrors[field.name]}
                            type="textarea"
                            required={field.required}
                          />
                        </div>
                      ))}
                  </div>
                )}

                {activeTab === 'planning' && (
                  <div className="grid grid-cols-1 gap-8 mt-8">
                    {templates[selectedTemplate].fields
                      .filter(field => ['risks', 'success_criteria', 'timeline', 'budget'].includes(field.name))
                      .map(field => (
                        <div key={field.name} className="bg-white p-8 rounded-xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow duration-300">
                          <h3 className="text-lg font-semibold bg-gradient-to-r from-[#00008B] to-[#4169E1] bg-clip-text text-transparent mb-6">
                            {field.label}
                          </h3>
                          <FormField
                            label={field.label}
                            name={field.name}
                            value={formData[field.name]}
                            onChange={handleInputChange}
                            error={validationErrors[field.name]}
                            type="textarea"
                            required={field.required}
                          />
                        </div>
                      ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Enhanced Action Buttons */}
          <div className="mt-8 flex justify-between items-center px-8 pb-8">
            <div className="flex items-center space-x-4">
              <button
                onClick={generateBRD}
                disabled={loading}
                className="inline-flex items-center px-8 py-3 rounded-xl text-base font-medium text-white bg-gradient-to-r from-[#00008B] to-[#4169E1] hover:shadow-lg shadow-blue-500/30 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed transform hover:scale-[1.02]"
              >
                {loading ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Sedang Membuat...
                  </>
                ) : (
                  'Buat BRD'
                )}
              </button>
            </div>
            <button
              onClick={() => setFormData({
                projectName: '',
                documentNumber: '',
                currentCondition: '',
                problems: '',
                problemImpact: '',
                mainNeeds: '',
                businessImpact: '',
                businessValue: '',
                mainObjective: '',
                specificObjectives: '',
                measurableTargets: '',
                background: '',
                businessNeed: '',
                scope: '',
                inScope: '',
                outScope: '',
                objectives: '',
                stakeholders: '',
                functionalRequirements: '',
                nonFunctionalRequirements: '',
                assumptions: '',
                constraints: '',
                risks: '',
                success_criteria: '',
                timeline: '',
                budget: '',
                approvers: ''
              })}
              className="inline-flex items-center px-6 py-3 border-2 border-gray-300 rounded-xl text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 hover:border-[#00008B]/30 transition-all duration-300"
            >
              Bersihkan Form
            </button>
          </div>
        </div>
      </div>

      {/* Enhanced Generated BRD Preview */}
      {generatedBRD && (
        <div className="max-w-7xl mx-auto mt-8 mb-12">
          <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg border border-white/20 overflow-hidden">
            <div className="px-8 py-8">
              <div className="flex justify-between items-center mb-8">
                <h2 className="text-xl font-semibold bg-gradient-to-r from-[#00008B] to-[#4169E1] bg-clip-text text-transparent">
                  Hasil Generate BRD
                </h2>
                <div className="flex space-x-3">
                  <button
                    onClick={() => setIsEditing(!isEditing)}
                    className="px-5 py-2.5 text-sm font-medium rounded-xl border-2 border-[#00008B] text-[#00008B] hover:bg-[#00008B]/5 transition-all duration-300"
                  >
                    {isEditing ? 'Batal Edit' : 'Edit Dokumen'}
                  </button>
                  {isEditing && (
                    <button
                      onClick={saveEditedContent}
                      className="px-5 py-2.5 text-sm font-medium rounded-xl bg-gradient-to-r from-[#00008B] to-[#4169E1] text-white hover:shadow-lg shadow-blue-500/30 transition-all duration-300"
                    >
                      Simpan Perubahan
                    </button>
                  )}
                  <button
                    onClick={exportToWord}
                    className="px-5 py-2.5 text-sm font-medium rounded-xl bg-gradient-to-r from-[#00008B] to-[#4169E1] text-white hover:shadow-lg shadow-blue-500/30 transition-all duration-300"
                  >
                    Ekspor ke Word
                  </button>
                </div>
              </div>

              <div className="brd-preview prose max-w-none">
                <div className="brd-document" style={{
                  maxWidth: '21cm',
                  padding: '2.54cm',
                  margin: '0 auto',
                  background: 'white',
                  boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
                  whiteSpace: 'pre-wrap',
                  fontFamily: 'Times New Roman',
                  fontSize: '12pt',
                  lineHeight: '1.6',
                  color: '#1a1a1a'
                }}>
                  <div className="brd-header" style={{
                    marginBottom: '2cm',
                    textAlign: 'center'
                  }}>
                    <div className="logo-container" style={{
                      marginBottom: '1cm'
                    }}>
                      <img 
                        src={bankLogo} 
                        alt="Bank Jateng Logo" 
                        style={{
                          width: '200px',
                          height: 'auto',
                          margin: '0 auto'
                        }}
                      />
                    </div>
                    <h1 style={{
                      fontSize: '14pt',
                      fontWeight: 'bold',
                      marginBottom: '0.5cm'
                    }}>PT BANK PEMBANGUNAN DAERAH JAWA TENGAH</h1>
                    <div style={{
                      width: '80%',
                      margin: '0.5cm auto',
                      borderTop: '2px solid black'
                    }}></div>
                    <h2 style={{
                      fontSize: '12pt',
                      fontWeight: 'bold',
                      marginBottom: '0.3cm'
                    }}>DOKUMEN KEBUTUHAN BISNIS</h2>
                    <h3 style={{
                      fontSize: '12pt',
                      fontWeight: 'bold',
                      marginBottom: '1cm'
                    }}>{formData.projectName || 'Untitled Project'}</h3>
                    <p style={{
                      fontSize: '12pt'
                    }}>SEMARANG</p>
                    <p style={{
                      fontSize: '12pt'
                    }}>{new Date().toLocaleDateString('id-ID', {
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric'
                    })}</p>
                  </div>

                  <div className="brd-content" style={{
                    whiteSpace: 'pre-wrap',
                    textAlign: 'justify'
                  }}>
                    {generatedBRD.split('\n').map((line, index) => (
                      <p key={index} style={{ marginBottom: '0.8em' }}>{line}</p>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
});

Main.displayName = 'Main';

export default Main;
