"use client"

import React from "react";
import { Navbar } from "@/components/layout/Navbar";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { 
  ArrowLeft, 
  Wallet,
  Sparkles
} from "lucide-react";
import Link from "next/link";
import { useToast } from "@/hooks/use-toast";
import { useRouter } from "next/navigation";
import { MOCK_MEMBERS } from "@/lib/mock-data";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";

export default function NewDepositPage() {
  const { toast } = useToast();
  const router = useRouter();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    toast({
      title: "Deposit recorded",
      description: "The monthly deposit has been added to the member's account.",
    });
    router.push("/transactions");
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      
      <main className="flex-1 p-4 sm:p-8 max-w-2xl mx-auto w-full space-y-6">
        <header className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/"><ArrowLeft className="h-5 w-5" /></Link>
          </Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-primary font-headline">Record Deposit</h1>
            <p className="text-muted-foreground">Log a member's monthly contribution or fine payment.</p>
          </div>
        </header>

        <Card className="border-none shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Wallet className="h-5 w-5 text-accent" />
              Transaction Details
            </CardTitle>
            <CardDescription>Select a member and enter the deposit amount.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid gap-4">
                <div className="grid gap-2">
                  <Label>Member</Label>
                  <Select required>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a member" />
                    </SelectTrigger>
                    <SelectContent>
                      {MOCK_MEMBERS.map(m => (
                        <SelectItem key={m.id} value={m.id}>
                          {m.name} ({m.id})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="type">Type</Label>
                    <Select defaultValue="deposit">
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="deposit">Monthly Deposit</SelectItem>
                        <SelectItem value="fine_payment">Fine Payment</SelectItem>
                        <SelectItem value="interest_payment">Interest Payment</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="amount">Amount (₹)</Label>
                    <Input id="amount" type="number" placeholder="500" required />
                  </div>
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="date">Date</Label>
                  <Input id="date" type="date" defaultValue={new Date().toISOString().split('T')[0]} required />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="comment">Comment</Label>
                  <div className="relative">
                    <Textarea id="comment" placeholder="e.g. Contribution for March 2024" className="pr-10" />
                    <Button type="button" variant="ghost" size="icon" className="absolute right-2 top-2 h-8 w-8 text-accent">
                      <Sparkles className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-3">
                <Button variant="outline" type="button" asChild>
                  <Link href="/">Cancel</Link>
                </Button>
                <Button type="submit">Record Transaction</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
