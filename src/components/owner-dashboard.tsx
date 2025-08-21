
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/auth-store';
import { getFullDatabase, updateDatabase, type Database, type User, type CompanyData } from '@/app/deductions/actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { LogOut, Loader2, ServerCrash, PlusCircle, Trash2, Save, Users, Building } from "lucide-react";
import { useToast } from '@/hooks/use-toast';
import { Label } from '@/components/ui/label';

export default function OwnerDashboard() {
  const router = useRouter();
  const { toast } = useToast();
  const logout = useAuthStore(state => state.logout);
  
  const [db, setDb] = useState<Database | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // State for user editing dialog
  const [isUserDialogOpen, setIsUserDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<Partial<User> | null>(null);
  const [editingUserIndex, setEditingUserIndex] = useState<number | null>(null);

  const fetchDatabase = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const fullDb = await getFullDatabase();
      setDb(fullDb);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "فشل تحميل قاعدة البيانات.";
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchDatabase();
  }, []);

  const handleLogout = () => {
    logout();
    router.replace('/');
  };

  const handleSave = async (dataToSave: Partial<Database>) => {
    setIsSaving(true);
    const result = await updateDatabase(dataToSave);
    if (result.success) {
        toast({ title: "نجاح", description: result.message });
        await fetchDatabase(); // Refresh data
    } else {
        toast({ variant: "destructive", title: "خطأ", description: result.message });
    }
    setIsSaving(false);
  };
  
  const handleOpenUserDialog = (user: User | null, index: number | null) => {
    setEditingUser(user ? { ...user } : { email: '', password_hashed: '', role: 'user' });
    setEditingUserIndex(index);
    setIsUserDialogOpen(true);
  };
  
  const handleSaveUser = () => {
    if (!db || !editingUser) return;
    const updatedUsers = [...db.users];
    if (editingUserIndex !== null) {
      // Editing existing user
      if (editingUser.password_hashed === '') {
        // If password field is empty, keep the old password
        editingUser.password_hashed = db.users[editingUserIndex].password_hashed;
      }
      updatedUsers[editingUserIndex] = editingUser as User;
    } else {
      // Adding new user
      if (!editingUser.email || !editingUser.password_hashed) {
        toast({variant: 'destructive', title: 'خطأ', description: 'البريد الإلكتروني وكلمة المرور مطلوبان.'});
        return;
      }
      updatedUsers.push(editingUser as User);
    }
    handleSave({ users: updatedUsers });
    setIsUserDialogOpen(false);
  };

  const handleDeleteUser = (index: number) => {
     if (!db) return;
     if (db.users[index].role === 'owner') {
        toast({ variant: 'destructive', title: 'خطأ', description: 'لا يمكن حذف حساب المالك.' });
        return;
     }
     const updatedUsers = db.users.filter((_, i) => i !== index);
     handleSave({ users: updatedUsers });
  };
  
  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>, companyKey: 'dmc_data' | 'curve_data', dataKey: keyof CompanyData) => {
      if (!db) return;
      const { value } = e.target;
      const list = value.split('\n').map(item => item.trim()).filter(Boolean);
      
      const updatedDb = { ...db };
      if (updatedDb[companyKey]) {
          (updatedDb[companyKey] as CompanyData)[dataKey] = list as any; // Use 'any' to bypass strict type checking for dynamic key
          setDb(updatedDb);
      }
  };
  
  const handleSaveCompanyData = () => {
    if (!db) return;
    handleSave({ dmc_data: db.dmc_data, curve_data: db.curve_data });
  };


  const renderContent = () => {
    if (isLoading) {
      return <Skeleton className="h-[400px] w-full mt-6" />;
    }
  
    if (error || !db) {
      return (
        <div className="flex items-center justify-center p-4 mt-6">
          <Alert variant="destructive" className="max-w-lg">
            <ServerCrash className="h-4 w-4"/>
            <AlertTitle>حدث خطأ!</AlertTitle>
            <AlertDescription>{error || "لا يمكن عرض قاعدة البيانات."}</AlertDescription>
            <Button onClick={fetchDatabase} className="mt-4">إعادة المحاولة</Button>
          </Alert>
        </div>
      );
    }

    return (
      <Tabs defaultValue="users" className="w-full mt-6">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="users"><Users className="ml-2"/> المستخدمين</TabsTrigger>
          <TabsTrigger value="company-data"><Building className="ml-2"/> بيانات الشركات</TabsTrigger>
        </TabsList>
        
        {/* Users Tab */}
        <TabsContent value="users">
          <Card>
            <CardHeader>
              <CardTitle>إدارة المستخدمين</CardTitle>
              <CardDescription>إضافة، تعديل، وحذف حسابات المستخدمين والمدراء.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Button onClick={() => handleOpenUserDialog(null, null)}><PlusCircle className="ml-2"/>إضافة مستخدم جديد</Button>
              <div className="border rounded-lg">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="border-l">البريد الإلكتروني</TableHead>
                      <TableHead className="border-l">كلمة المرور</TableHead>
                      <TableHead className="border-l">الصلاحية</TableHead>
                      <TableHead className="text-left">الإجراءات</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {db.users.map((user, index) => (
                      <TableRow key={index}>
                        <TableCell className="font-medium border-l border-t">{user.email}</TableCell>
                        <TableCell className="border-l border-t">••••••••</TableCell>
                        <TableCell className="border-l border-t">{user.role}</TableCell>
                        <TableCell className="text-left space-x-2 border-t">
                           <Button variant="outline" size="sm" onClick={() => handleOpenUserDialog(user, index)}>تعديل</Button>
                           <Button variant="destructive" size="sm" onClick={() => handleDeleteUser(index)} disabled={user.role === 'owner'}>حذف</Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        
        {/* Company Data Tab */}
        <TabsContent value="company-data">
          <Card>
            <CardHeader>
              <CardTitle>إدارة بيانات الشركات</CardTitle>
              <CardDescription>تعديل قوائم العقود، بنود العمل، والمقاولين لكل شركة. كل سطر يمثل بندًا منفصلاً.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* DMC Data */}
                    <div className="space-y-4 p-4 border rounded-lg">
                        <h3 className="text-lg font-bold text-primary">DMC Data</h3>
                        <div>
                            <Label htmlFor="dmc-contracts">قائمة العقود (DMC)</Label>
                            <Textarea id="dmc-contracts" className="min-h-[150px] font-mono text-sm" value={db.dmc_data.contracts.join('\n')} onChange={(e) => handleTextareaChange(e, 'dmc_data', 'contracts')} />
                        </div>
                        <div>
                           <Label htmlFor="dmc-work-items">قائمة بنود العمل (DMC)</Label>
                           <Textarea id="dmc-work-items" className="min-h-[150px] font-mono text-sm" value={db.dmc_data.workItems.join('\n')} onChange={(e) => handleTextareaChange(e, 'dmc_data', 'workItems')} />
                        </div>
                         <div>
                           <Label htmlFor="dmc-contractors">قائمة المقاولين (DMC)</Label>
                           <Textarea id="dmc-contractors" className="min-h-[150px] font-mono text-sm" value={db.dmc_data.contractors.join('\n')} onChange={(e) => handleTextareaChange(e, 'dmc_data', 'contractors')} />
                        </div>
                    </div>
                    {/* CURVE Data */}
                    <div className="space-y-4 p-4 border rounded-lg">
                        <h3 className="text-lg font-bold text-primary">CURVE Data</h3>
                        <div>
                            <Label htmlFor="curve-contracts">قائمة العقود (CURVE)</Label>
                            <Textarea id="curve-contracts" className="min-h-[150px] font-mono text-sm" value={db.curve_data.contracts.join('\n')} onChange={(e) => handleTextareaChange(e, 'curve_data', 'contracts')}/>
                        </div>
                        <div>
                           <Label htmlFor="curve-work-items">قائمة بنود العمل (CURVE)</Label>
                           <Textarea id="curve-work-items" className="min-h-[150px] font-mono text-sm" value={db.curve_data.workItems.join('\n')} onChange={(e) => handleTextareaChange(e, 'curve_data', 'workItems')}/>
                        </div>
                         <div>
                           <Label htmlFor="curve-contractors">قائمة المقاولين (CURVE)</Label>
                           <Textarea id="curve-contractors" className="min-h-[150px] font-mono text-sm" value={db.curve_data.contractors.join('\n')} onChange={(e) => handleTextareaChange(e, 'curve_data', 'contractors')}/>
                        </div>
                    </div>
                </div>
                <Button onClick={handleSaveCompanyData} disabled={isSaving}>
                    {isSaving ? <Loader2 className="animate-spin ml-2"/> : <Save className="ml-2" />}
                    حفظ بيانات الشركات
                </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    );
  };

  return (
    <div className="min-h-screen bg-background p-4 sm:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto">
        <header className="flex flex-col sm:flex-row items-center justify-between mb-6 gap-4">
          <div>
            <h1 className="font-headline text-3xl sm:text-4xl text-primary">
              لوحة تحكم المالك
            </h1>
            <p className="text-muted-foreground mt-1">
              إدارة البيانات الأساسية للتطبيق.
            </p>
          </div>
          <Button variant="ghost" onClick={handleLogout} className="text-muted-foreground">
            تسجيل خروج
            <LogOut className="mr-2 h-4 w-4" />
          </Button>
        </header>
        
        {renderContent()}

        {/* User Edit/Add Dialog */}
        <Dialog open={isUserDialogOpen} onOpenChange={setIsUserDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingUserIndex !== null ? 'تعديل مستخدم' : 'إضافة مستخدم جديد'}</DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="email" className="text-right">البريد الإلكتروني</Label>
                <Input id="email" value={editingUser?.email || ''} onChange={(e) => setEditingUser({...editingUser, email: e.target.value})} className="col-span-3" />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="password" className="text-right">كلمة المرور</Label>
                <Input id="password" type="text" placeholder={editingUserIndex !== null ? 'اتركه فارغًا لعدم التغيير' : ''} onChange={(e) => setEditingUser({...editingUser, password_hashed: e.target.value})} className="col-span-3" />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="role" className="text-right">الصلاحية</Label>
                <Select
                  value={editingUser?.role}
                  onValueChange={(value) => setEditingUser({...editingUser, role: value as User['role']})}
                >
                    <SelectTrigger className="col-span-3">
                        <SelectValue placeholder="اختر صلاحية" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="user">User</SelectItem>
                        <SelectItem value="admin">Admin</SelectItem>
                    </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
                <DialogClose asChild>
                    <Button variant="outline">إلغاء</Button>
                </DialogClose>
                <Button onClick={handleSaveUser} disabled={isSaving}>
                  {isSaving ? <Loader2 className="animate-spin" /> : 'حفظ التغييرات'}
                </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
