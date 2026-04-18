
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
import { deleteDocumentNonBlocking, updateDocumentNonBlocking } from "@/firebase/non-blocking-updates";
import { useToast } from "@/hooks/use-toast";

export default function TransactionsPage() {
  const db = useFirestore();
  const { user, isUserLoading } = useUser();
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState("");
  const [txToDelete, setTxToDelete] = useState<any | null>(null);
  const [txToEdit, setTxToEdit] = useState<any | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);

  const txRef = useMemoFirebase(() => {
    if (!db || !user) return null;
    return query(collection(db, 'transactions'), orderBy('transactionDate', 'desc'));
  }, [db, user]);

  const { data: rawTransactions, isLoading } = useCollection(txRef);

  const transactions = React.useMemo(() => {
    if (!rawTransactions) return [];
    if (!searchTerm) return rawTransactions;
    const lowerSearch = searchTerm.toLowerCase();
    return rawTransactions.filter(tx => 
      tx.memberName?.toLowerCase().includes(lowerSearch) || 
      tx.id?.toLowerCase().includes(lowerSearch) ||
      tx.transactionType?.toLowerCase().includes(lowerSearch) ||
      tx.comment?.toLowerCase().includes(lowerSearch)
    );
  }, [rawTransactions, searchTerm]);

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
    
    // Reset state to close dialog
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
          <div className="p-4 border-b flex flex-col md:flex-row gap-4 items-center justify-between bg-white">
            <div className="relative w-full md:max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input 
                placeholder="Search by member, ID or type..." 
                className="pl-10" 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <div className="flex items-center gap-2 w-full md:w-auto overflow-x-auto pb-2 md:pb-0">
              <Badge variant="outline" className="cursor-pointer hover:bg-muted py-1 px-3">All</Badge>
              <Badge variant="outline" className="cursor-pointer hover:bg-muted py-1 px-3">Deposits</Badge>
              <Badge variant="outline" className="cursor-pointer hover:bg-muted py-1 px-3">Loans</Badge>
              <Badge variant="outline" className="cursor-pointer hover:bg-muted py-1 px-3">Repayments</Badge>
              <Button variant="ghost" size="sm">
                <Filter className="h-4 w-4 mr-2" />
                More Filters
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
                                // Small delay ensures dropdown closes before dialog opens
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
                                // Small delay ensures dropdown closes before dialog opens
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
                        {searchTerm ? "No transactions match your search." : "No transactions recorded yet."}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            )}
          </div>
        </Card>
      </main>

      {/* Delete Confirmation */}
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

      {/* Edit Dialog */}
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
