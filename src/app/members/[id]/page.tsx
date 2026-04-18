"use client"

import React, { useState, useEffect } from "react";
import { Navbar } from "@/components/layout/Navbar";
import { useParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  History, 
  Wallet, 
  HandCoins, 
  ArrowLeft, 
  ShieldCheck, 
  Sparkles,
  Info,
  Calendar,
  Loader2
} from "lucide-react";
import Link from "next/link";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { explainCreditScore, AiCreditScoreExplanationOutput } from "@/ai/flows/ai-credit-score-explanation";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { useFirestore, useDoc, useCollection, useMemoFirebase, useUser } from "@/firebase";
import { doc, collection, query, where, orderBy } from "firebase/firestore";

export default function MemberDetails() {
  const params = useParams();
  const id = params?.id as string;
  const db = useFirestore();
  const { user } = useUser();
  
  const memberRef = useMemoFirebase(() => {
    if (!db || !id) return null;
    return doc(db, 'members', id);
  }, [db, id]);

  const { data: member, isLoading: memberLoading } = useDoc(memberRef);

  const transactionsRef = useMemoFirebase(() => {
    if (!db || !id) return null;
    return query(
      collection(db, 'transactions'),
      where('memberId', '==', id),
      orderBy('transactionDate', 'desc')
    );
  }, [db, id]);

  const { data: transactions, isLoading: txLoading } = useCollection(transactionsRef);
  
  const [aiInsight, setAiInsight] = useState<AiCreditScoreExplanationOutput | null>(null);
  const [loadingAi, setLoadingAi] = useState(false);

  // Calculate statistics from live transactions
  const stats = React.useMemo(() => {
    if (!transactions) return {
      totalDeposit: 0,
      totalLoanTaken: 0,
      totalInterestPaid: 0,
      totalFinePaid: 0,
      currentOutstandingLoan: 0
    };

    return transactions.reduce((acc, tx) => {
      const amount = tx.amount || 0;
      if (tx.transactionType === 'Deposit') acc.totalDeposit += amount;
      if (tx.transactionType === 'LoanDisbursement') acc.totalLoanTaken += amount;
      if (tx.transactionType === 'InterestPayment') acc.totalInterestPaid += amount;
      if (tx.transactionType === 'FinePayment') acc.totalFinePaid += amount;
      
      // Calculate outstanding roughly
      if (tx.transactionType === 'LoanDisbursement') acc.currentOutstandingLoan += amount;
      if (tx.transactionType === 'PrincipalRepayment') acc.currentOutstandingLoan -= amount;
      
      return acc;
    }, {
      totalDeposit: 0,
      totalLoanTaken: 0,
      totalInterestPaid: 0,
      totalFinePaid: 0,
      currentOutstandingLoan: 0
    });
  }, [transactions]);

  useEffect(() => {
    async function getAiInsight() {
      if (!member || !id) return;
      setLoadingAi(true);
      try {
        const result = await explainCreditScore({
          memberId: id,
          creditScore: member.creditRating || 7,
          totalDeposit: stats.totalDeposit,
          totalLoanTaken: stats.totalLoanTaken,
          totalInterestPaid: stats.totalInterestPaid,
          totalFinePaid: stats.totalFinePaid,
          currentOutstandingLoan: stats.currentOutstandingLoan,
          missedPaymentsCount: 0,
          loanRepaymentEfficiency: 'average'
        });
        setAiInsight(result);
      } catch (err) {
        // Silently fail AI insight
      } finally {
        setLoadingAi(false);
      }
    }
    if (member && transactions) {
      getAiInsight();
    }
  }, [member, transactions, id, stats]);

  if (memberLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!member) {
    return (
      <div className="min-h-screen flex flex-col">
        <Navbar />
        <main className="flex-1 flex flex-col items-center justify-center p-8 text-center">
          <h2 className="text-2xl font-bold">Member Not Found</h2>
          <p className="text-muted-foreground mt-2">The member record you are looking for does not exist.</p>
          <Button className="mt-4" asChild>
            <Link href="/members">Back to Directory</Link>
          </Button>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      
      <main className="flex-1 p-4 sm:p-8 max-w-7xl mx-auto w-full space-y-6">
        <header className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/members"><ArrowLeft className="h-5 w-5" /></Link>
          </Button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-bold tracking-tight text-primary font-headline">{member.name}</h1>
              <Badge variant={member.status === 'Active' ? 'default' : 'secondary'} className={member.status === 'Active' ? 'bg-green-100 text-green-700 hover:bg-green-100 border-none' : ''}>
                {member.status}
              </Badge>
            </div>
            <p className="text-muted-foreground font-mono text-sm">{id} • {member.mobileNumber}</p>
          </div>
        </header>

        <div className="grid gap-6 lg:grid-cols-4">
          <div className="lg:col-span-1 space-y-6">
            <Card className="border-none shadow-sm overflow-hidden">
              <CardHeader className="bg-primary text-primary-foreground">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-accent" />
                  Credit Profile
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-6">
                <div className="flex flex-col items-center text-center">
                  <div className="relative flex items-center justify-center w-24 h-24 rounded-full border-4 border-accent/20">
                    <span className="text-3xl font-bold text-primary">{member.creditRating || 7}</span>
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground">Group Credit Rating</p>
                </div>
              </CardContent>
            </Card>

            <Card className="border-none shadow-sm">
              <CardHeader>
                <CardTitle className="text-sm font-medium">Balance Summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-muted-foreground flex items-center gap-2">
                    <Wallet className="h-4 w-4" /> Total Deposit
                  </span>
                  <span className="font-bold">₹{stats.totalDeposit.toLocaleString()}</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-muted-foreground flex items-center gap-2">
                    <HandCoins className="h-4 w-4" /> Total Loan Taken
                  </span>
                  <span className="font-bold">₹{stats.totalLoanTaken.toLocaleString()}</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-muted-foreground flex items-center gap-2">
                    <Info className="h-4 w-4" /> Outstanding
                  </span>
                  <span className="font-bold text-destructive">₹{stats.currentOutstandingLoan.toLocaleString()}</span>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="lg:col-span-3 space-y-6">
            <Card className="border-none shadow-sm">
              <CardHeader className="flex flex-row items-center justify-between">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-accent" />
                  <CardTitle className="text-lg">AI Credit Insights</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                {loadingAi ? (
                  <div className="space-y-3">
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-5/6" />
                    <Skeleton className="h-4 w-4/6" />
                  </div>
                ) : aiInsight ? (
                  <div className="space-y-4">
                    <div className="p-4 rounded-lg bg-secondary/30 text-secondary-foreground border border-secondary">
                      <p className="text-sm leading-relaxed">{aiInsight.explanation}</p>
                    </div>
                    <div>
                      <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">Recommendations</p>
                      <ul className="grid gap-2 sm:grid-cols-2">
                        {aiInsight.actionableInsights.map((insight, i) => (
                          <li key={i} className="flex items-start gap-2 text-sm p-2 bg-muted rounded-md border">
                            <Info className="h-4 w-4 mt-0.5 text-accent shrink-0" />
                            <span>{insight}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">Record some transactions to generate AI insights.</p>
                )}
              </CardContent>
            </Card>

            <Card className="border-none shadow-sm overflow-hidden">
              <CardHeader className="flex flex-row items-center justify-between border-b bg-muted/20">
                <div className="flex items-center gap-2">
                  <History className="h-5 w-5 text-primary" />
                  <CardTitle className="text-lg">Member Passbook</CardTitle>
                </div>
              </CardHeader>
              <div className="relative min-h-[200px]">
                {txLoading ? (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/30">
                        <TableHead>Date</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Comment</TableHead>
                        <TableHead className="text-right">Amount</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {transactions?.map((tx) => (
                        <TableRow key={tx.id}>
                          <TableCell className="text-sm text-muted-foreground">
                            {tx.transactionDate ? new Date(tx.transactionDate).toLocaleDateString() : '-'}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="capitalize text-[10px]">
                              {tx.transactionType.replace(/([A-Z])/g, ' $1').trim()}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-sm italic text-muted-foreground max-w-[200px] truncate">
                            {tx.comment}
                          </TableCell>
                          <TableCell className={cn(
                            "text-right font-bold",
                            tx.balanceImpact === 'Debit' ? 'text-destructive' : 'text-primary'
                          )}>
                            {tx.balanceImpact === 'Debit' ? '-' : '+'}₹{tx.amount.toLocaleString()}
                          </TableCell>
                        </TableRow>
                      ))}
                      {(!transactions || transactions.length === 0) && (
                        <TableRow>
                          <TableCell colSpan={4} className="h-24 text-center text-muted-foreground">
                            No transactions found for this member.
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                )}
              </div>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}