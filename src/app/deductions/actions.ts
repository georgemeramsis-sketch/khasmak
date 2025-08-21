
'use server';

import {promises as fs} from 'fs';
import path from 'path';
import {randomUUID} from 'crypto';
// Deduction type is implicitly defined by how it's used and by the store.
// Let's define it explicitly here for clarity in this file.
export interface Deduction {
  id: string;
  contractName: string;
  personName: string;
  itemName: string;
  meterEquivalentValue: number | '';
  meterEquivalentUnit: string;
  workDescription: string;
  quantity: number | '';
  unitPrice: number | '';
  status: 'قيد المراجعة' | 'موافقة' | 'مرفوض';
  statusUpdateTimestamp?: string; // To store when the status was last changed
  reviewedBy?: string; // To store which admin reviewed it
}


// Define types based on the new database structure
export type UserRole = 'user' | 'admin' | 'owner';

export interface User {
  email: string;
  password_hashed: string;
  role: UserRole;
}

export interface CompanyData {
  contracts: string[];
  workItems: string[];
  contractors: string[];
}

export interface Database {
  users: User[];
  dmc_data: CompanyData;
  curve_data: CompanyData;
  submissions: Submission[];
}

export interface ContractorSubmission {
  id: string;
  contractorName: string;
  notes: string;
  deductions: Deduction[];
}

export type Company = "DMC" | "CURVE";


export interface Submission {
  reportId: string;
  timestamp: string;
  userEmail: string;
  status: string;
  company: Company | null;
  contractors: ContractorSubmission[];
  grandTotal: number;
}


interface SubmitDeductionsPayload {
  company: Company;
  contractors: ContractorSubmission[];
  userEmail: string;
}

// ================= LOCAL DATABASE SETUP =================
const dbPath = path.join(process.cwd(), 'db', 'database.json');

