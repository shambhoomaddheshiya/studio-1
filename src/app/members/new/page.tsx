"use client"

import React from "react";
import { Navbar } from "@/components/layout/Navbar";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { 
  ArrowLeft, 
  UserPlus,
  ShieldCheck
} from "lucide-react";
import Link from "next/link";
import { useToast } from "@/hooks/use-toast";
import { useRouter } from "next/navigation";

export default function NewMemberPage() {
  const { toast } = useToast();
  const router = useRouter();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    toast({
      title: "Member added",
      description: "The new member has been successfully registered.",
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
                  <Label htmlFor="name">Full Name</Label>
                  <Input id="name" placeholder="Enter full name" required />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="mobile">Mobile Number</Label>
                  <Input id="mobile" placeholder="e.g. 9876543210" required />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="deposit">Initial Deposit Amount (₹)</Label>
                  <Input id="deposit" type="number" placeholder="0" defaultValue="500" />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="id">Custom ID (Optional)</Label>
                  <Input id="id" placeholder="FF-XXX" />
                </div>
              </div>

              <div className="p-4 rounded-lg bg-secondary/20 border border-secondary flex gap-3 items-start">
                <ShieldCheck className="h-5 w-5 text-primary mt-0.5 shrink-0" />
                <p className="text-sm text-secondary-foreground">
                  By adding this member, they will be eligible for loans and required to make monthly deposits according to group rules.
                </p>
              </div>

              <div className="flex justify-end gap-3">
                <Button variant="outline" type="button" asChild>
                  <Link href="/members">Cancel</Link>
                </Button>
                <Button type="submit">Create Member Profile</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
