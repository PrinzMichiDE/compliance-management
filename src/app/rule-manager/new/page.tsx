'use client';

import { useSession } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import RuleForm from '@/components/RuleForm';
import { Rule } from '@/types/rule';
import { UserRole } from '@/types/enums';
import { ArrowUturnLeftIcon, ArrowPathIcon } from '@heroicons/react/24/outline';

export default function NewRulePage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  
  const initialRuleData = useMemo(() => {
    const prefillData: Partial<Rule> = {};
    if (searchParams.get('name')) prefillData.name = searchParams.get('name') as string;
    if (searchParams.get('description')) prefillData.description = searchParams.get('description') as string;
    if (searchParams.get('category')) prefillData.category = searchParams.get('category') as string;
    if (searchParams.get('priority')) prefillData.priority = searchParams.get('priority') as 'Hoch' | 'Mittel' | 'Niedrig';
    if (searchParams.get('status')) prefillData.status = searchParams.get('status') as 'Entwurf' | 'Aktiv' | 'Inaktiv' | 'Archiviert';
    if (searchParams.get('tags')) {
      try {
        const tagsParam = searchParams.get('tags');
        if (tagsParam) {
          prefillData.tags = JSON.parse(tagsParam);
        }
      } catch (e) {
        console.warn('Konnte Tags nicht aus Query-Parametern parsen:', e);
        if (searchParams.get('tags')) prefillData.tags = (searchParams.get('tags') as string).split(',').map(t => t.trim());
      }
    }
    if (searchParams.get('ruleId')) prefillData.ruleId = searchParams.get('ruleId') as string;
    
    if (!prefillData.status) {
        prefillData.status = 'Entwurf';
    }

    return prefillData;
  }, [searchParams]);

  useEffect(() => {
    if (status === 'loading') return;
    if (status === 'unauthenticated') {
      router.replace('/login');
      return;
    }
    const allowedCreateRoles: UserRole[] = [UserRole.ADMIN, UserRole.COMPLIANCE_MANAGER_FULL, UserRole.COMPLIANCE_MANAGER_WRITE];
    
    if (session?.user?.roles && !session.user.roles.some(role => allowedCreateRoles.includes(role))) {
      alert('Sie haben keine Berechtigung, neue Regeln zu erstellen.');
      router.replace('/rule-manager');
    }
  }, [status, session, router]);

  if (status === 'loading' || !session) {
    return (
      <div className="flex justify-center items-center min-h-screen bg-slate-100">
        <div className="text-center">
          <ArrowPathIcon className="h-12 w-12 text-slate-500 animate-spin mx-auto mb-4" />
          <p className="text-xl font-semibold text-slate-700">Lade Seite zum Erstellen einer neuen Regel...</p>
        </div>
      </div>
    );
  }

  const handleSubmit = async (formData: Partial<Rule>) => {
    setIsSubmitting(true);
    setSubmitError(null);

    const finalData = { ...initialRuleData, ...formData };

    try {
      const response = await fetch('/api/rules', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(finalData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Fehler beim Erstellen der Regel.');
      }
      
      alert('Regel erfolgreich erstellt!'); 
      router.push('/rule-manager');

    } catch (e: Error | unknown) {
      console.error('Fehler beim Senden des Formulars:', e);
      setSubmitError(e instanceof Error ? e.message : 'Ein unbekannter Fehler ist aufgetreten.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100">
      <div className="container mx-auto px-4 py-8">
        <header className="mb-8">
          <Link 
            href="/rule-manager" 
            className="inline-flex items-center px-4 py-2 text-sm bg-white text-slate-700 font-semibold rounded-md border border-slate-300 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-opacity-75 mb-4"
          >
            <ArrowUturnLeftIcon className="h-4 w-4 mr-2" />
            Zurück zum Rule Manager
          </Link>
          <h1 className="text-3xl font-bold text-slate-800">Neue Regel erstellen</h1>
          {Object.keys(initialRuleData).length > 0 && (
             <p className="text-sm text-indigo-600 mt-1">Formular wurde mit KI-Vorschlägen aus einem Dokument vorausgefüllt.</p>
          )}
        </header>

        {submitError && (
          <div className="mb-6 p-4 bg-red-50 text-red-700 border border-red-300 rounded-md shadow-sm">
            <p><strong>Fehler beim Speichern:</strong> {submitError}</p>
          </div>
        )}

        <div className="bg-white p-6 sm:p-8 rounded-xl shadow-lg">
           <h2 className="text-xl font-semibold text-slate-700 mb-4">Regeldetails eingeben</h2>
          <RuleForm 
            initialData={initialRuleData}
            onSubmit={handleSubmit}
            isSubmitting={isSubmitting}
            submitButtonText="Regel erstellen"
            onCancel={() => router.push('/rule-manager')}
          />
        </div>
      </div>
    </div>
  );
} 