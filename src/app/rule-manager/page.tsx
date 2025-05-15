'use client';

import { useSession, signOut } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Rule } from '@/types/rule';
import { UserRole } from '@/types/enums';
import { userHasRoles } from '@/lib/authUtils';

export default function RuleManagerPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [rules, setRules] = useState<Rule[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.replace('/login');
    } else if (status === 'authenticated') {
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
        } catch (e: Error | unknown) {
          console.error(e);
          setError(e instanceof Error ? e.message : 'Ein unbekannter Fehler ist aufgetreten.');
        } finally {
          setIsLoading(false);
        }
      };
      fetchRules();
    }
  }, [status, router]);

  if (status === 'loading' || (status === 'authenticated' && isLoading && rules.length === 0)) {
    return <p className="text-center mt-10">Lade Rule Manager und Regeln...</p>;
  }

  if (status === 'unauthenticated' || !session) {
    return <p className="text-center mt-10">Bitte zuerst anmelden, um den Rule Manager zu nutzen.</p>; 
  }

  return (
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
          {(userHasRoles(session?.user?.roles, [UserRole.ADMIN, UserRole.COMPLIANCE_MANAGER_FULL, UserRole.COMPLIANCE_MANAGER_WRITE])) && (
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

        {isLoading && rules.length === 0 && <p className="text-gray-600 mb-4">Lade Regeln...</p>}
        {!isLoading && !error && rules.length === 0 && (
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
                      {(userHasRoles(session?.user?.roles, [UserRole.ADMIN, UserRole.COMPLIANCE_MANAGER_FULL, UserRole.COMPLIANCE_MANAGER_WRITE])) && (
                        <Link href={`/rule-manager/${rule._id?.toString()}/edit`} className="text-indigo-600 hover:text-indigo-900 ml-4">
                          Bearbeiten
                        </Link>
                      )}
                      {(userHasRoles(session?.user?.roles, [UserRole.ADMIN, UserRole.COMPLIANCE_MANAGER_FULL])) && (
                         <button 
                            className="text-red-600 hover:text-red-900 ml-4"
                          >
                            Löschen
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
  );
} 