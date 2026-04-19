"use client"

import React, { useState } from "react";
import { Navbar } from "@/components/layout/Navbar";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { 
  ArrowLeft, 
  UserPlus,
  ShieldCheck,
  Loader2,
  Fingerprint
} from "lucide-react";
import Link from "next/link";
import { useToast } from "@/hooks/use-toast";
import { useRouter } from "next/navigation";
import { useFirestore } from "@/firebase";
import { collection, doc } from "firebase/firestore";
import { setDocumentNonBlocking } from "@/firebase/non-blocking-updates";

export default function NewMemberPage() {
  const { toast } = useToast();
  const router = useRouter();
  const db = useFirestore();
  const [isSubmitting, setIsSubmitting] = useState(false);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setIsSubmitting(true);

    const formData = new FormData(e.currentTarget);
    const name = formData.get('name') as string;
    const mobile = formData.get('mobile') as string;
    const initialDeposit = Number(formData.get('deposit'));
    const customId = (formData.get('id') as string)?.trim();

    // Determine the final document reference
    const membersCollection = collection(db, "members");
    const finalRef = customId 
      ? doc(db, "members", customId) 
      : doc(membersCollection);
    
    const memberId = finalRef.id;
    const timestamp = new Date().toISOString();

    setDocumentNonBlocking(finalRef, {
      id: memberId,
      name,
      mobileNumber: mobile || "",
      status: 'Active',
      creditRating: 7, // Default initial rating
      createdAt: timestamp,
      updatedAt: timestamp,
    }, { merge: true });

    // If initial deposit is provided, record it as a transaction
    if (initialDeposit > 0) {
      const txRef = doc(collection(db, "transactions"));
      setDocumentNonBlocking(txRef, {
        id: txRef.id,
        transactionDate: timestamp,
        transactionType: 'Deposit',
        amount: initialDeposit,
        memberId: memberId,
        memberName: name,
        fundCategory: 'PrincipalFund',
        balanceImpact: 'Credit',
        comment: 'Initial membership deposit',
        createdAt: timestamp,
        updatedAt: timestamp,
      }, { merge: true });
    }

    toast({
      title: "Member added",
      description: `${name} has been successfully registered with ID: ${memberId}.`,
    });
    router.push("/members");
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      
      <main className="flex-1 p-4 sm:p-8 max-w-2xl mx-auto w-full space-y-6">
        <header className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/members"><ArrowLeft className="h-5 w-5" /></Link>
          </Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-primary font-headline">Add New Member</h1>
            <p className="text-muted-foreground">Register a new person to the finance group.</p>
          </div>
        </header>

        <Card className="border-none shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserPlus className="h-5 w-5 text-accent" />
              Member Profile Details
            </CardTitle>
            <CardDescription>Enter the personal and financial details of the new member.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="id" className="flex items-center gap-2">
                    <Fingerprint className="h-4 w-4 text-muted-foreground" />
                    Member ID (Optional)
                  </Label>
                  <Input id="id" name="id" placeholder="e.g. FF-101 (Leave blank for auto-generated)" />
                  <p className="text-[10px] text-muted-foreground">If provided, this will be the unique identifier for the member across the system.</p>
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="name">Full Name</Label>
                  <Input id="name" name="name" placeholder="Enter full name" required />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="mobile">Mobile Number (Optional)</Label>
                  <Input id="mobile" name="mobile" placeholder="e.g. 9876543210" />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="deposit">Initial Deposit Amount (₹)</Label>
                  <Input id="deposit" name="deposit" type="number" placeholder="0" defaultValue="1000" />
                </div>
              </div>

              <div className="p-4 rounded-lg bg-secondary/20 border border-secondary flex gap-3 items-start">
                <ShieldCheck className="h-5 w-5 text-primary mt-0.5 shrink-0" />
                <p className="text-sm text-secondary-foreground">
                  By adding this member, they will be eligible for loans and required to make monthly deposits according to group rules.
                </p>
              </div>

              <div className="flex justify-end gap-3">
                <Button variant="outline" type="button" asChild disabled={isSubmitting}>
                  <Link href="/members">Cancel</Link>
                </Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? (
                    <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Creating...</>
                  ) : (
                    'Create Member Profile'
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
