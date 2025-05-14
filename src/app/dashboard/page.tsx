'use client';

import React from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import Link from 'next/link';
import { UserRole } from '@/types/enums';
import { userHasRoles } from '@/lib/authUtils';
import {
  BookOpenIcon,
  ShieldCheckIcon,
  ClipboardIcon,
  AcademicCapIcon,
  CogIcon
} from '@heroicons/react/24/outline';
import AppLayout from '@/components/AppLayout';

interface DashboardCardProps {
  title: string;
  description: string;
  href: string;
  icon?: React.ReactElement<{ className?: string }>;
  allowedRoles?: UserRole[];
  userRoles?: UserRole[];
}

const DashboardCard: React.FC<DashboardCardProps> = ({ title, description, href, icon, allowedRoles, userRoles }) => {
  if (allowedRoles && !userHasRoles(userRoles, allowedRoles)) {
    return null; // Karte nicht anzeigen, wenn der Benutzer nicht die erforderlichen Rollen hat
  }

  return (
    <Link href={href} className="block p-6 bg-white rounded-xl shadow-lg hover:shadow-xl transition-shadow duration-300 ease-in-out transform hover:-translate-y-1 group">
      <div className="flex items-center space-x-3 mb-3">
        {icon && <div className="p-2 bg-indigo-100 rounded-lg text-indigo-600 group-hover:bg-indigo-200 transition-colors duration-300">{React.cloneElement(icon, { className: "h-6 w-6" })}</div>} 
        <h3 className="text-xl font-semibold text-slate-800 group-hover:text-indigo-600 transition-colors duration-300">{title}</h3>
      </div>
      <p className="text-slate-600">{description}</p>
    </Link>
  );
};

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

  const currentUserRoles = session.user?.roles;

  // Definition der Dashboard-Kacheln
  const cards: Omit<DashboardCardProps, 'userRoles'>[] = [
    {
      title: 'Regelmanagement',
      description: 'Regeln erstellen, anzeigen, bearbeiten und verwalten.',
      href: '/rule-manager',
      icon: <BookOpenIcon />,
      allowedRoles: [UserRole.ADMIN, UserRole.COMPLIANCE_MANAGER_FULL, UserRole.COMPLIANCE_MANAGER_READ, UserRole.COMPLIANCE_MANAGER_WRITE],
    },
    {
      title: 'Risikomanagement',
      description: 'Risiken identifizieren, bewerten, behandeln und überwachen.',
      href: '/risk-manager',
      icon: <ShieldCheckIcon />,
      allowedRoles: [UserRole.ADMIN, UserRole.COMPLIANCE_MANAGER_FULL, UserRole.COMPLIANCE_MANAGER_READ, UserRole.COMPLIANCE_MANAGER_WRITE, UserRole.RISK_MANAGER],
    },
    {
      title: 'Meine Aufgaben',
      description: 'Übersicht über Ihre anstehenden Aufgaben und Verantwortlichkeiten.',
      href: '/dashboard/my-tasks',
      icon: <ClipboardIcon />,
    },
    {
      title: 'Schulungen',
      description: 'Zugriff auf zugewiesene Schulungen und Lernmaterialien.',
      href: '/dashboard/trainings',
      icon: <AcademicCapIcon />,
    },
    {
      title: 'Admin-Panel',
      description: 'Systemkonfiguration und Benutzerverwaltung.',
      href: '/admin',
      icon: <CogIcon />,
      allowedRoles: [UserRole.ADMIN],
    },
  ];

  return (
    <AppLayout>
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-slate-800">Dashboard</h1>
        <p className="text-slate-600">
            Hier ist eine Übersicht Ihrer verfügbaren Module und Funktionen.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {cards.map((card) => (
          <DashboardCard 
            key={card.title} 
            {...card} 
            userRoles={currentUserRoles} 
          />
        ))}
      </div>
    </AppLayout>
  );
} 