'use client';

import React from 'react';
import Sidebar from './Sidebar';
import { useSession, signOut } from 'next-auth/react';
import { Bars3Icon } from '@heroicons/react/24/outline';
import { useState } from 'react';

interface AppLayoutProps {
  children: React.ReactNode;
}

export default function AppLayout({ children }: AppLayoutProps) {
  const { data: session } = useSession();
  const [sidebarOpen, setSidebarOpen] = useState(false); // Für mobile Ansicht

  return (
    <div className="flex h-screen bg-slate-100">
      {/* Desktop Sidebar */}
      <div className="hidden md:flex md:flex-shrink-0">
        <Sidebar />
      </div>

      <div className="flex flex-col flex-1 overflow-hidden">
        {/* Mobile Header & Desktop Header (optional, kann auch nur in Sidebar sein) */}
        <header className="bg-white shadow-sm md:sticky top-0 z-40">
          <div className="container mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center py-3">
              {/* Mobile Sidebar Toggle */}
              <button 
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className="md:hidden text-slate-500 hover:text-slate-700 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-indigo-500"
              >
                <span className="sr-only">Open sidebar</span>
                <Bars3Icon className="h-6 w-6" aria-hidden="true" />
              </button>
              
              <div className="flex-1 min-w-0">
                {/* Optional: Platz für Breadcrumbs oder Seitentitel, wenn nicht in Sidebar */}
              </div>

              <div className="flex items-center space-x-4 ml-auto">
                {session?.user?.name && (
                    <span className="text-sm text-slate-600 hidden sm:block">
                        Willkommen, {session.user.name}!
                    </span>
                )}
                <button 
                  onClick={() => signOut({ callbackUrl: '/login' })}
                  className="px-3 py-1.5 bg-red-600 text-white text-xs font-medium rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-opacity-75 transition ease-in-out duration-150"
                >
                  Abmelden
                </button>
              </div>
            </div>
          </div>
        </header>

        {/* Mobile Sidebar (Overlay) */}
        {sidebarOpen && (
          <div className="md:hidden fixed inset-0 z-50 flex">
            <div className="fixed inset-0 bg-black/30" aria-hidden="true" onClick={() => setSidebarOpen(false)}></div>
            <div className="relative flex-1 flex flex-col max-w-xs w-full bg-slate-800">
              <div className="absolute top-0 right-0 -mr-12 pt-2">
                  <button
                      type="button"
                      className="ml-1 flex items-center justify-center h-10 w-10 rounded-full focus:outline-none focus:ring-2 focus:ring-inset focus:ring-white"
                      onClick={() => setSidebarOpen(false)}
                  >
                      <span className="sr-only">Close sidebar</span>
                      {/* XMarkIcon hier, wenn du es importierst, oder einfacher Text X */}
                      <svg className="h-6 w-6 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                  </button>
              </div>
              <Sidebar />
            </div>
            <div className="flex-shrink-0 w-14" aria-hidden="true"></div> {/* Spacer to prevent content overlap */} 
          </div>
        )}

        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
          {children}
        </main>
      </div>
    </div>
  );
} 