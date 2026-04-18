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
  CheckCircle2,
  Info
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
  const [memberId, setMemberId] = useState<string>("");
  const [selectedLoanId, setSelectedLoanId] = useState<string>("");

  const membersRef = useMemoFirebase(() => collection(db, 'members'), [db]);
  const { data: members, isLoading: membersLoading } = useCollection(membersRef);

  const loansRef = useMemoFirebase(() => collection(db, 'loans'), [db]);
  const { data: allLoans, isLoading: loansLoading } = useCollection(loansRef);

  // Filter loans for the selected member
  const memberLoans = React.useMemo(() => {
    if (!allLoans || !memberId) return [];
    return allLoans.filter(loan => loan.memberId === memberId);
  }, [allLoans, memberId]);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!memberId) {
      toast({ variant: "destructive", title: "Member required", description: "Please select a member." });
      return;
    }
    
    setIsSubmitting(true);
    const formData = new FormData(e.currentTarget);
    const description = formData.get('description') as string;
    // Get loan_id from either the Select (via state or FormData)
    const loanIdForRepayment = formData.get('loan_id') as string;
    
    const selectedMember = members?.find(m => m.id === memberId);
    const memberName = selectedMember?.name || "Unknown Member";
    const timestamp = new Date().toISOString();
    const txDate = date.toISOString();

    // Define all possible transaction fields
    const txConfigs = [
      { key: 'deposit_amount', type: 'Deposit', impact: 'Credit', fund: 'PrincipalFund' },
      { key: 'interest_paid_amount', type: 'InterestPayment', impact: 'Credit', fund: 'InterestFund' },
      { key: 'repayment_amount', type: 'PrincipalRepayment', impact: 'Credit', fund: 'PrincipalFund' },
      { key: 'loan_amount', type: 'LoanDisbursement', impact: 'Debit', fund: 'PrincipalFund' },
      { key: 'expense_amount', type: 'GeneralExpense', impact: 'Debit', fund: 'OperatingFund' },
      { key: 'waived_amount', type: 'LoanWaived', impact: 'Debit', fund: 'PrincipalFund' },
    ];

    let recordedCount = 0;

    txConfigs.forEach(config => {
      const amount = Number(formData.get(config.key));
      if (amount > 0) {
        recordedCount++;
        const txRef = doc(collection(db, "transactions"));
        
        // 1. Create Transaction Ledger Entry
        setDocumentNonBlocking(txRef, {
          id: txRef.id,
          transactionDate: txDate,
          transactionType: config.type,
          amount,
          memberId,
          memberName,
          fundCategory: config.fund,
          balanceImpact: config.impact,
          comment: description,
          relatedEntityId: (config.type === 'PrincipalRepayment' || config.type === 'InterestPayment') ? loanIdForRepayment : undefined,
          relatedEntityType: (config.type === 'PrincipalRepayment' || config.type === 'InterestPayment') ? 'Loan' : undefined,
          createdAt: timestamp,
          updatedAt: timestamp,
        }, { merge: true });

        // 2. Specialized Entity Creation
        if (config.type === 'PrincipalRepayment') {
          const repaymentRef = doc(collection(db, "repaymentEntries"));
          setDocumentNonBlocking(repaymentRef, {
            id: repaymentRef.id,
            memberId,
            loanId: loanIdForRepayment || 'unknown',
            repaymentDate: txDate,
            principalPaid: amount,
            interestPaid: 0,
            finePaid: 0,
            repaymentType: 'PrincipalOnly',
            comment: description,
            createdAt: timestamp,
            updatedAt: timestamp,
          }, { merge: true });
        } else if (config.type === 'InterestPayment') {
          const repaymentRef = doc(collection(db, "repaymentEntries"));
          setDocumentNonBlocking(repaymentRef, {
            id: repaymentRef.id,
            memberId,
            loanId: loanIdForRepayment || 'unknown',
            repaymentDate: txDate,
            principalPaid: 0,
            interestPaid: amount,
            finePaid: 0,
            repaymentType: 'InterestOnly',
            comment: description,
            createdAt: timestamp,
            updatedAt: timestamp,
          }, { merge: true });
        } else if (config.type === 'Deposit') {
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
      }
    });

    if (recordedCount === 0) {
      toast({ variant: "destructive", title: "No amounts entered", description: "Please enter at least one transaction amount." });
      setIsSubmitting(false);
      return;
    }

    toast({
      title: "Transactions recorded",
      description: `${recordedCount} transaction(s) for ${memberName} have been logged.`,
    });
    
    router.push("/transactions");
  }

  // Handle member change to clear selected loan
  const handleMemberChange = (id: string) => {
    setMemberId(id);
    setSelectedLoanId("");
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <Navbar />
      
      <main className="flex-1 flex items-center justify-center p-4">
        <Card className="w-full max-w-2xl shadow-xl border-none relative">
          <Button 
            variant="ghost" 
            size="icon" 
            className="absolute right-4 top-4 rounded-full"
            asChild
          >
            <Link href="/transactions"><X className="h-4 w-4" /></Link>
          </Button>

          <CardHeader className="space-y-1 pb-6">
            <CardTitle className="text-2xl font-bold text-slate-900">Record New Transaction</CardTitle>
            <CardDescription className="text-slate-500">
              Select a member and fill in all applicable transaction amounts.
            </CardDescription>
          </CardHeader>
          
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  {/* Member Selection */}
                  <div className="space-y-2">
                    <Label className="text-slate-700 font-medium">Member</Label>
                    <Select value={memberId} onValueChange={handleMemberChange} required>
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
                      placeholder="Add any notes here..." 
                      className="min-h-[120px] bg-slate-50 border-slate-200 resize-none"
                    />
                  </div>

                  <div className="p-4 rounded-lg bg-blue-50 border border-blue-100 flex gap-3 items-start">
                    <Info className="h-4 w-4 text-blue-600 mt-0.5 shrink-0" />
                    <p className="text-xs text-blue-800 leading-relaxed">
                      Entering an amount in any field below will create a separate transaction record for that type.
                    </p>
                  </div>
                </div>

                <div className="space-y-4 bg-slate-100/50 p-4 rounded-lg border border-slate-200">
                  <h3 className="font-semibold text-sm text-slate-900 mb-2 uppercase tracking-wider">Transaction Amounts</h3>
                  
                  <div className="space-y-4">
                    <div className="space-y-1.5">
                      <Label htmlFor="deposit_amount" className="text-xs font-bold text-slate-600">Monthly Deposit (₹)</Label>
                      <Input 
                        id="deposit_amount" 
                        name="deposit_amount" 
                        type="number" 
                        placeholder="0" 
                        className="bg-white border-slate-200"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="interest_paid_amount" className="text-xs font-bold text-slate-600">Interest Paid (₹)</Label>
                      <Input 
                        id="interest_paid_amount" 
                        name="interest_paid_amount" 
                        type="number" 
                        placeholder="0" 
                        className="bg-white border-slate-200"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="repayment_amount" className="text-xs font-bold text-slate-600">Loan Repayment (Principal) (₹)</Label>
                      <Input 
                        id="repayment_amount" 
                        name="repayment_amount" 
                        type="number" 
                        placeholder="0" 
                        className="bg-white border-slate-200"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="loan_id" className="text-xs font-bold text-slate-600">Loan ID (For Repayment/Interest)</Label>
                      <Select 
                        name="loan_id" 
                        value={selectedLoanId} 
                        onValueChange={setSelectedLoanId}
                        disabled={!memberId || memberLoans.length === 0}
                      >
                        <SelectTrigger className="bg-white border-slate-200 h-10">
                          <SelectValue placeholder={
                            !memberId 
                              ? "Select a member first" 
                              : (loansLoading ? "Loading loans..." : (memberLoans.length === 0 ? "No active loans found" : "Select active loan"))
                          } />
                        </SelectTrigger>
                        <SelectContent>
                          {memberLoans.map(loan => (
                            <SelectItem key={loan.id} value={loan.id}>
                              Loan #{loan.id} (₹{loan.loanAmount.toLocaleString()})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {!loansLoading && memberId && memberLoans.length === 0 && (
                        <p className="text-[10px] text-muted-foreground italic">No active loans found for this member.</p>
                      )}
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="loan_amount" className="text-xs font-bold text-slate-600">New Loan Issued (₹)</Label>
                      <Input 
                        id="loan_amount" 
                        name="loan_amount" 
                        type="number" 
                        placeholder="0" 
                        className="bg-white border-slate-200"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="expense_amount" className="text-xs font-bold text-slate-600">Expense (₹)</Label>
                      <Input 
                        id="expense_amount" 
                        name="expense_amount" 
                        type="number" 
                        placeholder="0" 
                        className="bg-white border-slate-200"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="waived_amount" className="text-xs font-bold text-slate-600">Loan Waived (₹)</Label>
                      <Input 
                        id="waived_amount" 
                        name="waived_amount" 
                        type="number" 
                        placeholder="0" 
                        className="bg-white border-slate-200"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <Button 
                type="submit" 
                className="w-full bg-primary hover:bg-primary/90 text-white py-6 text-lg font-semibold rounded-lg shadow-md mt-4"
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Processing...</>
                ) : (
                  'Record Transactions'
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
