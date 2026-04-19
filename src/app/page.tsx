
"use client"

import React, { useMemo, useState, useEffect } from "react";
import { Navbar } from "@/components/layout/Navbar";
import { StatCard } from "@/components/dashboard/StatCard";
import { 
  Users, 
  HandCoins, 
  TrendingUp, 
  AlertCircle, 
  History,
  Coins,
  Loader2,
  Banknote,
  CalendarCheck
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import Link from "next/link";
import { cn } from "@/lib/utils";
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

export default function Dashboard() {
  const db = useFirestore();
  const { user, isUserLoading } = useUser();

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
  const { data: allLoans } = useCollection(loansQuery);

  const [viewMonth, setViewMonth] = useState<string>(new Date().getMonth().toString());
  const [viewYear, setViewYear] = useState<string>(new Date().getFullYear().toString());

  // Global dynamic stats
  const totalFunds = useMemo(() => {
    return allTransactions?.reduce((acc, tx) => {
      return tx.balanceImpact === 'Credit' ? acc + (tx.amount || 0) : acc - (tx.amount || 0);
    }, 0) || 0;
  }, [allTransactions]);
  
  const totalInterest = useMemo(() => {
    return allTransactions?.filter(tx => tx.transactionType === 'InterestPayment')
      .reduce((acc, tx) => acc + (tx.amount || 0), 0) || 0;
  }, [allTransactions]);

  const totalLoanDisbursed = useMemo(() => {
    return allTransactions?.filter(tx => tx.transactionType === 'LoanDisbursement')
      .reduce((acc, tx) => acc + (tx.amount || 0), 0) || 0;
  }, [allTransactions]);

  const outstandingLoan = useMemo(() => {
    return allLoans?.reduce((acc, loan) => {
      return acc + (loan.outstandingPrincipal || 0) + (loan.outstandingInterest || 0);
    }, 0) || 0;
  }, [allLoans]);

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

  // Monthly Summary Calculations
  const monthlyStats = useMemo(() => {
    if (!allTransactions) {
      return { deposits: 0, loans: 0, interest: 0, recovered: 0 };
    }
    const m = parseInt(viewMonth);
    const y = parseInt(viewYear);

    const monthlyTx = allTransactions.filter(tx => {
      if (!tx.transactionDate) return false;
      const d = new Date(tx.transactionDate);
      return d.getMonth() === m && d.getFullYear() === y;
    });

    return {
      deposits: monthlyTx.filter(tx => tx.transactionType === 'Deposit').reduce((acc, tx) => acc + (tx.amount || 0), 0),
      loans: monthlyTx.filter(tx => tx.transactionType === 'LoanDisbursement').reduce((acc, tx) => acc + (tx.amount || 0), 0),
      interest: monthlyTx.filter(tx => tx.transactionType === 'InterestPayment').reduce((acc, tx) => acc + (tx.amount || 0), 0),
      recovered: monthlyTx.filter(tx => tx.transactionType === 'PrincipalRepayment').reduce((acc, tx) => acc + (tx.amount || 0), 0),
    };
  }, [allTransactions, viewMonth, viewYear]);

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
        <header className="flex flex-col gap-2">
          <h1 className="text-3xl font-bold tracking-tight text-primary font-headline">Financial Overview</h1>
          <p className="text-muted-foreground">Welcome back, admin. Here's what's happening in Yuva Finance 2 today.</p>
        </header>

        {/* Top Stats */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <StatCard 
            title="Total Fund Available" 
            value={`₹${totalFunds.toLocaleString()}`}
            icon={Coins}
            iconClassName="bg-blue-100 text-primary"
          />
          <StatCard 
            title="Active Members" 
            value={members?.length || 0}
            icon={Users}
            iconClassName="bg-cyan-100 text-cyan-600"
          />
          <StatCard 
            title="Interest Earned" 
            value={`₹${totalInterest.toLocaleString()}`}
            icon={TrendingUp}
            iconClassName="bg-green-100 text-green-600"
          />
          <StatCard 
            title="Outstanding Loan" 
            value={`₹${outstandingLoan.toLocaleString()}`}
            icon={Banknote}
            iconClassName="bg-rose-100 text-rose-600"
          />
          <StatCard 
            title="Total Loan Disbursed" 
            value={`₹${totalLoanDisbursed.toLocaleString()}`}
            icon={HandCoins}
            iconClassName="bg-indigo-100 text-indigo-600"
          />
          <StatCard 
            title="Alerts" 
            value={totalFunds < 5000 ? 1 : 0}
            description="System status check"
            icon={AlertCircle}
            iconClassName="bg-amber-100 text-amber-600"
          />
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          {/* Monthly Fund Summary */}
          <Card className="lg:col-span-2 border-none shadow-sm">
            <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2">
              <div className="flex items-center gap-2">
                <CalendarCheck className="h-5 w-5 text-primary" />
                <CardTitle className="text-lg">Monthly Fund Summary</CardTitle>
              </div>
              <div className="flex items-center gap-2">
                <Select value={viewMonth} onValueChange={setViewMonth}>
                  <SelectTrigger className="w-[120px] h-8 text-xs bg-slate-50">
                    <SelectValue placeholder="Month" />
                  </SelectTrigger>
                  <SelectContent>
                    {months.map(m => (
                      <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={viewYear} onValueChange={setViewYear}>
                  <SelectTrigger className="w-[80px] h-8 text-xs bg-slate-50">
                    <SelectValue placeholder="Year" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableYears.map(year => (
                      <SelectItem key={year} value={year}>{year}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="pb-4 border-b">
                  <p className="text-sm font-medium text-muted-foreground">
                    Summary for: <span className="text-primary font-bold">
                      {months.find(m => m.value === viewMonth)?.label} {viewYear}
                    </span>
                  </p>
                </div>
                
                {txLoading ? (
                  <div className="flex justify-center p-8"><Loader2 className="animate-spin text-muted-foreground" /></div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                    <div className="p-4 rounded-xl bg-slate-50 border border-slate-100 transition-all hover:shadow-md">
                      <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">Total Amount Deposits</p>
                      <p className="text-2xl font-bold text-primary">₹{monthlyStats.deposits.toLocaleString()}</p>
                    </div>
                    <div className="p-4 rounded-xl bg-slate-50 border border-slate-100 transition-all hover:shadow-md">
                      <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">Amount Given as Loan</p>
                      <p className="text-2xl font-bold text-destructive">₹{monthlyStats.loans.toLocaleString()}</p>
                    </div>
                    <div className="p-4 rounded-xl bg-slate-50 border border-slate-100 transition-all hover:shadow-md">
                      <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">Interest Received</p>
                      <p className="text-2xl font-bold text-green-600">₹{monthlyStats.interest.toLocaleString()}</p>
                    </div>
                    <div className="p-4 rounded-xl bg-slate-50 border border-slate-100 transition-all hover:shadow-md">
                      <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">Principal Recovered</p>
                      <p className="text-2xl font-bold text-indigo-600">₹{monthlyStats.recovered.toLocaleString()}</p>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Quick Actions / Summary */}
          <div className="space-y-6">
            <Card className="border-none shadow-sm bg-primary text-primary-foreground">
              <CardHeader>
                <CardTitle className="text-lg">Quick Actions</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-2">
                <Button className="w-full bg-accent text-accent-foreground hover:bg-accent/90" asChild>
                  <Link href="/members/new">Add New Member</Link>
                </Button>
                <Button variant="outline" className="w-full bg-white/10 border-white/20 text-white hover:bg-white/20" asChild>
                  <Link href="/deposits/new">Record Bulk Deposit</Link>
                </Button>
                <Button variant="outline" className="w-full bg-white/10 border-white/20 text-white hover:bg-white/20" asChild>
                  <Link href="/loans/new">Issue New Loan</Link>
                </Button>
              </CardContent>
            </Card>

            <Card className="border-none shadow-sm">
              <CardHeader>
                <CardTitle className="text-lg">Active Alerts</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {totalFunds < 5000 && (
                    <div className="flex items-start gap-3 text-sm p-2 rounded-md bg-amber-50 text-amber-800 border border-amber-100">
                      <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                      <p>Low Fund Alert: Available balance below ₹5,000.</p>
                    </div>
                  )}
                  <div className="flex items-start gap-3 text-sm p-2 rounded-md bg-secondary/10 text-secondary-foreground border border-secondary/20">
                    <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                    <p>System operational. All data synced to Firestore.</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}
