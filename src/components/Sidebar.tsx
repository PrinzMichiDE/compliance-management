'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { UserRole } from '@/types/enums';
import { userHasRoles } from '@/lib/authUtils';
import {
  HomeIcon,
  BookOpenIcon,
  ShieldCheckIcon,
  CogIcon,
  ClipboardDocumentListIcon, 
  AcademicCapIcon
} from '@heroicons/react/24/outline';
import React from 'react';

interface NavItem {
  href: string;
  label: string;
  icon: React.ReactElement<{ className?: string }>;
  allowedRoles?: UserRole[];
  exact?: boolean; 
}

const navigationItems: NavItem[] = [
  {
    href: '/dashboard',
    label: 'Dashboard',
    icon: <HomeIcon />,
    exact: true,
  },
  {
    href: '/rule-manager',
    label: 'Regelmanagement',
    icon: <BookOpenIcon />,
    allowedRoles: [UserRole.ADMIN, UserRole.COMPLIANCE_MANAGER_FULL, UserRole.COMPLIANCE_MANAGER_READ, UserRole.COMPLIANCE_MANAGER_WRITE],
  },
  {
    href: '/risk-manager',
    label: 'Risikomanagement',
    icon: <ShieldCheckIcon />,
    allowedRoles: [UserRole.ADMIN, UserRole.COMPLIANCE_MANAGER_FULL, UserRole.COMPLIANCE_MANAGER_READ, UserRole.COMPLIANCE_MANAGER_WRITE, UserRole.RISK_MANAGER],
  },
  {
    href: '/dashboard/my-tasks', 
    label: 'Meine Aufgaben',
    icon: <ClipboardDocumentListIcon />,
    // allowedRoles: [UserRole.USER] 
  },
  {
    href: '/dashboard/trainings', 
    label: 'Schulungen',
    icon: <AcademicCapIcon />,
    // allowedRoles: [UserRole.USER]
  },
  {
    href: '/admin',
    label: 'Admin Panel',
    icon: <CogIcon />,
    allowedRoles: [UserRole.ADMIN],
  },
];

export default function Sidebar() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const currentUserRoles = session?.user?.roles;

  const isActive = (href: string, exact?: boolean) => {
    if (exact) {
      return pathname === href;
    }
    return pathname.startsWith(href);
  };

  return (
    <aside className="w-64 bg-slate-800 text-slate-100 p-4 space-y-2 flex flex-col min-h-screen">
      <div className="text-2xl font-semibold text-white p-4 mb-4 border-b border-slate-700">
        Compliance AI
      </div>
      <nav className="flex-grow">
        {navigationItems.map((item) => {
          if (item.allowedRoles && !userHasRoles(currentUserRoles, item.allowedRoles)) {
            return null;
          }
          return (
            <Link
              key={item.label}
              href={item.href}
              className={`flex items-center space-x-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors duration-150 ease-in-out
                ${isActive(item.href, item.exact)
                  ? 'bg-indigo-600 text-white'
                  : 'text-slate-300 hover:bg-slate-700 hover:text-white'
                }`}
            >
              {React.cloneElement(item.icon, { className: "h-5 w-5" })}
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>
      <div className="mt-auto border-t border-slate-700 pt-4">
        {/* Optional: User Info in Sidebar oder Logout Button */} 
      </div>
    </aside>
  );
} 