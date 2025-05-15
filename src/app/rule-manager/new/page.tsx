'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import RuleForm from '@/components/RuleForm';
import { Rule } from '@/types/rule';
import { UserRole } from '@/types/enums';

export default function NewRulePage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

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
    return <p className="text-center mt-10">Lade Seite zum Erstellen einer neuen Regel...</p>;
  }

  const handleSubmit = async (formData: Partial<Rule>) => {
    setIsSubmitting(true);
    setSubmitError(null);
    try {
      const response = await fetch('/api/rules', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
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
    <div className="container mx-auto px-4 py-8">
      <header className="mb-6">
        <Link href="/rule-manager" className="text-sm text-indigo-600 hover:text-indigo-800">
          &larr; Zurück zum Rule Manager
        </Link>
        <h1 className="text-3xl font-bold text-gray-800 mt-2">Neue Regel erstellen</h1>
      </header>

      {submitError && (
        <div className="mb-4 p-4 bg-red-100 text-red-700 border border-red-400 rounded">
          <p><strong>Fehler beim Speichern:</strong> {submitError}</p>
        </div>
      )}

      <div className="bg-white p-6 rounded-lg shadow-md">
        <RuleForm 
          onSubmit={handleSubmit}
          isSubmitting={isSubmitting}
          submitButtonText="Regel erstellen"
          onCancel={() => router.push('/rule-manager')}
        />
      </div>
    </div>
  );
} 