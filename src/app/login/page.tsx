"use client";

import { useState, FormEvent } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation'; // Korrekter Import für App Router

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      const result = await signIn('credentials', {
        redirect: false, // Wir handhaben die Weiterleitung manuell
        email,
        password,
      });

      if (result?.error) {
        setError(result.error === "CredentialsSignin" ? "Ungültige Anmeldedaten. Bitte versuchen Sie es erneut." : result.error);
        setIsLoading(false);
      } else if (result?.ok) {
        // Erfolgreich angemeldet
        router.push('/'); // Weiterleitung zur Startseite oder Dashboard
      } else {
        setError("Ein unbekannter Fehler ist aufgetreten.");
        setIsLoading(false);
      }
    } catch (err) {
      console.error("Login-Fehler (catch)", err);
      setError("Ein Fehler ist beim Anmelden aufgetreten.");
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="bg-white p-8 rounded-lg shadow-md w-full max-w-md">
        <h1 className="text-2xl font-bold mb-6 text-center text-gray-800">Login</h1>
        <form onSubmit={handleSubmit}>
          {error && (
            <div className="mb-4 p-3 bg-red-100 text-red-700 border border-red-400 rounded-md">
              {error}
            </div>
          )}
          <div className="mb-4">
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
              E-Mail-Adresse
            </label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
              placeholder="ihre@email.de"
            />
          </div>
          <div className="mb-6">
            <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
              Passwort
            </label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
              placeholder="Ihr Passwort"
            />
          </div>
          <div>
            <button
              type="submit"
              disabled={isLoading}
              className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:bg-indigo-400 disabled:cursor-not-allowed"
            >
              {isLoading ? 'Anmelden...' : 'Anmelden'}
            </button>
          </div>
        </form>
        <p className="mt-6 text-center text-sm text-gray-600">
          Noch kein Konto?{' '}
          <a href="/register" className="font-medium text-indigo-600 hover:text-indigo-500">
            Registrieren
          </a>
        </p>
      </div>
    </div>
  );
} 