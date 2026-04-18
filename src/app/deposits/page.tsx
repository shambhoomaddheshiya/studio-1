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
import { Plus, Loader2, Calendar } from "lucide-react";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { useFirestore, useCollection, useMemoFirebase, useUser } from "@/firebase";
import { collection, query, orderBy } from "firebase/firestore";

export default function DepositsPage() {
  const db = useFirestore();
  const { user, isUserLoading } = useUser();
  
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
            <h1 className="text-3xl font-bold tracking-tight text-primary font-headline">Monthly Deposits</h1>
            <p className="text-muted-foreground">View and track all member contributions.</p>
          </div>
          <Button asChild>
            <Link href="/deposits/new">
              <Plus className="h-4 w-4 mr-2" />
              Record Deposit
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
                      </TableRow>
                    );
                  })}
                  {(!deposits || deposits.length === 0) && !isLoading && (
                    <TableRow>
                      <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
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
    </div>
  );
}
