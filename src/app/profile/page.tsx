"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function ProfilePage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === "unauthenticated") {
      router.replace("/login");
    }
  }, [status, router]);

  if (status === "loading") {
    return <div className="min-h-screen flex items-center justify-center"><p className="text-lg text-slate-600">Lade Profil...</p></div>;
  }

  if (status === "unauthenticated" || !session) {
    return <div className="min-h-screen flex items-center justify-center"><p className="text-lg text-slate-600">Bitte zuerst anmelden.</p></div>;
  }

  const user = session.user;
  const userRoles: string[] = user?.roles || [];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-200 flex items-center justify-center">
      <div className="bg-white rounded-xl shadow-lg p-8 w-full max-w-md">
        <div className="flex items-center space-x-4 mb-6">
          <span className="inline-flex items-center justify-center h-14 w-14 rounded-full bg-indigo-100 text-indigo-700 font-bold text-2xl">
            {user.name?.[0] || '?'}
          </span>
          <div>
            <h2 className="text-2xl font-bold text-slate-800">{user.name}</h2>
            <p className="text-slate-500 text-sm">{user.email}</p>
          </div>
        </div>
        <div className="mb-4">
          <h3 className="text-sm font-semibold text-slate-700 mb-1">Rollen</h3>
          <div className="flex flex-wrap gap-2">
            {userRoles.length === 0 && <span className="text-slate-400 text-xs">Keine Rollen</span>}
            {userRoles.map((role) => (
              <span key={role} className="bg-indigo-600 text-white text-xs font-semibold px-2 py-1 rounded-full">
                {role}
              </span>
            ))}
          </div>
        </div>
        {/* Platz für weitere Profildaten oder Bearbeitungsfunktionen */}
        {/* <button className="mt-6 w-full bg-indigo-600 text-white py-2 rounded-md font-semibold hover:bg-indigo-700 transition">Profil bearbeiten</button> */}
      </div>
    </div>
  );
} 