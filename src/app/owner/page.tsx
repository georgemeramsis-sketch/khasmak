
import OwnerDashboard from '@/components/owner-dashboard';
import { AuthGuard } from '@/components/auth-guard';

export const metadata = {
  title: 'لوحة تحكم المالك',
}

export default function OwnerPage() {
  return (
    <AuthGuard>
      <main>
        <OwnerDashboard />
      </main>
    </AuthGuard>
  );
}

    