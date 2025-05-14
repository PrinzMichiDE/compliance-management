'use client';

import { useSession, signOut } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import Link from 'next/link';

export default function RuleManagerPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.replace('/login');
    }
  }, [status, router]);

  if (status === 'loading') {
    return <p className="text-center mt-10">Lade Rule Manager...</p>;
  }

  if (status === 'unauthenticated' || !session) {
    return <p className="text-center mt-10">Bitte zuerst anmelden, um den Rule Manager zu nutzen.</p>; 
  }

  // Hier könnten wir später spezifische Rollenprüfungen für den Rule Manager hinzufügen
  // z.B. if (!['Admin', 'Compliancer Manager FULL', 'Compliancer Manager WRITE', 'Compliancer Manager READ'].includes(session.user?.role || '')) { ... }

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
        <h2 className="text-xl font-semibold text-gray-700 mb-4">Regelübersicht (Platzhalter)</h2>
        <p className="text-gray-600 mb-4">
          Dieser Bereich wird die Anzeige, Erstellung und Verwaltung von Compliance-Regeln ermöglichen.
        </p>
        
        {/* Beispiel für Rollen-spezifische Inhalte */} 
        {(session.user?.role === 'Admin' || 
          session.user?.role === 'Compliancer Manager FULL' || 
          session.user?.role === 'Compliancer Manager WRITE') && (
          <div className="mb-6">
            <button className="px-4 py-2 bg-green-500 text-white font-semibold rounded-md hover:bg-green-600">
              Neue Regel erstellen (Platzhalter)
            </button>
          </div>
        )}

        <div className="border rounded-lg overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Regel-ID</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Beschreibung</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Aktionen</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {/* Beispiel-Daten - später dynamisch befüllen */} 
              <tr>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">RULE-001</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">Datenzugriffskontrolle für Finanzberichte</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-green-500">Aktiv</td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                  <a href="#" className="text-indigo-600 hover:text-indigo-900">Details</a>
                  {(session.user?.role === 'Admin' || 
                    session.user?.role === 'Compliancer Manager FULL' || 
                    session.user?.role === 'Compliancer Manager WRITE') && (
                    <a href="#" className="text-indigo-600 hover:text-indigo-900 ml-4">Bearbeiten</a>
                  )}
                </td>
              </tr>
              <tr>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">RULE-002</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">Passwortrichtlinie für Benutzerkonten</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-green-500">Aktiv</td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                  <a href="#" className="text-indigo-600 hover:text-indigo-900">Details</a>
                  {(session.user?.role === 'Admin' || 
                    session.user?.role === 'Compliancer Manager FULL' || 
                    session.user?.role === 'Compliancer Manager WRITE') && (
                    <a href="#" className="text-indigo-600 hover:text-indigo-900 ml-4">Bearbeiten</a>
                  )}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
} 