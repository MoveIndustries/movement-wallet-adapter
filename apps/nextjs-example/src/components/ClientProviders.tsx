"use client";

import { Toaster } from "@/components/ui/toaster";
import { ReactNode } from "react";

interface ClientProvidersProps {
  children: ReactNode;
}

export function ClientProviders({ children }: ClientProvidersProps) {
  return (
    <>
      <Toaster />
      {children}
    </>
  );
}
