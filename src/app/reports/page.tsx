
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

const months = [
  { value: "0", label: "January" },
  { value: "1", label: "February" },
  { value: "2", label: "March" },
  { value: "3", label: "April" },
  { value: "4", label: "May" },
  { value: "5", label: "June" },
  { value: "6", label: "July" },
  { value: "7", label: "August" },
  { value: "8", label: "September" },
  { value: "9", label: "October" },
  { value: "10", label: "November" },
  { value: "11", label: "December" },
];

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
        const reportEnd = period === "monthly" 
          ? new Date(parseInt(selectedYear), parseInt(selectedMonth) + 1, 0, 23, 59, 59)
          : period === "yearly" 
            ? new Date(parseInt(selectedYear), 11, 31, 23, 59, 59) 
            : (endDate ? new Date(endDate) : new Date());

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

        // Global Aggregates up to reportEnd (Source of Truth)
        const globalMetrics = allTransactions.reduce((acc, tx) => {
          if (!tx.transactionDate || new Date(tx.transactionDate) > reportEnd) return acc;
          const amt = tx.amount || 0;
          if (tx.transactionType === 'Deposit') acc.deposits += amt;
          if (tx.transactionType === 'InterestPayment') acc.interest += amt;
          if (tx.transactionType === 'FinePayment') acc.fines += amt;
          if (tx.transactionType === 'GeneralExpense') acc.expenses += amt;
          return acc;
        }, { deposits: 0, interest: 0, fines: 0, expenses: 0 });

        const globalOutstanding = loans.reduce((acc, loan) => {
          const lDate = new Date(loan.loanDate || 0);
          if (lDate > reportEnd) return acc;
          
          // Historical principal recovery
          const principalRepaid = allTransactions
            .filter(tx => 
              tx.relatedEntityId === loan.id && 
              tx.transactionType === 'PrincipalRepayment' &&
              new Date(tx.transactionDate || 0) <= reportEnd
            )
            .reduce((total, tx) => total + (tx.amount || 0), 0);

          const balance = Math.max(0, (loan.loanAmount || 0) - principalRepaid);
          return acc + balance;
        }, 0);

        const totalLoansDisbursed = loans.reduce((acc, loan) => {
          const lDate = new Date(loan.loanDate || 0);
          if (lDate <= reportEnd) return acc + (loan.loanAmount || 0);
          return acc;
        }, 0);

        const netPosition = (globalMetrics.deposits + globalMetrics.interest + globalMetrics.fines) - globalOutstanding - globalMetrics.expenses;

        if (format === 'pdf') {
          generatePDFReport(filtered, totalLoansDisbursed, globalOutstanding, globalMetrics, netPosition, reportEnd);
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

  const generatePDFReport = (data: any[], totalLoans: number, outstanding: number, metrics: any, netPos: number, reportEnd: Date) => {
    const doc = new jsPDF();
    const monthName = period === 'monthly' ? months.find(m => m.value === selectedMonth)?.label : '';
    const reportTitle = `Yuva Finance 2 - Group Report: ${monthName || 'Period'} ${selectedYear}`;

    doc.setFontSize(16);
    doc.text(reportTitle, 14, 20);

    const summaryRows = [
      [`Total Collected Deposits`, `Rs. ${metrics.deposits.toLocaleString('en-IN')}`],
      [`Total Interest Earned`, `Rs. ${metrics.interest.toLocaleString('en-IN')}`],
      [`Total Fines Collected`, `Rs. ${metrics.fines.toLocaleString('en-IN')}`],
      [`Total Loans Disbursed (Registry)`, `Rs. ${totalLoans.toLocaleString('en-IN')}`],
      [`Total Outstanding Principal`, `Rs. ${outstanding.toLocaleString('en-IN')}`],
      [`Total Accumulated Expenses`, `Rs. ${metrics.expenses.toLocaleString('en-IN')}`],
      [`Net Capital Position (Remaining Fund)`, `Rs. ${netPos.toLocaleString('en-IN')}`]
    ];

    autoTable(doc, {
      startY: 30,
      head: [['Global Summary Metric', 'Amount (INR)']],
      body: summaryRows,
      theme: 'striped',
      headStyles: { fillColor: [26, 31, 54] },
      columnStyles: { 1: { halign: 'right', fontStyle: 'bold' } }
    });

    doc.setFontSize(12);
    doc.text("Period Transaction Activity:", 14, (doc as any).lastAutoTable.finalY + 15);

    const tableData = data.map(tx => [
      new Date(tx.transactionDate || 0).toLocaleDateString(),
      tx.memberName || 'N/A',
      tx.transactionType.replace(/([A-Z])/g, ' $1').trim(),
      tx.comment || '-',
      `Rs. ${tx.amount.toLocaleString('en-IN')}`
    ]);

    autoTable(doc, {
      startY: (doc as any).lastAutoTable.finalY + 20,
      head: [['Date', 'Member', 'Type', 'Description', 'Amount']],
      body: tableData,
      theme: 'grid',
      headStyles: { fillColor: [63, 81, 181] },
      columnStyles: { 4: { halign: 'right' } }
    });

    doc.save(`Financial_Report_${new Date().toISOString().split('T')[0]}.pdf`);
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
        <h1 className="text-4xl font-bold tracking-tight text-[#1a1f36]">Export Reports</h1>
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
                    <SelectContent>
                      {months.map(m => (
                        <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                      ))}
                    </SelectContent>
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
