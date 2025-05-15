'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import RuleForm from '@/components/RuleForm';
import { Rule } from '@/types/rule';
import { UserRole } from '@/types/enums';
import { ArrowUturnLeftIcon, ArrowPathIcon, DocumentArrowUpIcon, SparklesIcon } from '@heroicons/react/24/outline';

export default function NewRulePage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [analyzedRuleData, setAnalyzedRuleData] = useState<Partial<Rule> | null>(null);
  const [detectedRules, setDetectedRules] = useState<any[]>([]);
  const [generatedEmbedding, setGeneratedEmbedding] = useState<number[] | null>(null);

  useEffect(() => {
    if (status === 'loading') return;
    if (status === 'unauthenticated') {
      router.replace('/login');
      return;
    }
    const allowedCreateRoles: UserRole[] = [UserRole.ADMIN, UserRole.COMPLIANCE_MANAGER_FULL, UserRole.COMPLIANCE_MANAGER_WRITE];
    
    if (session?.user?.roles && !session.user.roles.some(role => allowedCreateRoles.includes(role))) {
      alert('Sie haben keine Berechtigung, neue Regeln zu erstellen.');
      router.replace('/rule-manager');
    }
  }, [status, session, router]);

  if (status === 'loading' || !session) {
    return (
      <div className="flex justify-center items-center min-h-screen bg-slate-100">
        <div className="text-center">
          <ArrowPathIcon className="h-12 w-12 text-slate-500 animate-spin mx-auto mb-4" />
          <p className="text-xl font-semibold text-slate-700">Lade Seite zum Erstellen einer neuen Regel...</p>
        </div>
      </div>
    );
  }

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files[0]) {
      setSelectedFile(event.target.files[0]);
      setAnalysisError(null); // Reset error on new file selection
      setAnalyzedRuleData(null); // Reset previous analysis
      setGeneratedEmbedding(null); // Reset previous embedding
      setDetectedRules([]); // Reset the detected rules
    }
  };

  const handleAnalyzeDocument = async () => {
    if (!selectedFile) {
      setAnalysisError('Bitte wählen Sie zuerst eine Datei aus.');
      return;
    }

    setIsAnalyzing(true);
    setAnalysisError(null);
    setAnalyzedRuleData(null);
    setGeneratedEmbedding(null);
    setDetectedRules([]);

    const formData = new FormData();
    formData.append('file', selectedFile);

    try {
      const response = await fetch('/api/rules/analyze-document', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        let detailedError = `Fehler bei der Dokumentenanalyse (HTTP ${response.status}).`;
        if (errorData.documentLevelError) detailedError += ` Dokument: ${errorData.documentLevelError}.`;
        if (errorData.extractionError) detailedError += ` Extraktion: ${errorData.extractionError}.`;
        if (errorData.embeddingError) detailedError += ` Embedding: ${errorData.embeddingError}.`;
        if (errorData.message && !errorData.documentLevelError && !errorData.extractionError && !errorData.embeddingError) {
            detailedError = errorData.message;
        }
        throw new Error(detailedError);
      }

      const result = await response.json();
      let successMessage = "Dokument erfolgreich analysiert!";
      let currentAnalysisError = null;

      if (result.analyzedRules && result.analyzedRules.length > 0) {
        setDetectedRules(result.analyzedRules);
        setAnalyzedRuleData(result.analyzedRules[0].extractedFields || {});
        successMessage += ` ${result.analyzedRules.length} Regel(n) erkannt. Erste Regel ins Formular geladen.`;
        console.log("Erkannte Regeln:", result.analyzedRules);
        if (result.analyzedRules.length > 1) {
          alert(`${result.analyzedRules.length} Regeln wurden im Dokument erkannt. Die erste Regel wurde in das Formular geladen. Bitte überprüfen Sie die Konsole für alle erkannten Regeln. Eine UI zur Auswahl wird später implementiert.`);
        }
      } else {
        successMessage += " Keine Regeln im Dokument gefunden.";
        if (result.extractionError) {
            successMessage += ` Extraktionsproblem: ${result.extractionError}.`;
            currentAnalysisError = `Extraktion: ${result.extractionError}`;
        }
      }

      if (result.documentEmbedding) {
        setGeneratedEmbedding(result.documentEmbedding);
        successMessage += " Dokumenten-Embedding generiert.";
      } else {
        if (result.embeddingError) {
            successMessage += ` Embedding-Problem: ${result.embeddingError}.`;
            currentAnalysisError = currentAnalysisError ? `${currentAnalysisError} Embedding: ${result.embeddingError}` : `Embedding: ${result.embeddingError}`;
        }
      }
      
      if (result.documentLevelError){
        successMessage = `Dokumentenproblem: ${result.documentLevelError}.`;
        currentAnalysisError = result.documentLevelError;
      }

      setAnalysisError(currentAnalysisError);
      alert(successMessage.trim());

    } catch (e: Error | unknown) {
      console.error('Fehler bei der Dokumentenanalyse:', e);
      const errorMessage = e instanceof Error ? e.message : 'Ein unbekannter Fehler ist bei der Analyse aufgetreten.';
      setAnalysisError(errorMessage);
      alert(`Analyse fehlgeschlagen: ${errorMessage}`);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleSubmit = async (formData: Partial<Rule>) => {
    setIsSubmitting(true);
    setSubmitError(null);

    const finalFormData = { ...formData };
    if (generatedEmbedding) {
      finalFormData.embedding = generatedEmbedding;
    }

    try {
      const response = await fetch('/api/rules', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(finalFormData), // Sende Daten inklusive Embedding
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Fehler beim Erstellen der Regel.');
      }
      
      alert('Regel erfolgreich erstellt!'); 
      router.push('/rule-manager');

    } catch (e: Error | unknown) {
      console.error('Fehler beim Senden des Formulars:', e);
      setSubmitError(e instanceof Error ? e.message : 'Ein unbekannter Fehler ist aufgetreten.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100">
      <div className="container mx-auto px-4 py-8">
        <header className="mb-8">
          <Link 
            href="/rule-manager" 
            className="inline-flex items-center px-4 py-2 text-sm bg-white text-slate-700 font-semibold rounded-md border border-slate-300 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-opacity-75 mb-4"
          >
            <ArrowUturnLeftIcon className="h-4 w-4 mr-2" />
            Zurück zum Rule Manager
          </Link>
          <h1 className="text-3xl font-bold text-slate-800">Neue Regel erstellen</h1>
        </header>

        <div className="mb-8 p-6 bg-white rounded-xl shadow-lg border border-sky-200">
          <h2 className="text-xl font-semibold text-slate-700 mb-3">
            <SparklesIcon className="h-6 w-6 inline-block mr-2 text-sky-500" />
            Regel automatisch aus Dokument erstellen (Optional)
          </h2>
          <p className="text-sm text-slate-600 mb-4">
            Laden Sie ein Dokument hoch (z.B. PDF, DOCX, TXT). Die KI versucht, die relevanten Felder für die neue Regel automatisch zu extrahieren.
          </p>
          <div className="space-y-4">
            <div>
              <label htmlFor="file-upload" className="block text-sm font-medium text-slate-700 mb-1">
                Dokument auswählen
              </label>
              <input 
                id="file-upload" 
                name="file-upload" 
                type="file" 
                onChange={handleFileChange}
                className="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-sky-50 file:text-sky-700 hover:file:bg-sky-100"
                accept=".pdf,.doc,.docx,.txt"
              />
            </div>
            {selectedFile && (
              <p className="text-sm text-slate-500">Ausgewählte Datei: {selectedFile.name}</p>
            )}
            <button
              type="button"
              onClick={handleAnalyzeDocument}
              disabled={!selectedFile || isAnalyzing || isSubmitting}
              className="inline-flex items-center justify-center px-4 py-2 text-sm font-semibold text-white bg-sky-600 rounded-md shadow-sm hover:bg-sky-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-sky-500 disabled:opacity-60"
            >
              {isAnalyzing ? (
                <ArrowPathIcon className="animate-spin h-4 w-4 mr-2" />
              ) : (
                <DocumentArrowUpIcon className="h-4 w-4 mr-2" />
              )}
              {isAnalyzing ? 'Analysiere...' : 'Hochladen & Analysieren'}
            </button>
            {analysisError && (
              <div className="mt-2 p-3 bg-red-50 text-red-700 border border-red-200 rounded-md text-sm">
                <p><strong>Analysefehler:</strong> {analysisError}</p>
              </div>
            )}
          </div>
        </div>

        {submitError && (
          <div className="mb-6 p-4 bg-red-50 text-red-700 border border-red-300 rounded-md shadow-sm">
            <p><strong>Fehler beim Speichern:</strong> {submitError}</p>
          </div>
        )}

        <div className="bg-white p-6 sm:p-8 rounded-xl shadow-lg">
          <RuleForm 
            initialData={analyzedRuleData || {}}
            onSubmit={handleSubmit}
            isSubmitting={isSubmitting}
            submitButtonText="Regel erstellen"
            onCancel={() => router.push('/rule-manager')}
          />
        </div>
      </div>
    </div>
  );
} 