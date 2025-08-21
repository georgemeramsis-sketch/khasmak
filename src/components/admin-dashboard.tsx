
'use client';

import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/auth-store';
import { getAllSubmissions, updateDeductionStatus, getUsers, type Submission, type User, type Deduction } from '@/app/deductions/actions';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Inbox, ServerCrash, CheckCircle, XCircle, LogOut, Loader2, CalendarIcon, Download, Archive, FileText, User as UserIcon } from "lucide-react";
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { format, parseISO } from 'date-fns';
import { ar } from 'date-fns/locale';
import * as XLSX from 'xlsx';
import type { DateRange } from 'react-day-picker';
import ExcelJS from "exceljs";

export default function AdminDashboard() {
  const router = useRouter();
  const { toast } = useToast();
  const { email: adminEmail, logout } = useAuthStore(state => ({ email: state.email, logout: state.logout }));
  
  const [allSubmissions, setAllSubmissions] = useState<Submission[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUpdating, setIsUpdating] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);
  const [selectedUser, setSelectedUser] = useState<string>('all');

  const formatTimestamp = (isoString?: string) => {
    if (!isoString) return '--';
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
       return isoString;
    }
  };

  const fetchInitialData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [submissions, userList] = await Promise.all([
          getAllSubmissions(),
          getUsers()
      ]);
      setAllSubmissions(submissions);
      setUsers(userList.filter(u => u.role === 'user')); // Only show submitting users
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "فشل تحميل البيانات.";
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchInitialData();
  }, []);
  
  const handleLogout = () => {
    logout();
    router.replace('/');
  };

  const handleUpdateDeductionStatus = async (reportId: string, deductionId: string, status: 'موافقة' | 'مرفوض') => {
    if (!adminEmail) return;
    setIsUpdating(deductionId);
    try {
      const result = await updateDeductionStatus(reportId, deductionId, status, adminEmail);
      if (result.success) {
        setAllSubmissions(prevSubmissions => {
            const newSubmissions = prevSubmissions.map(submission => {
                if (submission.reportId === reportId) {
                    const updatedContractors = submission.contractors.map(contractor => ({
                        ...contractor,
                        deductions: contractor.deductions.map(deduction => {
                            if (deduction.id === deductionId) {
                                return {
                                    ...deduction,
                                    status: status,
                                    reviewedBy: adminEmail,
                                    statusUpdateTimestamp: new Date().toISOString()
                                };
                            }
                            return deduction;
                        })
                    }));

                    const allDeductions = updatedContractors.flatMap(c => c.deductions);
                    const isAnyPending = allDeductions.some(d => d.status === 'قيد المراجعة');
                    const newStatus = isAnyPending ? 'قيد المراجعة' : 'مكتمل';
                    
                    return { ...submission, contractors: updatedContractors, status: newStatus };
                }
                return submission;
            });
            return newSubmissions;
        });
      } else {
        throw new Error(result.message);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "فشل تحديث حالة البند.";
      toast({ variant: "destructive", title: "خطأ", description: errorMessage });
    } finally {
      setIsUpdating(null);
    }
  }


  const getStatusVariant = (status?: string) => {
    if (!status) return 'bg-gray-500';
    if (status.includes('مرفوض')) return 'bg-red-500';
    if (status.includes('موافقة')) return 'bg-green-500';
    if (status.includes('قيد المراجعة')) return 'bg-yellow-500';
    if (status.includes('مكتمل')) return 'bg-blue-500';
    return 'bg-gray-500';
  };
  
  const calculateTotal = (deduction: any) => (Number(deduction.quantity) || 0) * (Number(deduction.unitPrice) || 0);
  const calculateContractorTotal = (deductions: Deduction[]) => {
    return deductions.reduce((total, d) => total + calculateTotal(d), 0);
  };
  
  const submissionsForReview = useMemo(() => {
      return allSubmissions.filter(s => s.status === 'قيد المراجعة');
  }, [allSubmissions]);

  const filteredArchivedSubmissions = useMemo(() => {
    return allSubmissions.filter(s => {
        if (selectedUser !== 'all' && s.userEmail !== selectedUser) {
            return false;
        }
        const submissionDate = parseISO(s.timestamp);
        const from = dateRange?.from ? new Date(dateRange.from.setHours(0, 0, 0, 0)) : null;
        const to = dateRange?.to ? new Date(dateRange.to.setHours(23, 59, 59, 999)) : null;
        if (from && submissionDate < from) return false;
        if (to && submissionDate > to) return false;
        return true;
    })
  }, [allSubmissions, dateRange, selectedUser]);

// import ExcelJS from "exceljs"; // (Moved to top of file)

// Helper to flatten the archived submissions for Excel export
const getFlattenedData = (submissions: Submission[]) => {
  const rows: Record<string, any>[] = [];
  submissions.forEach(sub => {
    sub.contractors.forEach(contractor => {
      contractor.deductions.forEach(deduction => {
        rows.push({
          "تاريخ التقرير": sub.timestamp,
          "مقدم من": sub.userEmail,
          "جهة العمل": sub.company,
          "اسم المقاول": contractor.contractorName,
          "اسم العقد": deduction.contractName,
          "بند العمل": deduction.itemName,
          "بيان العمل": deduction.workDescription,
          "الفئة": Number(deduction.unitPrice).toFixed(2),
          "الكمية": deduction.quantity,
          "الإجمالي": (Number(deduction.quantity) * Number(deduction.unitPrice)).toFixed(2),
          "بالخصم علي": deduction.personName || '--',
          "ما يوازي بالمتر": deduction.meterEquivalentValue ? `${deduction.meterEquivalentValue} ${deduction.meterEquivalentUnit}` : '--',
          "الحالة": deduction.status,
          "تاريخ المراجعة": deduction.statusUpdateTimestamp ? deduction.statusUpdateTimestamp : '--',
          "تمت المراجعة بواسطة": deduction.reviewedBy || '--',
          "ملاحظات المقاول": contractor.notes || '--'
        });
      });
    });
  });
  return rows;
};

const handleDownloadExcel = async () => {
  const flattenedData = getFlattenedData(filteredArchivedSubmissions);
  if (flattenedData.length === 0) return;

  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet("التقارير");

  // رؤوس الجدول
  const headers = Object.keys(flattenedData[0]);
  worksheet.addRow(headers);

  // ستايل للرؤوس
  const headerRow = worksheet.getRow(1);
  headerRow.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 12 };
  headerRow.alignment = { vertical: "middle", horizontal: "center" };
  headerRow.eachCell((cell: ExcelJS.Cell) => {
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "1F4E78" }, // أزرق غامق
    };
    cell.border = {
      top: { style: "thin" },
      left: { style: "thin" },
      bottom: { style: "thin" },
      right: { style: "thin" },
    };
  });

  // إضافة البيانات
  flattenedData.forEach((row: Record<string, any>) => {
    worksheet.addRow(Object.values(row));
  });

  // Auto-fit للأعمدة
  worksheet.columns.forEach((col) => {
    const column = col as ExcelJS.Column;
    let maxLength = 0;
    column.eachCell({ includeEmpty: true }, (cell: ExcelJS.Cell) => {
      const length = cell.value ? cell.value.toString().length : 10;
      if (length > maxLength) maxLength = length;
    });
    column.width = maxLength < 15 ? 15 : maxLength + 2;
  });

  // حفظ الملف
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: "application/octet-stream" });
  const link = document.createElement("a");
  link.href = window.URL.createObjectURL(blob);
  link.download = "Khasmak_Reports.xlsx";
  link.click();
  window.URL.revokeObjectURL(link.href);
};


  const renderContent = (submissions: Submission[], isArchive: boolean) => {
    if (isLoading) {
      return (
        <div className="space-y-4 mt-6">
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
            <Button onClick={fetchInitialData} className="mt-4">إعادة المحاولة</Button>
          </Alert>
        </div>
      );
    }

    if (submissions.length === 0) {
       return (
          <div className="text-center py-16">
            <Inbox className="mx-auto h-12 w-12 text-muted-foreground" />
            <h3 className="mt-4 text-lg font-medium">{isArchive ? "لا توجد تقارير في الأرشيف" : "لا توجد تقارير للمراجعة حالياً"}</h3>
            <p className="mt-1 text-sm text-muted-foreground">
             {isArchive ? "لم يتم العثور على تقارير تطابق بحثك." : "عندما يقوم المستخدمون بإرسال تقارير جديدة، ستظهر هنا."}
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
                    <div className="flex justify-between items-center w-full gap-4">
                        <div className="text-left">
                            <h4 className="font-semibold text-base mb-1">المقاولون:</h4>
                            <p className="text-sm text-muted-foreground">
                                {submission.contractors.map(c => c.contractorName).join(', ')}
                            </p>
                        </div>
                        <div className="text-right space-y-1 flex-grow">
                            <h3 className="font-bold text-lg text-right">تقرير بتاريخ: {formatTimestamp(submission.timestamp)}</h3>
                            <p className="text-sm text-muted-foreground text-right">مقدم من: {submission.userEmail}</p>
                            <p className="text-sm text-muted-foreground text-right">جهة العمل: {submission.company}</p>
                        </div>
                        <div className="flex flex-col items-end gap-2 flex-shrink-0">
                            <span className="font-bold text-xl">{submission.grandTotal.toFixed(2)} جنيه</span>
                            <Badge className={cn("text-white min-w-[100px] text-center justify-center", getStatusVariant(submission.status))}>{submission.status}</Badge>
                        </div>
                    </div>
                </AccordionTrigger>
                <AccordionContent className="px-6 pb-6">
                    <div className="space-y-4">
                        {submission.contractors.map((contractor) => (
                            <div key={contractor.id}>
                                <h4 className="font-headline text-2xl mb-2">{contractor.contractorName}</h4>
                                 {contractor.notes && <p className="text-sm text-muted-foreground mb-2 p-2 bg-muted rounded-md">ملحوظة: {contractor.notes}</p>}
                                <div className="border rounded-lg overflow-auto">
                                <Table className="min-w-[1100px]">
                                    <TableHeader>
                                        <TableRow className="bg-muted hover:bg-muted">
                                            <TableHead className="text-center w-[12%] border-l">الإجراء</TableHead>
                                            <TableHead className="text-center w-[8%] border-l">الإجمالي</TableHead>
                                            <TableHead className="text-center w-[8%] border-l">الفئة</TableHead>
                                            <TableHead className="text-center w-[8%] border-l">الكمية</TableHead>
                                            <TableHead className="text-center w-[12%] border-l">بالخصم علي</TableHead>
                                            <TableHead className="text-center w-[12%] border-l">ما يوازي بالمتر</TableHead>
                                            <TableHead className="text-center w-[20%]">بيان العمل</TableHead>
                                            <TableHead className="text-right w-[10%] border-l">بند العمل</TableHead>
                                            <TableHead className="text-right w-[10%] border-l">اسم العقد</TableHead>
                                            {isArchive && <TableHead className="text-center w-[15%] border-l">تاريخ المراجعة</TableHead>}
                                            {isArchive && <TableHead className="text-center w-[15%] border-l">تمت المراجعة بواسطة</TableHead>}
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {contractor.deductions.map((d) => (
                                          <TableRow key={d.id}>
                                            <TableCell className="text-center align-middle border-l border-t">
                                                {d.status === 'قيد المراجعة' && !isArchive ? (
                                                     <div className="flex justify-center gap-2">
                                                        <Button
                                                            size="sm"
                                                            className="bg-green-600 hover:bg-green-700 p-2 h-auto"
                                                            onClick={() => handleUpdateDeductionStatus(submission.reportId, d.id!, 'موافقة')}
                                                            disabled={isUpdating === d.id}
                                                        >
                                                            {isUpdating === d.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4" />}
                                                            <span className="sr-only sm:not-sr-only sm:inline-block sm:mr-1">موافقة</span>
                                                        </Button>
                                                        <Button
                                                            size="sm"
                                                            variant="destructive"
                                                            className="p-2 h-auto"
                                                            onClick={() => handleUpdateDeductionStatus(submission.reportId, d.id!, 'مرفوض')}
                                                            disabled={isUpdating === d.id}
                                                        >
                                                            {isUpdating === d.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <XCircle className="h-4 w-4" />}
                                                             <span className="sr-only sm:not-sr-only sm:inline-block sm:mr-1">رفض</span>
                                                        </Button>
                                                    </div>
                                                ) : (
                                                    <Badge className={cn("text-white", getStatusVariant(d.status))}>{d.status}</Badge>
                                                )}
                                            </TableCell>
                                            <TableCell className="text-center font-medium align-top border-l border-t">{calculateTotal(d).toFixed(2)}</TableCell>
                                            <TableCell className="text-center align-top border-l border-t">{Number(d.unitPrice).toFixed(2)}</TableCell>
                                            <TableCell className="text-center align-top border-l border-t">{d.quantity}</TableCell>
                                            <TableCell className="font-medium text-red-500 text-center align-top border-l border-t">{d.personName || '--'}</TableCell>
                                            <TableCell className="text-center align-top border-l border-t">{d.meterEquivalentValue ? `${d.meterEquivalentValue} ${d.meterEquivalentUnit}` : '--'}</TableCell>
                                            <TableCell className="whitespace-pre-wrap break-words text-center align-top border-l border-t">{d.workDescription}</TableCell>
                                            <TableCell className="align-top text-right border-l border-t">{d.itemName}</TableCell>
                                            <TableCell className="font-medium align-top text-right border-l border-t">{d.contractName}</TableCell>
                                            {isArchive && <TableCell className="text-center align-top border-l border-t">{formatTimestamp(d.statusUpdateTimestamp)}</TableCell>}
                                            {isArchive && <TableCell className="text-center align-top border-l border-t">{d.reviewedBy || '--'}</TableCell>}
                                          </TableRow>
                                        ))}
                                    </TableBody>
                                    <TableFooter>
                                        <TableRow className="bg-muted hover:bg-muted">
                                            <TableCell colSpan={1} className="font-bold text-base border-t">إجمالي المقاول</TableCell>
                                            <TableCell className="text-center font-bold text-base border-l border-t">{calculateContractorTotal(contractor.deductions).toFixed(2)}</TableCell>
                                            <TableCell colSpan={isArchive ? 9 : 7} className="text-right border-t" />
                                        </TableRow>
                                    </TableFooter>
                                </Table>
                                </div>
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
      <div className="max-w-7xl mx-auto">
        <header className="flex flex-col sm:flex-row items-center justify-between mb-6 gap-4">
          <div>
            <h1 className="font-headline text-3xl sm:text-4xl text-primary">
              لوحة تحكم المدير
            </h1>
            <p className="text-muted-foreground mt-1">
              مراجعة التقارير الجديدة والبحث في الأرشيف.
            </p>
          </div>
           <Button variant="ghost" onClick={handleLogout} className="text-muted-foreground">
                تسجيل خروج
                <LogOut className="mr-2 h-4 w-4" />
            </Button>
        </header>
        
        <Tabs defaultValue="review" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="review">
                    <FileText className="ml-2 h-4 w-4" /> تقارير للمراجعة
                    {submissionsForReview.length > 0 && <Badge className="mr-2 bg-yellow-500 text-white">{submissionsForReview.length}</Badge>}
                </TabsTrigger>
                <TabsTrigger value="archive">
                    <Archive className="ml-2 h-4 w-4" /> أرشيف التقارير
                </TabsTrigger>
            </TabsList>
            <TabsContent value="review">
                {renderContent(submissionsForReview, false)}
            </TabsContent>
            <TabsContent value="archive">
                <Card>
                    <CardHeader>
                        <CardTitle>البحث في الأرشيف</CardTitle>
                        <CardDescription>
                            ابحث في جميع التقارير السابقة وقم بتصدير النتائج.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="flex flex-col sm:flex-row gap-4 mb-4 items-center flex-wrap">
                            <Popover>
                                <PopoverTrigger asChild>
                                    <Button
                                    id="date"
                                    variant={"outline"}
                                    className={cn(
                                        "w-full sm:w-[300px] justify-start text-right font-normal",
                                        !dateRange && "text-muted-foreground"
                                    )}
                                    >
                                    <CalendarIcon className="ml-2 h-4 w-4" />
                                    {dateRange?.from ? (
                                        dateRange.to ? (
                                        <>
                                            {format(dateRange.from, "LLL dd, y", {locale: ar})} -{" "}
                                            {format(dateRange.to, "LLL dd, y", {locale: ar})}
                                        </>
                                        ) : (
                                        format(dateRange.from, "LLL dd, y", {locale: ar})
                                        )
                                    ) : (
                                        <span>اختر نطاق التاريخ</span>
                                    )}
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0" align="start">
                                    <Calendar
                                    initialFocus
                                    mode="range"
                                    defaultMonth={dateRange?.from}
                                    selected={dateRange}
                                    onSelect={setDateRange}
                                    numberOfMonths={1}
                                    locale={ar}
                                    />
                                </PopoverContent>
                            </Popover>
                            <div className="w-full sm:w-auto flex-grow sm:flex-grow-0">
                                <Select value={selectedUser} onValueChange={setSelectedUser}>
                                    <SelectTrigger className="w-full sm:w-[250px]">
                                        <div className="flex items-center gap-2">
                                            <UserIcon className="h-4 w-4 text-muted-foreground" />
                                            <SelectValue placeholder="فلترة حسب المستخدم" />
                                        </div>
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">كل المستخدمين</SelectItem>
                                        {users.map(user => (
                                            <SelectItem key={user.email} value={user.email}>
                                                {user.email}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            
                            <Button onClick={handleDownloadExcel} disabled={filteredArchivedSubmissions.length === 0}>
                                <Download className="ml-2 h-4 w-4" />
                                تنزيل Excel
                            </Button>
                        </div>
                        {renderContent(filteredArchivedSubmissions, true)}
                    </CardContent>
                </Card>
            </TabsContent>
        </Tabs>

      </div>
    </div>
  );
}