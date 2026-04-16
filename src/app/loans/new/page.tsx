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
  HandCoins,
  Info
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

export default function NewLoanPage() {
  const { toast } = useToast();
  const router = useRouter();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    toast({
      title: "Loan issued",
      description: "The loan has been successfully disbursed to the member.",
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
            <h1 className="text-3xl font-bold tracking-tight text-primary font-headline">Issue New Loan</h1>
            <p className="text-muted-foreground">Disburse funds to a member from the group pool.</p>
          </div>
        </header>

        <Card className="border-none shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <HandCoins className="h-5 w-5 text-accent" />
              Loan Disbursement Details
            </CardTitle>
            <CardDescription>Define terms for the new loan application.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid gap-4">
                <div className="grid gap-2">
                  <Label>Recipient Member</Label>
                  <Select required>
                    <SelectTrigger>
                      <SelectValue placeholder="Select member for loan" />
                    </SelectTrigger>
                    <SelectContent>
                      {MOCK_MEMBERS.map(m => (
                        <SelectItem key={m.id} value={m.id}>
                          {m.name} (Credit: {m.creditScore}/10)
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="amount">Loan Amount (₹)</Label>
                    <Input id="amount" type="number" placeholder="Enter amount" required />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="interest">Interest Rate (% p.m.)</Label>
                    <Input id="interest" type="number" defaultValue="2" step="0.5" required />
                  </div>
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="date">Disbursement Date</Label>
                  <Input id="date" type="date" defaultValue={new Date().toISOString().split('T')[0]} required />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="comment">Purpose of Loan</Label>
                  <Textarea id="comment" placeholder="Describe why the member needs the loan..." />
                </div>
              </div>

              <div className="p-4 rounded-lg bg-blue-50 border border-blue-100 flex gap-3 items-start">
                <Info className="h-5 w-5 text-primary mt-0.5 shrink-0" />
                <div className="text-sm text-blue-900">
                  <p className="font-semibold">Important Notes:</p>
                  <ul className="list-disc ml-4 mt-1 space-y-1">
                    <li>Interest will be calculated from the next billing cycle.</li>
                    <li>Ensure group approval before disbursing larger amounts.</li>
                  </ul>
                </div>
              </div>

              <div className="flex justify-end gap-3">
                <Button variant="outline" type="button" asChild>
                  <Link href="/">Cancel</Link>
                </Button>
                <Button type="submit" className="bg-primary hover:bg-primary/90">Approve & Disburse</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
