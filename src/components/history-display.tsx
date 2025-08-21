
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/auth-store';
import { getSubmissionHistory, type Submission } from '@/app/deductions/actions';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Inbox, ServerCrash, FilePlus, History, LogOut } from "lucide-react";
import { cn } from '@/lib/utils';
import { useDeductionsStore } from '@/stores/deductions-store';

export default function HistoryDisplay() {
  const router = useRouter();
  const { email, isAuthenticated, logout } = useAuthStore();
  const resetDeductions = useDeductionsStore(state => state.reset);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const formatTimestamp = (isoString: string) => {
    try {
      return new Date(isoString).toLocaleString('ar-EG', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
        timeZone: 'Africa/Cairo' 
      });
    } catch {
      return "تاريخ غير صالح";
    }
  };

  useEffect(() => {
    const fetchHistory = async () => {
      if (isAuthenticated && email) {
        setIsLoading(true);
        setError(null);
        try {
          const history = await getSubmissionHistory({ userEmail: email });
          setSubmissions(history);
        } catch (err) {
          console.error(err);
          const errorMessage = err instanceof Error ? err.message : "فشل تحميل سجل التقارير. الرجاء المحاولة مرة أخرى.";
          setError(errorMessage);
        } finally {
          setIsLoading(false);
        }
      }
    };
    fetchHistory();
  }, [isAuthenticated, email]);


  const handleCreateNew = () => {
    resetDeductions();
    router.push('/deductions');
  }

  const handleLogout = () => {
    logout();
    router.replace('/');
  };
  
  const getStatusVariant = (status: string) => {
    if (status === 'مرفوض') return 'bg-red-500 hover:bg-red-600';
    if (status === 'موافقة') return 'bg-green-500 hover:bg-green-600';
    if (status === 'قيد المراجعة') return 'bg-yellow-500 hover:bg-yellow-600';
    if (status === 'مكتمل') return 'bg-blue-500 hover:bg-blue-600';
    return 'bg-gray-500 hover:bg-gray-600';
  };

  const getDeductionStatusVariant = (status?: string) => {
    if (status === 'مرفوض') return 'text-red-600';
    if (status === 'موافقة') return 'text-green-600';
    return 'text-muted-foreground';
  }
  
  const calculateTotal = (deduction: any) => (Number(deduction.quantity) || 0) * (Number(deduction.unitPrice) || 0);

  const renderContent = () => {
    if (isLoading) {
      return (
        <div className="space-y-4 mt-6">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
        </div>
      );
    }
  
    if (error) {
      return (
        <div className="flex items-center justify-center p-4 mt-6">
          <Alert variant="destructive" className="max-w-lg">
            <ServerCrash className="h-4 w-4"/>
            <AlertTitle>حدث خطأ!</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        </div>
      );
    }

    if (submissions.length === 0) {
       return (
          <div className="text-center py-16">
            <Inbox className="mx-auto h-12 w-12 text-muted-foreground" />
            <h3 className="mt-4 text-lg font-medium">لا توجد تقارير سابقة</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              عندما تقوم بإرسال تقرير جديد، سيظهر هنا في السجل.
            </p>
          </div>
        );
    }
    
    return (
        <Accordion type="single" collapsible className="w-full space-y-4 mt-6">
        {submissions.map((submission) => (
          <AccordionItem value={submission.reportId} key={submission.reportId} className="border-b-0">
             <Card className="shadow-md">
                <AccordionTrigger className="p-6 hover:no-underline">
                    <div className="flex justify-between items-center w-full">
                        <div className="text-right space-y-1">
                            <h3 className="font-bold text-lg">تقرير بتاريخ: {formatTimestamp(submission.timestamp)}</h3>
                            <p className="text-sm text-muted-foreground">جهة العمل: {submission.company}</p>
                        </div>
                        <div className="flex items-center gap-4">
                            <span className="font-bold text-xl">{submission.grandTotal.toFixed(2)} جنيه</span>
                            <Badge className={cn("text-white", getStatusVariant(submission.status))}>{submission.status}</Badge>
                        </div>
                    </div>
                </AccordionTrigger>
                <AccordionContent className="px-6 pb-6">
                    <div className="space-y-4">
                    {submission.contractors.map((contractor) => (
                        <div key={contractor.id}>
                            <h4 className="font-headline text-xl text-primary mb-2">{contractor.contractorName}</h4>
                            <div className="border rounded-lg overflow-hidden">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead className="text-center border-l">اسم العقد</TableHead>
                                        <TableHead className="text-center border-l">بند العمل</TableHead>
                                        <TableHead className="text-center w-1/3 border-l">بيان العمل</TableHead>
                                        <TableHead className="text-center border-l">عدد اليوميات</TableHead>
                                        <TableHead className="text-center border-l">الفئه</TableHead>
                                        <TableHead className="text-center border-l">الإجمالي</TableHead>
                                        <TableHead className="text-center">الحالة</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {contractor.deductions.map((d) => (
                                    <TableRow key={d.id}>
                                        <TableCell className="text-center border-l border-t">{d.contractName}</TableCell>
                                        <TableCell className="text-center border-l border-t">{d.itemName}</TableCell>
                                        <TableCell className="text-center border-l border-t">{d.workDescription}</TableCell>
                                        <TableCell className="text-center border-l border-t">{d.quantity}</TableCell>
                                        <TableCell className="text-center border-l border-t">{Number(d.unitPrice).toFixed(2)}</TableCell>
                                        <TableCell className="text-center font-bold border-l border-t">{calculateTotal(d).toFixed(2)}</TableCell>
                                        <TableCell className={cn("text-center font-semibold border-t", getDeductionStatusVariant(d.status))}>{d.status}</TableCell>
                                    </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                            </div>
                            {contractor.notes && <p className="text-sm text-muted-foreground mt-2 p-2 bg-muted rounded-md">ملحوظة: {contractor.notes}</p>}
                        </div>
                    ))}
                    </div>
                </AccordionContent>
             </Card>
          </AccordionItem>
        ))}
      </Accordion>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4 sm:p-6 lg:p-8">
      <div className="max-w-6xl mx-auto">
        <header className="flex flex-col sm:flex-row items-center justify-between mb-8 gap-4">
            <div className='flex items-center gap-2'>
                <Button size="lg" variant="outline" onClick={handleCreateNew}>
                    <FilePlus className="ml-2 h-5 w-5" />
                    تقرير جديد
                </Button>
                <Button size="lg" disabled>
                     <History className="ml-2 h-5 w-5" />
                    سجل التقارير
                </Button>
            </div>
             <Button variant="ghost" onClick={handleLogout} className="text-muted-foreground">
                <LogOut className="ml-2 h-4 w-4" />
                تسجيل خروج
            </Button>
        </header>

        {renderContent()}
      </div>
    </div>
  );
}
