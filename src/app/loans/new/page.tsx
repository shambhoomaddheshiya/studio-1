
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
  HandCoins,
  Info,
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

export default function NewLoanPage() {
  const { toast } = useToast();
  const router = useRouter();
  const db = useFirestore();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const membersRef = useMemoFirebase(() => collection(db, 'members'), [db]);
  const { data: members, isLoading: membersLoading } = useCollection(membersRef);

  const loansRef = useMemoFirebase(() => collection(db, 'loans'), [db]);
  const { data: allLoans, isLoading: loansLoading } = useCollection(loansRef);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (loansLoading) return;
    setIsSubmitting(true);

    const formData = new FormData(e.currentTarget);
    const memberId = formData.get('memberId') as string;
    const amount = Number(formData.get('amount'));
    const interest = Number(formData.get('interest'));
    const date = formData.get('date') as string;
    const comment = formData.get('comment') as string;

    const selectedMember = members?.find(m => m.id === memberId);
    const memberName = selectedMember?.name || "Unknown Member";

    const timestamp = new Date().toISOString();
    const loanDate = date ? new Date(date).toISOString() : timestamp;

    // Generate numeric incrementing ID starting from 001
    let nextId = "001";
    if (allLoans && allLoans.length > 0) {
      const numericIds = allLoans
        .map(l => parseInt(l.id))
        .filter(id => !isNaN(id));
      if (numericIds.length > 0) {
        const maxId = Math.max(...numericIds);
        nextId = (maxId + 1).toString().padStart(3, '0');
      }
    }

    // 1. Create Loan Record with generated ID
    const loanRef = doc(db, "loans", nextId);
    setDocumentNonBlocking(loanRef, {
      id: nextId,
      memberId,
      loanAmount: amount,
      interestRate: interest / 100, // Monthly decimal
      loanDate,
      outstandingPrincipal: amount,
      outstandingInterest: 0,
      isOutsiderLoan: false,
      comment,
      createdAt: timestamp,
      updatedAt: timestamp,
    }, { merge: true });

    // 2. Create Transaction Ledger Entry
    const txRef = doc(collection(db, "transactions"));
    setDocumentNonBlocking(txRef, {
      id: txRef.id,
      transactionDate: loanDate,
      transactionType: 'LoanDisbursement',
      amount,
      memberId,
      memberName,
      fundCategory: 'PrincipalFund',
      balanceImpact: 'Debit',
      comment: `Loan [${nextId}] disbursed: ${comment}`,
      relatedEntityId: nextId,
      relatedEntityType: 'Loan',
      createdAt: timestamp,
      updatedAt: timestamp,
    }, { merge: true });

    toast({
      title: "Loan issued",
      description: `Loan ${nextId} for ₹${amount} has been disbursed to ${memberName}.`,
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
            <h1 className="text-3xl font-bold tracking-tight text-primary font-headline">Issue New Loan</h1>
            <p className="text-muted-foreground">Disburse funds to a member from the group pool.</p>
          </div>
        </header>

        <Card className="border-none shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <HandCoins className="h-5 w-5 text-accent" />
              Loan Disbursement Details
            </CardTitle>
            <CardDescription>Define terms for the new loan application.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid gap-4">
                <div className="grid gap-2">
                  <Label>Recipient Member</Label>
                  <Select name="memberId" required>
                    <SelectTrigger>
                      <SelectValue placeholder={membersLoading ? "Loading members..." : "Select member for loan"} />
                    </SelectTrigger>
                    <SelectContent>
                      {members?.map(m => (
                        <SelectItem key={m.id} value={m.id}>
                          {m.name} (Credit: {m.creditRating}/10)
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="amount">Loan Amount (₹)</Label>
                    <Input id="amount" name="amount" type="number" placeholder="Enter amount" required />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="interest">Interest Rate (% p.m.)</Label>
                    <Input id="interest" name="interest" type="number" defaultValue="2" step="0.5" required />
                  </div>
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="date">Disbursement Date</Label>
                  <Input id="date" name="date" type="date" defaultValue={new Date().toISOString().split('T')[0]} required />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="comment">Purpose of Loan</Label>
                  <Textarea id="comment" name="comment" placeholder="Describe why the member needs the loan..." />
                </div>
              </div>

              <div className="p-4 rounded-lg bg-blue-50 border border-blue-100 flex gap-3 items-start">
                <Info className="h-5 w-5 text-primary mt-0.5 shrink-0" />
                <div className="text-sm text-blue-900">
                  <p className="font-semibold">Important Notes:</p>
                  <ul className="list-disc ml-4 mt-1 space-y-1">
                    <li>A unique Loan ID will be generated automatically.</li>
                    <li>Interest will be calculated from the next billing cycle.</li>
                    <li>Ensure group approval before disbursing larger amounts.</li>
                  </ul>
                </div>
              </div>

              <div className="flex justify-end gap-3">
                <Button variant="outline" type="button" asChild disabled={isSubmitting || loansLoading}>
                  <Link href="/">Cancel</Link>
                </Button>
                <Button type="submit" className="bg-primary hover:bg-primary/90" disabled={isSubmitting || loansLoading}>
                  {isSubmitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Processing...</> : 'Approve & Disburse'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
