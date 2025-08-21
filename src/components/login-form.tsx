
'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import * as z from 'zod';
import { useRouter } from 'next/navigation';
import { AtSign, KeyRound, Loader2, User, Shield, Crown } from 'lucide-react';
import { useState, useTransition, useEffect } from 'react';

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
import { validateUser, getUserRoleByEmail } from '@/app/deductions/actions';
import { useToast } from '@/hooks/use-toast';

const loginFormSchema = z.object({
  email: z.string().email({ message: 'الرجاء إدخال بريد إلكتروني صالح.' }),
  password: z.string().min(1, { message: 'الرجاء إدخال كلمة المرور.' }),
});
type LoginFormValues = z.infer<typeof loginFormSchema>;

export default function LoginForm() {
  const router = useRouter();
  const { login, setPasswordChangeRequired } = useAuthStore();
  const { toast } = useToast();

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [detectedRole, setDetectedRole] = useState<'user' | 'admin' | 'owner' | null>(null);
  const [isCheckingRole, startRoleCheck] = useTransition();

  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginFormSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  });

  const emailValue = form.watch('email');

  useEffect(() => {
    const handler = setTimeout(() => {
      if (form.formState.errors.email) {
          setDetectedRole(null);
          return;
      }
      if (emailValue) {
        startRoleCheck(async () => {
          const role = await getUserRoleByEmail(emailValue);
          setDetectedRole(role);
        });
      } else {
        setDetectedRole(null);
      }
    }, 300); // 300ms delay

    return () => {
      clearTimeout(handler);
    };
  }, [emailValue, form.formState.errors.email]);


  async function onSubmit(values: LoginFormValues) {
    setIsSubmitting(true);
    try {
      const validationResult = await validateUser(values.email, values.password);

      if (validationResult.isValid && validationResult.role) {
        if (validationResult.needsPasswordChange) {
          setPasswordChangeRequired(values.email, validationResult.role);
          router.push('/change-password');
        } else {
          login(values.email, validationResult.role);
          toast({
            title: "تم تسجيل الدخول بنجاح",
            description: `مرحباً بك، ${values.email}`,
            className: "bg-green-100 border-green-400 text-green-800",
          });
          let targetPath = '/';
          if (validationResult.role === 'owner') targetPath = '/owner';
          else if (validationResult.role === 'admin') targetPath = '/admin';
          else if (validationResult.role === 'user') targetPath = '/deductions';
          router.push(targetPath);
        }
        router.refresh();
      } else {
        toast({
            variant: "destructive",
            title: "فشل تسجيل الدخول",
            description: "البريد الإلكتروني أو كلمة المرور غير صحيحة.",
        });
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "حدث خطأ أثناء محاولة تسجيل الدخول.";
      toast({
        variant: "destructive",
        title: "خطأ في النظام",
        description: errorMessage,
      });
    } finally {
        setIsSubmitting(false);
    }
  }

  const getRoleInfo = () => {
    if (isCheckingRole) return { icon: <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />, title: 'جاري التحقق...', description: '...' };
    switch (detectedRole) {
        case 'owner':
            return { icon: <Crown className="h-8 w-8 text-primary" />, title: 'حساب المالك', description: 'التحكم الكامل في بيانات التطبيق.' };
        case 'admin':
            return { icon: <Shield className="h-8 w-8 text-primary" />, title: 'حساب المدير', description: 'مراجعة واعتماد التقارير.' };
        case 'user':
            return { icon: <User className="h-8 w-8 text-primary" />, title: 'حساب مستخدم', description: 'للمهندسين والمشرفين.' };
        default:
             return { icon: <User className="h-8 w-8 text-muted-foreground" />, title: 'تسجيل الدخول', description: 'الرجاء إدخال البريد الإلكتروني وكلمة المرور.' };
    }
  }
  
  const { icon, title, description } = getRoleInfo();


  return (
    <main className="flex min-h-screen items-center justify-center p-4 bg-background">
      <Card className="w-full max-w-md shadow-lg animate-in fade-in-50 zoom-in-95 duration-500">
        <CardHeader className="text-center items-center">
            {icon}
           <CardTitle className="font-headline text-3xl pt-2">
            {title}
           </CardTitle>
           <CardDescription>
            {description}
           </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>البريد الإلكتروني</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <AtSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          placeholder="name@example.com"
                          {...field}
                          className="pl-10 text-left" dir="ltr"
                        />
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>كلمة المرور</FormLabel>
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
              <Button type="submit" className="w-full font-bold text-lg py-6" disabled={isSubmitting || isCheckingRole}>
                {isSubmitting ? (
                  <>
                    <Loader2 className="ml-2 h-4 w-4 animate-spin" />
                    جاري التحقق...
                  </>
                ) : 'تسجيل الدخول'}
              </Button>
            </form>
          </Form>
        </CardContent>
        <CardFooter>
            <p className="text-xs text-center text-muted-foreground w-full">
                لاستعادة كلمة السر الخاصة بك، برجاء الرجوع لـ أ/جورج.
            </p>
        </CardFooter>
      </Card>
    </main>
  );
}
