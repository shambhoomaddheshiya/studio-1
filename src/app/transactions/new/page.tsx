
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
  Calendar as CalendarIcon, 
  X, 
  Loader2,
  CheckCircle2
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
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useFirestore, useCollection, useMemoFirebase } from "@/firebase";
import { collection, doc, query, where, getDocs, limit } from "firebase/firestore";
import { setDocumentNonBlocking } from "@/firebase/non-blocking-updates";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

export default function NewTransactionPage() {
  const { toast } = useToast();
  const router = useRouter();
  const db = useFirestore();
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [date, setDate] = useState<Date>(new Date());
  const [type, setType] = useState<string>("deposit");
  const [memberId, setMemberId] = useState<string>("");

  const membersRef = useMemoFirebase(() => collection(db, 'members'), [db]);
  const { data: members, isLoading: membersLoading } = useCollection(membersRef);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!memberId) {
      toast({ variant: "destructive", title: "Member required", description: "Please select a member." });
      return;
    }
    
    setIsSubmitting(true);
    const formData = new FormData(e.currentTarget);
    const amount = Number(formData.get('amount'));
    const description = formData.get('description') as string;
    
    const selectedMember = members?.find(m => m.id === memberId);
    const memberName = selectedMember?.name || "Unknown Member";
    const timestamp = new Date().toISOString();
    const txDate = date.toISOString();

    const txRef = doc(collection(db, "transactions"));
    
    // Determine balance impact and specific types
    let balanceImpact: 'Credit' | 'Debit' = 'Credit';
    let transactionType = 'Deposit';
    let fundCategory = 'PrincipalFund';

    switch (type) {
      case 'deposit':
        transactionType = 'Deposit';
        balanceImpact = 'Credit';
        break;
      case 'loan':
        transactionType = 'LoanDisbursement';
        balanceImpact = 'Debit';
        break;
      case 'repayment':
        transactionType = 'PrincipalRepayment';
        balanceImpact = 'Credit';
        break;
      case 'expense':
        transactionType = 'GeneralExpense';
        balanceImpact = 'Debit';
        fundCategory = 'OperatingFund';
        break;
      case 'loan_waived':
        transactionType = 'LoanWaived';
        balanceImpact = 'Debit'; // Waiving is effectively a loss/outflow from pool
        break;
    }

    // 1. Create Transaction Ledger Entry
    setDocumentNonBlocking(txRef, {
      id: txRef.id,
      transactionDate: txDate,
      transactionType,
      amount,
      memberId,
      memberName,
      fundCategory,
      balanceImpact,
      comment: description,
      createdAt: timestamp,
      updatedAt: timestamp,
    }, { merge: true });

    // 2. Specialized Entity Creation
    if (type === 'repayment') {
      const repaymentRef = doc(collection(db, "repaymentEntries"));
      setDocumentNonBlocking(repaymentRef, {
        id: repaymentRef.id,
        memberId,
        repaymentDate: txDate,
        principalPaid: amount,
        interestPaid: 0,
        finePaid: 0,
        repaymentType: 'PrincipalOnly',
        comment: description,
        createdAt: timestamp,
        updatedAt: timestamp,
      }, { merge: true });
    } else if (type === 'deposit') {
      const depositRef = doc(collection(db, "depositEntries"));
      setDocumentNonBlocking(depositRef, {
        id: depositRef.id,
        memberId,
        month: date.getMonth() + 1,
        year: date.getFullYear(),
        expectedAmount: 500,
        paidAmount: amount,
        status: 'Paid',
        lateFineApplied: 0,
        paymentDate: txDate,
        comment: description,
        createdAt: timestamp,
        updatedAt: timestamp,
      }, { merge: true });
    }

    toast({
      title: "Transaction recorded",
      description: `₹${amount} ${type} for ${memberName} has been logged.`,
    });
    
    router.push("/transactions");
  }

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <Navbar />
      
      <main className="flex-1 flex items-center justify-center p-4">
        <Card className="w-full max-w-md shadow-xl border-none relative">
          <Button 
            variant="ghost" 
            size="icon" 
            className="absolute right-4 top-4 rounded-full"
            asChild
          >
            <Link href="/transactions"><X className="h-4 w-4" /></Link>
          </Button>

          <CardHeader className="space-y-1 pb-8">
            <CardTitle className="text-2xl font-bold text-slate-900">Record New Transaction</CardTitle>
            <CardDescription className="text-slate-500">
              Select a member and enter the transaction details.
            </CardDescription>
          </CardHeader>
          
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-4">
                {/* Member Selection */}
                <div className="space-y-2">
                  <Label className="text-slate-700 font-medium">Member</Label>
                  <Select value={memberId} onValueChange={setMemberId} required>
                    <SelectTrigger className="bg-slate-50 border-slate-200">
                      <SelectValue placeholder={membersLoading ? "Loading members..." : "Select a member"} />
                    </SelectTrigger>
                    <SelectContent>
                      {members?.map(m => (
                        <SelectItem key={m.id} value={m.id}>
                          {m.name} ({m.id})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Transaction Type Radio Group */}
                <div className="space-y-2">
                  <Label className="text-slate-700 font-medium">Transaction Type</Label>
                  <RadioGroup 
                    value={type} 
                    onValueChange={setType}
                    className="flex flex-wrap gap-x-6 gap-y-3 pt-1"
                  >
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="deposit" id="deposit" />
                      <Label htmlFor="deposit" className="font-normal cursor-pointer">Deposit</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="loan" id="loan" />
                      <Label htmlFor="loan" className="font-normal cursor-pointer">Loan</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="repayment" id="repayment" />
                      <Label htmlFor="repayment" className="font-normal cursor-pointer">Repayment</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="expense" id="expense" />
                      <Label htmlFor="expense" className="font-normal cursor-pointer">Expense</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="loan_waived" id="loan_waived" />
                      <Label htmlFor="loan_waived" className="font-normal cursor-pointer">Loan (Waived)</Label>
                    </div>
                  </RadioGroup>
                </div>

                {/* Amount */}
                <div className="space-y-2">
                  <Label htmlFor="amount" className="text-slate-700 font-medium">Amount</Label>
                  <Input 
                    id="amount" 
                    name="amount" 
                    type="number" 
                    placeholder="0" 
                    className="bg-slate-50 border-slate-200"
                    required 
                  />
                </div>

                {/* Date Picker */}
                <div className="space-y-2">
                  <Label className="text-slate-700 font-medium">Date</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant={"outline"}
                        className={cn(
                          "w-full justify-between text-left font-normal bg-slate-50 border-slate-200",
                          !date && "text-muted-foreground"
                        )}
                      >
                        {date ? format(date, "MMMM do, yyyy") : <span>Pick a date</span>}
                        <CalendarIcon className="h-4 w-4 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={date}
                        onSelect={(d) => d && setDate(d)}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>

                {/* Description */}
                <div className="space-y-2">
                  <Label htmlFor="description" className="text-slate-700 font-medium">Description</Label>
                  <Textarea 
                    id="description" 
                    name="description" 
                    placeholder="मासिक जमा - ..." 
                    className="min-h-[100px] bg-slate-50 border-slate-200 resize-none"
                  />
                </div>
              </div>

              <Button 
                type="submit" 
                className="w-full bg-primary hover:bg-primary/90 text-white py-6 text-lg font-semibold rounded-lg shadow-md"
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Processing...</>
                ) : (
                  'Record Transaction'
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
