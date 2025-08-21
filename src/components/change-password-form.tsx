
'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import * as z from 'zod';
import { useRouter } from 'next/navigation';
import { KeyRound, Loader2, LogOut } from 'lucide-react';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { useAuthStore } from '@/stores/auth-store';
import { useToast } from '@/hooks/use-toast';
import { changeUserPassword } from '@/app/deductions/actions';

const passwordFormSchema = z.object({
  newPassword: z.string().min(6, { message: 'كلمة المرور يجب أن تكون 6 أحرف على الأقل.' }),
  confirmPassword: z.string(),
})
.refine((data) => data.newPassword === data.confirmPassword, {
  message: 'كلمتا المرور غير متطابقتين.',
  path: ['confirmPassword'],
})
.refine((data) => data.newPassword !== '123456', {
    message: 'لا يمكن استخدام كلمة المرور الافتراضية. الرجاء اختيار كلمة مرور أخرى.',
    path: ['newPassword'],
});

type PasswordFormValues = z.infer<typeof passwordFormSchema>;

export default function ChangePasswordForm() {
  const router = useRouter();
  const { toast } = useToast();
  const { email, completePasswordChange, logout, role } = useAuthStore(state => ({
    email: state.email,
    completePasswordChange: state.completePasswordChange,
    logout: state.logout,
    role: state.role,
  }));
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<PasswordFormValues>({
    resolver: zodResolver(passwordFormSchema),
    defaultValues: {
      newPassword: '',
      confirmPassword: '',
    },
  });

  async function onSubmit(values: PasswordFormValues) {
    if (!email) {
      toast({
        variant: "destructive",
        title: "خطأ",
        description: "انتهت صلاحية الجلسة. الرجاء تسجيل الدخول مرة أخرى.",
      });
      logout();
      router.replace('/');
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await changeUserPassword(email, values.newPassword);
      if (result.success) {
        completePasswordChange(); // Update the store
        toast({
          title: "نجاح!",
          description: "تم تغيير كلمة المرور بنجاح. سيتم توجيهك الآن.",
          className: "bg-green-100 border-green-400 text-green-800",
        });
        
        // Redirect based on role
        if (role === 'admin') router.push('/admin');
        else if (role === 'owner') router.push('/owner');
        else router.push('/deductions');

        router.refresh(); // Refresh to let middleware re-evaluate
      } else {
        throw new Error(result.message);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "حدث خطأ غير متوقع.";
      toast({
        variant: "destructive",
        title: "فشل تغيير كلمة المرور",
        description: errorMessage,
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  const handleLogout = () => {
    logout();
    router.replace('/');
  }

  return (
    <main className="flex min-h-screen items-center justify-center p-4 bg-background">
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader className="text-center items-center">
          <CardTitle className="font-headline text-3xl pt-2">
            تغيير كلمة المرور
          </CardTitle>
          <CardDescription>
            كلمة المرور الحالية غير آمنة. يرجى تعيين كلمة مرور جديدة.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <FormField
                control={form.control}
                name="newPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>كلمة المرور الجديدة</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input type="password" placeholder="••••••••" {...field} className="pl-10 text-left" dir="ltr" />
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="confirmPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>تأكيد كلمة المرور الجديدة</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input type="password" placeholder="••••••••" {...field} className="pl-10 text-left" dir="ltr" />
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit" className="w-full font-bold text-lg py-6" disabled={isSubmitting}>
                {isSubmitting ? (
                  <>
                    <Loader2 className="ml-2 h-4 w-4 animate-spin" />
                    جاري الحفظ...
                  </>
                ) : 'حفظ كلمة المرور الجديدة'}
              </Button>
            </form>
          </Form>
        </CardContent>
        <CardFooter>
            <Button variant="ghost" onClick={handleLogout} className="text-muted-foreground w-full">
                تسجيل خروج
                <LogOut className="mr-2 h-4 w-4" />
            </Button>
        </CardFooter>
      </Card>
    </main>
  );
}
