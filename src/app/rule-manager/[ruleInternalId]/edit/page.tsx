'use client';

import { useSession } from 'next-auth/react';
import { useRouter, useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Rule } from '@/types/rule';
import RuleForm from '@/components/RuleForm';
import { UserRole } from '@/types/enums';
import { ArrowUturnLeftIcon, ArrowPathIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline';

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
    
    const allowedEditRoles: UserRole[] = [UserRole.ADMIN, UserRole.COMPLIANCE_MANAGER_FULL, UserRole.COMPLIANCE_MANAGER_WRITE];
    if (session?.user?.roles && !session.user.roles.some(role => allowedEditRoles.includes(role))) {
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
    return (
      <div className="flex justify-center items-center min-h-screen bg-slate-100">
        <div className="text-center">
          <ArrowPathIcon className="h-12 w-12 text-slate-500 animate-spin mx-auto mb-4" />
          <p className="text-xl font-semibold text-slate-700">Lade Regel zum Bearbeiten...</p>
        </div>
      </div>
    );
  }

  if (error && !isSubmitting) {
    return (
      <div className="min-h-screen bg-slate-100 flex flex-col justify-center items-center px-4 py-8">
        <div className="bg-white p-8 rounded-xl shadow-lg text-center max-w-md w-full">
          <ExclamationTriangleIcon className="h-16 w-16 text-red-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-slate-800 mb-2">Fehler beim Laden der Regel</h1>
          <p className="text-slate-600 mb-6">{error}</p>
          <Link 
            href={`/rule-manager`}
            className="inline-flex items-center px-4 py-2 text-sm bg-indigo-600 text-white font-semibold rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-opacity-75"
          >
            <ArrowUturnLeftIcon className="h-4 w-4 mr-2" />
            Zurück zum Rule Manager
          </Link>
        </div>
      </div>
    );
  }

  if (!rule) {
    return (
      <div className="min-h-screen bg-slate-100 flex flex-col justify-center items-center px-4 py-8">
        <div className="bg-white p-8 rounded-xl shadow-lg text-center max-w-md w-full">
          <ExclamationTriangleIcon className="h-16 w-16 text-slate-400 mx-auto mb-4" /> 
          <h1 className="text-2xl font-bold text-slate-800 mb-2">Regel nicht gefunden</h1>
          <p className="text-slate-600 mb-6">Die angeforderte Regel konnte nicht gefunden werden.</p>
          <Link 
            href="/rule-manager" 
            className="inline-flex items-center px-4 py-2 text-sm bg-indigo-600 text-white font-semibold rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-opacity-75"
          >
            <ArrowUturnLeftIcon className="h-4 w-4 mr-2" />
            Zurück zum Rule Manager
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100">
      <div className="container mx-auto px-4 py-8">
        <header className="mb-8">
          <Link 
            href={`/rule-manager/${ruleInternalId}`} 
            className="inline-flex items-center px-4 py-2 text-sm bg-white text-slate-700 font-semibold rounded-md border border-slate-300 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-opacity-75 mb-4"
          >
            <ArrowUturnLeftIcon className="h-4 w-4 mr-2" />
            Zurück zur Regeldetailansicht
          </Link>
          <h1 className="text-3xl font-bold text-slate-800">Regel bearbeiten: <span className="font-medium">{rule.name}</span></h1>
        </header>

        {error && isSubmitting && (
           <div className="mb-6 p-4 bg-red-50 text-red-700 border border-red-300 rounded-md shadow-sm">
             <p><strong>Fehler beim Speichern:</strong> {error}</p>
           </div>
        )}

        <div className="bg-white p-6 sm:p-8 rounded-xl shadow-lg">
          <RuleForm 
            initialData={rule}
            onSubmit={handleSubmit}
            isSubmitting={isSubmitting}
            submitButtonText="Änderungen speichern"
            onCancel={() => router.push(`/rule-manager/${ruleInternalId}`)}
          />
        </div>
      </div>
    </div>
  );
} 