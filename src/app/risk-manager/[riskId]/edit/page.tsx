'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter, useParams } from 'next/navigation';
import RiskForm from '@/components/RiskForm';
import { Risk, RiskFormData, MitigationMeasure, MitigationMeasureFormData } from '@/types/risk';
import { UserRole } from '@/types/enums';
import Link from 'next/link';

// Hilfsfunktion zur Überprüfung der Benutzerrollen
const userHasRoles = (userRoles: UserRole[] | undefined, targetRoles: UserRole[]): boolean => {
  if (!userRoles) return false;
  return userRoles.some(role => targetRoles.includes(role));
};

export default function EditRiskPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const params = useParams();
  const riskId = params?.riskId as string;

  const [risk, setRisk] = useState<Risk | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const canEdit = userHasRoles(session?.user?.roles, [UserRole.ADMIN, UserRole.COMPLIANCE_MANAGER_FULL, UserRole.RISK_MANAGER, UserRole.COMPLIANCE_MANAGER_WRITE]);

  const fetchRisk = useCallback(async () => {
    if (!riskId) return;
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/risks/${riskId}`);
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || `Fehler beim Laden des Risikos: ${response.status}`);
      }
      const data: Risk = await response.json();
      setRisk(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, [riskId]);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login');
    } else if (status === 'authenticated' && riskId) {
      if (!canEdit) {
        setError('Sie haben keine Berechtigung, dieses Risiko zu bearbeiten.');
        setIsLoading(false);
      } else {
        fetchRisk();
      }
    }
  }, [status, riskId, router, canEdit, fetchRisk]);

  const handleSubmit = async (formData: RiskFormData) => {
    if (!riskId || !canEdit) {
      setFormError("Fehler: Keine Berechtigung oder Risiko-ID fehlt.");
      return;
    }

    setIsSubmitting(true);
    setFormError(null);
    setSuccessMessage(null);

    // Stellen sicher, dass leere Strings für optionale Datumsfelder als undefined gesendet werden
    const payload = {
      ...formData,
      identifiedDate: formData.identifiedDate || undefined,
      reviewDate: formData.reviewDate || undefined,
      mitigationMeasures: formData.mitigationMeasures?.map((m: MitigationMeasureFormData) => ({
        ...m,
        dueDate: m.dueDate || undefined,
      }))
    };

    try {
      const response = await fetch(`/api/risks/${riskId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Fehler beim Aktualisieren des Risikos');
      }
      setSuccessMessage('Risiko erfolgreich aktualisiert.');
      // Optional: fetchRisk(); // um das Formular mit den neuesten Daten neu zu laden (falls serverseitige Änderungen stattfinden)
      // oder Weiterleitung nach kurzer Zeit
      setTimeout(() => {
        router.push(`/risk-manager/${riskId}`); // Zurück zur Detailansicht
      }, 2000);
    } catch (err: any) {
      setFormError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (status === 'loading' || (isLoading && !error && canEdit)) {
    return <div className="flex justify-center items-center min-h-screen"><p className="text-lg">Lade Risiko zum Bearbeiten...</p></div>;
  }

  if (error) {
    return (
      <div className="container mx-auto p-6">
        <h1 className="text-2xl font-bold mb-6 text-slate-800">Fehler</h1>
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4" role="alert">
          <p>{error}</p>
        </div>
        <Link href={riskId ? `/risk-manager/${riskId}` : "/risk-manager"} 
              className="text-indigo-600 hover:text-indigo-800">
          Zurück
        </Link>
      </div>
    );
  }
  
  if (!canEdit && status === 'authenticated') {
     return (
      <div className="container mx-auto p-6">
        <h1 className="text-2xl font-bold mb-6 text-slate-800">Zugriff verweigert</h1>
        <div className="bg-yellow-100 border border-yellow-400 text-yellow-700 px-4 py-3 rounded mb-4" role="alert">
          <p>Sie haben keine Berechtigung, dieses Risiko zu bearbeiten.</p>
        </div>
        <Link href={riskId ? `/risk-manager/${riskId}` : "/risk-manager"} 
              className="text-indigo-600 hover:text-indigo-800">
          Zurück zur Detailansicht
        </Link>
      </div>
    );
  }

  if (!risk) {
    return (
      <div className="container mx-auto p-6">
        <h1 className="text-2xl font-bold mb-6 text-slate-800">Risiko nicht gefunden</h1>
        <p className="text-slate-600">Das zu bearbeitende Risiko konnte nicht geladen werden.</p>
        <Link href="/risk-manager" className="text-indigo-600 hover:text-indigo-800 mt-4 inline-block">
          Zurück zum Risikomanagement
        </Link>
      </div>
    );
  }
  
  const initialRiskFormData: RiskFormData = {
    riskId: risk.riskId,
    title: risk.title,
    description: risk.description,
    category: risk.category,
    source: risk.source,
    identifiedDate: risk.identifiedDate ? new Date(risk.identifiedDate).toISOString().split('T')[0] : '',
    probability: risk.probability,
    impact: risk.impact,
    // riskScore will be calculated by the backend or not directly editable
    status: risk.status,
    owner: risk.owner || '',
    reviewDate: risk.reviewDate ? new Date(risk.reviewDate).toISOString().split('T')[0] : '',
    mitigationMeasures: risk.mitigationMeasures?.map((m: MitigationMeasure): MitigationMeasureFormData => ({
      id: m.id || crypto.randomUUID(),
      description: m.description,
      responsible: m.responsible,
      dueDate: m.dueDate ? new Date(m.dueDate).toISOString().split('T')[0] : '',
      status: m.status
    })) || [],
    linkedRuleIds: risk.linkedRuleIds || [],
    // AI specific fields - diese sind Teil von Risk und somit auch von RiskFormData, wenn nicht exkludiert
    aiGeneratedDescription: risk.aiGeneratedDescription || '',
    aiIdentified: risk.aiIdentified || false,
    aiSuggestedMitigation: risk.aiSuggestedMitigation || '',
  };

  return (
    <div className="container mx-auto p-6 bg-white shadow-xl rounded-lg">
      <h1 className="text-3xl font-bold mb-8 text-slate-800">Risiko bearbeiten: {risk.title}</h1>
      
      {successMessage && (
        <div className="mb-4 p-3 bg-green-100 text-green-700 border border-green-300 rounded-md">
          {successMessage}
        </div>
      )}

      <RiskForm
        initialData={initialRiskFormData}
        onSubmit={handleSubmit}
        isSubmitting={isSubmitting}
        submitButtonText="Änderungen speichern"
        onCancel={() => router.push(riskId ? `/risk-manager/${riskId}` : '/risk-manager')}
        formError={formError}
      />
    </div>
  );
} 