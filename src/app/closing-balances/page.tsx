
"use client"

import React, { useMemo } from "react";
import { Navbar } from "@/components/layout/Navbar";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { Card } from "@/components/ui/card";
import { 
  Loader2, 
  Calendar,
  IndianRupee,
  Scale
} from "lucide-react";
import { useFirestore, useCollection, useMemoFirebase, useUser } from "@/firebase";
import { collection, query, orderBy } from "firebase/firestore";
import { cn } from "@/lib/utils";

export default function ClosingBalancesPage() {
  const db = useFirestore();
  const { user, isUserLoading } = useUser();

  const txRef = useMemoFirebase(() => {
    if (!db || !user) return null;
    return query(collection(db, 'transactions'), orderBy('transactionDate', 'asc'));
  }, [db, user]);

  const { data: allTransactions, isLoading } = useCollection(txRef);

  const monthlyBalances = useMemo(() => {
    if (!allTransactions || allTransactions.length === 0) return [];

    const balances = [];
    const now = new Date();
    
    // Find the starting point (first transaction)
    const firstTxDate = new Date(allTransactions[0].transactionDate || now);
    let currentYear = firstTxDate.getFullYear();
    let currentMonth = firstTxDate.getMonth();

    const targetYear = now.getFullYear();
    const targetMonth = now.getMonth();

    // Loop through each month from the start to the current month to show the running balance
    while (currentYear < targetYear || (currentYear === targetYear && currentMonth <= targetMonth)) {
      const monthEndDate = new Date(currentYear, currentMonth + 1, 0, 23, 59, 59);
      
      // CUMULATIVE: Calculate closing balance for this month by summing ALL INFLOWS up to this date
      // As per instructions, this balance is NOT reduced by outflows/loans.
      const cumulativeBalance = allTransactions.reduce((acc, tx) => {
        if (!tx.transactionDate) return acc;
        const txDate = new Date(tx.transactionDate);
        if (txDate > monthEndDate) return acc;

        // Only count Inflows (Deposits, Interest, Repayments, Fines)
        const type = tx.transactionType;
        if (['Deposit', 'InterestPayment', 'PrincipalRepayment', 'FinePayment'].includes(type)) {
          return acc + (tx.amount || 0);
        }
        return acc;
      }, 0);

      // PERIOD-SPECIFIC: Sum the actual total values for this month as stored in the data
      const monthStats = allTransactions.reduce((acc, tx) => {
        if (!tx.transactionDate) return acc;
        const txDate = new Date(tx.transactionDate);
        if (txDate.getMonth() !== currentMonth || txDate.getFullYear() !== currentYear) return acc;

        const amt = tx.amount || 0;
        const type = tx.transactionType;

        if (type === 'Deposit') acc.deposits += amt;
        else if (type === 'InterestPayment') acc.interest += amt;
        else if (type === 'PrincipalRepayment' || type === 'FinePayment') acc.repayments += amt;
        else if (type === 'LoanDisbursement') acc.loans += amt;
        
        return acc;
      }, { deposits: 0, interest: 0, repayments: 0, loans: 0 });

      balances.push({
        year: currentYear,
        month: currentMonth,
        monthName: new Date(currentYear, currentMonth).toLocaleString('default', { month: 'long' }),
        cumulativeBalance,
        deposits: monthStats.deposits,
        interest: monthStats.interest,
        repayments: monthStats.repayments,
        loans: monthStats.loans
      });

      // Advance to next month
      currentMonth++;
      if (currentMonth > 11) {
        currentMonth = 0;
        currentYear++;
      }
    }

    return balances.reverse(); // Show newest months first
  }, [allTransactions]);

  if (isUserLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <Navbar />
      
      <main className="flex-1 p-4 sm:p-8 max-w-7xl mx-auto w-full space-y-6">
        <header className="flex flex-col gap-2">
          <div className="flex items-center gap-3">
            <div className="bg-primary/10 p-2 rounded-lg">
              <Scale className="h-8 w-8 text-primary" />
            </div>
            <div>
              <h1 className="text-3xl font-bold tracking-tight text-primary font-headline">Monthly Closing Balance</h1>
              <p className="text-muted-foreground text-sm">Cumulative capital growth tracking total group inflows month by month.</p>
            </div>
          </div>
        </header>

        <Card className="border-none shadow-sm overflow-hidden">
          <div className="relative min-h-[400px] bg-white">
            {isLoading ? (
              <div className="absolute inset-0 flex items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50 text-[11px] uppercase tracking-wider font-bold">
                    <TableHead className="w-[180px]">Period</TableHead>
                    <TableHead>Monthly Deposits</TableHead>
                    <TableHead>Monthly Interest</TableHead>
                    <TableHead>Monthly Repayments</TableHead>
                    <TableHead>Monthly Loans</TableHead>
                    <TableHead className="text-right">Cumulative Balance</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {monthlyBalances.map((item) => (
                    <TableRow key={`${item.year}-${item.month}`} className="hover:bg-muted/30 transition-colors">
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2 text-slate-700">
                          <Calendar className="h-4 w-4 text-muted-foreground" />
                          <span>{item.monthName} {item.year}</span>
                        </div>
                      </TableCell>
                      <TableCell className="font-medium text-slate-900">
                        ₹{Math.abs(item.deposits).toLocaleString()}
                      </TableCell>
                      <TableCell className="font-medium text-slate-900">
                        ₹{Math.abs(item.interest).toLocaleString()}
                      </TableCell>
                      <TableCell className="font-medium text-slate-900">
                        ₹{Math.abs(item.repayments).toLocaleString()}
                      </TableCell>
                      <TableCell className="font-medium text-destructive">
                        ₹{Math.abs(item.loans).toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1.5 font-bold text-lg text-primary">
                          <IndianRupee className="h-4 w-4" />
                          {Math.abs(item.cumulativeBalance).toLocaleString()}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  {monthlyBalances.length === 0 && !isLoading && (
                    <TableRow>
                      <TableCell colSpan={6} className="h-32 text-center text-muted-foreground">
                        No transactions recorded yet to calculate monthly balances.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            )}
          </div>
        </Card>
      </main>
    </div>
  );
}
