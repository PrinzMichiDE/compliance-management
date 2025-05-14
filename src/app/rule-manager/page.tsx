'use client';

import { useSession, signOut } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Rule } from '@/types/rule';

// TODO: Später eine DeleteConfirmationModal Komponente importieren
// import DeleteConfirmationModal from '@/components/DeleteConfirmationModal';

export default function RuleManagerPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [rules, setRules] = useState<Rule[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false); // Für den Ladezustand des Löschens
  const [ruleToDelete, setRuleToDelete] = useState<Rule | null>(null); // Für das Modal

  const fetchRules = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/rules');
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || `Fehler beim Abrufen der Regeln: ${response.status}`);
      }
      const data: Rule[] = await response.json();
      setRules(data);
    } catch (e: any) {
      console.error(e);
      setError(e.message || 'Ein unbekannter Fehler ist aufgetreten.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.replace('/login');
    } else if (status === 'authenticated') {
      fetchRules(); // Regeln beim ersten Laden und bei Authentifizierung abrufen
    }
  }, [status, router]); // Abhängigkeit von fetchRules entfernt, um Endlosschleife zu vermeiden

  const handleDeleteClick = (rule: Rule) => {
    setRuleToDelete(rule);
  };

  const handleConfirmDelete = async () => {
    if (!ruleToDelete || !ruleToDelete._id) return;

    setIsDeleting(true);
    setError(null);
    try {
      const response = await fetch(`/api/rules/${ruleToDelete._id.toString()}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Fehler beim Löschen der Regel.');
      }
      
      // Regel aus dem State entfernen
      setRules(prevRules => prevRules.filter(rule => rule._id !== ruleToDelete._id));
      alert('Regel erfolgreich gelöscht!'); // TODO: Bessere Benachrichtigung
    } catch (e: any) {
      console.error('Fehler beim Löschen:', e);
      setError(e.message || 'Ein unbekannter Fehler ist beim Löschen aufgetreten.');
    } finally {
      setIsDeleting(false);
      setRuleToDelete(null); // Modal schließen
    }
  };

  if (status === 'loading' || (status === 'authenticated' && isLoading && rules.length === 0 && !error)) {
    return <p className="text-center mt-10">Lade Rule Manager und Regeln...</p>;
  }

  if (status === 'unauthenticated' || !session) {
    return <p className="text-center mt-10">Bitte zuerst anmelden, um den Rule Manager zu nutzen.</p>; 
  }

  return (
    <>
      <div className="container mx-auto px-4 py-8">
        <header className="mb-6 flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-800">Rule Manager</h1>
            <p className="text-gray-600">Verwalten und überwachen Sie hier Ihre Compliance-Regeln.</p>
          </div>
          <div className="flex items-center space-x-4">
            <Link href="/dashboard" className="text-sm text-indigo-600 hover:text-indigo-800">
              &larr; Dashboard
            </Link>
            <button 
              onClick={() => signOut({ callbackUrl: '/login' })}
              className="px-4 py-2 bg-red-500 text-white font-semibold rounded-md hover:bg-red-600 focus:outline-none focus:ring-2 focus:ring-red-400 focus:ring-opacity-75"
            >
              Abmelden
            </button>
          </div>
        </header>
        
        <div className="bg-white p-6 rounded-lg shadow-md">
          <div className="mb-6 flex justify-between items-center">
            <h2 className="text-xl font-semibold text-gray-700">Regelübersicht</h2>
            {(session.user?.role === 'Admin' || 
              session.user?.role === 'Compliancer Manager FULL' || 
              session.user?.role === 'Compliancer Manager WRITE') && (
              <Link href="/rule-manager/new">
                <button className="px-4 py-2 bg-green-500 text-white font-semibold rounded-md hover:bg-green-600">
                  Neue Regel erstellen
                </button>
              </Link>
            )}
          </div>

          {error && (
            <div className="mb-4 p-4 bg-red-100 text-red-700 border border-red-400 rounded">
              <p><strong>Fehler:</strong> {error}</p>
            </div>
          )}

          {(isLoading && rules.length === 0 && !error) && <p className="text-gray-600 mb-4">Lade Regeln...</p>}
          {(!isLoading && !error && rules.length === 0) && (
            <p className="text-gray-600 mb-4">Keine Regeln gefunden.</p>
          )}

          {rules.length > 0 && (
            <div className="border rounded-lg overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Regel-ID</th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Kategorie</th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Priorität</th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Aktionen</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {rules.map((rule) => (
                    <tr key={rule._id?.toString() || rule.ruleId}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{rule.ruleId}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{rule.name}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                          rule.status === 'Aktiv' ? 'bg-green-100 text-green-800' :
                          rule.status === 'Entwurf' ? 'bg-yellow-100 text-yellow-800' :
                          rule.status === 'Inaktiv' ? 'bg-red-100 text-red-800' :
                          'bg-gray-100 text-gray-800'
                        }`}>
                          {rule.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{rule.category || '-'}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{rule.priority || '-'}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <Link href={`/rule-manager/${rule._id?.toString()}`} className="text-indigo-600 hover:text-indigo-900">
                          Details
                        </Link>
                        {(session.user?.role === 'Admin' || 
                          session.user?.role === 'Compliancer Manager FULL' || 
                          session.user?.role === 'Compliancer Manager WRITE') && (
                          <Link href={`/rule-manager/${rule._id?.toString()}/edit`} className="text-indigo-600 hover:text-indigo-900 ml-4">
                            Bearbeiten
                          </Link>
                        )}
                        {(session.user?.role === 'Admin' || session.user?.role === 'Compliancer Manager FULL') && (
                           <button 
                              onClick={() => handleDeleteClick(rule)} // Klick-Handler hinzugefügt
                              className="text-red-600 hover:text-red-900 ml-4 disabled:opacity-50"
                              disabled={isDeleting && ruleToDelete?._id === rule._id} // Button während des Löschens dieser Regel deaktivieren
                            >
                              {isDeleting && ruleToDelete?._id === rule._id ? 'Lösche...' : 'Löschen'}
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
      </div>

      {/* Platzhalter für das Bestätigungsmodal - wird als Nächstes erstellt */}
      {ruleToDelete && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50 flex justify-center items-center">
          <div className="bg-white p-8 rounded-lg shadow-xl max-w-md mx-auto">
            <h3 className="text-lg font-medium leading-6 text-gray-900">Regel löschen bestätigen</h3>
            <div className="mt-2">
              <p className="text-sm text-gray-500">
                Möchten Sie die Regel "{ruleToDelete.name}" (ID: {ruleToDelete.ruleId}) wirklich unwiderruflich löschen?
              </p>
            </div>
            <div className="mt-5 sm:mt-6 sm:grid sm:grid-flow-row-dense sm:grid-cols-2 sm:gap-3">
              <button
                type="button"
                className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-red-600 text-base font-medium text-white hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 sm:col-start-2 sm:text-sm disabled:opacity-50"
                onClick={handleConfirmDelete}
                disabled={isDeleting}
              >
                {isDeleting ? 'Wird gelöscht...' : 'Löschen bestätigen'}
              </button>
              <button
                type="button"
                className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:mt-0 sm:col-start-1 sm:text-sm disabled:opacity-50"
                onClick={() => setRuleToDelete(null)} // Modal schließen
                disabled={isDeleting}
              >
                Abbrechen
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
} 