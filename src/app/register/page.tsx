"use client";

import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation'; // Korrekter Import für App Router

export default function RegisterPage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setSuccessMessage(null);

    if (password !== confirmPassword) {
      setError("Die Passwörter stimmen nicht überein.");
      return;
    }

    // Optionale: Passwortstärke-Validierung clientseitig (zusätzlich zur serverseitigen)
    if (password.length < 6) { // Beispiel: Mindestlänge 6 Zeichen
        setError("Das Passwort muss mindestens 6 Zeichen lang sein.");
        return;
    }

    setIsLoading(true);

    try {
      const response = await fetch('/api/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name, email, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.message || "Registrierung fehlgeschlagen. Bitte versuchen Sie es erneut.");
      } else {
        setSuccessMessage(data.message || "Registrierung erfolgreich! Sie können sich jetzt anmelden.");
        // Optional: Felder leeren oder zur Login-Seite weiterleiten
        // router.push('/login');
        setName("");
        setEmail("");
        setPassword("");
        setConfirmPassword("");
      }
    } catch (err) {
      console.error("Registrierungs-Fehler (catch)", err);
      setError("Ein Fehler ist bei der Registrierung aufgetreten.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="bg-white p-8 rounded-lg shadow-md w-full max-w-md">
        <h1 className="text-2xl font-bold mb-6 text-center text-gray-800">Registrieren</h1>
        <form onSubmit={handleSubmit}>
          {error && (
            <div className="mb-4 p-3 bg-red-100 text-red-700 border border-red-400 rounded-md">
              {error}
            </div>
          )}
          {successMessage && (
            <div className="mb-4 p-3 bg-green-100 text-green-700 border border-green-400 rounded-md">
              {successMessage}
            </div>
          )}
          <div className="mb-4">
            <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
              Name (Optional)
            </label>
            <input
              id="name"
              name="name"
              type="text"
              autoComplete="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
              placeholder="Ihr Name"
            />
          </div>
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
          <div className="mb-4">
            <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
              Passwort
            </label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="new-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
              placeholder="Mindestens 6 Zeichen"
            />
          </div>
          <div className="mb-6">
            <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-1">
              Passwort bestätigen
            </label>
            <input
              id="confirmPassword"
              name="confirmPassword"
              type="password"
              autoComplete="new-password"
              required
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
              placeholder="Passwort erneut eingeben"
            />
          </div>
          <div>
            <button
              type="submit"
              disabled={isLoading}
              className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:bg-indigo-400 disabled:cursor-not-allowed"
            >
              {isLoading ? 'Registrieren...' : 'Konto erstellen'}
            </button>
          </div>
        </form>
        <p className="mt-6 text-center text-sm text-gray-600">
          Bereits ein Konto?{' '}
          <a href="/login" className="font-medium text-indigo-600 hover:text-indigo-500">
            Anmelden
          </a>
        </p>
      </div>
    </div>
  );
} 