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
import { 
  Plus, 
  Loader2, 
  Calendar, 
  MoreHorizontal, 
  Edit, 
  Trash2, 
  IndianRupee, 
  FileText 
} from "lucide-react";
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

export default function DepositsPage() {
  const db = useFirestore();
  const { toast } = useToast();
  const { user, isUserLoading } = useUser();
  const [depositToDelete, setDepositToDelete] = useState<any | null>(null);
  const [depositToEdit, setDepositToEdit] = useState<any | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);
  
  const depositsRef = useMemoFirebase(() => {
    if (!db || !user) return null;
    return query(collection(db, 'depositEntries'), orderBy('paymentDate', 'desc'));
  }, [db, user]);

  const { data: deposits, isLoading } = useCollection(depositsRef);

  const membersRef = useMemoFirebase(() => {
    if (!db || !user) return null;
    return collection(db, 'members');
  }, [db, user]);
  const { data: members } = useCollection(membersRef);

  const handleDelete = () => {
    if (depositToDelete && db) {
      const docRef = doc(db, 'depositEntries', depositToDelete.id);
      deleteDocumentNonBlocking(docRef);
      toast({
        title: "Deposit deleted",
        description: "The deposit record has been removed.",
      });
      setDepositToDelete(null);
    }
  };

  const handleEditSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!depositToEdit || !db) return;
    setIsUpdating(true);

    const formData = new FormData(e.currentTarget);
    const amount = Number(formData.get('amount'));
    const date = formData.get('date') as string;
    const comment = formData.get('comment') as string;

    const docRef = doc(db, 'depositEntries', depositToEdit.id);
    updateDocumentNonBlocking(docRef, {
      paidAmount: amount,
      paymentDate: new Date(date).toISOString(),
      comment,
      updatedAt: new Date().toISOString()
    });

    toast({
      title: "Deposit updated",
      description: "The deposit entry has been saved successfully.",
    });
    
    setDepositToEdit(null);
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
            <h1 className="text-3xl font-bold tracking-tight text-primary font-headline">Bulk Deposits</h1>
            <p className="text-muted-foreground">View and track all member contributions.</p>
          </div>
          <Button asChild>
            <Link href="/deposits/new">
              <Plus className="h-4 w-4 mr-2" />
              Record Bulk Deposit
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
                    <TableHead>Date</TableHead>
                    <TableHead>Member</TableHead>
                    <TableHead>Period</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead className="w-[80px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {deposits?.map((deposit) => {
                    const member = members?.find(m => m.id === deposit.memberId);
                    return (
                      <TableRow key={deposit.id} className="hover:bg-muted/30 transition-colors">
                        <TableCell className="text-sm">
                          {deposit.paymentDate ? new Date(deposit.paymentDate).toLocaleDateString() : '-'}
                        </TableCell>
                        <TableCell className="font-medium">
                          {member?.name || 'Unknown Member'}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1.5 text-sm">
                            <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                            {deposit.month && new Date(0, deposit.month - 1).toLocaleString('default', { month: 'long' })} {deposit.year}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant={deposit.status === 'Paid' ? 'default' : 'secondary'} className={deposit.status === 'Paid' ? 'bg-green-100 text-green-700 hover:bg-green-100' : ''}>
                            {deposit.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right font-bold text-primary">
                          ₹{deposit.paidAmount.toLocaleString()}
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
                                  setTimeout(() => setDepositToEdit(deposit), 0);
                                }} 
                                className="flex items-center gap-2"
                              >
                                <Edit className="h-4 w-4" />
                                Edit Entry
                              </DropdownMenuItem>
                              <DropdownMenuItem 
                                className="text-destructive focus:text-destructive flex items-center gap-2" 
                                onSelect={() => {
                                  setTimeout(() => setDepositToDelete(deposit), 0);
                                }}
                              >
                                <Trash2 className="h-4 w-4" />
                                Delete Entry
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {(!deposits || deposits.length === 0) && !isLoading && (
                    <TableRow>
                      <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                        No deposits recorded yet.
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
        open={!!depositToDelete} 
        onOpenChange={(open) => {
          if (!open) setDepositToDelete(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the deposit record of 
              <strong> ₹{depositToDelete?.paidAmount?.toLocaleString()}</strong>.
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
        open={!!depositToEdit} 
        onOpenChange={(open) => {
          if (!open) setDepositToEdit(null);
        }}
      >
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Edit Deposit Entry</DialogTitle>
            <DialogDescription>
              Modify the details for this monthly contribution.
            </DialogDescription>
          </DialogHeader>
          {depositToEdit && (
            <form onSubmit={handleEditSubmit} className="space-y-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="amount" className="flex items-center gap-2">
                  <IndianRupee className="h-4 w-4" />
                  Amount (₹)
                </Label>
                <Input id="amount" name="amount" type="number" defaultValue={depositToEdit.paidAmount} required />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="date" className="flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  Payment Date
                </Label>
                <Input 
                  id="date" 
                  name="date" 
                  type="date" 
                  defaultValue={depositToEdit.paymentDate ? new Date(depositToEdit.paymentDate).toISOString().split('T')[0] : ''} 
                  required 
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="comment" className="flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  Comment
                </Label>
                <Textarea id="comment" name="comment" defaultValue={depositToEdit.comment} />
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setDepositToEdit(null)} disabled={isUpdating}>
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
