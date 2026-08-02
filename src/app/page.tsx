
"use client"

import React, { useMemo, useState } from "react";
import { Navbar } from "@/components/layout/Navbar";
import { StatCard } from "@/components/dashboard/StatCard";
import { 
  Users, 
  Wallet,
  Loader2,
  Landmark,
  CalendarCheck,
  Filter,
  PiggyBank,
  Scroll,
  UserCheck,
  Scale,
  CircleCheck,
  CircleX,
  AlertCircle
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
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

const dateFilters = [
  { value: "all", label: "All Time" },
  { value: "monthly", label: "Monthly" },
  { value: "yearly", label: "Yearly" },
];

export default function Dashboard() {
  const db = useFirestore();
  const { user, isUserLoading } = useUser();

  const [dateFilterType, setDateFilterType] = useState<string>("monthly");
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

  const globalStats = useMemo(() => {
    const s = {
      deposits: 0,
      loans: 0,
      interest: 0,
      fines: 0,
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
        if (t === 'FinePayment') s.fines += amt;

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

  const filteredTransactions = useMemo(() => {
    if (!allTransactions) return [];

    return allTransactions.filter(tx => {
      if (!tx.transactionDate) return false;
      const d = new Date(tx.transactionDate);
      
      if (dateFilterType === 'monthly') {
        if (d.getMonth().toString() !== viewMonth || d.getFullYear().toString() !== viewYear) return false;
      } else if (dateFilterType === 'yearly') {
        if (d.getFullYear().toString() !== viewYear) return false;
      }
      return true;
    });
  }, [allTransactions, dateFilterType, viewMonth, viewYear]);

  const overviewStats = useMemo(() => {
    const s = {
      deposits: 0,
      loans: 0,
      interest: 0,
      principalRecovered: 0,
      closingBalance: 0
    };

    filteredTransactions.forEach(tx => {
      const amt = tx.amount || 0;
      const t = tx.transactionType;

      if (t === 'Deposit') s.deposits += amt;
      if (t === 'LoanDisbursement') s.loans += amt;
      if (t === 'InterestPayment') s.interest += amt;
      if (t === 'PrincipalRepayment') s.principalRecovered += amt;
    });

    if (allTransactions) {
      const periodEnd = dateFilterType === 'monthly'
        ? new Date(parseInt(viewYear), parseInt(viewMonth) + 1, 0, 23, 59, 59)
        : dateFilterType === 'yearly'
          ? new Date(parseInt(viewYear), 11, 31, 23, 59, 59)
          : new Date();

      s.closingBalance = allTransactions.reduce((acc, tx) => {
        if (!tx.transactionDate) return acc;
        const d = new Date(tx.transactionDate);
        if (dateFilterType !== 'all' && d > periodEnd) return acc;
        return tx.balanceImpact === 'Credit' ? acc + (tx.amount || 0) : acc - (tx.amount || 0);
      }, 0);
    }

    return s;
  }, [filteredTransactions, allTransactions, dateFilterType, viewMonth, viewYear]);

  if (isUserLoading || txLoading) {
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
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Overview Filters</span>
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
          </div>
        </header>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-5">
          <StatCard 
            title="Total Remaining Fund" 
            value={`₹${Math.abs(globalStats.remaining).toLocaleString()}`}
            description="Global cash available"
          />
          <StatCard 
            title="Total Deposits" 
            value={`₹${Math.abs(globalStats.deposits).toLocaleString()}`}
            description="Global collections"
          />
          <StatCard 
            title="Total Loan Disbursed" 
            value={`₹${Math.abs(globalStats.loans).toLocaleString()}`}
            description="Global disbursements"
          />
          <StatCard 
            title="Total Interest Earned" 
            value={`₹${Math.abs(globalStats.interest).toLocaleString()}`}
            description="Global interest income"
          />
          <StatCard 
            title="Total Fines Collected" 
            value={`₹${Math.abs(globalStats.fines).toLocaleString()}`}
            description="Global fine income"
          />
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          <StatCard 
            title="Total Members" 
            value={members?.length || 0}
            description="Total registrations"
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
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">Active / Inactive</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <StatCard 
            title="Outstanding Loan" 
            value={`₹${globalStats.outstanding.toLocaleString()}`}
            description="Total pending recovery"
          />
        </div>

        <div className="grid gap-6">
          <Card className="border-none shadow-sm bg-white max-w-3xl">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <div>
                <CardTitle className="text-lg font-bold text-[#1a1f36]">Monthly Overview</CardTitle>
                <p className="text-xs text-muted-foreground mt-1">
                  Scope: {dateFilterType === 'all' ? 'All Time' : `${months.find(m => m.value === viewMonth)?.label} ${viewYear}`}
                </p>
              </div>
            </CardHeader>
            <CardContent className="space-y-4 pt-4">
              <div className="flex justify-between items-center text-sm border-b pb-2">
                <span className="text-slate-600 font-medium">Monthly Deposits</span>
                <span className="font-bold">₹{overviewStats.deposits.toLocaleString()}</span>
              </div>
              <div className="flex justify-between items-center text-sm border-b pb-2">
                <span className="text-slate-600 font-medium">Loans Disbursed</span>
                <span className="font-bold">₹{overviewStats.loans.toLocaleString()}</span>
              </div>
              <div className="flex justify-between items-center text-sm border-b pb-2">
                <span className="text-slate-600 font-medium">Interest Received</span>
                <span className="font-bold">₹{overviewStats.interest.toLocaleString()}</span>
              </div>
              <div className="flex justify-between items-center text-sm border-b pb-2">
                <span className="text-slate-600 font-medium">Principal Recovered</span>
                <span className="font-bold">₹{overviewStats.principalRecovered.toLocaleString()}</span>
              </div>
              
              <div className="flex justify-between items-center text-sm pt-4 border-t border-dashed mt-2 bg-blue-50/50 p-2 rounded-md">
                <span className="text-primary font-bold">Closing Balance (Carry-Forward)</span>
                <div className="text-right">
                  <span className="font-bold text-primary text-base">₹{overviewStats.closingBalance.toLocaleString()}</span>
                  <p className="text-[10px] text-muted-foreground uppercase font-bold">End of Period Total</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
