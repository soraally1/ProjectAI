import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import bankLogo from '../assets/i-BRDSystem.svg';

export const BRDViewer = () => {
  const { requestId } = useParams();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [request, setRequest] = useState(null);
  const [generatedContent, setGeneratedContent] = useState(null);
  const [templateFields, setTemplateFields] = useState(null);

  useEffect(() => {
    fetchRequest();
  }, [requestId]);

  const fetchRequest = async () => {
    try {
      setLoading(true);
      const requestDoc = await getDoc(doc(db, 'brd_requests', requestId));
      if (!requestDoc.exists()) {
        throw new Error('Request not found');
      }
      const requestData = { id: requestDoc.id, ...requestDoc.data() };
      console.log('Fetched BRD data:', requestData); // Debug log

      // Handle the generated content
      let content = requestData.generatedContent;
      if (typeof content === 'string') {
        // If content is a string (from GROQ), parse it into sections
        const sections = {
          pendahuluan: content.match(/I\. PENDAHULUAN[\s\S]*?(?=II\. KEBUTUHAN BISNIS|$)/)?.[0] || '',
          kebutuhanBisnis: content.match(/II\. KEBUTUHAN BISNIS[\s\S]*?(?=III\. RUANG LINGKUP|$)/)?.[0] || '',
          ruangLingkup: content.match(/III\. RUANG LINGKUP[\s\S]*?(?=IV\. ESTIMASI|$)/)?.[0] || '',
          estimasi: content.match(/IV\. ESTIMASI[\s\S]*?(?=V\. RISIKO DAN MITIGASI|$)/)?.[0] || '',
          risikoMitigasi: content.match(/V\. RISIKO DAN MITIGASI[\s\S]*/)?.[0] || ''
        };
        content = sections;
      }

      console.log('Processed content:', content); // Debug log
      
      setRequest(requestData);
      setGeneratedContent(content);
      setTemplateFields(requestData.formData || {});
    } catch (error) {
      console.error('Error fetching request:', error);
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return '';
    try {
      return new Date(dateString).toLocaleDateString('id-ID', {
        day: '2-digit',
        month: 'long',
        year: 'numeric'
      });
    } catch (error) {
      return dateString;
    }
  };

  const formatCurrency = (amount) => {
    if (!amount) return '';
    try {
      return new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency: 'IDR',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
      }).format(amount);
    } catch (error) {
      return amount;
    }
  };

  const exportToWord = () => {
    const template = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <style>
          @page {
            size: A4;
            margin: 2cm;
          }
          body {
            font-family: 'Times New Roman', Times, serif;
            font-size: 12pt;
            line-height: 1.5;
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
          .section-title {
            font-weight: bold;
            margin-bottom: 10px;
          }
          .content {
            text-align: justify;
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
              <td>${formatDate(templateFields?.tanggalPermintaan)}</td>
            </tr>
            <tr>
              <td class="field-label">Unit Bisnis</td>
              <td>${templateFields?.unitBisnis || ''}</td>
            </tr>
            <tr>
              <td class="field-label">Nama Pemohon</td>
              <td>${templateFields?.namaPemohon || ''}</td>
            </tr>
            <tr>
              <td class="field-label">Jabatan Pemohon</td>
              <td>${templateFields?.jabatanPemohon || ''}</td>
            </tr>
            <tr>
              <td class="field-label">Nama Project</td>
              <td>${templateFields?.namaProject || ''}</td>
            </tr>
            <tr>
              <td class="field-label">Jenis Permintaan</td>
              <td>${templateFields?.jenisPermintaan || ''}</td>
            </tr>
            <tr>
              <td class="field-label">Prioritas</td>
              <td>${templateFields?.prioritas || ''}</td>
            </tr>
            <tr>
              <td class="field-label">Target Implementasi</td>
              <td>${formatDate(templateFields?.targetImplementasi)}</td>
            </tr>
          </table>
        </div>
        
        ${generatedContent?.pendahuluan || ''}

        ${generatedContent?.kebutuhanBisnis || ''}

        ${generatedContent?.ruangLingkup || ''}

        ${generatedContent?.estimasi || ''}

        ${generatedContent?.risikoMitigasi || ''}

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
              <td>${templateFields?.dibuatOleh || ''}</td>
              <td>${templateFields?.diperiksaOleh || ''}</td>
              <td>${templateFields?.disetujuiOleh || ''}</td>
            </tr>
            <tr>
              <td>${formatDate(templateFields?.dibuatTanggal)}</td>
              <td>${formatDate(templateFields?.diperiksaTanggal)}</td>
              <td>${formatDate(templateFields?.disetujuiTanggal)}</td>
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
    link.download = `BRD_${request?.noBRD || 'Document'}.doc`;
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

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="bg-red-50 border-l-4 border-red-400 p-4">
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
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="bg-white shadow rounded-lg">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
          <h1 className="text-2xl font-bold text-gray-900">
            Business Requirement Document
          </h1>
          <button
            onClick={exportToWord}
            className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700"
          >
            <svg className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            Export to Word
          </button>
        </div>

        {/* Document Content */}
        <div className="px-6 py-8">
          <div className="prose max-w-none">
            {/* Document Header */}
            <div className="text-center mb-12">
              <img src={bankLogo} alt="Bank Logo" className="mx-auto h-20" />
              <h1 className="text-3xl font-bold mt-6 mb-2">BUSINESS REQUIREMENT DOCUMENT</h1>
              <p className="text-lg text-gray-600">No. BRD: {request?.noBRD}</p>
              <p className="text-lg text-gray-600">Tanggal: {formatDate(new Date())}</p>
            </div>

            {/* Basic Information */}
            <div className="mb-8">
              <table className="w-full border-collapse">
                <tbody>
                  <tr>
                    <td className="border border-gray-300 p-4 font-semibold w-1/3">Tanggal Permintaan</td>
                    <td className="border border-gray-300 p-4">{formatDate(templateFields?.tanggalPermintaan)}</td>
                  </tr>
                  <tr>
                    <td className="border border-gray-300 p-4 font-semibold">Unit Bisnis</td>
                    <td className="border border-gray-300 p-4">{templateFields?.unitBisnis}</td>
                  </tr>
                  <tr>
                    <td className="border border-gray-300 p-4 font-semibold">Nama Pemohon</td>
                    <td className="border border-gray-300 p-4">{templateFields?.namaPemohon}</td>
                  </tr>
                  <tr>
                    <td className="border border-gray-300 p-4 font-semibold">Jabatan Pemohon</td>
                    <td className="border border-gray-300 p-4">{templateFields?.jabatanPemohon}</td>
                  </tr>
                  <tr>
                    <td className="border border-gray-300 p-4 font-semibold">Nama Project</td>
                    <td className="border border-gray-300 p-4">{templateFields?.namaProject}</td>
                  </tr>
                  <tr>
                    <td className="border border-gray-300 p-4 font-semibold">Jenis Permintaan</td>
                    <td className="border border-gray-300 p-4">{templateFields?.jenisPermintaan}</td>
                  </tr>
                  <tr>
                    <td className="border border-gray-300 p-4 font-semibold">Prioritas</td>
                    <td className="border border-gray-300 p-4">{templateFields?.prioritas}</td>
                  </tr>
                  <tr>
                    <td className="border border-gray-300 p-4 font-semibold">Target Implementasi</td>
                    <td className="border border-gray-300 p-4">{formatDate(templateFields?.targetImplementasi)}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Generated Content */}
            <div className="space-y-8">
              {generatedContent?.informasiProyek && (
                <div className="bg-white rounded-lg border border-gray-200 p-6">
                  <div className="prose max-w-none">
                    <div className="whitespace-pre-wrap leading-relaxed">
                      <h2 className="text-2xl font-bold text-gray-900 mb-6">I. INFORMASI PROYEK</h2>
                      {generatedContent.informasiProyek.split('\n').slice(1).map((line, index) => (
                        <div key={index} className={`${line.match(/^\d+\.\d+\./) ? 'font-semibold text-lg mt-4' : 'ml-4 mt-2'}`}>
                          {line}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
              
              {generatedContent?.latarBelakang && (
                <div className="bg-white rounded-lg border border-gray-200 p-6">
                  <div className="prose max-w-none">
                    <div className="whitespace-pre-wrap leading-relaxed">
                      <h2 className="text-2xl font-bold text-gray-900 mb-6">II. LATAR BELAKANG</h2>
                      {generatedContent.latarBelakang.split('\n').slice(1).map((line, index) => (
                        <div key={index} className={`${line.match(/^\d+\.\d+\./) ? 'font-semibold text-lg mt-4' : 'ml-4 mt-2'}`}>
                          {line}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
              
              {generatedContent?.kebutuhanBisnis && (
                <div className="bg-white rounded-lg border border-gray-200 p-6">
                  <div className="prose max-w-none">
                    <div className="whitespace-pre-wrap leading-relaxed">
                      <h2 className="text-2xl font-bold text-gray-900 mb-6">III. KEBUTUHAN BISNIS</h2>
                      {generatedContent.kebutuhanBisnis.split('\n').slice(1).map((line, index) => (
                        <div key={index} className={`${line.match(/^\d+\.\d+\./) ? 'font-semibold text-lg mt-4' : 'ml-4 mt-2'}`}>
                          {line}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
              
              {generatedContent?.ruangLingkup && (
                <div className="bg-white rounded-lg border border-gray-200 p-6">
                  <div className="prose max-w-none">
                    <div className="whitespace-pre-wrap leading-relaxed">
                      <h2 className="text-2xl font-bold text-gray-900 mb-6">IV. RUANG LINGKUP</h2>
                      {generatedContent.ruangLingkup.split('\n').slice(1).map((line, index) => (
                        <div key={index} className={`${line.match(/^\d+\.\d+\./) ? 'font-semibold text-lg mt-4' : 'ml-4 mt-2'}`}>
                          {line}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
              
              {generatedContent?.kebutuhanSistem && (
                <div className="bg-white rounded-lg border border-gray-200 p-6">
                  <div className="prose max-w-none">
                    <div className="whitespace-pre-wrap leading-relaxed">
                      <h2 className="text-2xl font-bold text-gray-900 mb-6">V. KEBUTUHAN SISTEM</h2>
                      {generatedContent.kebutuhanSistem.split('\n').slice(1).map((line, index) => (
                        <div key={index} className={`${line.match(/^\d+\.\d+\./) ? 'font-semibold text-lg mt-4' : 'ml-4 mt-2'}`}>
                          {line}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
              
              {generatedContent?.perencanaan && (
                <div className="bg-white rounded-lg border border-gray-200 p-6">
                  <div className="prose max-w-none">
                    <div className="whitespace-pre-wrap leading-relaxed">
                      <h2 className="text-2xl font-bold text-gray-900 mb-6">VI. PERENCANAAN</h2>
                      {generatedContent.perencanaan.split('\n').slice(1).map((line, index) => (
                        <div key={index} className={`${line.match(/^\d+\.\d+\./) ? 'font-semibold text-lg mt-4' : 'ml-4 mt-2'}`}>
                          {line}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Signature Section */}
            <div className="mt-16">
              <table className="w-full border-collapse">
                <thead>
                  <tr>
                    <th className="border border-gray-300 p-4">Dibuat Oleh</th>
                    <th className="border border-gray-300 p-4">Diperiksa Oleh</th>
                    <th className="border border-gray-300 p-4">Disetujui Oleh</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="border border-gray-300 p-4 h-24"></td>
                    <td className="border border-gray-300 p-4 h-24"></td>
                    <td className="border border-gray-300 p-4 h-24"></td>
                  </tr>
                  <tr>
                    <td className="border border-gray-300 p-4">{templateFields?.dibuatOleh}</td>
                    <td className="border border-gray-300 p-4">{templateFields?.diperiksaOleh}</td>
                    <td className="border border-gray-300 p-4">{templateFields?.disetujuiOleh}</td>
                  </tr>
                  <tr>
                    <td className="border border-gray-300 p-4">{formatDate(templateFields?.dibuatTanggal)}</td>
                    <td className="border border-gray-300 p-4">{formatDate(templateFields?.diperiksaTanggal)}</td>
                    <td className="border border-gray-300 p-4">{formatDate(templateFields?.disetujuiTanggal)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}; 