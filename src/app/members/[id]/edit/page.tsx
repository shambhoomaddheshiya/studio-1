"use client"

import React, { useState, useEffect } from "react";
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
  Fingerprint,
  Save
} from "lucide-react";
import Link from "next/link";
import { useToast } from "@/hooks/use-toast";
import { useRouter, useParams } from "next/navigation";
import { useFirestore, useDoc, useMemoFirebase } from "@/firebase";
import { doc } from "firebase/firestore";
import { updateDocumentNonBlocking } from "@/firebase/non-blocking-updates";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export default function EditMemberPage() {
  const { toast } = useToast();
  const router = useRouter();
  const params = useParams();
  const id = params?.id as string;
  const db = useFirestore();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const memberRef = useMemoFirebase(() => {
    if (!db || !id) return null;
    return doc(db, "members", id);
  }, [db, id]);

  const { data: member, isLoading: memberLoading } = useDoc(memberRef);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!member) return;
    
    setIsSubmitting(true);

    const formData = new FormData(e.currentTarget);
    const name = formData.get('name') as string;
    const mobile = formData.get('mobile') as string;
    const status = formData.get('status') as string;
    const creditRating = Number(formData.get('creditRating'));

    const timestamp = new Date().toISOString();

    if (memberRef) {
      updateDocumentNonBlocking(memberRef, {
        name,
        mobileNumber: mobile,
        status,
        creditRating,
        updatedAt: timestamp,
      });

      toast({
        title: "Profile updated",
        description: `${name}'s profile has been successfully updated.`,
      });
      router.push("/members");
    } else {
      setIsSubmitting(false);
    }
  }

  if (memberLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!member && !memberLoading) {
    return (
      <div className="min-h-screen flex flex-col">
        <Navbar />
        <main className="flex-1 flex flex-col items-center justify-center p-8 text-center">
          <h2 className="text-2xl font-bold">Member Not Found</h2>
          <Button className="mt-4" asChild>
            <Link href="/members">Back to Directory</Link>
          </Button>
        </main>
      </div>
    );
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
            <h1 className="text-3xl font-bold tracking-tight text-primary font-headline">Edit Member Profile</h1>
            <p className="text-muted-foreground">Modify details for {member?.name}.</p>
          </div>
        </header>

        <Card className="border-none shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserPlus className="h-5 w-5 text-accent" />
              Member Profile Details
            </CardTitle>
            <CardDescription>Update the personal and financial details below.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid gap-4">
                <div className="grid gap-2">
                  <Label className="flex items-center gap-2 opacity-70">
                    <Fingerprint className="h-4 w-4" />
                    Member ID
                  </Label>
                  <Input value={member?.id} disabled className="bg-muted font-mono" />
                  <p className="text-[10px] text-muted-foreground">Unique identifier cannot be changed.</p>
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="name">Full Name</Label>
                  <Input id="name" name="name" defaultValue={member?.name} placeholder="Enter full name" required />
                </div>
                
                <div className="grid gap-2">
                  <Label htmlFor="mobile">Mobile Number</Label>
                  <Input id="mobile" name="mobile" defaultValue={member?.mobileNumber} placeholder="e.g. 9876543210" required />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="status">Status</Label>
                    <Select name="status" defaultValue={member?.status}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Active">Active</SelectItem>
                        <SelectItem value="Inactive">Inactive</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="creditRating">Credit Rating (1-10)</Label>
                    <Input id="creditRating" name="creditRating" type="number" min="1" max="10" defaultValue={member?.creditRating || 7} required />
                  </div>
                </div>
              </div>

              <div className="p-4 rounded-lg bg-secondary/20 border border-secondary flex gap-3 items-start">
                <ShieldCheck className="h-5 w-5 text-primary mt-0.5 shrink-0" />
                <p className="text-sm text-secondary-foreground">
                  Updates to status or credit rating may affect the member's eligibility for future loans.
                </p>
              </div>

              <div className="flex justify-end gap-3">
                <Button variant="outline" type="button" asChild disabled={isSubmitting}>
                  <Link href="/members">Cancel</Link>
                </Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? (
                    <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...</>
                  ) : (
                    <>
                      <Save className="mr-2 h-4 w-4" />
                      Save Changes
                    </>
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
