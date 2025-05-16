'use client';

import { useSearchParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowPathIcon, ArrowUturnLeftIcon } from '@heroicons/react/24/outline';

interface AnalysisResult {
  extractedText?: string;
  error?: string;
  message?: string;
  // Weitere Felder je nach API-Antwort
}

export default function DocumentAnalysisViewerPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [filePath, setFilePath] = useState<string | null>(null);
  const [fileType, setFileType] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [documentId, setDocumentId] = useState<string | null>(null); // Hinzugefügt für documentId

  const [isLoading, setIsLoading] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fp = searchParams.get('filePath');
    const ft = searchParams.get('fileType');
    const fn = searchParams.get('fileName');
    const id = searchParams.get('documentId'); // documentId auslesen
    
    setFilePath(fp);
    setFileType(ft);
    setFileName(fn);
    setDocumentId(id);

    if (!fp || !fn) {
      // setError('Fehlende Dateiparameter für die Analyse.');
      // Optional: router.replace('/document-library');
    }
  }, [searchParams, router]);

  const handleStartAnalysis = async () => {
    if (!filePath || !fileType || !documentId) {
      setError('Wichtige Informationen für die Analyse fehlen (Dateipfad, Typ oder ID).');
      return;
    }
    setIsLoading(true);
    setError(null);
    setAnalysisResult(null);
    try {
      const response = await fetch('/api/rules/analyze-document', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          filePath: filePath, // Der Pfad sollte relativ zu persistent_uploads/documents/ sein
          originalFileType: fileType,
          documentId: documentId, // documentId an API senden
        }),
      });

      const resultData = await response.json();

      if (!response.ok) {
        throw new Error(resultData.error || `Fehler bei der Analyse (HTTP ${response.status})`);
      }
      setAnalysisResult(resultData);
    } catch (e: any) {
      setError(e.message);
      setAnalysisResult({ error: e.message });
    } finally {
      setIsLoading(false);
    }
  };

  if (error && !analysisResult) { // Fehler anzeigen, wenn keine Ergebnisse da sind, die ihn überschreiben
    return (
        <div className="min-h-screen bg-slate-100 flex flex-col items-center justify-center p-4">
            <div className="bg-white p-8 rounded-xl shadow-xl text-center max-w-md">
                <h1 className="text-2xl font-bold text-red-600 mb-4">Fehler</h1>
                <p className="text-slate-700 mb-6">{error}</p>
                <Link href="/document-library" className="inline-flex items-center px-4 py-2 text-sm bg-sky-600 text-white font-semibold rounded-md hover:bg-sky-700">
                    <ArrowUturnLeftIcon className="h-4 w-4 mr-2" />
                    Zurück zur Dokumentenbibliothek
                </Link>
            </div>
        </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 p-4 sm:p-8">
      <div className="container mx-auto">
        <header className="mb-8">
            <Link 
                href="/document-library" 
                className="inline-flex items-center px-4 py-2 text-sm bg-white text-slate-700 font-semibold rounded-md border border-slate-300 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-opacity-75 mb-6"
            >
                <ArrowUturnLeftIcon className="h-4 w-4 mr-2" />
                Zurück zur Dokumentenbibliothek
            </Link>
            <h1 className="text-3xl font-bold text-slate-800">Dokumentenanalyse</h1>
        </header>

        <div className="bg-white p-6 sm:p-8 rounded-xl shadow-lg mb-8">
          <h2 className="text-xl font-semibold text-slate-700 mb-1">Analyse für:</h2>
          {fileName ? (
            <p className="text-slate-600 mb-1 truncate" title={fileName}><span className="font-medium">Originalname:</span> {fileName}</p>
          ) : <p className="text-slate-500">Dateiname nicht verfügbar.</p>}
          {filePath ? (
            <p className="text-slate-600 mb-1 text-sm break-all"><span className="font-medium">Pfad:</span> {filePath}</p>
           ) : <p className="text-slate-500 text-sm">Dateipfad nicht verfügbar.</p>}
           {documentId && (
            <p className="text-slate-600 mb-4 text-sm"><span className="font-medium">Document ID:</span> {documentId}</p>
           )}

          {!analysisResult && (
            <button
              onClick={handleStartAnalysis}
              disabled={isLoading || !filePath || !documentId}
              className="mt-4 w-full md:w-auto inline-flex items-center justify-center px-6 py-2.5 text-sm font-semibold text-white bg-sky-600 rounded-md shadow-sm hover:bg-sky-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-sky-500 disabled:opacity-60"
            >
              {isLoading ? (
                <ArrowPathIcon className="animate-spin h-4 w-4 mr-2" />
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5 mr-2">
                  <path d="M10 3.75a2 2 0 100 4 2 2 0 000-4z" />
                  <path fillRule="evenodd" d="M10 1.5a8.5 8.5 0 100 17 8.5 8.5 0 000-17zM2.341 11.634a1 1 0 011.32-1.49l.006.005.006.005a.816.816 0 01.95.23 5.492 5.492 0 004.251 2.081 5.49 5.49 0 004.25-2.08.815.815 0 01.95-.231l.007-.005.005-.005a1 1 0 111.321 1.49l-.005.006-.005.006a2.316 2.316 0 00-1.628.457 6.993 6.993 0 01-1.606.784 6.995 6.995 0 01-2.718 0A6.993 6.993 0 017.1 12.09a2.316 2.316 0 00-1.628-.458l-.005-.005z" clipRule="evenodd" />
                </svg>
              )}
              {isLoading ? 'Analysiere...' : 'Analyse starten'}
            </button>
          )}
        </div>

        {isLoading && (
          <div className="text-center py-10 bg-white p-6 sm:p-8 rounded-xl shadow-lg">
            <ArrowPathIcon className="h-8 w-8 text-slate-400 animate-spin mx-auto mb-3" />
            <p className="text-slate-500">Analyse wird durchgeführt...</p>
          </div>
        )}

        {analysisResult && (
          <div className="bg-white p-6 sm:p-8 rounded-xl shadow-lg">
            <h2 className="text-xl font-semibold text-slate-700 mb-4">Analyseergebnis</h2>
            {analysisResult.message && (
                <div className="mb-4 p-3 bg-sky-50 text-sky-700 border border-sky-200 rounded-md text-sm">
                    {analysisResult.message}
                </div>
            )}
            {analysisResult.error && (
              <div className="mb-4 p-3 bg-red-50 text-red-700 border border-red-200 rounded-md text-sm">
                <p><strong>Fehler bei der Analyse:</strong> {analysisResult.error}</p>
              </div>
            )}
            {analysisResult.extractedText && (
              <div>
                <h3 className="text-lg font-semibold text-slate-700 mb-2">Extrahierter Text:</h3>
                <pre className="bg-slate-50 p-4 rounded-md text-sm text-slate-800 whitespace-pre-wrap max-h-96 overflow-y-auto">{
                  analysisResult.extractedText.length > 1000 ? 
                  analysisResult.extractedText.substring(0, 1000) + '... (gekürzt)' : 
                  analysisResult.extractedText
                }</pre>
              </div>
            )}
            {!analysisResult.extractedText && !analysisResult.error && !analysisResult.message && (
                <p className="text-slate-500">Keine spezifischen Daten vom Analyseendpunkt erhalten.</p>
            )
            }
          </div>
        )}
      </div>
    </div>
  );
} 