
"use client"

import React, { useMemo, useState } from "react";
import { Navbar } from "@/components/layout/Navbar";
import { StatCard } from "@/components/dashboard/StatCard";
import { 
  Users, 
  HandCoins, 
  TrendingUp, 
  History,
  Wallet,
  Loader2,
  Landmark,
  CalendarCheck,
  Filter,
  ArrowRightLeft,
  Receipt,
  HeartHandshake,
  PiggyBank,
  Scroll,
  UserCheck,
  Scale,
  CircleCheck,
  CircleX,
  User
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useFirestore, useCollection, useMemoFirebase, useUser } from "@/firebase";
import { collection } from "firebase/firestore";
import { cn } from "@/lib/utils";

const months = [
  { value: "0", label: "January" },
  { value: "1", label: "February" },
  { value: "2", label: "March" },
  { value: "3", label: "April" },
  { value: "4", label: "May" },
  { value: "5", label: "June" },
  { value: "6", label: "July" },
  { value: "7", label: "August" },
  { value: "8", label: "September" },
  { value: "9", label: "October" },
  { value: "10", label: "November" },
  { value: "11", label: "December" },
];

const typeFilters = [
  { value: "all", label: "All" },
  { value: "deposits", label: "Deposits" },
  { value: "loans", label: "Loans" },
  { value: "interest", label: "Interest" },
  { value: "repayments", label: "Repayments" },
  { value: "expenses", label: "Expenses" },
  { value: "waived", label: "Loan Waived" },
];

const dateFilters = [
  { value: "all", label: "All Time" },
  { value: "monthly", label: "Monthly" },
  { value: "yearly", label: "Yearly" },
];

