
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
  
  const { data: allTransactions, isLoading: txLoading } = useCollection(allTxQuery);
  const { data: members } = useCollection(membersQuery);

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
    }).sort((a, b) => {
      const dateA = new Date(a.transactionDate || 0).getTime();
      const dateB = new Date(b.transactionDate || 0).getTime();
      return dateB - dateA;
    });
  }, [allTransactions, dateFilterType, typeFilter, viewMonth, viewYear]);

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

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <StatCard 
            title="Remaining Fund" 
            value={`₹${Math.abs(stats.remaining).toLocaleString()}`}
            icon={Coins}
            iconClassName="bg-blue-100 text-primary"
            description="Net balance of filtered items"
          />
          <StatCard 
            title="Total Deposits" 
            value={`₹${Math.abs(stats.deposits).toLocaleString()}`}
            icon={Users}
            iconClassName="bg-cyan-100 text-cyan-600"
          />
          <StatCard 
            title="Loans Issued" 
            value={`₹${Math.abs(stats.loans).toLocaleString()}`}
            icon={HandCoins}
            iconClassName="bg-indigo-100 text-indigo-600"
          />
          <StatCard 
            title="Interest Received" 
            value={`₹${Math.abs(stats.interest).toLocaleString()}`}
            icon={TrendingUp}
            iconClassName="bg-green-100 text-green-600"
          />
          <StatCard 
            title="Total Repayments" 
            value={`₹${Math.abs(stats.repayments).toLocaleString()}`}
            icon={ArrowRightLeft}
            iconClassName="bg-emerald-100 text-emerald-600"
            description="Principal & Fine"
          />
          <StatCard 
            title="Total Expenses" 
            value={`₹${Math.abs(stats.expenses).toLocaleString()}`}
            icon={Receipt}
            iconClassName="bg-rose-100 text-rose-600"
          />
          <StatCard 
            title="Loan Waived" 
            value={`₹${Math.abs(stats.waived).toLocaleString()}`}
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
            <CardHeader className="flex flex-row items-center justify-between pb-4 border-b">
              <div className="flex items-center gap-2">
                <History className="h-5 w-5 text-primary" />
                <CardTitle className="text-lg">Filtered Transaction History</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {txLoading ? (
                <div className="flex justify-center p-12"><Loader2 className="animate-spin text-muted-foreground" /></div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/30">
                      <TableHead>Date</TableHead>
                      <TableHead>Member</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Comment</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredTransactions.map((tx) => (
                      <TableRow key={tx.id} className="hover:bg-muted/20">
                        <TableCell className="text-sm">
                          {tx.transactionDate ? new Date(tx.transactionDate).toLocaleDateString() : '-'}
                        </TableCell>
                        <TableCell className="font-medium">
                          {tx.memberName || 'System'}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="capitalize text-[10px]">
                            {(tx.transactionType || '').replace(/([A-Z])/g, ' $1').trim()}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm italic text-muted-foreground max-w-[200px] truncate">
                          {tx.comment}
                        </TableCell>
                        <TableCell className={cn(
                          "text-right font-bold",
                          tx.balanceImpact === 'Debit' ? 'text-destructive' : 'text-primary'
                        )}>
                          ₹{(tx.amount || 0).toLocaleString()}
                        </TableCell>
                      </TableRow>
                    ))}
                    {filteredTransactions.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                          No transactions found for this filter.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
