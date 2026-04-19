
"use client"

import React, { useState, useEffect } from "react";
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
  Loader2,
  Check
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
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

export default function NewDepositPage() {
  const { toast } = useToast();
  const router = useRouter();
  const db = useFirestore();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([]);

  const membersRef = useMemoFirebase(() => collection(db, 'members'), [db]);
  const { data: members, isLoading: membersLoading } = useCollection(membersRef);

  // Initialize selected members when data loads
  useEffect(() => {
    if (members && selectedMemberIds.length === 0) {
      // By default, maybe we don't select all to avoid accidental bulk writes
      // But based on the image, it seems useful to have them ready
    }
  }, [members]);

  const handleSelectAll = (checked: boolean | string) => {
    if (checked === true && members) {
      setSelectedMemberIds(members.map(m => m.id));
    } else {
      setSelectedMemberIds([]);
    }
  };

  const toggleMember = (memberId: string) => {
    setSelectedMemberIds(prev => 
      prev.includes(memberId) 
        ? prev.filter(id => id !== memberId) 
        : [...prev, memberId]
    );
  };

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    
    if (selectedMemberIds.length === 0) {
      toast({
        variant: "destructive",
        title: "No members selected",
        description: "Please select at least one member to record a deposit.",
      });
      return;
    }

    setIsSubmitting(true);

    const formData = new FormData(e.currentTarget);
    const type = formData.get('type') as string;
    const amount = Number(formData.get('amount'));
    const date = formData.get('date') as string;
    const comment = formData.get('comment') as string;

    const timestamp = new Date().toISOString();
    const entryDate = date ? new Date(date).toISOString() : timestamp;

    const membersToProcess = members?.filter(m => selectedMemberIds.includes(m.id)) || [];

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
        expectedAmount: 500, // Standard rule
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
      title: membersToProcess.length > 1 ? "Bulk transactions recorded" : "Transaction recorded",
      description: `₹${amount} has been recorded for ${membersToProcess.length} member(s).`,
    });
    
    router.push("/transactions");
  }

  const allSelected = members && members.length > 0 && selectedMemberIds.length === members.length;

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
            <p className="text-muted-foreground">Log monthly contributions or fine payments.</p>
          </div>
        </header>

        <Card className="border-none shadow-sm">
          <CardHeader>
            <div className="flex flex-col gap-1">
              <CardTitle className="text-xl font-bold text-slate-900">Select Members</CardTitle>
              <CardDescription>Choose which active members to include in this bulk deposit.</CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-4">
                <div className="flex items-center space-x-2 py-2 border-b">
                  <Checkbox 
                    id="select-all" 
                    checked={allSelected}
                    onCheckedChange={handleSelectAll}
                    disabled={membersLoading || !members?.length}
                  />
                  <Label 
                    htmlFor="select-all" 
                    className="text-sm font-semibold cursor-pointer select-none"
                  >
                    Select All Members ({selectedMemberIds.length} / {members?.length || 0})
                  </Label>
                </div>

                <div className="rounded-md border bg-slate-50/50 p-2">
                  <ScrollArea className="h-[250px] pr-4">
                    {membersLoading ? (
                      <div className="flex items-center justify-center h-full">
                        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                      </div>
                    ) : (
                      <div className="grid gap-3">
                        {members?.map((member) => (
                          <div 
                            key={member.id} 
                            className={cn(
                              "flex items-center space-x-3 p-2 rounded-lg transition-colors hover:bg-white border border-transparent",
                              selectedMemberIds.includes(member.id) && "bg-white border-slate-200 shadow-sm"
                            )}
                          >
                            <Checkbox 
                              id={`member-${member.id}`} 
                              checked={selectedMemberIds.includes(member.id)}
                              onCheckedChange={() => toggleMember(member.id)}
                            />
                            <Label 
                              htmlFor={`member-${member.id}`} 
                              className="flex-1 cursor-pointer text-sm font-medium select-none"
                            >
                              {member.name}
                              <span className="ml-2 text-[10px] text-muted-foreground font-mono">
                                ({member.id.substring(0, 8)})
                              </span>
                            </Label>
                          </div>
                        ))}
                        {(!members || members.length === 0) && !membersLoading && (
                          <p className="text-center text-sm text-muted-foreground py-8">
                            No active members found.
                          </p>
                        )}
                      </div>
                    )}
                  </ScrollArea>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t">
                  <div className="grid gap-2">
                    <Label htmlFor="type">Transaction Type</Label>
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
                  <Label htmlFor="date">Payment Date</Label>
                  <Input id="date" name="date" type="date" defaultValue={new Date().toISOString().split('T')[0]} required />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="comment">Comment (Optional)</Label>
                  <div className="relative">
                    <Textarea id="comment" name="comment" placeholder="e.g. Contribution for March 2024" className="pr-10 min-h-[80px]" />
                    <Button type="button" variant="ghost" size="icon" className="absolute right-2 top-2 h-8 w-8 text-accent">
                      <Sparkles className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t">
                <Button variant="outline" type="button" asChild disabled={isSubmitting}>
                  <Link href="/">Cancel</Link>
                </Button>
                <Button type="submit" disabled={isSubmitting || selectedMemberIds.length === 0} className="min-w-[180px]">
                  {isSubmitting ? (
                    <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Recording...</>
                  ) : (
                    selectedMemberIds.length > 0 
                      ? `Deposit for ${selectedMemberIds.length} member${selectedMemberIds.length > 1 ? 's' : ''}`
                      : 'Select Members'
                  )}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
