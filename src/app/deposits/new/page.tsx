
"use client"

import React, { useState } from "react";
import { Navbar } from "@/components/layout/Navbar";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { 
  ArrowLeft, 
  Wallet,
  Sparkles,
  Loader2
} from "lucide-react";
import Link from "next/link";
import { useToast } from "@/hooks/use-toast";
import { useRouter } from "next/navigation";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { useFirestore, useCollection, useMemoFirebase } from "@/firebase";
import { collection, doc } from "firebase/firestore";
import { setDocumentNonBlocking } from "@/firebase/non-blocking-updates";

export default function NewDepositPage() {
  const { toast } = useToast();
  const router = useRouter();
  const db = useFirestore();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const membersRef = useMemoFirebase(() => collection(db, 'members'), [db]);
  const { data: members, isLoading: membersLoading } = useCollection(membersRef);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setIsSubmitting(true);

    const formData = new FormData(e.currentTarget);
    const memberId = formData.get('memberId') as string;
    const type = formData.get('type') as string;
    const amount = Number(formData.get('amount'));
    const date = formData.get('date') as string;
    const comment = formData.get('comment') as string;

    const timestamp = new Date().toISOString();
    const entryDate = date ? new Date(date).toISOString() : timestamp;

    const membersToProcess = memberId === 'all' 
      ? (members || []) 
      : (members?.filter(m => m.id === memberId) || []);

    if (membersToProcess.length === 0) {
      toast({
        variant: "destructive",
        title: "No members found",
        description: "Could not find any members to record transactions for.",
      });
      setIsSubmitting(false);
      return;
    }

    membersToProcess.forEach(member => {
      const currentMemberId = member.id;
      const memberName = member.name || "Unknown Member";

      // 1. Create Deposit Entry
      const depositRef = doc(collection(db, "depositEntries"));
      setDocumentNonBlocking(depositRef, {
        id: depositRef.id,
        memberId: currentMemberId,
        month: new Date(entryDate).getMonth() + 1,
        year: new Date(entryDate).getFullYear(),
        expectedAmount: 500, // Assuming static rule for now
        paidAmount: amount,
        status: 'Paid',
        lateFineApplied: 0,
        paymentDate: entryDate,
        comment,
        createdAt: timestamp,
        updatedAt: timestamp,
      }, { merge: true });

      // 2. Create Transaction Ledger Entry
      const txRef = doc(collection(db, "transactions"));
      setDocumentNonBlocking(txRef, {
        id: txRef.id,
        transactionDate: entryDate,
        transactionType: type === 'deposit' ? 'Deposit' : type === 'fine_payment' ? 'FinePayment' : 'InterestPayment',
        amount,
        memberId: currentMemberId,
        memberName,
        fundCategory: type === 'fine_payment' ? 'FineFund' : 'PrincipalFund',
        balanceImpact: 'Credit',
        comment,
        createdAt: timestamp,
        updatedAt: timestamp,
      }, { merge: true });
    });

    toast({
      title: memberId === 'all' ? "Bulk transactions recorded" : "Transaction recorded",
      description: memberId === 'all' 
        ? `₹${amount} has been added to ${membersToProcess.length} members' accounts.`
        : `₹${amount} has been added to ${membersToProcess[0]?.name || 'the member'}'s account.`,
    });
    
    router.push("/transactions");
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      
      <main className="flex-1 p-4 sm:p-8 max-w-2xl mx-auto w-full space-y-6">
        <header className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/"><ArrowLeft className="h-5 w-5" /></Link>
          </Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-primary font-headline">Record Deposit</h1>
            <p className="text-muted-foreground">Log a member's monthly contribution or fine payment.</p>
          </div>
        </header>

        <Card className="border-none shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Wallet className="h-5 w-5 text-accent" />
              Transaction Details
            </CardTitle>
            <CardDescription>Select a member and enter the deposit amount.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid gap-4">
                <div className="grid gap-2">
                  <Label>Member</Label>
                  <Select name="memberId" required>
                    <SelectTrigger>
                      <SelectValue placeholder={membersLoading ? "Loading members..." : "Select a member"} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all" className="font-bold text-primary">Select All Members</SelectItem>
                      {members?.map(m => (
                        <SelectItem key={m.id} value={m.id}>
                          {m.name} ({m.id.substring(0, 6)})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="type">Type</Label>
                    <Select name="type" defaultValue="deposit">
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="deposit">Monthly Deposit</SelectItem>
                        <SelectItem value="fine_payment">Fine Payment</SelectItem>
                        <SelectItem value="interest_payment">Interest Payment</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="amount">Amount (₹)</Label>
                    <Input id="amount" name="amount" type="number" placeholder="500" required />
                  </div>
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="date">Date</Label>
                  <Input id="date" name="date" type="date" defaultValue={new Date().toISOString().split('T')[0]} required />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="comment">Comment</Label>
                  <div className="relative">
                    <Textarea id="comment" name="comment" placeholder="e.g. Contribution for March 2024" className="pr-10" />
                    <Button type="button" variant="ghost" size="icon" className="absolute right-2 top-2 h-8 w-8 text-accent">
                      <Sparkles className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-3">
                <Button variant="outline" type="button" asChild disabled={isSubmitting}>
                  <Link href="/">Cancel</Link>
                </Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Recording...</> : 'Record Transaction'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
