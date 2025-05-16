'use client';

import { useState, useEffect, useMemo } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import { UserRole } from '@/types/enums';
import { RiskFormData, RiskProbability, RiskImpact, RiskStatus } from '@/types/risk';
import RiskForm from '@/components/RiskForm';

// Hilfsfunktion zur Überprüfung der Benutzerrollen
const userHasRoles = (userRoles: UserRole[] | undefined, targetRoles: UserRole[]): boolean => {
  if (!userRoles) return false;
  return userRoles.some(role => targetRoles.includes(role));
};

export default function NewRiskPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [allowedToCreate, setAllowedToCreate] = useState(false);

  const initialRiskData = useMemo(() => {
    const prefillData: Partial<RiskFormData> = {};
    // Primäre Felder
    if (searchParams.get('title')) prefillData.title = searchParams.get('title') as string;
    if (searchParams.get('description')) prefillData.description = searchParams.get('description') as string;
    if (searchParams.get('category')) prefillData.category = searchParams.get('category') as string;
    if (searchParams.get('source')) prefillData.source = searchParams.get('source') as string;
    
    // Enum-Felder
    const probabilityParam = searchParams.get('probability');
    if (probabilityParam && Object.values(RiskProbability).includes(probabilityParam as RiskProbability)) {
      prefillData.probability = probabilityParam as RiskProbability;
    }
    const impactParam = searchParams.get('impact');
    if (impactParam && Object.values(RiskImpact).includes(impactParam as RiskImpact)) {
      prefillData.impact = impactParam as RiskImpact;
    }
    const statusParam = searchParams.get('status');
    if (statusParam && Object.values(RiskStatus).includes(statusParam as RiskStatus)) {
      prefillData.status = statusParam as RiskStatus;
    } else {
      prefillData.status = RiskStatus.OPEN; // Standardwert
    }

    // Datumsfelder
    if (searchParams.get('identifiedDate')) prefillData.identifiedDate = searchParams.get('identifiedDate') as string;
    else prefillData.identifiedDate = new Date().toISOString().split('T')[0]; // Standard auf heute

    if (searchParams.get('reviewDate')) prefillData.reviewDate = searchParams.get('reviewDate') as string;

    // KI-spezifische Felder (werden in RiskForm und Risk-Typ erwartet)
    if (searchParams.get('aiIdentified') === 'true') prefillData.aiIdentified = true;
    if (searchParams.get('aiGeneratedDescription')) prefillData.aiGeneratedDescription = searchParams.get('aiGeneratedDescription') as string;
    if (searchParams.get('aiSuggestedMitigation')) prefillData.aiSuggestedMitigation = searchParams.get('aiSuggestedMitigation') as string;
    
    // RiskId (falls von KI vorgeschlagen oder bereits bekannt)
    if (searchParams.get('riskId')) prefillData.riskId = searchParams.get('riskId') as string;
    
    // Für `mitigationMeasures` ist die Übergabe via Query-Params komplex.
    // Die KI könnte einen Text für `aiSuggestedMitigation` liefern, der dann manuell in Maßnahmen umgewandelt wird.
    // Hier wird es vorerst nicht aus Query-Params befüllt.

    return prefillData;
  }, [searchParams]);

  useEffect(() => {
    if (session?.user?.roles) {
      setAllowedToCreate(userHasRoles(session.user.roles, [
        UserRole.ADMIN,
        UserRole.COMPLIANCE_MANAGER_FULL,
        UserRole.RISK_MANAGER,
        UserRole.COMPLIANCE_MANAGER_WRITE
      ]));
    }
  }, [session]);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login');
    }
    if (status === 'authenticated' && !allowedToCreate && session) { 
      setError('Sie haben keine Berechtigung, neue Risiken zu erstellen.');
    }
  }, [status, session, allowedToCreate, router]);


  const handleFormSubmit = async (formDataFromForm: RiskFormData) => {
    if (!allowedToCreate) {
        setError('Aktion nicht erlaubt.');
        setIsSubmitting(false);
        return;
    }

    setIsSubmitting(true);
    setError(null);
    setSuccessMessage(null);

    // Kombiniere initialData (aus URL) mit den aktuellen Formulardaten.
    // formDataFromForm sollte bereits die initialen Werte enthalten und eventuelle Änderungen.
    const finalFormData: RiskFormData = {
        ...initialRiskData, // Beginne mit URL-Daten als Basis
        ...formDataFromForm, // Überschreibe/ergänze mit dem aktuellen Formularstatus
         // Stelle sicher, dass Pflichtfelder aus dem Formular kommen, wenn sie nicht in initialRiskData sind
        riskId: formDataFromForm.riskId || initialRiskData.riskId || '', // riskId ist in RiskFormData optional für die Erstellung, wird serverseitig generiert wenn leer
        title: formDataFromForm.title || initialRiskData.title || '',
        description: formDataFromForm.description || initialRiskData.description || '',
        status: formDataFromForm.status || initialRiskData.status || RiskStatus.OPEN,
        probability: formDataFromForm.probability || initialRiskData.probability || RiskProbability.LOW,
        impact: formDataFromForm.impact || initialRiskData.impact || RiskImpact.LOW,
        identifiedDate: formDataFromForm.identifiedDate || initialRiskData.identifiedDate || new Date().toISOString().split('T')[0],
    };
    
    if (!finalFormData.title || !finalFormData.description) {
      setError('Titel und Beschreibung sind Pflichtfelder.');
      setIsSubmitting(false);
      return;
    }

    try {
      const response = await fetch('/api/risks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(finalFormData),
      });

      const responseData = await response.json();
      if (!response.ok) {
        throw new Error(responseData.message || 'Fehler beim Erstellen des Risikos');
      }
      
      setSuccessMessage(`Risiko '${responseData.title || finalFormData.title}' (ID: ${responseData.riskId}) erfolgreich erstellt.`);
      setTimeout(() => router.push(`/risk-manager/${responseData.riskId || ''}`), 2000); // Fallback für responseData.riskId

    } catch (err: Error | unknown) {
      setError(err instanceof Error ? err.message : 'Ein unbekannter Fehler ist aufgetreten');
    }
    setIsSubmitting(false);
  };

  if (status === 'loading') {
    return <div className="flex justify-center items-center min-h-screen"><p>Lade...</p></div>;
  }
  
  if (!session && status !== 'unauthenticated') {
      return <div className="flex justify-center items-center min-h-screen"><p>Sitzung wird geladen...</p></div>;
  }

  if (status === 'authenticated' && !allowedToCreate && error) {
       return (
        <div className="container mx-auto p-6">
          <h1 className="text-2xl font-bold mb-6 text-slate-800">Neues Risiko erstellen</h1>
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4" role="alert">
            <strong className="font-bold">Fehler: </strong>
            <span className="block sm:inline">{error}</span>
          </div>
           <div className="mt-6">
            <button 
                onClick={() => router.back()}
                className="px-4 py-2 bg-slate-500 text-white rounded-md hover:bg-slate-600 transition ease-in-out duration-150"
            >
                Zurück
            </button>
            </div>
        </div>
      );
  }
  
  if (status === 'authenticated' && allowedToCreate) {
    return (
      <div className="container mx-auto p-6 bg-white shadow-xl rounded-lg max-w-4xl">
        <button onClick={() => router.back()} className="mb-6 text-sm text-indigo-600 hover:text-indigo-800 transition ease-in-out duration-150">
          &larr; Zurück zum Risikomanagement
        </button>
        <h1 className="text-3xl font-bold mb-8 text-slate-800">Neues Risiko erstellen</h1>
        {Object.keys(initialRiskData).length > 0 && (
            <p className="text-sm text-indigo-600 my-2 p-2 bg-indigo-50 rounded-md">Formular wurde mit KI-Vorschlägen aus einem Dokument vorausgefüllt.</p>
        )}
        
        {successMessage && (
          <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded relative mb-6" role="alert">
            <strong className="font-bold">Erfolg: </strong>
            <span className="block sm:inline">{successMessage}</span>
          </div>
        )}

        <RiskForm 
          initialData={initialRiskData as RiskFormData} // Übergebe die aufbereiteten initialRiskData
          onSubmit={handleFormSubmit} 
          isSubmitting={isSubmitting} 
          submitButtonText="Risiko erstellen"
          onCancel={() => router.push('/risk-manager')}
          formError={error}
        />
      </div>
    );
  }
  
  return <div className="flex justify-center items-center min-h-screen"><p>Zugriff wird geprüft...</p></div>;
} 