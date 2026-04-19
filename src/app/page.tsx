"use client"

import { Navbar } from "@/components/layout/Navbar";
import { StatCard } from "@/components/dashboard/StatCard";
import { 
  Users, 
  HandCoins, 
  TrendingUp, 
  AlertCircle, 
  ArrowUpRight, 
  History,
  Coins,
  Loader2,
  Banknote
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { useFirestore, useCollection, useMemoFirebase, useUser } from "@/firebase";
import { collection, query, orderBy, limit } from "firebase/firestore";

export default function Dashboard() {
  const db = useFirestore();
  const { user, isUserLoading } = useUser();

  const txQuery = useMemoFirebase(() => {
    if (!db || !user) return null;
    return query(collection(db, 'transactions'), orderBy('transactionDate', 'desc'), limit(5));
  }, [db, user]);

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
  
  const { data: recentTransactions, isLoading: txLoading } = useCollection(txQuery);
  const { data: allTransactions } = useCollection(allTxQuery);
  const { data: members } = useCollection(membersQuery);
  const { data: allLoans } = useCollection(loansQuery);

  if (isUserLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Basic dynamic stats
  const totalFunds = allTransactions?.reduce((acc, tx) => {
    return tx.balanceImpact === 'Credit' ? acc + (tx.amount || 0) : acc - (tx.amount || 0);
  }, 0) || 0;
  
  const totalInterest = allTransactions?.filter(tx => tx.transactionType === 'InterestPayment')
    .reduce((acc, tx) => acc + (tx.amount || 0), 0) || 0;

  const totalLoanDisbursed = allTransactions?.filter(tx => tx.transactionType === 'LoanDisbursement')
    .reduce((acc, tx) => acc + (tx.amount || 0), 0) || 0;

  const outstandingLoan = allLoans?.reduce((acc, loan) => {
    return acc + (loan.outstandingPrincipal || 0) + (loan.outstandingInterest || 0);
  }, 0) || 0;

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      
      <main className="flex-1 p-4 sm:p-8 max-w-7xl mx-auto w-full space-y-8">
        <header className="flex flex-col gap-2">
          <h1 className="text-3xl font-bold tracking-tight text-primary font-headline">Financial Overview</h1>
          <p className="text-muted-foreground">Welcome back, admin. Here's what's happening in FundFlow today.</p>
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
          {/* Recent Transactions */}
          <Card className="lg:col-span-2 border-none shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between">
              <div className="flex items-center gap-2">
                <History className="h-5 w-5 text-primary" />
                <CardTitle className="text-lg">Recent Transactions</CardTitle>
              </div>
              <Button variant="ghost" size="sm" asChild>
                <Link href="/transactions">View All</Link>
              </Button>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {txLoading ? (
                  <div className="flex justify-center p-8"><Loader2 className="animate-spin text-muted-foreground" /></div>
                ) : (
                  recentTransactions?.map((tx) => (
                    <div key={tx.id} className="flex items-center justify-between p-3 rounded-lg bg-background hover:bg-muted transition-colors">
                      <div className="flex items-center gap-4">
                        <div className={cn(
                          "p-2 rounded-full",
                          tx.balanceImpact === 'Credit' ? 'bg-green-100 text-green-600' : 'bg-blue-100 text-primary'
                        )}>
                          <ArrowUpRight className={cn("h-4 w-4", tx.balanceImpact === 'Debit' && "rotate-180")} />
                        </div>
                        <div>
                          <p className="text-sm font-medium">{tx.memberName}</p>
                          <p className="text-xs text-muted-foreground capitalize">
                            {(tx.transactionType || '').replace(/([A-Z])/g, ' $1').trim()} • {tx.transactionDate ? new Date(tx.transactionDate).toLocaleDateString() : 'N/A'}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className={cn(
                          "text-sm font-bold",
                          tx.balanceImpact === 'Debit' ? 'text-destructive' : 'text-primary'
                        )}>
                          {tx.balanceImpact === 'Debit' ? '-' : '+'}₹{(tx.amount || 0).toLocaleString()}
                        </p>
                      </div>
                    </div>
                  ))
                )}
                {(!recentTransactions || recentTransactions.length === 0) && !txLoading && (
                  <p className="text-center text-muted-foreground py-8">No transactions yet.</p>
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
                  <Link href="/deposits/new">Record Monthly Deposit</Link>
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
