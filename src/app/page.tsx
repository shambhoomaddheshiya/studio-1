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
  Coins
} from "lucide-react";
import { MOCK_TRANSACTIONS } from "@/lib/mock-data";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";

export default function Dashboard() {
  const totalFunds = 125000;
  const activeLoans = 85000;
  const pendingDeposits = 12;
  const totalInterestEarned = 15400;

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      
      <main className="flex-1 p-4 sm:p-8 max-w-7xl mx-auto w-full space-y-8">
        <header className="flex flex-col gap-2">
          <h1 className="text-3xl font-bold tracking-tight text-primary font-headline">Financial Overview</h1>
          <p className="text-muted-foreground">Welcome back, admin. Here's what's happening in FundFlow today.</p>
        </header>

        {/* Top Stats */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <StatCard 
            title="Total Fund Available" 
            value={`₹${totalFunds.toLocaleString()}`}
            icon={Coins}
            iconClassName="bg-blue-100 text-primary"
            trend={{ value: 12, isPositive: true }}
          />
          <StatCard 
            title="Active Loans" 
            value={`₹${activeLoans.toLocaleString()}`}
            icon={HandCoins}
            iconClassName="bg-aqua-100 text-accent"
          />
          <StatCard 
            title="Interest Earned" 
            value={`₹${totalInterestEarned.toLocaleString()}`}
            icon={TrendingUp}
            iconClassName="bg-green-100 text-green-600"
            trend={{ value: 8, isPositive: true }}
          />
          <StatCard 
            title="Pending Deposits" 
            value={pendingDeposits}
            description="Members awaiting payment"
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
                {MOCK_TRANSACTIONS.slice(0, 5).map((tx) => (
                  <div key={tx.id} className="flex items-center justify-between p-3 rounded-lg bg-background hover:bg-muted transition-colors">
                    <div className="flex items-center gap-4">
                      <div className={cn(
                        "p-2 rounded-full",
                        tx.type === 'deposit' ? 'bg-green-100 text-green-600' :
                        tx.type === 'loan' ? 'bg-blue-100 text-primary' :
                        'bg-purple-100 text-purple-600'
                      )}>
                        <ArrowUpRight className={cn("h-4 w-4", tx.type === 'loan' && "rotate-180")} />
                      </div>
                      <div>
                        <p className="text-sm font-medium">{tx.memberName}</p>
                        <p className="text-xs text-muted-foreground capitalize">{tx.type.replace('_', ' ')} • {new Date(tx.date).toLocaleDateString()}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className={cn(
                        "text-sm font-bold",
                        tx.type === 'loan' ? 'text-destructive' : 'text-primary'
                      )}>
                        {tx.type === 'loan' ? '-' : '+'}₹{tx.amount.toLocaleString()}
                      </p>
                    </div>
                  </div>
                ))}
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
                  <div className="flex items-start gap-3 text-sm p-2 rounded-md bg-amber-50 text-amber-800 border border-amber-100">
                    <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                    <p>Low Fund Alert: Available balance below ₹5,000.</p>
                  </div>
                  <div className="flex items-start gap-3 text-sm p-2 rounded-md bg-destructive/10 text-destructive border border-destructive/20">
                    <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                    <p>3 Members have outstanding interest payments over 30 days.</p>
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

function cn(...classes: (string | boolean | undefined)[]) {
  return classes.filter(Boolean).join(' ');
}
