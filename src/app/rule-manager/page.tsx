'use client';

import { useSession, signOut } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Rule } from '@/types/rule';
import { UserRole } from '@/types/enums';
import { userHasRoles } from '@/lib/authUtils';
import { ArrowLeftOnRectangleIcon, ArrowPathIcon, DocumentPlusIcon, EyeIcon, PencilIcon, TrashIcon, ArrowUturnLeftIcon } from '@heroicons/react/24/outline';

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
    return (
      <div className="flex justify-center items-center min-h-screen bg-slate-100">
        <div className="text-center">
          <ArrowPathIcon className="h-12 w-12 text-slate-500 animate-spin mx-auto mb-4" />
          <p className="text-xl font-semibold text-slate-700">Lade Rule Manager und Regeln...</p>
        </div>
      </div>
    );
  }

  if (status === 'unauthenticated' || !session) {
    return (
      <div className="flex justify-center items-center min-h-screen bg-slate-100">
        <p className="text-xl font-semibold text-slate-700">Bitte zuerst anmelden, um den Rule Manager zu nutzen.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100">
      <div className="container mx-auto px-4 py-8">
        <header className="mb-8 flex flex-col sm:flex-row justify-between items-start sm:items-center">
          <div>
            <h1 className="text-3xl font-bold text-slate-800">Rule Manager</h1>
            <p className="text-slate-500 mt-1">Verwalten und überwachen Sie hier Ihre Compliance-Regeln.</p>
          </div>
          <div className="flex items-center space-x-3 mt-4 sm:mt-0">
            <Link 
              href="/dashboard" 
              className="flex items-center px-4 py-2 text-sm bg-white text-slate-700 font-semibold rounded-md border border-slate-300 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-opacity-75"
            >
              <ArrowUturnLeftIcon className="h-4 w-4 mr-2" />
              Dashboard
            </Link>
            <button 
              onClick={() => signOut({ callbackUrl: '/login' })}
              className="flex items-center px-4 py-2 text-sm bg-red-600 text-white font-semibold rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-opacity-75"
            >
              <ArrowLeftOnRectangleIcon className="h-4 w-4 mr-2" />
              Abmelden
            </button>
          </div>
        </header>
        
        <div className="bg-white p-6 sm:p-8 rounded-xl shadow-lg">
          <div className="mb-6 flex flex-col sm:flex-row justify-between items-start sm:items-center">
            <h2 className="text-2xl font-semibold text-slate-800">Regelübersicht</h2>
            {(userHasRoles(session?.user?.roles, [UserRole.ADMIN, UserRole.COMPLIANCE_MANAGER_FULL, UserRole.COMPLIANCE_MANAGER_WRITE])) && (
              <Link href="/rule-manager/new" className="mt-3 sm:mt-0">
                <button className="flex items-center px-4 py-2 bg-indigo-600 text-white font-semibold rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-opacity-75">
                  <DocumentPlusIcon className="h-5 w-5 mr-2" />
                  Neue Regel erstellen
                </button>
              </Link>
            )}
          </div>

          {error && (
            <div className="mb-6 p-4 bg-red-50 text-red-700 border border-red-300 rounded-md">
              <p><strong>Fehler:</strong> {error}</p>
            </div>
          )}

          {isLoading && rules.length === 0 && (
            <div className="text-center py-10">
              <ArrowPathIcon className="h-8 w-8 text-slate-400 animate-spin mx-auto mb-3" />
              <p className="text-slate-500">Lade Regeln...</p>
            </div>
          )}
          {!isLoading && !error && rules.length === 0 && (
             <div className="text-center py-10 border-2 border-dashed border-slate-300 rounded-lg">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="mx-auto h-12 w-12 text-slate-400">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.143 17.082a2.448 2.448 0 0 0 3.714 0l6.143-6.143a2.448 2.448 0 0 0-3.443-3.443l-6.143 6.143a2.448 2.448 0 0 0 3.443 3.443Z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.612 10.962a2.448 2.448 0 0 0-3.443 3.443l6.143 6.143a2.448 2.448 0 0 0 3.443-3.443l-6.143-6.143Z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 21.75c5.94 0 10.75-4.81 10.75-10.75S17.94 1.25 12 1.25 1.25 6.06 1.25 12s4.81 10.75 10.75 10.75Z" />
              </svg>
              <p className="mt-4 text-slate-500 font-semibold">Keine Regeln gefunden.</p>
              {(userHasRoles(session?.user?.roles, [UserRole.ADMIN, UserRole.COMPLIANCE_MANAGER_FULL, UserRole.COMPLIANCE_MANAGER_WRITE])) && (
                <p className="mt-2 text-sm text-slate-500">Erstellen Sie Ihre erste Regel, um loszulegen.</p>
              )}
            </div>
          )}

          {rules.length > 0 && (
            <div className="border border-slate-200 rounded-lg overflow-x-auto shadow-sm">
              <table className="min-w-full divide-y divide-slate-200">
                <thead className="bg-slate-50">
                  <tr>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Regel-ID</th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Name</th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Status</th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Kategorie</th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Priorität</th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Aktionen</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-slate-200">
                  {rules.map((rule) => (
                    <tr key={rule._id?.toString() || rule.ruleId} className="hover:bg-slate-50 transition-colors duration-150">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-800">{rule.ruleId}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">{rule.name}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <span className={`px-2.5 py-0.5 inline-flex text-xs leading-5 font-semibold rounded-full ${
                          rule.status === 'Aktiv' ? 'bg-green-100 text-green-700' :
                          rule.status === 'Entwurf' ? 'bg-yellow-100 text-yellow-700' :
                          rule.status === 'Inaktiv' ? 'bg-red-100 text-red-700' :
                          'bg-slate-100 text-slate-700'
                        }`}>
                          {rule.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">{rule.category || '-'}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">{rule.priority || '-'}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2 flex items-center">
                        <Link 
                          href={`/rule-manager/${rule._id?.toString()}`} 
                          className="flex items-center text-indigo-600 hover:text-indigo-800 p-1 hover:bg-indigo-50 rounded-md transition-colors duration-150"
                          title="Details anzeigen"
                        >
                          <EyeIcon className="h-5 w-5" />
                        </Link>
                        {(userHasRoles(session?.user?.roles, [UserRole.ADMIN, UserRole.COMPLIANCE_MANAGER_FULL, UserRole.COMPLIANCE_MANAGER_WRITE])) && (
                          <Link 
                            href={`/rule-manager/${rule._id?.toString()}/edit`} 
                            className="flex items-center text-sky-600 hover:text-sky-800 p-1 hover:bg-sky-50 rounded-md transition-colors duration-150"
                            title="Regel bearbeiten"
                          >
                            <PencilIcon className="h-5 w-5" />
                          </Link>
                        )}
                        {(userHasRoles(session?.user?.roles, [UserRole.ADMIN, UserRole.COMPLIANCE_MANAGER_FULL])) && (
                           <button 
                              className="flex items-center text-red-600 hover:text-red-800 p-1 hover:bg-red-50 rounded-md transition-colors duration-150"
                              title="Regel löschen"
                              // onClick={() => handleDelete(rule._id?.toString())} // Implement delete logic
                            >
                              <TrashIcon className="h-5 w-5" />
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
    </div>
  );
} 