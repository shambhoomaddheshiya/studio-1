"use client"

import React, { useState, useEffect } from "react";
import { Navbar } from "@/components/layout/Navbar";
import { MOCK_MEMBERS, MOCK_TRANSACTIONS } from "@/lib/mock-data";
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
  Calendar
} from "lucide-react";
import Link from "next/link";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { explainCreditScore, AiCreditScoreExplanationOutput } from "@/ai/flows/ai-credit-score-explanation";
import { Skeleton } from "@/components/ui/skeleton";

export default function MemberDetails() {
  const { id } = useParams();
  const member = MOCK_MEMBERS.find(m => m.id === id) || MOCK_MEMBERS[0];
  const transactions = MOCK_TRANSACTIONS.filter(t => t.memberId === member.id);
  
  const [aiInsight, setAiInsight] = useState<AiCreditScoreExplanationOutput | null>(null);
  const [loadingAi, setLoadingAi] = useState(false);

  useEffect(() => {
    async function getAiInsight() {
      setLoadingAi(true);
      try {
        const result = await explainCreditScore({
          memberId: member.id,
          creditScore: member.creditScore as any,
          totalDeposit: member.totalDeposit,
          totalLoanTaken: member.totalLoanTaken,
          totalInterestPaid: member.totalInterestPaid,
          totalFinePaid: member.totalFinePaid,
          currentOutstandingLoan: member.currentOutstandingLoan,
          missedPaymentsCount: 1, // Mock
          loanRepaymentEfficiency: 'good'
        });
        setAiInsight(result);
      } catch (err) {
        console.error("AI Insight failed", err);
      } finally {
        setLoadingAi(false);
      }
    }
    getAiInsight();
  }, [member]);

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
              <Badge className="bg-green-100 text-green-700 border-none">{member.status}</Badge>
            </div>
            <p className="text-muted-foreground font-mono text-sm">{member.id} • {member.mobile}</p>
          </div>
        </header>

        <div className="grid gap-6 lg:grid-cols-4">
          {/* Stats Column */}
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
                    <span className="text-3xl font-bold text-primary">{member.creditScore}</span>
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground">Group Credit Rating</p>
                  <p className="text-xs font-medium text-accent uppercase tracking-wider mt-1">Tier 1 Member</p>
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
                  <span className="font-bold">₹{member.totalDeposit.toLocaleString()}</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-muted-foreground flex items-center gap-2">
                    <HandCoins className="h-4 w-4" /> Total Loan Taken
                  </span>
                  <span className="font-bold">₹{member.totalLoanTaken.toLocaleString()}</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-muted-foreground flex items-center gap-2">
                    <Info className="h-4 w-4" /> Outstanding
                  </span>
                  <span className="font-bold text-destructive">₹{member.currentOutstandingLoan.toLocaleString()}</span>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Passbook / History Column */}
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
                  <p className="text-sm text-muted-foreground">Unable to generate insights at this time.</p>
                )}
              </CardContent>
            </Card>

            <Card className="border-none shadow-sm overflow-hidden">
              <CardHeader className="flex flex-row items-center justify-between border-b bg-muted/20">
                <div className="flex items-center gap-2">
                  <History className="h-5 w-5 text-primary" />
                  <CardTitle className="text-lg">Member Passbook</CardTitle>
                </div>
                <Button variant="outline" size="sm" className="bg-white">
                  <Calendar className="h-4 w-4 mr-2" />
                  Filter by Month
                </Button>
              </CardHeader>
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
                  {transactions.map((tx) => (
                    <TableRow key={tx.id}>
                      <TableCell className="text-sm text-muted-foreground">{new Date(tx.date).toLocaleDateString()}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="capitalize text-xs">
                          {tx.type.replace('_', ' ')}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm italic">{tx.comment}</TableCell>
                      <TableCell className={cn(
                        "text-right font-bold",
                        tx.type === 'loan' ? 'text-destructive' : 'text-primary'
                      )}>
                        {tx.type === 'loan' ? '-' : '+'}₹{tx.amount.toLocaleString()}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
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