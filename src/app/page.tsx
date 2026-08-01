
"use client"

import React, { useMemo, useState } from "react";
import { Navbar } from "@/components/layout/Navbar";
import { StatCard } from "@/components/dashboard/StatCard";
import { 
  Users, 
  HandCoins, 
  TrendingUp, 
  History,
  Coins,
  Loader2,
  Banknote,
  CalendarCheck,
  Filter,
  ArrowRightLeft,
  Receipt,
  HeartHandshake
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
  { value: "all", label: "All Types" },
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
  
  const { data: allTransactions, isLoading: txLoading } = useCollection(allTxQuery);
  const { data: members } = useCollection(membersQuery);

  // Available years for the filter
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

  // Unified Filtering Logic
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

  // Filtered Stat Calculations
  const stats = useMemo(() => {
    const s = {
      deposits: 0,
      loans: 0,
      interest: 0,
      repayments: 0,
      expenses: 0,
      waived: 0,
      remaining: 0
    };

    filteredTransactions.forEach(tx => {
      const amt = tx.amount || 0;
      const t = tx.transactionType;
      const impact = tx.balanceImpact;

      if (t === 'Deposit') s.deposits += amt;
      if (t === 'LoanDisbursement') s.loans += amt;
      if (t === 'InterestPayment') s.interest += amt;
      if (['PrincipalRepayment', 'FinePayment'].includes(t)) s.repayments += amt;
      if (t === 'GeneralExpense') s.expenses += amt;
      if (t === 'LoanWaived') s.waived += amt;

      // Net impact on fund within this filtered set
      if (impact === 'Credit') s.remaining += amt;
      else s.remaining -= amt;
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
    <div className="min-h-screen flex flex-col">
      <Navbar />
      
      <main className="flex-1 p-4 sm:p-8 max-w-7xl mx-auto w-full space-y-8">
        <header className="flex flex-col gap-6">
          <div className="flex flex-col gap-2">
            <h1 className="text-3xl font-bold tracking-tight text-primary font-headline">Financial Overview</h1>
            <p className="text-muted-foreground">Manage and track group funds with live transaction analytics.</p>
          </div>

          {/* Global Filter Bar */}
          <div className="flex flex-wrap items-center gap-3 p-4 bg-white rounded-xl shadow-sm border border-slate-100">
            <div className="flex items-center gap-2 mr-4">
              <Filter className="h-4 w-4 text-primary" />
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Dashboard Filters</span>
            </div>

            <Select value={dateFilterType} onValueChange={setDateFilterType}>
              <SelectTrigger className="w-[140px] h-9 text-sm">
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
                <SelectTrigger className="w-[100px] h-9 text-sm">
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
                <SelectTrigger className="w-[130px] h-9 text-sm">
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
              <SelectTrigger className="w-[160px] h-9 text-sm">
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

        {/* Dashboard Stat Cards */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <StatCard 
            title="Remaining Fund" 
            value={`₹${stats.remaining.toLocaleString()}`}
            icon={Coins}
            iconClassName="bg-blue-100 text-primary"
            description="Net balance of filtered items"
          />
          <StatCard 
            title="Total Deposits" 
            value={`₹${stats.deposits.toLocaleString()}`}
            icon={Users}
            iconClassName="bg-cyan-100 text-cyan-600"
          />
          <StatCard 
            title="Loans Issued" 
            value={`₹${stats.loans.toLocaleString()}`}
            icon={HandCoins}
            iconClassName="bg-indigo-100 text-indigo-600"
          />
          <StatCard 
            title="Interest Received" 
            value={`₹${stats.interest.toLocaleString()}`}
            icon={TrendingUp}
            iconClassName="bg-green-100 text-green-600"
          />
          <StatCard 
            title="Total Repayments" 
            value={`₹${stats.repayments.toLocaleString()}`}
            icon={ArrowRightLeft}
            iconClassName="bg-emerald-100 text-emerald-600"
            description="Principal & Fine"
          />
          <StatCard 
            title="Total Expenses" 
            value={`₹${stats.expenses.toLocaleString()}`}
            icon={Receipt}
            iconClassName="bg-rose-100 text-rose-600"
          />
          <StatCard 
            title="Loan Waived" 
            value={`₹${stats.waived.toLocaleString()}`}
            icon={HeartHandshake}
            iconClassName="bg-amber-100 text-amber-600"
          />
          <StatCard 
            title="Records Count" 
            value={filteredTransactions.length}
            icon={History}
            iconClassName="bg-slate-100 text-slate-600"
            description="Total filtered entries"
          />
        </div>

        <div className="grid gap-6">
          <Card className="border-none shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <div className="flex items-center gap-2">
                <CalendarCheck className="h-5 w-5 text-primary" />
                <CardTitle className="text-lg">Filter Summary Detail</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="pb-4 border-b">
                  <p className="text-sm font-medium text-muted-foreground">
                    Active Data: <span className="text-primary font-bold">
                      {dateFilterType === 'all' ? 'All Time' : dateFilterType === 'yearly' ? `Year ${viewYear}` : `${months.find(m => m.value === viewMonth)?.label} ${viewYear}`}
                    </span>
                    {typeFilter !== 'all' && (
                      <> | Category: <span className="text-primary font-bold capitalize">{typeFilter}</span></>
                    )}
                  </p>
                </div>
                
                {txLoading ? (
                  <div className="flex justify-center p-8"><Loader2 className="animate-spin text-muted-foreground" /></div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-2">
                    <div className="p-4 rounded-xl bg-slate-50 border border-slate-100">
                      <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">Inflow (Credits)</p>
                      <p className="text-2xl font-bold text-green-600">₹{(stats.deposits + stats.interest + stats.repayments).toLocaleString()}</p>
                    </div>
                    <div className="p-4 rounded-xl bg-slate-50 border border-slate-100">
                      <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">Outflow (Debits)</p>
                      <p className="text-2xl font-bold text-destructive">₹{(stats.loans + stats.expenses + stats.waived).toLocaleString()}</p>
                    </div>
                    <div className="p-4 rounded-xl bg-slate-50 border border-slate-100">
                      <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">Net Balance</p>
                      <p className="text-2xl font-bold text-primary">₹{stats.remaining.toLocaleString()}</p>
                    </div>
                    <div className="p-4 rounded-xl bg-primary/5 border border-primary/10">
                      <p className="text-[10px] font-bold text-primary uppercase tracking-wider mb-1">Active Members</p>
                      <p className="text-2xl font-bold text-primary">{members?.length || 0}</p>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