export default function Dashboard() {
  const db = useFirestore();
  const { user, isUserLoading } = useUser();

  const [dateFilterType, setDateFilterType] = useState<string>("monthly");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [viewMonth, setViewMonth] = useState<string>(new Date().getMonth().toString());
  const [viewYear, setViewYear] = useState<string>(new Date().getFullYear().toString());

  const allTxQuery = useMemoFirebase(() => {
    if (!db || !user) return null;
    return collection(db, 'transactions');
  }, [db, user]);

  const membersQuery = useMemoFirebase(() => {
    if (!db || !user) return null;
    return collection(db, 'members');
  }, [db, user]);

  const loansQuery = useMemoFirebase(() => {
    if (!db || !user) return null;
    return collection(db, 'loans');
  }, [db, user]);
  
  const { data: allTransactions, isLoading: txLoading } = useCollection(allTxQuery);
  const { data: members } = useCollection(membersQuery);
  const { data: loans } = useCollection(loansQuery);

  const availableYears = useMemo(() => {
    const years = new Set<string>();
    const currentYear = new Date().getFullYear();
    years.add(currentYear.toString());
    
    if (allTransactions) {
      allTransactions.forEach(tx => {
        if (tx.transactionDate) {
          years.add(new Date(tx.transactionDate).getFullYear().toString());
        }
      });
    }
    return Array.from(years).sort((a, b) => b.localeCompare(a));
  }, [allTransactions]);

  // Filters apply ONLY to the Monthly Overview section
  const filteredTransactions = useMemo(() => {
    if (!allTransactions) return [];

    return allTransactions.filter(tx => {
      // 1. Date Filter
      if (tx.transactionDate) {
        const d = new Date(tx.transactionDate);
        if (dateFilterType === 'monthly') {
          if (d.getMonth().toString() !== viewMonth || d.getFullYear().toString() !== viewYear) return false;
        } else if (dateFilterType === 'yearly') {
          if (d.getFullYear().toString() !== viewYear) return false;
        }
      }

      // 2. Type Filter
      if (typeFilter !== 'all') {
        const t = tx.transactionType;
        if (typeFilter === 'deposits' && t !== 'Deposit') return false;
        if (typeFilter === 'loans' && t !== 'LoanDisbursement') return false;
        if (typeFilter === 'interest' && t !== 'InterestPayment') return false;
        if (typeFilter === 'repayments' && !['PrincipalRepayment', 'FinePayment'].includes(t)) return false;
        if (typeFilter === 'expenses' && t !== 'GeneralExpense') return false;
        if (typeFilter === 'waived' && t !== 'LoanWaived') return false;
      }

      return true;
    });
  }, [allTransactions, dateFilterType, typeFilter, viewMonth, viewYear]);

  // Global stats for the top summary cards
  const globalStats = useMemo(() => {
    const s = {
      deposits: 0,
      loans: 0,
      interest: 0,
      remaining: 0,
      outstanding: 0,
      memberActive: 0,
      memberInactive: 0,
    };

    if (allTransactions) {
      allTransactions.forEach(tx => {
        const amt = tx.amount || 0;
        const t = tx.transactionType;
        const impact = tx.balanceImpact;

        if (t === 'Deposit') s.deposits += amt;
        if (t === 'LoanDisbursement') s.loans += amt;
        if (t === 'InterestPayment') s.interest += amt;

        if (impact === 'Credit') s.remaining += amt;
        else s.remaining -= amt;
      });
    }

    if (loans) {
      s.outstanding = loans.reduce((acc, loan) => {
        if (loan.status === 'Active') {
          return acc + (loan.outstandingPrincipal || 0) + (loan.outstandingInterest || 0);
        }
        return acc;
      }, 0);
    }

    if (members) {
      s.memberActive = members.filter(m => m.status === 'Active').length;
      s.memberInactive = members.filter(m => m.status === 'Inactive').length;
    }

    return s;
  }, [allTransactions, loans, members]);

  // Overview stats based on the UI filters
  const overviewStats = useMemo(() => {
    const s = {
      deposits: 0,
      loans: 0,
      interest: 0,
      principalRecovered: 0,
    };

    filteredTransactions.forEach(tx => {
      const amt = tx.amount || 0;
      const t = tx.transactionType;

      if (t === 'Deposit') s.deposits += amt;
      if (t === 'LoanDisbursement') s.loans += amt;
      if (t === 'InterestPayment') s.interest += amt;
      if (t === 'PrincipalRepayment') s.principalRecovered += amt;
    });

    return s;
  }, [filteredTransactions]);

  if (isUserLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-[#f0f2f9]">
      <Navbar />
      
      <main className="flex-1 p-4 sm:p-8 max-w-7xl mx-auto w-full space-y-8">
        <header className="flex flex-col gap-6">
          <div className="flex flex-col gap-2">
            <h1 className="text-3xl font-extrabold tracking-tight text-[#1a1f36] font-headline">Dashboard</h1>
          </div>

          <div className="flex flex-wrap items-center gap-3 p-4 bg-white rounded-xl shadow-sm border border-slate-200">
            <div className="flex items-center gap-2 mr-4">
              <Filter className="h-4 w-4 text-primary" />
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Filter Controls</span>
            </div>

            <Select value={dateFilterType} onValueChange={setDateFilterType}>
              <SelectTrigger className="w-[140px] h-9 text-sm bg-slate-50">
                <SelectValue placeholder="Date Scope" />
              </SelectTrigger>
              <SelectContent>
                {dateFilters.map(f => (
                  <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            {(dateFilterType === 'monthly' || dateFilterType === 'yearly') && (
              <Select value={viewYear} onValueChange={setViewYear}>
                <SelectTrigger className="w-[100px] h-9 text-sm bg-slate-50">
                  <SelectValue placeholder="Year" />
                </SelectTrigger>
                <SelectContent>
                  {availableYears.map(year => (
                    <SelectItem key={year} value={year}>{year}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            {dateFilterType === 'monthly' && (
              <Select value={viewMonth} onValueChange={setViewMonth}>
                <SelectTrigger className="w-[130px] h-9 text-sm bg-slate-50">
                  <SelectValue placeholder="Month" />
                </SelectTrigger>
                <SelectContent>
                  {months.map(m => (
                    <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            <div className="h-6 w-px bg-slate-200 mx-2" />

            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-[160px] h-9 text-sm bg-slate-50">
                <SelectValue placeholder="Transaction Type" />
              </SelectTrigger>
              <SelectContent>
                {typeFilters.map(f => (
                  <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </header>

        {/* Top Summary Row - Displays Global Data */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          <StatCard 
            title="Total Remaining Fund" 
            value={`₹ ${Math.abs(globalStats.remaining).toLocaleString()}`}
            icon={Wallet}
            iconClassName="bg-blue-50 text-[#3f51b5]"
            description="Cash available in group"
          />
          <StatCard 
            title="Total Deposits" 
            value={`₹ ${Math.abs(globalStats.deposits).toLocaleString()}`}
            icon={PiggyBank}
            iconClassName="bg-indigo-50 text-[#3f51b5]"
            description="From active & closed members"
          />
          <StatCard 
            title="Total Loan Disbursed" 
            value={`₹ ${Math.abs(globalStats.loans).toLocaleString()}`}
            icon={Landmark}
            iconClassName="bg-blue-50 text-[#3f51b5]"
            description="To active & closed members"
          />
          <StatCard 
            title="Total Interest Earned" 
            value={`₹ ${Math.abs(globalStats.interest).toLocaleString()}`}
            icon={Scroll}
            iconClassName="bg-indigo-50 text-[#3f51b5]"
            description="From loan repayments"
          />
        </div>

        {/* Second Summary Row - Displays Global Data */}
        <div className="grid gap-6 md:grid-cols-3">
          <StatCard 
            title="Total Members" 
            value={members?.length || 0}
            icon={Users}
            iconClassName="bg-slate-50 text-[#3f51b5]"
            description="Total members in group"
          />
          
          <Card className="border-none shadow-sm bg-white overflow-hidden">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">MEMBER STATUS</p>
                  <div className="flex items-center gap-4 mt-2">
                    <div className="flex items-center gap-1.5">
                      <CircleCheck className="h-4 w-4 text-green-500" />
                      <span className="text-xl font-bold">{globalStats.memberActive}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <CircleX className="h-4 w-4 text-red-500" />
                      <span className="text-xl font-bold">{globalStats.memberInactive}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <User className="h-4 w-4 text-slate-400" />
                      <span className="text-xl font-bold">0</span>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">Active / Inactive / Closed</p>
                </div>
                <div className="p-3 rounded-xl bg-slate-50 text-[#3f51b5]">
                  <UserCheck className="h-6 w-6" />
                </div>
              </div>
            </CardContent>
          </Card>

          <StatCard 
            title="Outstanding Loan" 
            value={`₹ ${globalStats.outstanding.toLocaleString()}`}
            icon={Scale}
            iconClassName="bg-slate-50 text-[#3f51b5]"
            description="Pending loan recovery"
          />
        </div>

        {/* Monthly Overview Card - Displays Filtered Data */}
        <div className="grid gap-6 lg:grid-cols-2">
          <Card className="border-none shadow-sm bg-white">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <div>
                <CardTitle className="text-lg font-bold text-[#1a1f36]">Monthly Overview</CardTitle>
                <p className="text-xs text-muted-foreground mt-1">
                  Summary for {dateFilterType === 'all' ? 'All Time' : `${months.find(m => m.value === viewMonth)?.label} ${viewYear}`}
                </p>
              </div>
              <CalendarCheck className="h-5 w-5 text-[#3f51b5]" />
            </CardHeader>
            <CardContent className="space-y-4 pt-4">
              <div className="flex justify-between items-center text-sm border-b pb-2">
                <span className="text-slate-600 font-medium">Total Amount Deposits</span>
                <span className="font-bold">₹ {overviewStats.deposits.toLocaleString()}</span>
              </div>
              <div className="flex justify-between items-center text-sm border-b pb-2">
                <span className="text-slate-600 font-medium">Amount Given as Loan</span>
                <span className="font-bold">₹ {overviewStats.loans.toLocaleString()}</span>
              </div>
              <div className="flex justify-between items-center text-sm border-b pb-2">
                <span className="text-slate-600 font-medium">Interest Received</span>
                <span className="font-bold">₹ {overviewStats.interest.toLocaleString()}</span>
              </div>
              <div className="flex justify-between items-center text-sm border-b pb-2">
                <span className="text-slate-600 font-medium">Principal Recovered</span>
                <span className="font-bold">₹ {overviewStats.principalRecovered.toLocaleString()}</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
