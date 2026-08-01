
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
import { setDocumentNonBlocking, updateDocumentNonBlocking } from "@/firebase/non-blocking-updates";
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

  // Alphabetical sorting and calculation of balances for the dropdown
  const sortedMembersWithBalance = React.useMemo(() => {
    if (!members) return [];
    
    const sorted = [...members].sort((a, b) => (a.name || "").localeCompare(b.name || ""));
    
    if (!allLoans) return sorted.map(m => ({ ...m, loanBalance: 0 }));

    return sorted.map(member => {
      const balance = allLoans
        .filter(loan => loan.memberId === member.id && loan.status !== 'Closed')
        .reduce((acc, loan) => acc + (loan.outstandingPrincipal || 0) + (loan.outstandingInterest || 0), 0);
      
      return { ...member, loanBalance: balance };
    });
  }, [members, allLoans]);

  const memberLoans = React.useMemo(() => {
    if (!allLoans || !memberId) return [];
    return allLoans.filter(loan => loan.memberId === memberId && loan.status !== 'Closed');
  }, [allLoans, memberId]);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!memberId) {
      toast({ variant: "destructive", title: "Member required", description: "Please select a member." });
      return;
    }
    
    if (!date) {
      toast({ variant: "destructive", title: "Date required", description: "Please select a transaction date." });
      return;
    }

    setIsSubmitting(true);
    
    try {
      const formData = new FormData(e.currentTarget);
      const description = (formData.get('description') as string) || "";
      
      const selectedMember = sortedMembersWithBalance.find(m => m.id === memberId);
      const memberName = selectedMember?.name || "Unknown Member";
      const timestamp = new Date().toISOString();
      const txDate = date.toISOString();

      const txConfigs = [
        { key: 'deposit_amount', type: 'Deposit', impact: 'Credit', fund: 'PrincipalFund', entityType: 'DepositEntry' },
        { key: 'interest_paid_amount', type: 'InterestPayment', impact: 'Credit', fund: 'InterestFund', entityType: 'RepaymentEntry' },
        { key: 'repayment_amount', type: 'PrincipalRepayment', impact: 'Credit', fund: 'PrincipalFund', entityType: 'RepaymentEntry' },
        { key: 'fine_amount', type: 'FinePayment', impact: 'Credit', fund: 'FineFund', entityType: 'RepaymentEntry' },
        { key: 'loan_amount', type: 'LoanDisbursement', impact: 'Debit', fund: 'PrincipalFund', entityType: 'Loan' },
        { key: 'expense_amount', type: 'GeneralExpense', impact: 'Debit', fund: 'OperatingFund' },
        { key: 'waived_amount', type: 'LoanWaived', impact: 'Debit', fund: 'PrincipalFund' },
      ];

      let recordedCount = 0;

      txConfigs.forEach(config => {
        const amountValue = formData.get(config.key);
        const amount = amountValue ? Number(amountValue) : 0;

        if (amount > 0) {
          recordedCount++;
          const txRef = doc(collection(db, "transactions"));
          
          let relatedEntityId = "";
          let relatedEntityType = config.entityType || "";

          if (config.type === 'PrincipalRepayment' || config.type === 'InterestPayment' || config.type === 'FinePayment') {
            const repaymentRef = doc(collection(db, "repaymentEntries"));
            relatedEntityId = repaymentRef.id;
            
            setDocumentNonBlocking(repaymentRef, {
              id: repaymentRef.id,
              memberId,
              loanId: selectedLoanId || 'unknown',
              repaymentDate: txDate,
              principalPaid: config.type === 'PrincipalRepayment' ? amount : 0,
              interestPaid: config.type === 'InterestPayment' ? amount : 0,
              finePaid: config.type === 'FinePayment' ? amount : 0,
              repaymentType: config.type === 'PrincipalRepayment' ? 'PrincipalOnly' : config.type === 'InterestPayment' ? 'InterestOnly' : 'FineOnly',
              comment: description,
              createdAt: timestamp,
              updatedAt: timestamp,
            }, { merge: true });
          } else if (config.type === 'Deposit') {
            const depositRef = doc(collection(db, "depositEntries"));
            relatedEntityId = depositRef.id;
            
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
          } else if (config.type === 'LoanDisbursement') {
            const loanId = `L-${txRef.id.substring(0, 5).toUpperCase()}`;
            relatedEntityId = loanId;
            
            const loanRef = doc(db, "loans", loanId);
            setDocumentNonBlocking(loanRef, {
              id: loanId,
              memberId,
              loanAmount: amount,
              interestRate: 0.02,
              loanDate: txDate,
              outstandingPrincipal: amount,
              outstandingInterest: 0,
              status: 'Active',
              isOutsiderLoan: false,
              comment: description,
              createdAt: timestamp,
              updatedAt: timestamp,
            }, { merge: true });
          }

          const txData: any = {
            id: txRef.id,
            transactionDate: txDate,
            transactionType: config.type,
            amount,
            memberId,
            memberName,
            fundCategory: config.fund,
            balanceImpact: config.impact,
            comment: description,
            createdAt: timestamp,
            updatedAt: timestamp,
          };

          if (relatedEntityId) {
            txData.relatedEntityId = relatedEntityId;
            txData.relatedEntityType = relatedEntityType;
          }

          setDocumentNonBlocking(txRef, txData, { merge: true });
        }
      });

      // AUTO-UPDATE LOAN BALANCE
      if (selectedLoanId) {
        const selectedLoan = allLoans?.find(l => l.id === selectedLoanId);
        if (selectedLoan) {
          const principalPaid = Number(formData.get('repayment_amount')) || 0;
          const interestPaid = Number(formData.get('interest_paid_amount')) || 0;

          if (principalPaid > 0 || interestPaid > 0) {
            const currentPrincipal = selectedLoan.outstandingPrincipal ?? selectedLoan.loanAmount ?? 0;
            const currentInterest = selectedLoan.outstandingInterest ?? 0;

            const newPrincipal = Math.max(0, currentPrincipal - principalPaid);
            const newInterest = Math.max(0, currentInterest - interestPaid);
            const newStatus = newPrincipal <= 0 ? 'Closed' : 'Active';

            const loanDocRef = doc(db, 'loans', selectedLoan.id);
            updateDocumentNonBlocking(loanDocRef, {
              outstandingPrincipal: newPrincipal,
              outstandingInterest: newInterest,
              status: newStatus,
              updatedAt: timestamp
            });
          }
        }
      }

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
    } catch (error: any) {
      console.error("Submission error:", error);
      toast({
        variant: "destructive",
        title: "Submission failed",
        description: error.message || "An unexpected error occurred. Please try again."
      });
    } finally {
      setIsSubmitting(false);
    }
  }

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
            disabled={isSubmitting}
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
                  <div className="space-y-2">
                    <Label className="text-slate-700 font-medium">Member</Label>
                    <Select value={memberId} onValueChange={handleMemberChange} required disabled={isSubmitting}>
                      <SelectTrigger className="bg-slate-50 border-slate-200">
                        <SelectValue placeholder={membersLoading || loansLoading ? "Loading..." : "Select a member"} />
                      </SelectTrigger>
                      <SelectContent>
                        {sortedMembersWithBalance.map(m => (
                          <SelectItem key={m.id} value={m.id}>
                            {m.name} (Loan: ₹{m.loanBalance.toLocaleString()})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-slate-700 font-medium">Date</Label>
                    <Popover>
                      <PopoverTrigger asChild disabled={isSubmitting}>
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

                  <div className="space-y-2">
                    <Label htmlFor="description" className="text-slate-700 font-medium">Description</Label>
                    <Textarea 
                      id="description" 
                      name="description" 
                      placeholder="Add any notes here..." 
                      className="min-h-[120px] bg-slate-50 border-slate-200 resize-none"
                      disabled={isSubmitting}
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
                  <h3 className="font-semibold text-sm text-slate-900 mb-2 uppercase tracking-wider">TRANSACTION AMOUNTS</h3>
                  
                  <div className="space-y-4 overflow-y-auto max-h-[400px] pr-2">
                    <div className="space-y-1.5">
                      <Label htmlFor="deposit_amount" className="text-xs font-bold text-slate-600">Monthly Deposit (₹)</Label>
                      <Input 
                        id="deposit_amount" 
                        name="deposit_amount" 
                        type="number" 
                        placeholder="0" 
                        className="bg-white border-slate-200"
                        disabled={isSubmitting}
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
                        disabled={isSubmitting}
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
                        disabled={isSubmitting}
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="fine_amount" className="text-xs font-bold text-slate-600">Fine Paid (₹)</Label>
                      <Input 
                        id="fine_amount" 
                        name="fine_amount" 
                        type="number" 
                        placeholder="0" 
                        className="bg-white border-slate-200"
                        disabled={isSubmitting}
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-xs font-bold text-slate-600">Loan ID (For Repayment/Interest)</Label>
                      <Select 
                        value={selectedLoanId} 
                        onValueChange={setSelectedLoanId}
                        disabled={isSubmitting || !memberId || memberLoans.length === 0}
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
                              Loan #{loan.id} (₹{(loan.outstandingPrincipal ?? loan.loanAmount).toLocaleString()})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="loan_amount" className="text-xs font-bold text-slate-600">New Loan Issued (₹)</Label>
                      <Input 
                        id="loan_amount" 
                        name="loan_amount" 
                        type="number" 
                        placeholder="0" 
                        className="bg-white border-slate-200"
                        disabled={isSubmitting}
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
                        disabled={isSubmitting}
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
                        disabled={isSubmitting}
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
