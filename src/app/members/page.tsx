
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
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Search, 
  UserPlus, 
  Filter, 
  MoreHorizontal, 
  Loader2, 
  Trash2, 
  Edit, 
  UserX, 
  UserCheck,
  HandCoins
} from "lucide-react";
import Link from "next/link";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";
import { Card } from "@/components/ui/card";
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
import { useFirestore, useCollection, useMemoFirebase, useUser } from "@/firebase";
import { collection, doc, query, where, getDocs } from "firebase/firestore";
import { deleteDocumentNonBlocking, updateDocumentNonBlocking } from "@/firebase/non-blocking-updates";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

export default function MembersPage() {
  const db = useFirestore();
  const { user, isUserLoading } = useUser();
  const { toast } = useToast();
  const [memberToDelete, setMemberToDelete] = useState<any | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  
  const membersRef = useMemoFirebase(() => {
    if (!db || !user) return null;
    return collection(db, 'members');
  }, [db, user]);

  const { data: rawMembers, isLoading } = useCollection(membersRef);

  const depositEntriesRef = useMemoFirebase(() => {
    if (!db || !user) return null;
    return collection(db, 'depositEntries');
  }, [db, user]);

  const { data: allDeposits } = useCollection(depositEntriesRef);

  const loansRef = useMemoFirebase(() => {
    if (!db || !user) return null;
    return collection(db, 'loans');
  }, [db, user]);

  const { data: allLoans } = useCollection(loansRef);

  const calculateDynamicScore = (member: any) => {
    if (!member) return 10;
    
    const now = new Date();
    const joinedDate = new Date(member.createdAt);
    let missedCount = 0;
    
    for (let i = 1; i <= 6; i++) {
      const checkDate = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const m = checkDate.getMonth() + 1;
      const y = checkDate.getFullYear();
      
      const joinedMonthStart = new Date(joinedDate.getFullYear(), joinedDate.getMonth(), 1);
      if (checkDate < joinedMonthStart) continue;

      const isPaid = allDeposits?.some(entry => 
        entry.memberId === member.id &&
        entry.month === m && 
        entry.year === y && 
        entry.status === 'Paid'
      );

      if (!isPaid) {
        missedCount++;
      }
    }

    if (missedCount === 0) return 10;
    if (missedCount === 1) return 9;
    if (missedCount === 2) return 7;
    if (missedCount >= 3) return 5;
    return 10;
  };

  const getMemberOutstandingLoan = (memberId: string) => {
    if (!allLoans) return 0;
    return allLoans
      .filter(l => l.memberId === memberId && l.status === 'Active')
      .reduce((acc, l) => acc + (l.outstandingPrincipal || 0) + (l.outstandingInterest || 0), 0);
  };

  const members = React.useMemo(() => {
    if (!rawMembers) return [];
    
    let filtered = rawMembers;
    if (searchTerm) {
      const lowerSearch = searchTerm.toLowerCase();
      filtered = rawMembers.filter(m => 
        m.name?.toLowerCase().includes(lowerSearch) || 
        m.id?.toLowerCase().includes(lowerSearch) ||
        m.mobileNumber?.includes(lowerSearch)
      );
    }
    
    return [...filtered].sort((a, b) => (a.name || "").localeCompare(b.name || ""));
  }, [rawMembers, searchTerm]);

  // CRITICAL: Cascade Deletion Logic - Purge all member-related data to prevent "stale" records in reports
  const handleDelete = async () => {
    if (memberToDelete && db) {
      const memberId = memberToDelete.id;
      
      // 1. Delete Member Record
      deleteDocumentNonBlocking(doc(db, 'members', memberId));

      try {
        // 2. Cleanup Transactions
        const txCol = collection(db, 'transactions');
        const qTx = query(txCol, where('memberId', '==', memberId));
        const snapshotTx = await getDocs(qTx);
        snapshotTx.forEach((docSnap) => {
          deleteDocumentNonBlocking(docSnap.ref);
        });

        // 3. Cleanup Loans
        const loansCol = collection(db, 'loans');
        const qLoans = query(loansCol, where('memberId', '==', memberId));
        const snapshotLoans = await getDocs(qLoans);
        snapshotLoans.forEach((docSnap) => {
          deleteDocumentNonBlocking(docSnap.ref);
        });

        // 4. Cleanup Deposit Entries
        const depositsCol = collection(db, 'depositEntries');
        const qDeposits = query(depositsCol, where('memberId', '==', memberId));
        const snapshotDeposits = await getDocs(qDeposits);
        snapshotDeposits.forEach((docSnap) => {
          deleteDocumentNonBlocking(docSnap.ref);
        });
      } catch (e) {
        console.error("Member deep cleanup failed:", e);
      }

      toast({
        title: "Member Purged",
        description: `${memberToDelete.name} and all their history have been removed from the database.`,
      });
      setMemberToDelete(null);
    }
  };

  const handleToggleStatus = (member: any) => {
    const newStatus = member.status === 'Active' ? 'Inactive' : 'Active';
    const mRef = doc(db, 'members', member.id);
    updateDocumentNonBlocking(mRef, { 
      status: newStatus,
      updatedAt: new Date().toISOString()
    });
    toast({
      title: `Member ${newStatus === 'Active' ? 'Activated' : 'Deactivated'}`,
      description: `${member.name} is now ${newStatus.toLowerCase()}.`,
    });
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
            <h1 className="text-3xl font-bold tracking-tight text-primary font-headline">Member Directory</h1>
            <p className="text-muted-foreground">Manage and view profiles for all group members.</p>
          </div>
          <Button asChild>
            <Link href="/members/new">
              <UserPlus className="h-4 w-4 mr-2" />
              Add Member
            </Link>
          </Button>
        </header>

        <Card className="border-none shadow-sm overflow-hidden">
          <div className="p-4 border-b flex flex-col sm:flex-row gap-4 items-center justify-between bg-white">
            <div className="relative w-full sm:max-w-xs">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input 
                placeholder="Search name, ID or mobile..." 
                className="pl-10" 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <Button variant="outline" size="sm" className="flex-1 sm:flex-none">
                <Filter className="h-4 w-4 mr-2" />
                Filter
              </Button>
              <Button variant="outline" size="sm" className="flex-1 sm:flex-none">
                Export CSV
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
                    <TableHead>Member ID</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Contact</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Active Loan</TableHead>
                    <TableHead className="text-right">Credit Rating</TableHead>
                    <TableHead className="w-[80px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {members.map((member) => {
                    const dynamicScore = calculateDynamicScore(member);
                    const outstandingLoan = getMemberOutstandingLoan(member.id);
                    return (
                      <TableRow key={member.id} className="hover:bg-muted/30 transition-colors">
                        <TableCell className="font-mono text-xs font-bold text-primary">
                          {member.id}
                        </TableCell>
                        <TableCell className="font-medium">
                          <Link href={`/members/${member.id}`} className="hover:text-accent transition-colors">
                            {member.name}
                          </Link>
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm">{member.mobileNumber}</TableCell>
                        <TableCell>
                          <Badge variant={member.status === 'Active' ? 'default' : 'secondary'} className={member.status === 'Active' ? 'bg-green-100 text-green-700 hover:bg-green-100' : ''}>
                            {member.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {outstandingLoan > 0 ? (
                            <div className="flex items-center gap-1.5 font-bold text-destructive">
                              <HandCoins className="h-3.5 w-3.5" />
                              ₹{outstandingLoan.toLocaleString()}
                            </div>
                          ) : (
                            <span className="text-muted-foreground text-xs">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          <div className="flex flex-col items-end">
                            <span className={cn(
                              "font-bold",
                              dynamicScore >= 9 ? "text-green-600" : dynamicScore >= 7 ? "text-orange-500" : "text-destructive"
                            )}>
                              {dynamicScore} / 10
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem asChild>
                                <Link href={`/members/${member.id}`}>View Passbook</Link>
                              </DropdownMenuItem>
                              <DropdownMenuItem asChild>
                                <Link href={`/members/${member.id}/edit`} className="flex items-center gap-2">
                                  <Edit className="h-4 w-4" />
                                  Edit Profile
                                </Link>
                              </DropdownMenuItem>
                              <DropdownMenuItem 
                                onSelect={() => {
                                  setTimeout(() => handleToggleStatus(member), 0);
                                }}
                                className="flex items-center gap-2"
                              >
                                {member.status === 'Active' ? (
                                  <>
                                    <UserX className="h-4 w-4" />
                                    Deactivate Member
                                  </>
                                ) : (
                                  <>
                                    <UserCheck className="h-4 w-4" />
                                    Activate Member
                                  </>
                                )}
                              </DropdownMenuItem>
                              <DropdownMenuItem 
                                className="text-destructive focus:text-destructive flex items-center gap-2" 
                                onSelect={() => {
                                  setTimeout(() => setMemberToDelete(member), 0);
                                }}
                              >
                                <Trash2 className="h-4 w-4" />
                                Delete Member
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {(members.length === 0) && (
                    <TableRow>
                      <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                        {searchTerm ? "No members match your search." : "No members found. Add your first member to get started."}
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
        open={!!memberToDelete} 
        onOpenChange={(open) => {
          if (!open) setMemberToDelete(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete <strong>{memberToDelete?.name}</strong> and remove all their transaction and loan history.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete Everything
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
