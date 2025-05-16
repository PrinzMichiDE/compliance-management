'use client';

import React from 'react';
import { useSession, signOut } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { UserRole } from '@/types/enums';
import { userHasRoles } from '@/lib/authUtils';
import Link from 'next/link';
import { BookOpenIcon, ShieldCheckIcon, ClipboardDocumentListIcon, AcademicCapIcon, Cog6ToothIcon, FolderOpenIcon } from '@heroicons/react/24/outline';

const cardDefs = [
  {
    title: 'Regelmanagement',
    description: 'Regeln erstellen, anzeigen, bearbeiten und verwalten.',
    href: '/rule-manager',
    icon: <BookOpenIcon className="h-7 w-7 text-indigo-600" />, 
    allowedRoles: [UserRole.ADMIN, UserRole.COMPLIANCE_MANAGER_FULL, UserRole.COMPLIANCE_MANAGER_READ, UserRole.COMPLIANCE_MANAGER_WRITE],
  },
  {
    title: 'Risikomanagement',
    description: 'Risiken identifizieren, bewerten, behandeln und überwachen.',
    href: '/risk-manager',
    icon: <ShieldCheckIcon className="h-7 w-7 text-indigo-600" />, 
    allowedRoles: [UserRole.ADMIN, UserRole.COMPLIANCE_MANAGER_FULL, UserRole.COMPLIANCE_MANAGER_READ, UserRole.COMPLIANCE_MANAGER_WRITE, UserRole.RISK_MANAGER],
  },
  {
    title: 'Dokumentenbibliothek',
    description: 'Dokumente zentral verwalten und analysieren.',
    href: '/document-library',
    icon: <FolderOpenIcon className="h-7 w-7 text-indigo-600" />,
    allowedRoles: [
      UserRole.ADMIN,
      UserRole.COMPLIANCE_MANAGER_FULL,
      UserRole.COMPLIANCE_MANAGER_READ,
      UserRole.COMPLIANCE_MANAGER_WRITE
    ],
  },
  {
    title: 'Meine Aufgaben',
    description: 'Übersicht über Ihre anstehenden Aufgaben und Verantwortlichkeiten.',
    href: '/dashboard/my-tasks',
    icon: <ClipboardDocumentListIcon className="h-7 w-7 text-indigo-600" />, 
  },
  {
    title: 'Schulungen',
    description: 'Zugriff auf zugewiesene Schulungen und Lernmaterialien.',
    href: '/dashboard/trainings',
    icon: <AcademicCapIcon className="h-7 w-7 text-indigo-600" />, 
  },
  {
    title: 'Admin-Panel',
    description: 'Systemkonfiguration und Benutzerverwaltung.',
    href: '/admin',
    icon: <Cog6ToothIcon className="h-7 w-7 text-indigo-600" />, 
    allowedRoles: [UserRole.ADMIN],
  },
];

export default function DashboardPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.replace('/login');
    }
  }, [status, router]);

  if (status === 'loading') {
    return <div className="min-h-screen flex items-center justify-center"><p className="text-lg text-slate-600">Lade Dashboard...</p></div>;
  }

  if (status === 'unauthenticated' || !session) {
    return <div className="min-h-screen flex items-center justify-center"><p className="text-lg text-slate-600">Bitte zuerst anmelden.</p></div>;
  }

  const user = session.user;
  const userRoles: string[] = user?.roles || [];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-200">
      {/* Header */}
      <header className="w-full bg-white shadow-sm py-4 px-6 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <span className="text-2xl font-bold text-indigo-700 tracking-tight">Compliance Dashboard</span>
        </div>
        <div className="flex items-center space-x-2">
          <span className="inline-flex items-center justify-center h-9 w-9 rounded-full bg-indigo-100 text-indigo-700 font-bold text-lg">
            {user.name?.[0] || '?'}
          </span>
          <span className="font-medium text-slate-800 mr-2 cursor-pointer hover:underline" onClick={() => router.push('/profile')}>{user.name}</span>
          {userRoles.map((role) => (
            <span key={role} className="bg-indigo-600 text-white text-xs font-semibold px-2 py-1 rounded-full ml-1">
              {role}
            </span>
          ))}
          <button
            onClick={() => signOut({ callbackUrl: '/login' })}
            className="ml-4 px-3 py-1.5 bg-slate-200 hover:bg-red-600 hover:text-white text-slate-700 rounded transition font-semibold text-sm"
          >
            Abmelden
          </button>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-7xl mx-auto px-4 py-10">
        <h1 className="text-3xl font-bold text-slate-800 mb-2">Dashboard</h1>
        <p className="text-slate-600 mb-8">Hier ist eine Übersicht Ihrer verfügbaren Module und Funktionen.</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {cardDefs.map((card) => {
            if (card.allowedRoles && !userHasRoles(userRoles as UserRole[], card.allowedRoles)) {
              return null;
            }
            return (
              <Link key={card.title} href={card.href} className="block group rounded-xl bg-white shadow-md hover:shadow-lg transition-shadow duration-200 p-6 border border-slate-100 hover:border-indigo-300">
                <div className="flex items-center space-x-3 mb-4">
                  {card.icon}
                  <span className="text-lg font-semibold text-slate-800 group-hover:text-indigo-700 transition-colors duration-200">{card.title}</span>
                </div>
                <p className="text-slate-600 text-sm">{card.description}</p>
              </Link>
            );
          })}
        </div>
      </main>
    </div>
  );
} 