"use client"

import { Navbar } from "@/components/layout/Navbar";
import { MOCK_TRANSACTIONS } from "@/lib/mock-data";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Download, Filter, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import Link from "next/link";

export default function TransactionsPage() {
  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      
      <main className="flex-1 p-4 sm:p-8 max-w-7xl mx-auto w-full space-y-6">
        <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-primary font-headline">Transaction History</h1>
            <p className="text-muted-foreground">Track all deposits, loans, and repayments globally.</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline">
              <Download className="h-4 w-4 mr-2" />
              Report
            </Button>
            <Button asChild>
              <Link href="/transactions/new">
                <Plus className="h-4 w-4 mr-2" />
                New Entry
              </Link>
            </Button>
          </div>
        </header>

        <Card className="border-none shadow-sm overflow-hidden">
          <div className="p-4 border-b flex flex-col md:flex-row gap-4 items-center justify-between bg-white">
            <div className="relative w-full md:max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search by member, ID or type..." className="pl-10" />
            </div>
            <div className="flex items-center gap-2 w-full md:w-auto overflow-x-auto pb-2 md:pb-0">
              <Badge variant="outline" className="cursor-pointer hover:bg-muted py-1 px-3">All</Badge>
              <Badge variant="outline" className="cursor-pointer hover:bg-muted py-1 px-3">Deposits</Badge>
              <Badge variant="outline" className="cursor-pointer hover:bg-muted py-1 px-3">Loans</Badge>
              <Badge variant="outline" className="cursor-pointer hover:bg-muted py-1 px-3">Repayments</Badge>
              <Button variant="ghost" size="sm">
                <Filter className="h-4 w-4 mr-2" />
                More Filters
              </Button>
            </div>
          </div>
          
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead>Date</TableHead>
                <TableHead>Member</TableHead>
                <TableHead>Transaction Type</TableHead>
                <TableHead>Comment</TableHead>
                <TableHead className="text-right">Amount</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {MOCK_TRANSACTIONS.map((tx) => (
                <TableRow key={tx.id} className="hover:bg-muted/30">
                  <TableCell className="text-sm">{new Date(tx.date).toLocaleDateString()}</TableCell>
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="font-medium">{tx.memberName}</span>
                      <span className="text-[10px] font-mono text-muted-foreground">{tx.memberId}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={
                      tx.type === 'deposit' ? 'outline' : 
                      tx.type === 'loan' ? 'destructive' : 
                      'default'
                    } className="capitalize">
                      {tx.type.replace('_', ' ')}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm max-w-[200px] truncate italic text-muted-foreground">
                    {tx.comment}
                  </TableCell>
                  <TableCell className={cn(
                    "text-right font-bold tabular-nums",
                    tx.type === 'loan' ? 'text-destructive' : 'text-primary'
                  )}>
                    {tx.type === 'loan' ? '-' : '+'}₹{tx.amount.toLocaleString()}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      </main>
    </div>
  );
}

function cn(...classes: (string | boolean | undefined)[]) {
  return classes.filter(Boolean).join(' ');
}
