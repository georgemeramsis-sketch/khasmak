import ChangePasswordForm from '@/components/change-password-form';
import {AuthGuard} from '@/components/auth-guard';

export const metadata = {
  title: 'تغيير كلمة المرور',
};

export default function ChangePasswordPage() {
  return (
    <AuthGuard>
      <main>
        <ChangePasswordForm />
      </main>
    </AuthGuard>
  );
}
