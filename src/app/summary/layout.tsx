import { AuthGuard } from '@/components/auth-guard';
import type { ReactNode } from 'react';

export default function SummaryLayout({ children }: { children: ReactNode }) {
  return <AuthGuard>{children}</AuthGuard>;
}
