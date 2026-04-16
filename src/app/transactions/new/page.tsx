"use client"

import React from "react";
import { Navbar } from "@/components/layout/Navbar";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { 
  ArrowLeft, 
  Wallet,
  HandCoins,
  History,
  FileText
} from "lucide-react";
import Link from "next/link";

export default function NewTransactionEntryPage() {
  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      
      <main className="flex-1 p-4 sm:p-8 max-w-4xl mx-auto w-full space-y-6">
        <header className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/transactions"><ArrowLeft className="h-5 w-5" /></Link>
          </Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-primary font-headline">New Entry</h1>
            <p className="text-muted-foreground">Choose the type of transaction you want to record.</p>
          </div>
        </header>

        <div className="grid gap-6 sm:grid-cols-2">
          <Card className="hover:border-primary transition-all cursor-pointer group" asChild>
            <Link href="/deposits/new">
              <CardHeader>
                <div className="p-3 rounded-xl bg-green-100 text-green-700 w-fit mb-2 group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                  <Wallet className="h-6 w-6" />
                </div>
                <CardTitle>Member Deposit</CardTitle>
                <CardDescription>Record monthly savings, contributions or interest payments.</CardDescription>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                Increases group fund balance and updates member passbook.
              </CardContent>
            </Link>
          </Card>

          <Card className="hover:border-primary transition-all cursor-pointer group" asChild>
            <Link href="/loans/new">
              <CardHeader>
                <div className="p-3 rounded-xl bg-blue-100 text-primary w-fit mb-2 group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                  <HandCoins className="h-6 w-6" />
                </div>
                <CardTitle>Issue Loan</CardTitle>
                <CardDescription>Disburse new loans to eligible members from the pool.</CardDescription>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                Decreases available liquidity and creates a repayment schedule.
              </CardContent>
            </Link>
          </Card>

          <Card className="hover:border-primary transition-all cursor-pointer group">
            <CardHeader>
              <div className="p-3 rounded-xl bg-purple-100 text-purple-700 w-fit mb-2 group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                <History className="h-6 w-6" />
              </div>
              <CardTitle>Loan Repayment</CardTitle>
              <CardDescription>Record principal or interest payments for existing loans.</CardDescription>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              Reduces outstanding member liability. (Coming Soon)
            </CardContent>
          </Card>

          <Card className="hover:border-primary transition-all cursor-pointer group">
            <CardHeader>
              <div className="p-3 rounded-xl bg-amber-100 text-amber-700 w-fit mb-2 group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                <FileText className="h-6 w-6" />
              </div>
              <CardTitle>General Expense</CardTitle>
              <CardDescription>Record stationery, meeting costs or bank charges.</CardDescription>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              Records group operational costs. (Coming Soon)
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
