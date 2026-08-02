
"use client"

import React, { useState } from "react";
import { Navbar } from "@/components/layout/Navbar";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { useFirestore, useCollection, useMemoFirebase } from "@/firebase";
import { collection } from "firebase/firestore";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

export default function ReportsPage() {
  const { toast } = useToast();
  const db = useFirestore();
  const [isGenerating, setIsGenerating] = useState(false);
  
  const [scope, setScope] = useState("all");
  const [selectedMemberId, setSelectedMemberId] = useState<string>("");
  const [period, setPeriod] = useState("monthly");
  const [selectedMonth, setSelectedMonth] = useState<string>(new Date().getMonth().toString());
  const [selectedYear, setSelectedYear] = useState<string>(new Date().getFullYear().toString());
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [type, setType] = useState("all");
  const [format, setFormat] = useState("pdf");
  
  const membersRef = useMemoFirebase(() => collection(db, 'members'), [db]);
  const { data: members } = useCollection(membersRef);

  const sortedMembers = React.useMemo(() => {
    if (!members) return [];
    return [...members].sort((a, b) => (a.name || "").localeCompare(b.name || ""));
  }, [members]);

  const transactionsRef = useMemoFirebase(() => collection(db, 'transactions'), [db]);
  const { data: allTransactions } = useCollection(transactionsRef);

  const loansRef = useMemoFirebase(() => collection(db, 'loans'), [db]);
  const { data: loans } = useCollection(loansRef);

  const handleGenerateReport = () => {
    if (!allTransactions || !loans) {
      toast({
        variant: "destructive",
        title: "No data available",
        description: "Records are still loading or do not exist.",
      });
      return;
    }

    setIsGenerating(true);
    
    setTimeout(() => {
      try {
        const monthStart = new Date(parseInt(selectedYear), parseInt(selectedMonth), 1);
        const monthEnd = new Date(parseInt(selectedYear), parseInt(selectedMonth) + 1, 0, 23, 59, 59);
        const reportEnd = period === "monthly" ? monthEnd : period === "yearly" ? new Date(parseInt(selectedYear), 11, 31, 23, 59, 59) : (endDate ? new Date(endDate) : new Date());

        const filtered = allTransactions.filter(tx => {
          if (scope === "specific" && selectedMemberId && tx.memberId !== selectedMemberId) return false;
          if (tx.transactionDate) {
            const txDate = new Date(tx.transactionDate);
            if (period === "monthly") {
              if (txDate.getMonth().toString() !== selectedMonth || txDate.getFullYear().toString() !== selectedYear) return false;
            } else if (period === "yearly") {
              if (txDate.getFullYear().toString() !== selectedYear) return false;
            } else if (period === "custom") {
              if (startDate && txDate < new Date(startDate)) return false;
              if (endDate && txDate > new Date(endDate)) return false;
            }
          }
          if (type === "deposits" && tx.transactionType !== 'Deposit') return false;
          if (type === "loans" && tx.transactionType !== 'LoanDisbursement') return false;
          return true;
        }).sort((a, b) => new Date(a.transactionDate || 0).getTime() - new Date(b.transactionDate || 0).getTime());

        // Historical accurate metrics
        let totalHistoricalLoans = 0;
        let totalHistoricalOutstanding = 0;
        const memberOutstandingMap: Record<string, { name: string, balance: number }> = {};

        loans.forEach(loan => {
          const lDate = new Date(loan.loanDate || 0);
          if (lDate <= reportEnd) {
            const isTarget = scope === 'all' || (scope === 'specific' && loan.memberId === selectedMemberId);
            if (!isTarget) return;

            totalHistoricalLoans += (loan.loanAmount || 0);

            // Calculate historical outstanding at reportEnd
            const repaymentsToDate = allTransactions.filter(tx => 
              tx.relatedEntityId === loan.id && 
              tx.transactionType === 'PrincipalRepayment' &&
              new Date(tx.transactionDate || 0) <= reportEnd
            ).reduce((acc, tx) => acc + (tx.amount || 0), 0);

            const balance = Math.max(0, (loan.loanAmount || 0) - repaymentsToDate);
            if (balance > 0) {
              totalHistoricalOutstanding += balance;
              const name = loan.isOutsiderLoan ? (loan.outsiderName || "Outsider") : (members?.find(m => m.id === loan.memberId)?.name || "Unknown");
              if (!memberOutstandingMap[loan.memberId || 'outsider']) {
                memberOutstandingMap[loan.memberId || 'outsider'] = { name, balance: 0 };
              }
              memberOutstandingMap[loan.memberId || 'outsider'].balance += balance;
            }
          }
        });

        if (format === 'pdf') {
          generatePDFReport(filtered, totalHistoricalLoans, totalHistoricalOutstanding, memberOutstandingMap, reportEnd);
        } else {
          generateCSVReport(filtered);
        }

        toast({ title: "Report Generated", description: `Report for ${filtered.length} transactions completed.` });
      } catch (error) {
        console.error("Report generation error:", error);
        toast({ variant: "destructive", title: "Generation Failed", description: "Unexpected error occurred." });
      } finally {
        setIsGenerating(false);
      }
    }, 800);
  };

  const generatePDFReport = (data: any[], totalLoans: number, outstanding: number, map: any, reportEnd: Date) => {
    const doc = new jsPDF();
    const monthName = period === 'monthly' ? new Date(0, parseInt(selectedMonth)).toLocaleString('default', { month: 'long' }) : '';
    const reportTitle = `Yuva Finance 2 - Group Report: ${monthName || 'Period'} ${selectedYear}`;

    doc.setFontSize(18);
    doc.text(reportTitle, 14, 20);

    const summary = data.reduce((acc, tx) => {
      const amt = tx.amount || 0;
      if (tx.transactionType === 'Deposit') acc.deposits += amt;
      if (tx.transactionType === 'InterestPayment') acc.interest += amt;
      if (tx.transactionType === 'FinePayment') acc.fines += amt;
      if (tx.transactionType === 'PrincipalRepayment') acc.principal += amt;
      return acc;
    }, { deposits: 0, interest: 0, fines: 0, principal: 0 });

    const accumulatedColl = allTransactions?.filter(tx => new Date(tx.transactionDate || 0) <= reportEnd && ['Deposit', 'InterestPayment', 'FinePayment'].includes(tx.transactionType))
      .reduce((acc, tx) => acc + (tx.amount || 0), 0) || 0;

    const netPos = accumulatedColl - outstanding;

    const summaryRows = [
      [`Period Deposits`, `Rs. ${summary.deposits.toLocaleString('en-IN')}`],
      [`Period Loans Issued (Source of Truth)`, `Rs. ${data.filter(tx => tx.transactionType === 'LoanDisbursement').reduce((acc, tx) => acc + (tx.amount || 0), 0).toLocaleString('en-IN')}`],
      [`Period Principal Recovered`, `Rs. ${summary.principal.toLocaleString('en-IN')}`],
      [`Total Accumulated Collections`, `Rs. ${accumulatedColl.toLocaleString('en-IN')}`],
      [`Total Outstanding Principal (as of ${reportEnd.toLocaleDateString()})`, `Rs. ${outstanding.toLocaleString('en-IN')}`],
      [`Net Capital Position (Closing Balance)`, `Rs. ${netPos.toLocaleString('en-IN')}`]
    ];

    autoTable(doc, {
      startY: 30,
      head: [['Summary Metric', 'Amount (INR)']],
      body: summaryRows,
      theme: 'striped',
      headStyles: { fillColor: [21, 101, 192] },
      columnStyles: { 1: { halign: 'right' } }
    });

    const tableData = data.map(tx => [
      tx.memberName || 'N/A',
      new Date(tx.transactionDate || 0).toLocaleDateString(),
      tx.transactionType.replace(/([A-Z])/g, ' $1').trim(),
      tx.comment || '-',
      `Rs. ${tx.amount.toLocaleString('en-IN')}`
    ]);

    autoTable(doc, {
      startY: (doc as any).lastAutoTable.finalY + 15,
      head: [['Member', 'Date', 'Type', 'Description', 'Amount']],
      body: tableData,
      theme: 'grid',
      headStyles: { fillColor: [46, 125, 50] },
      columnStyles: { 4: { halign: 'right' } }
    });

    doc.save(`Report_${new Date().toISOString().split('T')[0]}.pdf`);
  };

  const generateCSVReport = (data: any[]) => {
    const csvContent = ["Date,Member,Type,Amount,Comment", ...data.map(tx => `${new Date(tx.transactionDate || 0).toLocaleDateString()},${tx.memberName},${tx.transactionType},${tx.amount},"${tx.comment || ''}"`)].join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `Report_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <Navbar />
      <main className="flex-1 p-4 sm:p-8 max-w-4xl mx-auto w-full space-y-6">
        <h1 className="text-4xl font-bold tracking-tight text-[#1e293b]">Export Reports</h1>
        <Card className="border border-slate-200 shadow-sm rounded-xl">
          <CardHeader>
            <CardTitle>Configure Export</CardTitle>
            <CardDescription>Select filters for the transaction data export.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-8">
            <div className="space-y-3">
              <Label>Scope</Label>
              <RadioGroup value={scope} onValueChange={setScope} className="flex flex-col space-y-2">
                <div className="flex items-center space-x-2"><RadioGroupItem value="all" id="r1" /><Label htmlFor="r1">All Members</Label></div>
                <div className="flex items-center space-x-2"><RadioGroupItem value="specific" id="r2" /><Label htmlFor="r2">Specific Member</Label></div>
              </RadioGroup>
              {scope === "specific" && (
                <Select value={selectedMemberId} onValueChange={setSelectedMemberId}>
                  <SelectTrigger className="w-full mt-2"><SelectValue placeholder="Select member" /></SelectTrigger>
                  <SelectContent>{sortedMembers.map(m => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}</SelectContent>
                </Select>
              )}
            </div>
            <div className="space-y-3">
              <Label>Period</Label>
              <RadioGroup value={period} onValueChange={setPeriod} className="flex flex-col space-y-2">
                <div className="flex items-center space-x-2"><RadioGroupItem value="monthly" id="p1" /><Label htmlFor="p1">Monthly</Label></div>
                <div className="flex items-center space-x-2"><RadioGroupItem value="yearly" id="p2" /><Label htmlFor="p2">Yearly</Label></div>
              </RadioGroup>
              {period === "monthly" && (
                <div className="flex gap-2 mt-2">
                  <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                    <SelectTrigger className="flex-1"><SelectValue /></SelectTrigger>
                    <SelectContent>{months.map(m => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}</SelectContent>
                  </Select>
                  <Input type="number" value={selectedYear} onChange={e => setSelectedYear(e.target.value)} className="w-24" />
                </div>
              )}
            </div>
            <Button onClick={handleGenerateReport} disabled={isGenerating} className="w-full bg-[#3f51b5]">
              {isGenerating ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Generating...</> : 'Download Report'}
            </Button>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
