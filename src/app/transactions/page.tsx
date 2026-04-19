
"use client"

import React, { useState } from "react";
import { Navbar } from "@/components/layout/Navbar";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Download, Filter, Search, Loader2, MoreHorizontal, Edit, Trash2, Calendar, IndianRupee, FileText } from "lucide-react";
import { Input } from "@/components/ui/input";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { useFirestore, useCollection, useMemoFirebase, useUser } from "@/firebase";
import { collection, query, orderBy, doc } from "firebase/firestore";
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
import { deleteDocumentNonBlocking, updateDocumentNonBlocking } from "@/firebase/non-blocking-updates";
import { useToast } from "@/hooks/use-toast";

const months = [
  { value: "All", label: "All Months" },
  { value: "1", label: "January" },
  { value: "2", label: "February" },
  { value: "3", label: "March" },
  { value: "4", label: "April" },
  { value: "5", label: "May" },
  { value: "6", label: "June" },
  { value: "7", label: "July" },
  { value: "8", label: "August" },
  { value: "9", label: "September" },
  { value: "10", label: "October" },
  { value: "11", label: "November" },
  { value: "12", label: "December" },
];

export default function TransactionsPage() {
  const db = useFirestore();
  const { user, isUserLoading } = useUser();
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState("");
  const [activeFilter, setActiveFilter] = useState("All");
  const [selectedMonth, setSelectedMonth] = useState("All");
  const [selectedYear, setSelectedYear] = useState("All");
  const [txToDelete, setTxToDelete] = useState<any | null>(null);
  const [txToEdit, setTxToEdit] = useState<any | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);

  const txRef = useMemoFirebase(() => {
    if (!db || !user) return null;
    return query(collection(db, 'transactions'), orderBy('transactionDate', 'desc'));
  }, [db, user]);

  const { data: rawTransactions, isLoading } = useCollection(txRef);

  // Get unique years from transactions for the filter
  const availableYears = React.useMemo(() => {
    if (!rawTransactions) return [];
    const years = new Set<string>();
    rawTransactions.forEach(tx => {
      if (tx.transactionDate) {
        years.add(new Date(tx.transactionDate).getFullYear().toString());
      }
    });
    return Array.from(years).sort((a, b) => b.localeCompare(a));
  }, [rawTransactions]);

  const transactions = React.useMemo(() => {
    if (!rawTransactions) return [];
    
    let filtered = rawTransactions;

    // Search filter
    if (searchTerm) {
      const lowerSearch = searchTerm.toLowerCase();
      filtered = filtered.filter(tx => 
        tx.memberName?.toLowerCase().includes(lowerSearch) || 
        tx.id?.toLowerCase().includes(lowerSearch) ||
        tx.transactionType?.toLowerCase().includes(lowerSearch) ||
        tx.comment?.toLowerCase().includes(lowerSearch)
      );
    }

    // Category filter
    if (activeFilter !== "All") {
      filtered = filtered.filter(tx => {
        if (activeFilter === "Deposits") return tx.transactionType === 'Deposit';
        if (activeFilter === "Loans") return tx.transactionType === 'LoanDisbursement';
        if (activeFilter === "Repayments") {
          return ['PrincipalRepayment', 'InterestPayment', 'FinePayment'].includes(tx.transactionType);
        }
        return true;
      });
    }

    // Month filter
    if (selectedMonth !== "All") {
      filtered = filtered.filter(tx => {
        if (!tx.transactionDate) return false;
        const txDate = new Date(tx.transactionDate);
        return (txDate.getMonth() + 1).toString() === selectedMonth;
      });
    }

    // Year filter
    if (selectedYear !== "All") {
      filtered = filtered.filter(tx => {
        if (!tx.transactionDate) return false;
        const txDate = new Date(tx.transactionDate);
        return txDate.getFullYear().toString() === selectedYear;
      });
    }

    return filtered;
  }, [rawTransactions, searchTerm, activeFilter, selectedMonth, selectedYear]);

  const handleDelete = () => {
    if (txToDelete && db) {
      const docRef = doc(db, 'transactions', txToDelete.id);
      deleteDocumentNonBlocking(docRef);
      toast({
        title: "Transaction deleted",
        description: "The record has been permanently removed.",
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
            <Button variant="outline">
              <Download className="h-4 w-4 mr-2" />
              Report
            </Button>
            <Button asChild>
              <Link href="/transactions/new">
                <Plus className="h-4 w-4 mr-2" />
                New Entry
              </Link>
            </Button>
          </div>
        </header>

        <Card className="border-none shadow-sm overflow-hidden">
          <div className="p-4 border-b space-y-4 bg-white">
            <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
              <div className="relative w-full md:max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input 
                  placeholder="Search by member, ID or type..." 
                  className="pl-10" 
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <div className="flex items-center gap-2 w-full md:w-auto">
                <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                  <SelectTrigger className="w-full md:w-[150px]">
                    <SelectValue placeholder="Month" />
                  </SelectTrigger>
                  <SelectContent>
                    {months.map(m => (
                      <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={selectedYear} onValueChange={setSelectedYear}>
                  <SelectTrigger className="w-full md:w-[120px]">
                    <SelectValue placeholder="Year" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="All">All Years</SelectItem>
                    {availableYears.map(year => (
                      <SelectItem key={year} value={year}>{year}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex items-center gap-2 w-full overflow-x-auto pb-2 md:pb-0 border-t pt-4">
              <Badge 
                variant={activeFilter === "All" ? "default" : "outline"} 
                className="cursor-pointer hover:bg-muted py-1 px-4 transition-all"
                onClick={() => setActiveFilter("All")}
              >
                All Categories
              </Badge>
              <Badge 
                variant={activeFilter === "Deposits" ? "default" : "outline"} 
                className="cursor-pointer hover:bg-muted py-1 px-4 transition-all"
                onClick={() => setActiveFilter("Deposits")}
              >
                Deposits
              </Badge>
              <Badge 
                variant={activeFilter === "Loans" ? "default" : "outline"} 
                className="cursor-pointer hover:bg-muted py-1 px-4 transition-all"
                onClick={() => setActiveFilter("Loans")}
              >
                Loans
              </Badge>
              <Badge 
                variant={activeFilter === "Repayments" ? "default" : "outline"} 
                className="cursor-pointer hover:bg-muted py-1 px-4 transition-all"
                onClick={() => setActiveFilter("Repayments")}
              >
                Repayments
              </Badge>
              <div className="h-4 w-px bg-border mx-2" />
              <Button variant="ghost" size="sm" onClick={() => {
                setSearchTerm("");
                setActiveFilter("All");
                setSelectedMonth("All");
                setSelectedYear("All");
              }}>
                Clear All
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
                          tx.transactionType === 'Deposit' ? 'outline' : 
                          tx.transactionType === 'LoanDisbursement' ? 'destructive' : 
                          'default'
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
                        {tx.balanceImpact === 'Debit' ? '-' : '+'}₹{(tx.amount || 0).toLocaleString()}
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
                        {searchTerm || activeFilter !== "All" || selectedMonth !== "All" || selectedYear !== "All" ? "No transactions match your criteria." : "No transactions recorded yet."}
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
              This action cannot be undone. This will permanently delete the transaction record of 
              <strong> ₹{txToDelete?.amount?.toLocaleString()}</strong> for <strong>{txToDelete?.memberName}</strong>.
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
