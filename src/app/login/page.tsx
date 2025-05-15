'use client';

import { useState, useEffect, FormEvent } from 'react';
import { signIn, useSession, getProviders, ClientSafeProvider } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface ProviderButtonProps {
  providerId: string;
  name: string;
  bgColor?: string;
  textColor?: string;
}

const ProviderButton: React.FC<ProviderButtonProps> = ({ providerId, name, bgColor = 'bg-blue-500', textColor = 'text-white' }) => (
  <button
    onClick={() => signIn(providerId, { callbackUrl: '/dashboard' })}
    className={`w-full px-4 py-2 font-semibold ${textColor} ${bgColor} rounded-md hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 mb-2`}
  >
    Mit {name} anmelden
  </button>
);

export default function LoginPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [providers, setProviders] = useState<Record<string, ClientSafeProvider> | null>(null);
  const [enableLocalRegistration, setEnableLocalRegistration] = useState(false);

  useEffect(() => {
    const fetchProvidersAndSettings = async () => {
      const res = await getProviders();
      setProviders(res);
      setEnableLocalRegistration(process.env.ENABLE_LOCAL_REGISTRATION === 'true');
    };
    fetchProvidersAndSettings();
  }, []);

  useEffect(() => {
    if (status === 'authenticated') {
      router.replace('/dashboard');
    }
  }, [session, status, router]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    const result = await signIn('credentials', {
      redirect: false,
      email,
      password,
      callbackUrl: '/dashboard'
    });

    if (result?.error) {
      setError(result.error === 'CredentialsSignin' ? 'Ungültige Anmeldedaten.' : result.error);
    } else if (result?.ok) {
      router.replace('/dashboard');
    }
  };

  if (status === 'loading') {
    return <p className="text-center mt-10">Lade...</p>;
  }
  if (status === 'authenticated') {
    return null;
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-100">
      <div className="w-full max-w-md p-8 space-y-6 bg-white rounded-lg shadow-md">
        <h2 className="text-2xl font-bold text-center text-gray-900">Anmelden</h2>
        
        {error && <p className="text-sm text-red-600 text-center">{error}</p>}

        {providers?.credentials && (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700">
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
                className="block w-full px-3 py-2 mt-1 placeholder-gray-400 border border-gray-300 rounded-md shadow-sm appearance-none focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700">
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
                className="block w-full px-3 py-2 mt-1 placeholder-gray-400 border border-gray-300 rounded-md shadow-sm appearance-none focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
              />
            </div>

            <button
              type="submit"
              className="w-full px-4 py-2 text-sm font-medium text-white bg-indigo-600 border border-transparent rounded-md shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
              Anmelden
            </button>
          </form>
        )}

        {(providers?.google || providers?.['azure-ad']) && <div className="relative my-4">
          <div className="absolute inset-0 flex items-center" aria-hidden="true">
            <div className="w-full border-t border-gray-300" />
          </div>
          <div className="relative flex justify-center text-sm">
            <span className="px-2 bg-white text-gray-500">Oder weitermachen mit</span>
          </div>
        </div>}

        <div className="space-y-2">
          {providers?.google && (
            <ProviderButton providerId="google" name="Google" bgColor="bg-red-500" />
          )}
          {providers?.['azure-ad'] && (
            <ProviderButton providerId="azure-ad" name="Azure AD" bgColor="bg-blue-600" />
          )}
        </div>

        {enableLocalRegistration && providers?.credentials && (
          <p className="mt-6 text-sm text-center text-gray-600">
            Noch kein Konto?{' '}
            <Link href="/register" className="font-medium text-indigo-600 hover:text-indigo-500">
              Registrieren
            </Link>
          </p>
        )}
      </div>
    </div>
  );
} 