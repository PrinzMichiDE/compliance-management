'use client';

import { useSession } from 'next-auth/react';
import { useRouter, useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Rule } from '@/types/rule';
import RuleForm from '@/components/RuleForm';

export default function EditRulePage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const params = useParams();
  const ruleInternalId = params.ruleInternalId as string;

  const [rule, setRule] = useState<Rule | null>(null);
  const [isLoadingRule, setIsLoadingRule] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (status === 'loading') return;
    if (status === 'unauthenticated') {
      router.replace('/login');
      return;
    }
    
    const allowedEditRoles = ['Admin', 'Compliancer Manager FULL', 'Compliancer Manager WRITE'];
    if (session && !allowedEditRoles.includes(session.user?.role || '')) {
      alert('Sie haben keine Berechtigung, diese Regel zu bearbeiten.');
      router.replace(`/rule-manager/${ruleInternalId}`);
      return;
    }

    if (ruleInternalId && status === 'authenticated') {
      const fetchRuleToEdit = async () => {
        setIsLoadingRule(true);
        setError(null);
        try {
          const response = await fetch(`/api/rules/${ruleInternalId}`);
          if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || `Fehler beim Laden der Regel: ${response.status}`);
          }
          const data: Rule = await response.json();
          setRule(data);
        } catch (e: Error | unknown) {
          console.error(e);
          setError(e instanceof Error ? e.message : 'Ein unbekannter Fehler ist aufgetreten.');
        } finally {
          setIsLoadingRule(false);
        }
      };
      fetchRuleToEdit();
    }
  }, [status, session, router, ruleInternalId]);

  const handleSubmit = async (formData: Partial<Rule>) => {
    setIsSubmitting(true);
    setError(null);
    try {
      const response = await fetch(`/api/rules/${ruleInternalId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Fehler beim Aktualisieren der Regel.');
      }

      alert('Regel erfolgreich aktualisiert!');
      router.push(`/rule-manager/${ruleInternalId}`);

    } catch (e: Error | unknown) {
      console.error('Fehler beim Senden des Formulars:', e);
      setError(e instanceof Error ? e.message : 'Ein unbekannter Fehler ist aufgetreten.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (status === 'loading' || isLoadingRule) {
    return <p className="text-center mt-10">Lade Regel zum Bearbeiten...</p>;
  }

  if (error && !isSubmitting) {
    return (
      <div className="container mx-auto px-4 py-8 text-center">
        <h1 className="text-2xl font-bold text-red-600">Fehler beim Laden</h1>
        <p className="text-gray-600">{error}</p>
        <Link href={`/rule-manager`} className="mt-4 inline-block text-indigo-600 hover:text-indigo-800">
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

  return (
    <div className="container mx-auto px-4 py-8">
      <header className="mb-6">
        <Link href={`/rule-manager/${ruleInternalId}`} className="text-sm text-indigo-600 hover:text-indigo-800">
          &larr; Zurück zur Regeldetailansicht
        </Link>
        <h1 className="text-3xl font-bold text-gray-800 mt-2">Regel bearbeiten: {rule.name}</h1>
      </header>

      {error && isSubmitting && (
         <div className="mb-4 p-4 bg-red-100 text-red-700 border border-red-400 rounded">
           <p><strong>Fehler beim Speichern:</strong> {error}</p>
         </div>
      )}

      <div className="bg-white p-6 rounded-lg shadow-md">
        <RuleForm 
          initialData={rule}
          onSubmit={handleSubmit}
          isSubmitting={isSubmitting}
          submitButtonText="Änderungen speichern"
          onCancel={() => router.push(`/rule-manager/${ruleInternalId}`)}
        />
      </div>
    </div>
  );
} 