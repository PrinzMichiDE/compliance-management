'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import { Risk, RiskProbability, RiskImpact, RiskStatus } from '@/types/risk'; // Pfad anpassen, falls Risk-Typen woanders liegen
import { UserRole } from '@/next-auth'; // Pfad zu UserRole enum
import { useRouter } from 'next/navigation';

// Hilfsfunktion zur Überprüfung der Benutzerrollen
const userHasRoles = (userRoles: UserRole[] | undefined, targetRoles: UserRole[]): boolean => {
  if (!userRoles) return false;
  return userRoles.some(role => targetRoles.includes(role));
};

export default function RiskManagerPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [risks, setRisks] = useState<Risk[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState<string | null>(null); // riskId des zu löschenden Risikos

  useEffect(() => {
    if (status === 'authenticated') {
      fetchRisks();
    } else if (status === 'unauthenticated') {
      router.push('/login');
    }
  }, [status, router]);

  const fetchRisks = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/risks');
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || `Fehler beim Laden der Risiken: ${response.status}`);
      }
      const data: Risk[] = await response.json();
      setRisks(data);
    } catch (err: any) {
      setError(err.message);
    }
    setIsLoading(false);
  };

  const handleDeleteRisk = async (riskId: string) => {
    if (!riskId) return;
    if (!window.confirm(`Möchten Sie das Risiko ${riskId} wirklich löschen?`)) return;

    setIsDeleting(riskId);
    setError(null);
    try {
      const response = await fetch(`/api/risks/${riskId}`, {
        method: 'DELETE',
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Fehler beim Löschen des Risikos');
      }
      // Risiken neu laden oder das gelöschte Risiko aus dem State entfernen
      setRisks(prevRisks => prevRisks.filter(risk => risk.riskId !== riskId));
    } catch (err: any) {
      setError(err.message);
    }
    setIsDeleting(null);
  };

  if (status === 'loading' || isLoading) {
    return <div className="flex justify-center items-center min-h-screen"><p className="text-lg">Lade Risikomanagement...</p></div>;
  }

  if (!session) {
    // Sollte durch den useEffect Hook bereits behandelt werden, aber als Fallback
    return <div className="flex justify-center items-center min-h-screen"><p className="text-lg">Bitte anmelden, um auf diese Seite zuzugreifen.</p></div>;
  }
  
  // Rollenprüfungen für UI-Elemente
  const canCreateRisks = userHasRoles(session.user.roles, [UserRole.ADMIN, UserRole.COMPLIANCE_MANAGER_FULL, UserRole.RISK_MANAGER, UserRole.COMPLIANCE_MANAGER_WRITE]);
  const canEditRisks = userHasRoles(session.user.roles, [UserRole.ADMIN, UserRole.COMPLIANCE_MANAGER_FULL, UserRole.RISK_MANAGER, UserRole.COMPLIANCE_MANAGER_WRITE]);
  const canDeleteRisks = userHasRoles(session.user.roles, [UserRole.ADMIN, UserRole.COMPLIANCE_MANAGER_FULL, UserRole.RISK_MANAGER]);
  // Leserechte werden durch den API-Endpunkt und die Seitenauthentifizierung sichergestellt.

  return (
    <div className="container mx-auto p-4 sm:p-6 lg:p-8">
      <header className="mb-8">
        <div className="flex flex-col sm:flex-row justify-between items-center">
          <h1 className="text-3xl font-bold text-slate-800 mb-4 sm:mb-0">Risikomanagement</h1>
          {canCreateRisks && (
            <Link href="/risk-manager/new"
              className="px-6 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 transition ease-in-out duration-150"
            >
              Neues Risiko erstellen
            </Link>
          )}
        </div>
      </header>

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-6" role="alert">
          <strong className="font-bold">Fehler: </strong>
          <span className="block sm:inline">{error}</span>
        </div>
      )}

      {risks.length === 0 && !isLoading && (
        <p className="text-center text-slate-600">Keine Risiken gefunden.</p>
      )}

      {risks.length > 0 && (
        <div className="shadow-lg overflow-x-auto rounded-lg border border-slate-200">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">ID</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Titel</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Kategorie</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Wahrscheinlichkeit</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Auswirkung</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Status</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Verantwortlich</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Aktionen</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-slate-200">
              {risks.map((risk) => (
                <tr key={risk.riskId} className={`${isDeleting === risk.riskId ? 'opacity-50' : ''}`}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-900">{risk.riskId}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-700">{risk.title}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-700">{risk.category || '-'}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-700">
                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full 
                      ${risk.probability === RiskProbability.HIGH ? 'bg-red-100 text-red-800' : 
                        risk.probability === RiskProbability.MEDIUM ? 'bg-yellow-100 text-yellow-800' : 'bg-green-100 text-green-800'}
                    `}>
                      {risk.probability}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-700">
                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full 
                      ${risk.impact === RiskImpact.HIGH ? 'bg-red-100 text-red-800' : 
                        risk.impact === RiskImpact.MEDIUM ? 'bg-yellow-100 text-yellow-800' : 'bg-green-100 text-green-800'}
                    `}>
                      {risk.impact}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-700">
                     <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full 
                      ${risk.status === RiskStatus.OPEN ? 'bg-blue-100 text-blue-800' : 
                        risk.status === RiskStatus.IN_PROGRESS ? 'bg-orange-100 text-orange-800' : 
                        risk.status === RiskStatus.CLOSED ? 'bg-gray-100 text-gray-800' : 
                        risk.status === RiskStatus.MITIGATED ? 'bg-teal-100 text-teal-800' :
                        'bg-purple-100 text-purple-800'}
                    `}>
                      {risk.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-700">{risk.owner || '-'}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-3">
                    <Link href={`/risk-manager/${risk.riskId}`} className="text-indigo-600 hover:text-indigo-900">Details</Link>
                    {canEditRisks && (
                      <Link href={`/risk-manager/${risk.riskId}/edit`} className="text-indigo-600 hover:text-indigo-900">Bearbeiten</Link>
                    )}
                    {canDeleteRisks && (
                      <button 
                        onClick={() => handleDeleteRisk(risk.riskId)}
                        disabled={isDeleting === risk.riskId}
                        className="text-red-600 hover:text-red-900 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {isDeleting === risk.riskId ? 'Lösche...' : 'Löschen'}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
} 