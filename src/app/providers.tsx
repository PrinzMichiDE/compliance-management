"use client";

import { SessionProvider } from "next-auth/react";
import React from "react";

interface ProvidersProps {
  children: React.ReactNode;
  // Du könntest hier session als Prop übergeben, wenn du sie serverseitig abrufst und weitergibst,
  // aber für den reinen Client-Side Provider ist es nicht zwingend notwendig.
  // session?: any; 
}

export default function Providers({ children }: ProvidersProps) {
  return <SessionProvider>{children}</SessionProvider>;
} 