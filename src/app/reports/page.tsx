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
        let reportStart: Date;
        let reportEnd: Date;

        if (period === "monthly") {
          reportStart = new Date(parseInt(selectedYear), parseInt(selectedMonth), 1, 0, 0, 0);
          reportEnd = new Date(parseInt(selectedYear), parseInt(selectedMonth) + 1, 0, 23, 59, 59);
        } else if (period === "yearly") {
          reportStart = new Date(parseInt(selectedYear), 0, 1, 0, 0, 0);
          reportEnd = new Date(parseInt(selectedYear), 11, 31, 23, 59, 59);
        } else {
          reportStart = startDate ? new Date(startDate) : new Date(0);
          reportEnd = endDate ? new Date(endDate) : new Date();
        }

        const prevMonthEnd = new Date(reportStart.getTime() - 1);
        const prevMonthLabel = months[prevMonthEnd.getMonth()].label;
        const prevMonthYear = prevMonthEnd.getFullYear();

        // Transaction filtering for the detailed log
        const filtered = allTransactions.filter(tx => {
          if (scope === "specific" && selectedMemberId && tx.memberId !== selectedMemberId) return false;
          if (!tx.transactionDate) return false;
          const txDate = new Date(tx.transactionDate);
          if (txDate < reportStart || txDate > reportEnd) return false;
          
          if (type !== 'all') {
            if (type === "deposits" && tx.transactionType !== 'Deposit') return false;
            if (type === "loans" && tx.transactionType !== 'LoanDisbursement') return false;
          }
          return true;
        }).sort((a, b) => new Date(a.transactionDate || 0).getTime() - new Date(b.transactionDate || 0).getTime());

        // Calculation Helpers for Net Capital Position Reconcilliation (Matching Dashboard Logic)
        const calcNetPosition = (date: Date) => {
          const collections = allTransactions.reduce((acc, tx) => {
            if (!tx.transactionDate || new Date(tx.transactionDate) > date) return acc;
            const amt = tx.amount || 0;
            const type = tx.transactionType;
            // Total Capital = Deposits + Interest + Fines - Expenses
            if (['Deposit', 'InterestPayment', 'FinePayment'].includes(type)) return acc + amt;
            if (type === 'GeneralExpense') return acc - amt;
            return acc;
          }, 0);

          const outstandingAtDate = loans.reduce((acc, loan) => {
            if (!loan.loanDate) return acc;
            const lDate = new Date(loan.loanDate);
            if (lDate > date) return acc;
            
            // Subtract principal repaid up to this date
            const repaid = allTransactions
              .filter(tx => 
                tx.relatedEntityId === loan.id && 
                tx.transactionType === 'PrincipalRepayment' &&
                new Date(tx.transactionDate || 0) <= date
              )
              .reduce((total, tx) => total + (tx.amount || 0), 0);
            
            return acc + Math.max(0, (loan.loanAmount || 0) - repaid);
          }, 0);

          return collections - outstandingAtDate;
        };

        const openingBalance = calcNetPosition(prevMonthEnd);
        const closingBalance = calcNetPosition(reportEnd);

        const periodMetrics = filtered.reduce((acc, tx) => {
          const amt = tx.amount || 0;
          const t = tx.transactionType;
          if (t === 'Deposit') acc.deposits += amt;
          // Note: Loans are calculated from registry below
          else if (t === 'PrincipalRepayment') acc.principal += amt;
          else if (t === 'InterestPayment') acc.interest += amt;
          else if (t === 'FinePayment') acc.fines += amt;
          else if (t === 'GeneralExpense') acc.expenses += amt;
          return acc;
        }, { deposits: 0, loans: 0, principal: 0, interest: 0, fines: 0, expenses: 0 });

        // Calculate period loans from registry for consistency with dashboard
        const periodLoansFromRegistry = loans.reduce((acc, loan) => {
          if (!loan.loanDate) return acc;
          const lDate = new Date(loan.loanDate);
          if (lDate >= reportStart && lDate <= reportEnd) {
            return acc + (loan.loanAmount || 0);
          }
          return acc;
        }, 0);
        periodMetrics.loans = periodLoansFromRegistry;

        const periodNetBalance = (periodMetrics.deposits + periodMetrics.interest + periodMetrics.principal + periodMetrics.fines) - (periodMetrics.loans + periodMetrics.expenses);

        const accumulatedDeposits = allTransactions.reduce((acc, tx) => {
          if (!tx.transactionDate || new Date(tx.transactionDate) > reportEnd || tx.transactionType !== 'Deposit') return acc;
          return acc + (tx.amount || 0);
        }, 0);

        const accumulatedOutstanding = loans.reduce((acc, loan) => {
          const lDate = new Date(loan.loanDate || 0);
          if (lDate > reportEnd) return acc;
          
          const repaid = allTransactions
            .filter(tx => 
              tx.relatedEntityId === loan.id && 
              tx.transactionType === 'PrincipalRepayment' &&
              new Date(tx.transactionDate || 0) <= reportEnd
            )
            .reduce((total, tx) => total + (tx.amount || 0), 0);
          
          return acc + Math.max(0, (loan.loanAmount || 0) - repaid);
        }, 0);

        if (format === 'pdf') {
          generatePDFReport({
            reportMonth: months[reportStart.getMonth()].label,
            reportYear: reportStart.getFullYear(),
            prevMonthName: prevMonthLabel,
            prevMonthYear: prevMonthYear,
            transactionTypeLabel: type === 'all' ? 'All' : type === 'deposits' ? 'Deposits Only' : 'Loans Only',
            openingBalance,
            periodDeposits: periodMetrics.deposits,
            periodLoans: periodMetrics.loans,
            periodPrincipal: periodMetrics.principal,
            periodInterest: periodMetrics.interest,
            periodFines: periodMetrics.fines,
            periodNetBalance,
            closingBalance,
            accumulatedDeposits,
            accumulatedOutstanding,
            data: filtered
          });
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

  const generatePDFReport = (reportData: any) => {
    const doc = new jsPDF();
    const { 
      reportMonth, reportYear, prevMonthName, prevMonthYear, transactionTypeLabel,
      openingBalance, periodDeposits, periodLoans, periodPrincipal, periodInterest, periodFines,
      periodNetBalance, closingBalance, accumulatedDeposits, accumulatedOutstanding, data 
    } = reportData;

    doc.setFontSize(22);
    doc.text(`Group Transactions Report: ${reportMonth} ${reportYear}`, 14, 20);

    doc.setFontSize(11);
    doc.setTextColor(100);
    doc.text(`Transaction Type: ${transactionTypeLabel}`, 14, 28);

    const summaryRows = [
      [`Opening Balance (${prevMonthName} ${prevMonthYear} Closing)`, `Rs. ${openingBalance.toLocaleString('en-IN')}`],
      [`Total Deposits (${reportMonth} ${reportYear})`, `Rs. ${periodDeposits.toLocaleString('en-IN')}`],
      [`Total Loans Issued (${reportMonth} ${reportYear})`, `Rs. ${periodLoans.toLocaleString('en-IN')}`],
      [`Total Principal Repaid (${reportMonth} ${reportYear})`, `Rs. ${periodPrincipal.toLocaleString('en-IN')}`],
      [`Total Interest Earned (${reportMonth} ${reportYear})`, `Rs. ${periodInterest.toLocaleString('en-IN')}`],
      [`Total Fines Collected (${reportMonth} ${reportYear})`, `Rs. ${periodFines.toLocaleString('en-IN')}`],
      [`Net Balance for Period`, `Rs. ${periodNetBalance.toLocaleString('en-IN')}`],
      [{ content: `Closing Balance`, styles: { fontStyle: 'bold' } }, { content: `Rs. ${closingBalance.toLocaleString('en-IN')}`, styles: { fontStyle: 'bold' } }],
      [`Total Deposits accumulated (up to ${reportMonth} ${reportYear})`, `Rs. ${accumulatedDeposits.toLocaleString('en-IN')}`],
      [`Total Outstanding Loan (up to ${reportMonth} ${reportYear})`, `Rs. ${accumulatedOutstanding.toLocaleString('en-IN')}`]
    ];

    autoTable(doc, {
      startY: 35,
      head: [['Summary Metric', 'Amount (INR)']],
      body: summaryRows,
      theme: 'striped',
      headStyles: { fillColor: [46, 125, 50], textColor: [255, 255, 255], fontSize: 12 },
      columnStyles: { 1: { halign: 'right' } },
      margin: { top: 35 }
    });

    const finalY = (doc as any).lastAutoTable.finalY;
    doc.setTextColor(0);
    doc.setFontSize(14);
    doc.text("Detailed Transaction Log:", 14, finalY + 15);

    const tableData = data.map((tx: any) => [
      new Date(tx.transactionDate || 0).toLocaleDateString(),
      tx.memberName || 'N/A',
      tx.transactionType.replace(/([A-Z])/g, ' $1').trim(),
      tx.comment || '-',
      `Rs. ${tx.amount.toLocaleString('en-IN')}`
    ]);

    autoTable(doc, {
      startY: finalY + 20,
      head: [['Date', 'Member', 'Type', 'Description', 'Amount']],
      body: tableData,
      theme: 'grid',
      headStyles: { fillColor: [33, 150, 243], fontSize: 10 },
      columnStyles: { 4: { halign: 'right' } }
    });

    doc.save(`Financial_Report_${reportMonth}_${reportYear}.pdf`);
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
