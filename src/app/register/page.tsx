'use client';

import { useState, useEffect, FormEvent } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function RegisterPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const enableLocalRegistration = process.env.NEXT_PUBLIC_ENABLE_LOCAL_REGISTRATION === 'true';

  useEffect(() => {
    if (!enableLocalRegistration) {
      router.replace('/login'); // Weiterleiten, wenn Registrierung deaktiviert ist
    } else if (status === 'authenticated') {
      router.replace('/dashboard'); // Weiterleiten, wenn bereits angemeldet
    }
  }, [session, status, router, enableLocalRegistration]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (password !== confirmPassword) {
      setError('Die Passwörter stimmen nicht überein.');
      return;
    }

    if (!name.trim()) {
      setError('Name ist erforderlich.');
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch('/api/auth/register', { // API-Route für die Registrierung
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name, email, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.message || 'Registrierung fehlgeschlagen. Versuchen Sie es später erneut.');
      } else {
        setSuccess(data.message || 'Registrierung erfolgreich! Sie können sich jetzt anmelden.');
        // Optional: Benutzer direkt einloggen
        // const signInResult = await signIn('credentials', {
        //   redirect: false,
        //   email,
        //   password,
        //   callbackUrl: '/dashboard'
        // });
        // if (signInResult?.ok) {
        //   router.replace('/dashboard');
        // } else {
        //   setError(signInResult?.error || 'Anmeldung nach Registrierung fehlgeschlagen.');
        // }
        setName('');
        setEmail('');
        setPassword('');
        setConfirmPassword('');
        // Nach Erfolg zur Login-Seite weiterleiten, damit der Benutzer sich anmelden kann
        setTimeout(() => router.push('/login'), 3000); 
      }
    } catch (err) {
      console.error('Registrierungsfehler:', err);
      setError('Ein unerwarteter Fehler ist aufgetreten.');
    }
    setIsLoading(false);
  };

  if (!enableLocalRegistration || status === 'authenticated') {
    // Zeige nichts oder Ladeindikator, während die Weiterleitung im useEffect stattfindet
    return <p className="text-center mt-10">Lade...</p>; 
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-100">
      <div className="w-full max-w-md p-8 space-y-6 bg-white rounded-lg shadow-md">
        <h2 className="text-2xl font-bold text-center text-gray-900">Konto erstellen</h2>
        
        {error && <p className="text-sm text-red-600 bg-red-100 p-3 rounded-md text-center">{error}</p>}
        {success && <p className="text-sm text-green-600 bg-green-100 p-3 rounded-md text-center">{success}</p>}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-gray-700">Vollständiger Name</label>
            <input id="name" type="text" required value={name} onChange={(e) => setName(e.target.value)} className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500" />
          </div>
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700">E-Mail-Adresse</label>
            <input id="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500" />
          </div>
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700">Passwort</label>
            <input id="password" type="password" autoComplete="new-password" required value={password} onChange={(e) => setPassword(e.target.value)} className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500" />
          </div>
          <div>
            <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700">Passwort bestätigen</label>
            <input id="confirmPassword" type="password" autoComplete="new-password" required value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500" />
          </div>
          <button type="submit" disabled={isLoading} className="w-full px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50">
            {isLoading ? 'Registriere...' : 'Registrieren'}
          </button>
        </form>
        <p className="mt-4 text-sm text-center text-gray-600">
          Bereits ein Konto?{' '}
          <Link href="/login" className="font-medium text-indigo-600 hover:text-indigo-500">
            Anmelden
          </Link>
        </p>
      </div>
    </div>
  );
} 