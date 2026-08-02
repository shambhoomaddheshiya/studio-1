
"use client"

import React, { useState } from "react";
import { Navbar } from "@/components/layout/Navbar";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Plus, 
  Download, 
  Search, 
  Loader2, 
  MoreHorizontal, 
  Edit, 
  Trash2, 
  Calendar, 
  IndianRupee, 
  FileText
} from "lucide-react";
import { Input } from "@/components/ui/input";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { useFirestore, useCollection, useMemoFirebase, useUser } from "@/firebase";
import { collection, query, orderBy, doc, where, getDocs } from "firebase/firestore";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";
import { 
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { deleteDocumentNonBlocking, updateDocumentNonBlocking } from "@/firebase/non-blocking-updates";
import { useToast } from "@/hooks/use-toast";
import { StatCard } from "@/components/dashboard/StatCard";

const months = [
  { value: "0", label: "January" },
  { value: "1", label: "February" },
  { value: "2", label: "March" },
  { value: "3", label: "April" },
  { value: "4", label: "May" },
  { value: "5", label: "June" },
  { value: "6", label: "July" },
  { value: "7", label: "August" },
  { value: "8", label: "September" },
  { value: "9", label: "October" },
  { value: "10", label: "November" },
  { value: "11", label: "December" },
];

const typeFilters = [
  { value: "all", label: "All" },
  { value: "deposits", label: "Deposits" },
  { value: "loans", label: "Loans" },
  { value: "interest", label: "Interest" },
  { value: "repayments", label: "Repayments" },
  { value: "fines", label: "Fines" },
  { value: "expenses", label: "Expenses" },
  { value: "waived", label: "Loan Waived" },
];

const dateFilters = [
  { value: "all", label: "All Time" },
  { value: "monthly", label: "Monthly" },
  { value: "yearly", label: "Yearly" },
];

export default function TransactionsPage() {
  const db = useFirestore();
  const { user, isUserLoading } = useUser();
  const { toast } = useToast();
  
  const [searchTerm, setSearchTerm] = useState("");
  const [dateFilterType, setDateFilterType] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [viewMonth, setViewMonth] = useState<string>(new Date().getMonth().toString());
  const [viewYear, setViewYear] = useState<string>(new Date().getFullYear().toString());
  
  const [txToDelete, setTxToDelete] = useState<any | null>(null);
  const [txToEdit, setTxToEdit] = useState<any | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);

  const txRef = useMemoFirebase(() => {
    if (!db || !user) return null;
    return query(collection(db, 'transactions'), orderBy('transactionDate', 'desc'));
  }, [db, user]);

  const loansRef = useMemoFirebase(() => {
    if (!db || !user) return null;
    return collection(db, 'loans');
  }, [db, user]);

  const { data: rawTransactions, isLoading } = useCollection(txRef);
  const { data: rawLoans } = useCollection(loansRef);

  const availableYears = React.useMemo(() => {
    if (!rawTransactions) return [];
    const years = new Set<string>();
    rawTransactions.forEach(tx => {
      if (tx.transactionDate) {
        years.add(new Date(tx.transactionDate).getFullYear().toString());
      }
    });
    const current = new Date().getFullYear().toString();
    years.add(current);
    return Array.from(years).sort((a, b) => b.localeCompare(a));
  }, [rawTransactions]);

  const transactions = React.useMemo(() => {
    if (!rawTransactions) return [];
    
    return rawTransactions.filter(tx => {
      if (searchTerm) {
        const lowerSearch = searchTerm.toLowerCase();
        const matches = (tx.memberName || "").toLowerCase().includes(lowerSearch) ||
                      (tx.id || "").toLowerCase().includes(lowerSearch) ||
                      (tx.transactionType || "").toLowerCase().includes(lowerSearch) ||
                      (tx.comment || "").toLowerCase().includes(lowerSearch);
        if (!matches) return false;
      }

      if (typeFilter !== 'all') {
        const t = tx.transactionType;
        if (typeFilter === 'deposits' && t !== 'Deposit') return false;
        if (typeFilter === 'loans' && t !== 'LoanDisbursement') return false;
        if (typeFilter === 'interest' && t !== 'InterestPayment') return false;
        if (typeFilter === 'repayments' && t !== 'PrincipalRepayment') return false;
        if (typeFilter === 'fines' && t !== 'FinePayment') return false;
        if (typeFilter === 'expenses' && t !== 'GeneralExpense') return false;
        if (typeFilter === 'waived' && t !== 'LoanWaived') return false;
      }

      if (tx.transactionDate) {
        const d = new Date(tx.transactionDate);
        if (dateFilterType === 'monthly') {
          if (d.getMonth().toString() !== viewMonth || d.getFullYear().toString() !== viewYear) return false;
        } else if (dateFilterType === 'yearly') {
          if (d.getFullYear().toString() !== viewYear) return false;
        }
      }

      return true;
    });
  }, [rawTransactions, searchTerm, typeFilter, dateFilterType, viewMonth, viewYear]);

  const stats = React.useMemo(() => {
    const s = {
      deposits: 0,
      loans: 0,
      repayments: 0,
      fines: 0,
      expenses: 0,
      remaining: 0,
      allTimeAggregatedDeposits: 0
    };

    transactions.forEach(tx => {
      const amt = tx.amount || 0;
      const t = tx.transactionType;
      const impact = tx.balanceImpact;

      if (t === 'Deposit') s.deposits += amt;
      if (t === 'PrincipalRepayment') s.repayments += amt;
      if (t === 'FinePayment') s.fines += amt;
      if (t === 'GeneralExpense') s.expenses += amt;

      if (impact === 'Credit') s.remaining += amt;
      else if (t !== 'LoanDisbursement') s.remaining -= amt; // Loan recovery logic handle separately
    });

    // Loans source of truth: registry
    if (rawLoans) {
      rawLoans.forEach(loan => {
        const d = new Date(loan.loanDate || 0);
        let inView = true;
        if (dateFilterType === 'monthly') {
          if (d.getMonth().toString() !== viewMonth || d.getFullYear().toString() !== viewYear) inView = false;
        } else if (dateFilterType === 'yearly') {
          if (d.getFullYear().toString() !== viewYear) inView = false;
        }

        if (inView) {
          s.loans += (loan.loanAmount || 0);
        }
      });

      const totalAggregated = rawTransactions?.reduce((acc, tx) => {
        const t = tx.transactionType;
        if (['Deposit', 'InterestPayment', 'FinePayment'].includes(t)) return acc + (tx.amount || 0);
        return acc;
      }, 0) || 0;

      const currentOutstanding = rawLoans.reduce((acc, l) => acc + (l.outstandingPrincipal || 0), 0);
      s.allTimeAggregatedDeposits = totalAggregated;
      s.remaining = totalAggregated - currentOutstanding; // Simplified Net Position
    }

    return s;
  }, [transactions, rawTransactions, rawLoans, dateFilterType, viewMonth, viewYear]);

  const handleDelete = async () => {
    if (txToDelete && db) {
      const docRef = doc(db, 'transactions', txToDelete.id);
      deleteDocumentNonBlocking(docRef);

      if (txToDelete.relatedEntityId && txToDelete.relatedEntityType) {
        const collectionName = 
          txToDelete.relatedEntityType === 'Loan' ? "loans" :
          txToDelete.relatedEntityType === 'DepositEntry' ? "depositEntries" :
          txToDelete.relatedEntityType === 'RepaymentEntry' ? "repaymentEntries" : "";

        if (collectionName) {
          const entityRef = doc(db, collectionName, txToDelete.relatedEntityId);
          deleteDocumentNonBlocking(entityRef);
          
          if (collectionName === 'loans') {
            try {
              const repaymentsCol = collection(db, 'repaymentEntries');
              const qRepayments = query(repaymentsCol, where('loanId', '==', txToDelete.relatedEntityId));
              const snapRepayments = await getDocs(qRepayments);
              snapRepayments.forEach((rDoc) => {
                deleteDocumentNonBlocking(rDoc.ref);
              });
            } catch (e) { console.error(e); }
          }
        }
      }

      toast({
        title: "Transaction deleted",
        description: "The record and its associated directory data have been removed.",
      });
      setTxToDelete(null);
    }
  };

  const handleEditSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!txToEdit || !db) return;
    setIsUpdating(true);

    const formData = new FormData(e.currentTarget);
    const amount = Number(formData.get('amount'));
    const date = formData.get('date') as string;
    const comment = formData.get('comment') as string;

    const docRef = doc(db, 'transactions', txToEdit.id);
    updateDocumentNonBlocking(docRef, {
      amount,
      transactionDate: new Date(date).toISOString(),
      comment,
      updatedAt: new Date().toISOString()
    });

    toast({
      title: "Transaction updated",
      description: "Changes have been saved successfully.",
    });
    
    setTxToEdit(null);
    setIsUpdating(false);
  };

  if (isUserLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      
      <main className="flex-1 p-4 sm:p-8 max-w-7xl mx-auto w-full space-y-6">
        <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-primary font-headline">Transaction History</h1>
            <p className="text-muted-foreground">Track all deposits, loans, and repayments globally.</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" asChild>
              <Link href="/reports">
                <Download className="h-4 w-4 mr-2" />
                Report
              </Link>
            </Button>
            <Button asChild>
              <Link href="/transactions/new">
                <Plus className="h-4 w-4 mr-2" />
                New Entry
              </Link>
            </Button>
          </div>
        </header>

        <div className="grid gap-4 grid-cols-2 md:grid-cols-4 lg:grid-cols-7">
          <StatCard title="Deposits" value={`₹${Math.abs(stats.deposits).toLocaleString()}`} />
          <StatCard title="Repayments" value={`₹${Math.abs(stats.repayments).toLocaleString()}`} />
          <StatCard title="Fines" value={`₹${Math.abs(stats.fines).toLocaleString()}`} />
          <StatCard title="Loans" value={`₹${Math.abs(stats.loans).toLocaleString()}`} className="text-destructive" />
          <StatCard title="Expenses" value={`₹${Math.abs(stats.expenses).toLocaleString()}`} />
          <StatCard title="Net Capital" value={`₹${Math.abs(stats.remaining).toLocaleString()}`} />
          <StatCard 
            title="Total Coll." 
            value={`₹${Math.abs(stats.allTimeAggregatedDeposits).toLocaleString()}`} 
            description="All Time Collections" 
          />
        </div>

        <Card className="border-none shadow-sm overflow-hidden">
          <div className="p-6 border-b space-y-6 bg-white">
            <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
              <div className="relative w-full md:max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input 
                  placeholder="Search by member, ID or type..." 
                  className="pl-10 h-10 border-slate-200" 
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-6">
              <span className="text-sm font-bold text-[#1e293b]">Filter by Date:</span>
              <RadioGroup
                value={dateFilterType}
                onValueChange={setDateFilterType}
                className="flex items-center gap-6"
              >
                {dateFilters.map((f) => (
                  <div key={f.value} className="flex items-center space-x-2">
                    <RadioGroupItem 
                      value={f.value} 
                      id={`date-${f.value}`} 
                      className="h-5 w-5 border-[#3f51b5] text-[#3f51b5]" 
                    />
                    <Label htmlFor={`date-${f.value}`} className="font-medium text-slate-600 cursor-pointer">
                      {f.label}
                    </Label>
                  </div>
                ))}
              </RadioGroup>

              {(dateFilterType === 'monthly' || dateFilterType === 'yearly') && (
                <Select value={viewYear} onValueChange={setViewYear}>
                  <SelectTrigger className="w-[110px] h-9 text-sm bg-[#eef2ff] border-none shadow-none focus:ring-0 text-slate-700 font-medium">
                    <SelectValue placeholder="Year" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableYears.map(year => (
                      <SelectItem key={year} value={year}>{year}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}

              {dateFilterType === 'monthly' && (
                <Select value={viewMonth} onValueChange={setViewMonth}>
                  <SelectTrigger className="w-[140px] h-9 text-sm bg-[#eef2ff] border-none shadow-none focus:ring-0 text-slate-700 font-medium">
                    <SelectValue placeholder="Month" />
                  </SelectTrigger>
                  <SelectContent>
                    {months.map(m => (
                      <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            <div className="flex items-center gap-2 w-full overflow-x-auto border-t pt-4">
              {typeFilters.map((filter) => (
                <Badge 
                  key={filter.value}
                  variant={typeFilter === filter.value ? "default" : "outline"} 
                  className={cn(
                    "cursor-pointer hover:bg-muted py-1.5 px-4 transition-all whitespace-nowrap rounded-full",
                    typeFilter === filter.value ? "bg-[#3f51b5] hover:bg-[#303f9f]" : ""
                  )}
                  onClick={() => setTypeFilter(filter.value)}
                >
                  {filter.label}
                </Badge>
              ))}
              <div className="h-4 w-px bg-border mx-2" />
              <Button variant="ghost" size="sm" className="text-slate-500" onClick={() => {
                setSearchTerm("");
                setTypeFilter("all");
                setDateFilterType("all");
              }}>
                Clear Filters
              </Button>
            </div>
          </div>
          
          <div className="relative min-h-[400px]">
            {isLoading ? (
              <div className="absolute inset-0 flex items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead>Date</TableHead>
                    <TableHead>Member</TableHead>
                    <TableHead>Transaction Type</TableHead>
                    <TableHead>Comment</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead className="w-[80px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {transactions?.map((tx) => (
                    <TableRow key={tx.id} className="hover:bg-muted/30">
                      <TableCell className="text-sm">
                        {tx.transactionDate ? new Date(tx.transactionDate).toLocaleDateString() : '-'}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-medium">{tx.memberName}</span>
                          <span className="text-[10px] font-mono text-muted-foreground">{(tx.memberId || '').substring(0, 8)}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={
                          tx.transactionType === 'Deposit' ? 'secondary' : 
                          tx.transactionType === 'LoanDisbursement' ? 'destructive' : 
                          tx.transactionType === 'FinePayment' ? 'default' :
                          'outline'
                        } className="capitalize">
                          {(tx.transactionType || '').replace(/([A-Z])/g, ' $1').trim()}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm max-w-[200px] truncate italic text-muted-foreground">
                        {tx.comment}
                      </TableCell>
                      <TableCell className={cn(
                        "text-right font-bold tabular-nums",
                        tx.balanceImpact === 'Debit' ? 'text-destructive' : 'text-primary'
                      )}>
                        ₹{(tx.amount || 0).toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem 
                              onSelect={() => {
                                setTimeout(() => setTxToEdit(tx), 0);
                              }} 
                              className="flex items-center gap-2"
                            >
                              <Edit className="h-4 w-4" />
                              Edit Entry
                            </DropdownMenuItem>
                            <DropdownMenuItem 
                              className="text-destructive focus:text-destructive flex items-center gap-2" 
                              onSelect={() => {
                                setTimeout(() => setTxToDelete(tx), 0);
                              }}
                            >
                              <Trash2 className="h-4 w-4" />
                              Delete Entry
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                  {(transactions.length === 0) && (
                    <TableRow>
                      <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                        No transactions match your criteria.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            )}
          </div>
        </Card>
      </main>

      <AlertDialog 
        open={!!txToDelete} 
        onOpenChange={(open) => {
          if (!open) setTxToDelete(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the transaction record and update the dashboard balance.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog 
        open={!!txToEdit} 
        onOpenChange={(open) => {
          if (!open) setTxToEdit(null);
        }}
      >
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Edit Transaction</DialogTitle>
            <DialogDescription>
              Modify the details for this transaction entry.
            </DialogDescription>
          </DialogHeader>
          {txToEdit && (
            <form onSubmit={handleEditSubmit} className="space-y-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="amount" className="flex items-center gap-2">
                  <IndianRupee className="h-4 w-4" />
                  Amount (₹)
                </Label>
                <Input id="amount" name="amount" type="number" defaultValue={txToEdit.amount} required />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="date" className="flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  Date
                </Label>
                <Input 
                  id="date" 
                  name="date" 
                  type="date" 
                  defaultValue={txToEdit.transactionDate ? new Date(txToEdit.transactionDate).toISOString().split('T')[0] : ''} 
                  required 
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="comment" className="flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  Comment
                </Label>
                <Textarea id="comment" name="comment" defaultValue={txToEdit.comment} />
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setTxToEdit(null)} disabled={isUpdating}>
                  Cancel
                </Button>
                <Button type="submit" disabled={isUpdating}>
                  {isUpdating ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  Save Changes
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
