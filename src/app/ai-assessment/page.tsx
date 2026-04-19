"use client"

import React, { useState, useMemo } from "react";
import { Navbar } from "@/components/layout/Navbar";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  Sparkles, 
  Send, 
  Loader2, 
  Bot, 
  User, 
  TrendingUp, 
  AlertCircle,
  BrainCircuit
} from "lucide-react";
import { useFirestore, useCollection, useMemoFirebase } from "@/firebase";
import { collection } from "firebase/firestore";
import { askAiAssessment } from "@/ai/flows/ai-assessment-flow";
import { cn } from "@/lib/utils";

interface Message {
  role: 'user' | 'ai';
  content: string;
}

export default function AiAssessmentPage() {
  const db = useFirestore();
  const [query, setQuery] = useState("");
  const [messages, setMessages] = useState<Message[]>([
    { role: 'ai', content: "Hello! I am your Yuva Finance 2 AI Advisor. How can I help you assess your group's financial health today?" }
  ]);
  const [isLoading, setIsLoading] = useState(false);

  // Data fetching for context
  const txRef = useMemoFirebase(() => collection(db, 'transactions'), [db]);
  const membersRef = useMemoFirebase(() => collection(db, 'members'), [db]);
  const loansRef = useMemoFirebase(() => collection(db, 'loans'), [db]);
  
  const { data: allTransactions } = useCollection(txRef);
  const { data: members } = useCollection(membersRef);
  const { data: allLoans } = useCollection(loansRef);

  // Financial Context Calculation
  const contextData = useMemo(() => {
    if (!allTransactions || !members || !allLoans) return null;

    const now = new Date();
    const currentMonth = now.getMonth() + 1;
    const currentYear = now.getFullYear();

    const totalFunds = allTransactions.reduce((acc, tx) => {
      return tx.balanceImpact === 'Credit' ? acc + (tx.amount || 0) : acc - (tx.amount || 0);
    }, 0);

    const outstandingLoans = allLoans.reduce((acc, loan) => {
      return acc + (loan.outstandingPrincipal || 0) + (loan.outstandingInterest || 0);
    }, 0);

    const totalInterestEarned = allTransactions
      .filter(tx => tx.transactionType === 'InterestPayment')
      .reduce((acc, tx) => acc + (tx.amount || 0), 0);

    // Prepare detailed data for AI
    const membersList = members.map(m => ({
      id: m.id,
      name: m.name,
      status: m.status
    }));

    const activeLoansList = allLoans
      .filter(l => l.status === 'Active')
      .map(l => {
        const member = members.find(m => m.id === l.memberId);
        return {
          id: l.id,
          memberId: l.memberId,
          memberName: member?.name || "Unknown",
          amount: l.loanAmount,
          outstanding: (l.outstandingPrincipal || 0) + (l.outstandingInterest || 0)
        };
      });

    const recentDepositsList = allTransactions
      .filter(tx => {
        if (tx.transactionType !== 'Deposit' || !tx.transactionDate) return false;
        const d = new Date(tx.transactionDate);
        return d.getMonth() + 1 === currentMonth && d.getFullYear() === currentYear;
      })
      .map(tx => ({
        memberId: tx.memberId,
        memberName: tx.memberName,
        amount: tx.amount,
        date: tx.transactionDate
      }));

    return {
      totalFunds,
      activeMembers: members.length,
      outstandingLoans,
      totalInterestEarned,
      currentMonth,
      currentYear,
      members: membersList,
      activeLoans: activeLoansList,
      recentDeposits: recentDepositsList
    };
  }, [allTransactions, members, allLoans]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim() || isLoading) return;

    const userMessage = query.trim();
    setQuery("");
    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setIsLoading(true);

    try {
      const result = await askAiAssessment({
        query: userMessage,
        context: contextData || undefined
      });
      setMessages(prev => [...prev, { role: 'ai', content: result.answer }]);
    } catch (error) {
      setMessages(prev => [...prev, { role: 'ai', content: "I'm sorry, I encountered an error while processing your request. Please try again." }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <Navbar />
      
      <main className="flex-1 p-4 sm:p-8 max-w-4xl mx-auto w-full flex flex-col gap-6">
        <header className="flex flex-col gap-2">
          <div className="flex items-center gap-3">
            <div className="bg-accent/10 p-2 rounded-lg">
              <BrainCircuit className="h-8 w-8 text-accent" />
            </div>
            <div>
              <h1 className="text-3xl font-bold tracking-tight text-primary font-headline">AI Assessment</h1>
              <p className="text-muted-foreground text-sm">Ask insights about fund growth, member performance, or specific balances.</p>
            </div>
          </div>
        </header>

        <div className="grid gap-6 md:grid-cols-4 flex-1 min-h-0">
          {/* Context Sidebar */}
          <div className="md:col-span-1 space-y-4">
            <Card className="border-none shadow-sm h-fit">
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-bold uppercase text-muted-foreground tracking-wider flex items-center gap-2">
                  <TrendingUp className="h-3 w-3" /> Live Context
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 pt-2">
                <div className="space-y-1">
                  <p className="text-[10px] text-muted-foreground">Available Fund</p>
                  <p className="text-sm font-bold text-primary">₹{contextData?.totalFunds.toLocaleString() ?? '...'}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] text-muted-foreground">Active Loans</p>
                  <p className="text-sm font-bold text-destructive">₹{contextData?.outstandingLoans.toLocaleString() ?? '...'}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] text-muted-foreground">Interest Earned</p>
                  <p className="text-sm font-bold text-green-600">₹{contextData?.totalInterestEarned.toLocaleString() ?? '...'}</p>
                </div>
              </CardContent>
            </Card>

            <Card className="border-none shadow-sm bg-primary/5">
              <CardContent className="p-4 space-y-3">
                <p className="text-[10px] font-bold uppercase text-primary tracking-wider">Try asking:</p>
                <div className="space-y-2">
                  {[
                    "Who hasn't paid this month?",
                    "Does Raju have any active loans?",
                    "What is our total outstanding amount?",
                    "Which member has the most deposits?"
                  ].map((tip, i) => (
                    <button 
                      key={i} 
                      onClick={() => setQuery(tip)}
                      className="w-full text-left text-xs p-2 rounded-md bg-white border border-primary/10 hover:border-primary/30 transition-colors text-slate-600 hover:text-primary"
                    >
                      {tip}
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Chat Area */}
          <Card className="md:col-span-3 border-none shadow-sm flex flex-col h-[600px]">
            <CardHeader className="border-b bg-white py-3">
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
                <CardTitle className="text-sm font-medium">Finance Advisor Active</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="flex-1 overflow-hidden p-0 flex flex-col">
              <ScrollArea className="flex-1 p-4">
                <div className="space-y-4">
                  {messages.map((msg, i) => (
                    <div key={i} className={cn(
                      "flex gap-3 max-w-[85%]",
                      msg.role === 'user' ? "ml-auto flex-row-reverse" : "mr-auto"
                    )}>
                      <div className={cn(
                        "h-8 w-8 rounded-full flex items-center justify-center shrink-0 border",
                        msg.role === 'ai' ? "bg-accent/10 border-accent/20" : "bg-slate-100 border-slate-200"
                      )}>
                        {msg.role === 'ai' ? <Bot className="h-4 w-4 text-accent" /> : <User className="h-4 w-4 text-slate-500" />}
                      </div>
                      <div className={cn(
                        "p-3 rounded-2xl text-sm leading-relaxed",
                        msg.role === 'ai' 
                          ? "bg-slate-50 text-slate-700 rounded-tl-none border border-slate-100" 
                          : "bg-primary text-primary-foreground rounded-tr-none"
                      )}>
                        {msg.content}
                      </div>
                    </div>
                  ))}
                  {isLoading && (
                    <div className="flex gap-3 mr-auto max-w-[85%]">
                      <div className="h-8 w-8 rounded-full bg-accent/10 flex items-center justify-center shrink-0 animate-pulse">
                        <Loader2 className="h-4 w-4 text-accent animate-spin" />
                      </div>
                      <div className="p-3 rounded-2xl bg-slate-50 text-slate-400 text-sm border border-slate-100 italic">
                        Checking records...
                      </div>
                    </div>
                  )}
                </div>
              </ScrollArea>

              <form onSubmit={handleSend} className="p-4 bg-white border-t flex gap-2">
                <Input 
                  placeholder="Ask about members, loans, or payments..." 
                  value={query} 
                  onChange={(e) => setQuery(e.target.value)}
                  disabled={isLoading}
                  className="bg-slate-50 border-slate-200 focus-visible:ring-accent"
                />
                <Button type="submit" size="icon" disabled={isLoading || !query.trim()} className="shrink-0 bg-accent hover:bg-accent/90">
                  <Send className="h-4 w-4" />
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
