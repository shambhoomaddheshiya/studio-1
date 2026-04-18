"use client"

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
import { Plus, Loader2 } from "lucide-react";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { useFirestore, useCollection, useMemoFirebase, useUser } from "@/firebase";
import { collection, query, orderBy } from "firebase/firestore";

export default function LoansPage() {
  const db = useFirestore();
  const { user, isUserLoading } = useUser();
  
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
            <h1 className="text-3xl font-bold tracking-tight text-primary font-headline">Active Loans</h1>
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
                    <TableHead>Disbursement Date</TableHead>
                    <TableHead>Recipient</TableHead>
                    <TableHead>Principal</TableHead>
                    <TableHead>Interest Rate</TableHead>
                    <TableHead className="text-right">Outstanding</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loans?.map((loan) => {
                    const member = members?.find(m => m.id === loan.memberId);
                    return (
                      <TableRow key={loan.id} className="hover:bg-muted/30 transition-colors">
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
                        <TableCell className="text-right font-bold text-destructive">
                          ₹{(loan.outstandingPrincipal + (loan.outstandingInterest || 0)).toLocaleString()}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {(!loans || loans.length === 0) && !isLoading && (
                    <TableRow>
                      <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
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
    </div>
  );
}
