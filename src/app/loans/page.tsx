
"use client"

import React, { useState } from "react";
import { Navbar } from "@/components/layout/Navbar";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Loader2, MoreHorizontal, Edit, Trash2, IndianRupee, Calendar, FileText } from "lucide-react";
import Link from "next/link";
import { Card } from "@/components/ui/card";
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
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { deleteDocumentNonBlocking, updateDocumentNonBlocking } from "@/firebase/non-blocking-updates";
import { useToast } from "@/hooks/use-toast";

export default function LoansPage() {
  const db = useFirestore();
  const { toast } = useToast();
  const { user, isUserLoading } = useUser();
  const [loanToDelete, setLoanToDelete] = useState<any | null>(null);
  const [loanToEdit, setLoanToEdit] = useState<any | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);
  
  const loansRef = useMemoFirebase(() => {
    if (!db || !user) return null;
    return query(collection(db, 'loans'), orderBy('loanDate', 'desc'));
  }, [db, user]);

  const { data: loans, isLoading } = useCollection(loansRef);

  const membersRef = useMemoFirebase(() => {
    if (!db || !user) return null;
    return collection(db, 'members');
  }, [db, user]);
  const { data: members } = useCollection(membersRef);

  const handleDelete = () => {
    if (loanToDelete && db) {
      const docRef = doc(db, 'loans', loanToDelete.id);
      deleteDocumentNonBlocking(docRef);
      toast({
        title: "Loan deleted",
        description: "The loan record has been removed.",
      });
      setLoanToDelete(null);
    }
  };

  const handleEditSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!loanToEdit || !db) return;
    setIsUpdating(true);

    const formData = new FormData(e.currentTarget);
    const amount = Number(formData.get('amount'));
    const interest = Number(formData.get('interest')) / 100;
    const date = formData.get('date') as string;
    const comment = formData.get('comment') as string;

    const docRef = doc(db, 'loans', loanToEdit.id);
    updateDocumentNonBlocking(docRef, {
      loanAmount: amount,
      outstandingPrincipal: amount,
      interestRate: interest,
      loanDate: new Date(date).toISOString(),
      comment,
      updatedAt: new Date().toISOString()
    });

    toast({
      title: "Loan updated",
      description: "The loan details have been saved successfully.",
    });
    
    setLoanToEdit(null);
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
            <h1 className="text-3xl font-bold tracking-tight text-primary font-headline">Loans Directory</h1>
            <p className="text-muted-foreground">Manage and track all issued loans and balances.</p>
          </div>
          <Button asChild>
            <Link href="/loans/new">
              <Plus className="h-4 w-4 mr-2" />
              Issue New Loan
            </Link>
          </Button>
        </header>

        <Card className="border-none shadow-sm overflow-hidden">
          <div className="relative min-h-[400px]">
            {isLoading ? (
              <div className="absolute inset-0 flex items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead>Loan ID</TableHead>
                    <TableHead>Disbursement Date</TableHead>
                    <TableHead>Recipient</TableHead>
                    <TableHead>Principal</TableHead>
                    <TableHead>Interest Rate</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Outstanding</TableHead>
                    <TableHead className="w-[80px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loans?.map((loan) => {
                    const member = members?.find(m => m.id === loan.memberId);
                    return (
                      <TableRow key={loan.id} className="hover:bg-muted/30 transition-colors">
                        <TableCell className="font-mono text-xs font-bold text-primary">
                          {loan.id}
                        </TableCell>
                        <TableCell className="text-sm">
                          {new Date(loan.loanDate).toLocaleDateString()}
                        </TableCell>
                        <TableCell className="font-medium">
                          {loan.isOutsiderLoan ? loan.outsiderName : (member?.name || 'Unknown Member')}
                          {loan.isOutsiderLoan && <Badge variant="outline" className="ml-2 text-[10px]">Outsider</Badge>}
                        </TableCell>
                        <TableCell>
                          ₹{loan.loanAmount.toLocaleString()}
                        </TableCell>
                        <TableCell>
                          {(loan.interestRate * 100).toFixed(1)}% p.m.
                        </TableCell>
                        <TableCell>
                          <Badge 
                            variant={loan.status === 'Closed' ? 'secondary' : 'default'}
                            className={loan.status === 'Closed' ? 'bg-slate-100 text-slate-600' : 'bg-green-100 text-green-700 hover:bg-green-100'}
                          >
                            {loan.status || 'Active'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right font-bold text-destructive">
                          ₹{(loan.outstandingPrincipal + (loan.outstandingInterest || 0)).toLocaleString()}
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
                                  setTimeout(() => setLoanToEdit(loan), 0);
                                }} 
                                className="flex items-center gap-2"
                              >
                                <Edit className="h-4 w-4" />
                                Edit Loan
                              </DropdownMenuItem>
                              <DropdownMenuItem 
                                className="text-destructive focus:text-destructive flex items-center gap-2" 
                                onSelect={() => {
                                  setTimeout(() => setLoanToDelete(loan), 0);
                                }}
                              >
                                <Trash2 className="h-4 w-4" />
                                Delete Loan
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {(!loans || loans.length === 0) && !isLoading && (
                    <TableRow>
                      <TableCell colSpan={8} className="h-24 text-center text-muted-foreground">
                        No loans issued yet.
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
        open={!!loanToDelete} 
        onOpenChange={(open) => {
          if (!open) setLoanToDelete(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the loan record 
              <strong> [{loanToDelete?.id}]</strong> of <strong> ₹{loanToDelete?.loanAmount?.toLocaleString()}</strong>.
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
        open={!!loanToEdit} 
        onOpenChange={(open) => {
          if (!open) setLoanToEdit(null);
        }}
      >
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Edit Loan Details</DialogTitle>
            <DialogDescription>
              Modify the terms or details for loan <strong>{loanToEdit?.id}</strong>.
            </DialogDescription>
          </DialogHeader>
          {loanToEdit && (
            <form onSubmit={handleEditSubmit} className="space-y-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="amount" className="flex items-center gap-2">
                  <IndianRupee className="h-4 w-4" />
                  Loan Amount (₹)
                </Label>
                <Input id="amount" name="amount" type="number" defaultValue={loanToEdit.loanAmount} required />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="interest" className="flex items-center gap-2">
                  <Plus className="h-4 w-4" />
                  Interest Rate (% p.m.)
                </Label>
                <Input id="interest" name="interest" type="number" step="0.1" defaultValue={loanToEdit.interestRate * 100} required />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="date" className="flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  Disbursement Date
                </Label>
                <Input 
                  id="date" 
                  name="date" 
                  type="date" 
                  defaultValue={loanToEdit.loanDate ? new Date(loanToEdit.loanDate).toISOString().split('T')[0] : ''} 
                  required 
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="comment" className="flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  Purpose / Comment
                </Label>
                <Textarea id="comment" name="comment" defaultValue={loanToEdit.comment} />
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setLoanToEdit(null)} disabled={isUpdating}>
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
