'use client';

import { useSession } from 'next-auth/react';
import { useRouter, useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Rule } from '@/types/rule';

export default function RuleDetailPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const params = useParams();
  const ruleInternalId = params.ruleInternalId as string;

  const [rule, setRule] = useState<Rule | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (status === 'loading') return;
    if (status === 'unauthenticated') {
      router.replace('/login');
      return;
    }
    // TODO: Rollenprüfung für Detailansicht (ähnlich wie bei GET /api/rules/[ruleInternalId])
    // const allowedReadRoles = ['Admin', 'Compliancer Manager FULL', 'Compliancer Manager READ', 'Compliancer Manager WRITE'];
    // if (session && !allowedReadRoles.includes(session.user?.role || '')) {
    //   alert('Sie haben keine Berechtigung, diese Regeldetails anzuzeigen.');
    //   router.replace('/rule-manager');
    //   return;
    // }

    if (ruleInternalId && status === 'authenticated') {
      const fetchRuleDetails = async () => {
        setIsLoading(true);
        setError(null);
        try {
          const response = await fetch(`/api/rules/${ruleInternalId}`);
          if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || `Fehler beim Abrufen der Regeldetails: ${response.status}`);
          }
          const data: Rule = await response.json();
          setRule(data);
        } catch (e: Error | unknown) {
          console.error(e);
          setError(e instanceof Error ? e.message : 'Ein unbekannter Fehler ist aufgetreten.');
        } finally {
          setIsLoading(false);
        }
      };
      fetchRuleDetails();
    }
  }, [status, session, router, ruleInternalId]);

  if (status === 'loading' || isLoading) {
    return <p className="text-center mt-10">Lade Regeldetails...</p>;
  }

  if (error) {
    return (
      <div className="container mx-auto px-4 py-8 text-center">
        <h1 className="text-2xl font-bold text-red-600">Fehler</h1>
        <p className="text-gray-600">{error}</p>
        <Link href="/rule-manager" className="mt-4 inline-block text-indigo-600 hover:text-indigo-800">
          &larr; Zurück zum Rule Manager
        </Link>
      </div>
    );
  }

  if (!rule) {
    return (
      <div className="container mx-auto px-4 py-8 text-center">
        <h1 className="text-2xl font-bold text-gray-700">Regel nicht gefunden</h1>
        <Link href="/rule-manager" className="mt-4 inline-block text-indigo-600 hover:text-indigo-800">
          &larr; Zurück zum Rule Manager
        </Link>
      </div>
    );
  }

  // Helper function to format dates or return '-'
  const formatDate = (date?: Date | string) => {
    if (!date) return '-';
    return new Date(date).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <header className="mb-6 flex justify-between items-center">
        <div>
          <Link href="/rule-manager" className="text-sm text-indigo-600 hover:text-indigo-800">
            &larr; Zurück zum Rule Manager
          </Link>
          <h1 className="text-3xl font-bold text-gray-800 mt-2">Regeldetails: {rule.name}</h1>
        </div>
        {(session?.user?.role === 'Admin' || 
          session?.user?.role === 'Compliancer Manager FULL' || 
          session?.user?.role === 'Compliancer Manager WRITE') && (
          <Link href={`/rule-manager/${ruleInternalId}/edit`}>
            <button className="px-4 py-2 bg-indigo-500 text-white font-semibold rounded-md hover:bg-indigo-600">
              Regel bearbeiten
            </button>
          </Link>
        )}
      </header>

      <div className="bg-white p-6 rounded-lg shadow-md">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div><strong className="text-gray-700">Regel-ID (intern):</strong> <span className="text-gray-600">{rule._id?.toString()}</span></div>
          <div><strong className="text-gray-700">Regel-ID (Benutzerdef.):</strong> <span className="text-gray-600">{rule.ruleId}</span></div>
          <div><strong className="text-gray-700">Name:</strong> <span className="text-gray-600">{rule.name}</span></div>
          <div><strong className="text-gray-700">Status:</strong> 
            <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
              rule.status === 'Aktiv' ? 'bg-green-100 text-green-800' :
              rule.status === 'Entwurf' ? 'bg-yellow-100 text-yellow-800' :
              rule.status === 'Inaktiv' ? 'bg-red-100 text-red-800' :
              'bg-gray-100 text-gray-800'
            }`}>
              {rule.status}
            </span>
          </div>
          <div><strong className="text-gray-700">Kategorie:</strong> <span className="text-gray-600">{rule.category || '-'}</span></div>
          <div><strong className="text-gray-700">Priorität:</strong> <span className="text-gray-600">{rule.priority || '-'}</span></div>
          <div className="md:col-span-2"><strong className="text-gray-700">Beschreibung:</strong> <p className="text-gray-600 whitespace-pre-wrap">{rule.description}</p></div>
          <div><strong className="text-gray-700">Zielgruppe:</strong> <span className="text-gray-600">{rule.targetAudience?.join(', ') || '-'}</span></div>
          <div><strong className="text-gray-700">Verknüpfte Dokumente:</strong> <span className="text-gray-600">{rule.linkedDocuments?.join(', ') || '-'}</span></div>
          <div><strong className="text-gray-700">Tags:</strong> <span className="text-gray-600">{rule.tags?.join(', ') || '-'}</span></div>
          <div><strong className="text-gray-700">Version:</strong> <span className="text-gray-600">{rule.version || '-'}</span></div>
          <div><strong className="text-gray-700">Gültig von:</strong> <span className="text-gray-600">{formatDate(rule.validFrom)}</span></div>
          <div><strong className="text-gray-700">Gültig bis:</strong> <span className="text-gray-600">{formatDate(rule.validTo)}</span></div>
          <div><strong className="text-gray-700">Erstellt am:</strong> <span className="text-gray-600">{formatDate(rule.createdAt)}</span></div>
          <div><strong className="text-gray-700">Zuletzt geändert am:</strong> <span className="text-gray-600">{formatDate(rule.updatedAt)}</span></div>
          {/* TODO: Ersteller und Letzter Bearbeiter (Namen statt IDs anzeigen) */}
          <div><strong className="text-gray-700">Erstellt von (ID):</strong> <span className="text-gray-600">{rule.createdBy?.toString() || '-'}</span></div>
          <div><strong className="text-gray-700">Zuletzt geändert von (ID):</strong> <span className="text-gray-600">{rule.lastModifiedBy?.toString() || '-'}</span></div>
        </div>

        {rule.customFields && Object.keys(rule.customFields).length > 0 && (
          <div className="mt-6 pt-4 border-t">
            <h2 className="text-xl font-semibold text-gray-700 mb-2">Zusätzliche Felder</h2>
            {Object.entries(rule.customFields).map(([key, value]) => (
              <div key={key}><strong className="text-gray-700">{key}:</strong> <span className="text-gray-600">{String(value)}</span></div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
} 