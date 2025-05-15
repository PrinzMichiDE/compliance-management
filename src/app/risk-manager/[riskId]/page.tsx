'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { Risk, RiskProbability, RiskImpact, RiskStatus } from '@/types/risk';
import { UserRole } from '@/types/enums';

// Hilfsfunktion zur Überprüfung der Benutzerrollen
const userHasRoles = (userRoles: UserRole[] | undefined, targetRoles: UserRole[]): boolean => {
  if (!userRoles) return false;
  return userRoles.some(role => targetRoles.includes(role));
};

// Helper-Komponente zur Anzeige formatierter Feld-Wert-Paare
const DetailItem: React.FC<{ label: string; value: React.ReactNode; className?: string }> = ({ label, value, className }) => (
  <div className={`py-3 sm:grid sm:grid-cols-3 sm:gap-4 ${className}`}>
    <dt className="text-sm font-medium text-slate-500">{label}</dt>
    <dd className="mt-1 text-sm text-slate-900 sm:mt-0 sm:col-span-2">
      {value || '-'}
    </dd>
  </div>
);

export default function RiskDetailPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const params = useParams();
  const riskId = params?.riskId as string; // riskId aus URL

  const [risk, setRisk] = useState<Risk | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // fetchRiskDetails mit useCallback umhüllt
  const fetchRiskDetails = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/risks/${riskId}`);
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || `Fehler beim Laden der Risikodetails: ${response.status}`);
      }
      const data: Risk = await response.json();
      setRisk(data);
    } catch (err: Error | unknown) {
      setError(err instanceof Error ? err.message : 'Ein unbekannter Fehler ist aufgetreten');
    }
    setIsLoading(false);
  }, [riskId]);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login');
    }
    if (status === 'authenticated' && riskId) {
      fetchRiskDetails();
    }
  }, [status, riskId, router, fetchRiskDetails]);

  const handleDeleteRisk = async () => {
    if (!risk || !risk.riskId) return;
    if (!window.confirm(`Möchten Sie das Risiko ${risk.riskId} wirklich löschen?`)) return;

    setIsDeleting(true);
    setError(null);
    try {
      const response = await fetch(`/api/risks/${risk.riskId}`, {
        method: 'DELETE',
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Fehler beim Löschen des Risikos');
      }
      alert('Risiko erfolgreich gelöscht.');
      router.push('/risk-manager'); // Zurück zur Übersicht
    } catch (err: Error | unknown) {
      setError(err instanceof Error ? err.message : 'Ein unbekannter Fehler ist aufgetreten');
    }
    setIsDeleting(false);
  };
  
  // Berechtigungen
  const canEdit = userHasRoles(session?.user?.roles, [UserRole.ADMIN, UserRole.COMPLIANCE_MANAGER_FULL, UserRole.RISK_MANAGER, UserRole.COMPLIANCE_MANAGER_WRITE]);
  const canDelete = userHasRoles(session?.user?.roles, [UserRole.ADMIN, UserRole.COMPLIANCE_MANAGER_FULL, UserRole.RISK_MANAGER]);

  if (status === 'loading' || (isLoading && !error)) {
    return <div className="flex justify-center items-center min-h-screen"><p className="text-lg">Lade Risikodetails...</p></div>;
  }

  if (error) {
    return (
      <div className="container mx-auto p-6">
        <button onClick={() => router.back()} className="mb-6 text-sm text-indigo-600 hover:text-indigo-800">
          &larr; Zurück
        </button>
        <h1 className="text-2xl font-bold mb-4 text-slate-800">Fehler</h1>
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded" role="alert">
          <p>{error}</p>
        </div>
      </div>
    );
  }

  if (!risk) {
    return (
       <div className="container mx-auto p-6">
        <button onClick={() => router.back()} className="mb-6 text-sm text-indigo-600 hover:text-indigo-800">
          &larr; Zurück
        </button>
        <h1 className="text-2xl font-bold mb-4 text-slate-800">Risiko nicht gefunden</h1>
        <p className="text-slate-600">Das angeforderte Risiko konnte nicht gefunden werden.</p>
      </div>
    );
  }

  // Datumsformatierungsfunktion
  const formatDate = (dateString?: string) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };

  return (
    <div className="container mx-auto p-6 bg-white shadow-xl rounded-lg max-w-4xl">
      <button onClick={() => router.push('/risk-manager')} className="mb-6 text-sm text-indigo-600 hover:text-indigo-800 transition ease-in-out duration-150">
        &larr; Zurück zum Risikomanagement
      </button>

      <div className="flex flex-col sm:flex-row justify-between items-start mb-6">
        <h1 className="text-3xl font-bold text-slate-800 mb-3 sm:mb-0">Risikodetails: {risk.title}</h1>
        <div className="flex space-x-3">
          {canEdit && (
            <Link href={`/risk-manager/${risk.riskId}/edit`} 
                  className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-md hover:bg-indigo-700 transition ease-in-out duration-150">
              Bearbeiten
            </Link>
          )}
          {canDelete && (
            <button 
              onClick={handleDeleteRisk}
              disabled={isDeleting}
              className="px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-md hover:bg-red-700 disabled:bg-red-400 transition ease-in-out duration-150"
            >
              {isDeleting ? 'Lösche...' : 'Löschen'}
            </button>
          )}
        </div>
      </div>

      <div className="border-t border-slate-200">
        <dl className="divide-y divide-slate-200">
          <DetailItem label="Risiko ID" value={risk.riskId} />
          <DetailItem label="Titel" value={risk.title} />
          <DetailItem label="Beschreibung" value={<p className="whitespace-pre-wrap">{risk.description}</p>} />
          <DetailItem label="Kategorie" value={risk.category} />
          <DetailItem label="Quelle" value={risk.source} />
          <DetailItem label="Identifiziert am" value={formatDate(risk.identifiedDate)} />
          <DetailItem label="Wahrscheinlichkeit" value={<span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${risk.probability === RiskProbability.HIGH ? 'bg-red-100 text-red-800' : risk.probability === RiskProbability.MEDIUM ? 'bg-yellow-100 text-yellow-800' : 'bg-green-100 text-green-800'}`}>{risk.probability}</span>} />
          <DetailItem label="Auswirkung" value={<span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${risk.impact === RiskImpact.HIGH ? 'bg-red-100 text-red-800' : risk.impact === RiskImpact.MEDIUM ? 'bg-yellow-100 text-yellow-800' : 'bg-green-100 text-green-800'}`}>{risk.impact}</span>} />
          <DetailItem label="Risikowert" value={risk.riskScore || 'Nicht berechnet'} />
          <DetailItem label="Status" value={<span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${risk.status === RiskStatus.OPEN ? 'bg-blue-100 text-blue-800' : risk.status === RiskStatus.IN_PROGRESS ? 'bg-orange-100 text-orange-800' : risk.status === RiskStatus.CLOSED ? 'bg-gray-100 text-gray-800' : risk.status === RiskStatus.MITIGATED ? 'bg-teal-100 text-teal-800' : 'bg-purple-100 text-purple-800'}`}>{risk.status}</span>} />
          <DetailItem label="Verantwortlicher (Owner)" value={risk.owner} />
          <DetailItem label="Nächste Überprüfung am" value={formatDate(risk.reviewDate)} />
          <DetailItem label="Erstellt am" value={formatDate(risk.createdAt)} />
          <DetailItem label="Zuletzt aktualisiert am" value={formatDate(risk.updatedAt)} />
          {risk.linkedRuleIds && risk.linkedRuleIds.length > 0 && (
             <DetailItem label="Verknüpfte Regeln" value={risk.linkedRuleIds.join(', ')} />
          )}
        </dl>
      </div>

      {risk.mitigationMeasures && risk.mitigationMeasures.length > 0 && (
        <div className="mt-8">
          <h2 className="text-xl font-semibold text-slate-700 mb-4">Maßnahmen zur Risikominderung</h2>
          <div className="space-y-6">
            {risk.mitigationMeasures.map((measure, index) => (
              <div key={measure.id || index} className="p-4 border border-slate-200 rounded-md shadow-sm">
                <h3 className="text-lg font-semibold text-slate-800 mb-2">Maßnahme {index + 1}: {measure.description}</h3>
                <dl className="sm:divide-y sm:divide-slate-200">
                  <DetailItem label="Status" value={<span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${measure.status === 'Umgesetzt' ? 'bg-green-100 text-green-800' : measure.status === 'In Umsetzung' ? 'bg-yellow-100 text-yellow-800' : 'bg-slate-100 text-slate-800'}`}>{measure.status}</span>} className="py-2" />
                  <DetailItem label="Verantwortlich" value={measure.responsible} className="py-2" />
                  <DetailItem label="Fälligkeitsdatum" value={formatDate(measure.dueDate)} className="py-2" />
                </dl>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
} 