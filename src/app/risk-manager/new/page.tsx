'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { UserRole } from '@/next-auth';
import { Risk } from '@/types/risk';
import RiskForm from '@/components/RiskForm'; // Importiere die neue Komponente

// Hilfsfunktion zur Überprüfung der Benutzerrollen
const userHasRoles = (userRoles: UserRole[] | undefined, targetRoles: UserRole[]): boolean => {
  if (!userRoles) return false;
  return userRoles.some(role => targetRoles.includes(role));
};

export default function NewRiskPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Berechtigungsprüfung basierend auf der aktuellen Session
  const [allowedToCreate, setAllowedToCreate] = useState(false);

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
    // Zeige Fehler, wenn authentifiziert aber nicht berechtigt
    if (status === 'authenticated' && !allowedToCreate && session) { 
      setError('Sie haben keine Berechtigung, neue Risiken zu erstellen.');
    }
  }, [status, session, allowedToCreate, router]);


  const handleFormSubmit = async (formData: Partial<Risk>) => {
    if (!allowedToCreate) {
        setError('Aktion nicht erlaubt.');
        setIsSubmitting(false); // Wichtig, um den Button wieder freizugeben
        return;
    }

    setIsSubmitting(true);
    setError(null);
    setSuccessMessage(null);

    if (!formData.title || !formData.description) {
      setError('Titel und Beschreibung sind Pflichtfelder.');
      setIsSubmitting(false);
      return;
    }

    try {
      const response = await fetch('/api/risks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const responseData = await response.json();
      if (!response.ok) {
        throw new Error(responseData.message || 'Fehler beim Erstellen des Risikos');
      }
      
      setSuccessMessage(`Risiko '${responseData.title || formData.title}' (ID: ${responseData.riskId}) erfolgreich erstellt.`);
      setTimeout(() => router.push(`/risk-manager/${responseData.riskId}`), 2000);

    } catch (err: any) {
      setError(err.message);
    }
    setIsSubmitting(false);
  };

  if (status === 'loading') {
    return <div className="flex justify-center items-center min-h-screen"><p>Lade...</p></div>;
  }
  
  // Wenn !session (also noch nicht authentifiziert oder fehlerhaft), zeige Ladezustand oder nichts
  // Dieser Fall wird meist durch den useEffect redirect abgefangen.
  if (!session && status !== 'unauthenticated') {
      return <div className="flex justify-center items-center min-h-screen"><p>Sitzung wird geladen...</p></div>;
  }

  // Wenn authentifiziert, aber keine Berechtigung und Fehler gesetzt wurde (aus useEffect)
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
  
  // Nur das Formular anzeigen, wenn der Benutzer eingeloggt und berechtigt ist.
  // Die allowedToCreate Prüfung im Formular selbst (via disabled) dient als zusätzliche Sicherheit.
  if (status === 'authenticated' && allowedToCreate) {
    return (
      <div className="container mx-auto p-6 bg-white shadow-xl rounded-lg max-w-4xl">
        <button onClick={() => router.back()} className="mb-6 text-sm text-indigo-600 hover:text-indigo-800 transition ease-in-out duration-150">
          &larr; Zurück zum Risikomanagement
        </button>
        <h1 className="text-3xl font-bold mb-8 text-slate-800">Neues Risiko erstellen</h1>
        
        {successMessage && (
          <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded relative mb-6" role="alert">
            <strong className="font-bold">Erfolg: </strong>
            <span className="block sm:inline">{successMessage}</span>
          </div>
        )}

        <RiskForm 
          onSubmit={handleFormSubmit} 
          isSubmitting={isSubmitting} 
          submitButtonText="Risiko erstellen"
          onCancel={() => router.push('/risk-manager')}
          formError={error} // Fehler aus dem API-Aufruf oder der Validierung hier übergeben
        />
      </div>
    );
  }
  
  // Fallback, falls status === 'authenticated' aber allowedToCreate noch nicht gesetzt ist (sollte selten sein)
  // oder falls der Benutzer nicht berechtigt ist und noch kein Fehler angezeigt wurde.
  return <div className="flex justify-center items-center min-h-screen"><p>Zugriff wird geprüft...</p></div>;
} 