async function readDb(): Promise<Database> {
  try {
    const data = await fs.readFile(dbPath, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    console.error("Error reading database file:", error);
    throw new Error("Could not read from the local database.");
  }
}

async function writeDb(data: Database): Promise<void> {
  try {
    await fs.writeFile(dbPath, JSON.stringify(data, null, 2), 'utf-8');
  } catch (error) {
    console.error("Error writing to database file:", error);
    throw new Error("Could not write to the local database.");
  }
}

// ================= DATA FETCHING FUNCTIONS =================

export async function getFullDatabase(): Promise<Database> {
    return await readDb();
}

export async function getUsers(): Promise<User[]> {
    const db = await readDb();
    return db.users;
}

export async function getContractorList(company: Company): Promise<string[]> {
  const db = await readDb();
  const companyKey = company.toLowerCase() + '_data' as 'dmc_data' | 'curve_data';
  return db[companyKey]?.contractors || [];
}

export async function getContractList(company: Company): Promise<string[]> {
  const db = await readDb();
  const companyKey = company.toLowerCase() + '_data' as 'dmc_data' | 'curve_data';
  return db[companyKey]?.contracts || [];
}

export async function getWorkItemList(company: Company): Promise<string[]> {
  const db = await readDb();
  const companyKey = company.toLowerCase() + '_data' as 'dmc_data' | 'curve_data';
  return db[companyKey]?.workItems || [];
}

// ================= AUTHENTICATION FUNCTIONS =================

export async function getUserRoleByEmail(email: string): Promise<UserRole | null> {
  if (!email) return null;
  const db = await readDb();
  const user = db.users.find(u => u.email.toLowerCase() === email.toLowerCase());
  return user ? user.role : null;
}

export async function validateUser(email: string, password_provided: string): Promise<{ isValid: boolean; role: UserRole | null, needsPasswordChange: boolean }> {
    const db = await readDb();
    const user = db.users.find(u => 
        u.email.toLowerCase() === email.toLowerCase() &&
        u.password_hashed === password_provided // Direct comparison for simplicity
    );
    if (user) {
        return { 
            isValid: true, 
            role: user.role, 
            needsPasswordChange: user.password_hashed === '123456' 
        };
    }
    return { isValid: false, role: null, needsPasswordChange: false };
}

export async function changeUserPassword(email: string, newPassword: string): Promise<{ success: boolean; message: string }> {
    if (!email) {
        return { success: false, message: 'البريد الإلكتروني غير متوفر.' };
    }
    try {
        const db = await readDb();
        const userIndex = db.users.findIndex(u => u.email.toLowerCase() === email.toLowerCase());

        if (userIndex === -1) {
            return { success: false, message: 'لم يتم العثور على المستخدم.' };
        }

        db.users[userIndex].password_hashed = newPassword;
        await writeDb(db);
        
        return { success: true, message: 'تم تغيير كلمة المرور بنجاح.' };

    } catch (error) {
        const message = error instanceof Error ? error.message : "An unknown error occurred.";
        return { success: false, message: `فشل تغيير كلمة المرور: ${message}` };
    }
}


// ================= SUBMISSION FUNCTIONS =================

export async function submitDeductions(payload: SubmitDeductionsPayload) {
  const db = await readDb();
  const grandTotal = payload.contractors.reduce((total, contractor) =>
    total + contractor.deductions.reduce((deductionTotal, deduction) =>
      deductionTotal + ((Number(deduction.quantity) || 0) * (Number(deduction.unitPrice) || 0)), 0), 0);

  const newSubmission: Submission = {
    reportId: `report-${randomUUID()}`,
    timestamp: new Date().toISOString(),
    userEmail: payload.userEmail,
    status: "قيد المراجعة",
    company: payload.company,
    contractors: payload.contractors.map(c => ({
        ...c,
        deductions: c.deductions.map(d => ({...d, status: 'قيد المراجعة', id: randomUUID()}))
    })),
    grandTotal: grandTotal
  };

  db.submissions.push(newSubmission);
  await writeDb(db);

  return { success: true, message: 'تم إرسال التقرير بنجاح للمراجعة.' };
}

export async function getSubmissionHistory({ userEmail }: { userEmail: string }): Promise<Submission[]> {
    const db = await readDb();
    return db.submissions
        .filter(s => s.userEmail === userEmail)
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
}

export async function getAllSubmissions(): Promise<Submission[]> {
  const db = await readDb();
  return db.submissions.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
}

export async function updateDeductionStatus(
  reportId: string,
  deductionId: string,
  newStatus: 'موافقة' | 'مرفوض',
  adminEmail: string
): Promise<{ success: boolean; message: string }> {
  const db = await readDb();
  const reportIndex = db.submissions.findIndex(s => s.reportId === reportId);

  if (reportIndex === -1) {
    return { success: false, message: 'لم يتم العثور على التقرير.' };
  }

  let deductionUpdated = false;
  const now = new Date().toISOString();

  db.submissions[reportIndex].contractors.forEach(contractor => {
      const deduction = contractor.deductions.find(d => d.id === deductionId);
      if (deduction) {
          deduction.status = newStatus;
          deduction.reviewedBy = adminEmail;
          deduction.statusUpdateTimestamp = now;
          deductionUpdated = true;
      }
  });

  if (!deductionUpdated) {
    return { success: false, message: 'لم يتم العثور على الخصم المحدد في التقرير.'};
  }

  // Update overall report status
  const allDeductions = db.submissions[reportIndex].contractors.flatMap(c => c.deductions);
  const isAnyPending = allDeductions.some(d => d.status === 'قيد المراجعة');
  
  if (!isAnyPending) {
    db.submissions[reportIndex].status = 'مكتمل';
  } else {
    db.submissions[reportIndex].status = 'قيد المراجعة';
  }


  await writeDb(db);
  return { success: true, message: `تم تحديث حالة البند إلى "${newStatus}" بنجاح.` };
}


// ================= OWNER ACTIONS =================

export async function updateDatabase(updatedData: Partial<Database>): Promise<{success: boolean, message: string}> {
    try {
        const db = await readDb();
        const newDb = { ...db, ...updatedData };
        
        // Ensure nested objects are merged correctly
        if (updatedData.dmc_data) {
          newDb.dmc_data = { ...db.dmc_data, ...updatedData.dmc_data };
        }
        if (updatedData.curve_data) {
          newDb.curve_data = { ...db.curve_data, ...updatedData.curve_data };
        }
        
        await writeDb(newDb);
        return { success: true, message: "تم تحديث قاعدة البيانات بنجاح."};
    } catch(error) {
        const message = error instanceof Error ? error.message : "An unknown error occurred.";
        return { success: false, message: `فشل تحديث قاعدة البيانات: ${message}`};
    }
}
