'use client';

import { useSession, signOut } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import Link from 'next/link';

export default function AdminPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === 'loading') return;

    if (status === 'unauthenticated') {
      router.replace('/login');
      return;
    }
    if (session?.user?.role !== 'Admin') {
      router.replace('/dashboard?error=admin_only'); 
    }
  }, [session, status, router]);

  if (status === 'loading') {
    return <p className="text-center mt-10">Lade Admin-Bereich...</p>;
  }

  if (status !== 'authenticated' || session?.user?.role !== 'Admin') {
    return (
      <div className="container mx-auto px-4 py-8 text-center">
        <h1 className="text-2xl font-bold text-red-600">Zugriff verweigert</h1>
        <p className="text-gray-700">Sie haben keine Berechtigung, auf diese Seite zuzugreifen.</p>
        <Link href="/dashboard" className="text-indigo-600 hover:text-indigo-800 mt-4 inline-block">
          Zurück zum Dashboard
        </Link>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <header className="mb-6 flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-800">Admin Panel</h1>
          <p className="text-gray-600">Willkommen, Administrator {session.user?.name || ''}!</p>
        </div>
        <button 
          onClick={() => signOut({ callbackUrl: '/login' })}
          className="px-4 py-2 bg-red-500 text-white font-semibold rounded-md hover:bg-red-600 focus:outline-none focus:ring-2 focus:ring-red-400 focus:ring-opacity-75"
        >
          Abmelden
        </button>
      </header>
      
      <div className="bg-white p-6 rounded-lg shadow-md">
        <h2 className="text-xl font-semibold text-gray-700 mb-4">Benutzerverwaltung (Beispiel)</h2>
        <p className="text-gray-600">
          Hier könnten Funktionen zur Benutzerverwaltung, Rollenmanagement oder andere administrative Aufgaben platziert werden.
        </p>
        <div className="mt-6">
          <h3 className="text-lg font-semibold text-gray-700">Systemstatus</h3>
          <p className="text-gray-600">Alle Systeme laufen normal.</p>
        </div>

        <div className="mt-6">
          <Link href="/dashboard" className="text-indigo-600 hover:text-indigo-800">
            &larr; Zurück zum Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
} 