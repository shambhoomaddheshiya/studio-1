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
import { Loader2, Calendar as CalendarIcon } from "lucide-react";
import { Input } from "@/components/ui/input";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { cn } from "@/lib/utils";

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
  
  // State for report configuration
  const [scope, setScope] = useState("all");
  const [selectedMemberId, setSelectedMemberId] = useState<string>("");
  const [period, setPeriod] = useState("all_time");
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
    
    // Slight delay to allow UI state to update
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
        } else if (period === "custom") {
          reportStart = startDate ? new Date(startDate) : new Date(0);
          reportEnd = endDate ? new Date(endDate) : new Date();
        } else {
          // All Time
          reportStart = new Date(0);
          reportEnd = new Date();
        }

        const prevMonthEnd = new Date(reportStart.getTime() - 1);
        const prevMonthLabel = months[prevMonthEnd.getMonth()].label;
        const prevMonthYear = prevMonthEnd.getFullYear();

        // Detailed transaction log filtering
        const filtered = allTransactions.filter(tx => {
          if (scope === "specific" && selectedMemberId && tx.memberId !== selectedMemberId) return false;
          if (!tx.transactionDate) return false;
          const txDate = new Date(tx.transactionDate);
          if (txDate < reportStart || txDate > reportEnd) return false;
          
          if (type !== 'all') {
            if (type === "deposits" && tx.transactionType !== 'Deposit') return false;
            if (type === "loans" && tx.transactionType !== 'LoanDisbursement') return false;
            if (type === "repayments" && !['PrincipalRepayment', 'InterestPayment', 'FinePayment'].includes(tx.transactionType)) return false;
            if (type === "deposits_repayments" && !['Deposit', 'PrincipalRepayment', 'InterestPayment', 'FinePayment'].includes(tx.transactionType)) return false;
          }
          return true;
        }).sort((a, b) => new Date(a.transactionDate || 0).getTime() - new Date(b.transactionDate || 0).getTime());

        // Net Capital Position Reconcilliation
        const calcNetPosition = (date: Date) => {
          const collections = allTransactions.reduce((acc, tx) => {
            if (!tx.transactionDate || new Date(tx.transactionDate) > date) return acc;
            const amt = tx.amount || 0;
            const type = tx.transactionType;
            if (['Deposit', 'InterestPayment', 'FinePayment'].includes(type)) return acc + amt;
            if (type === 'GeneralExpense') return acc - amt;
            return acc;
          }, 0);

          const outstandingAtDate = loans.reduce((acc, loan) => {
            if (!loan.loanDate) return acc;
            const lDate = new Date(loan.loanDate);
            if (lDate > date) return acc;
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
          else if (t === 'PrincipalRepayment') acc.principal += amt;
          else if (t === 'InterestPayment') acc.interest += amt;
          else if (t === 'FinePayment') acc.fines += amt;
          else if (t === 'GeneralExpense') acc.expenses += amt;
          return acc;
        }, { deposits: 0, loans: 0, principal: 0, interest: 0, fines: 0, expenses: 0 });

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
            reportRange: period === 'all_time' ? 'All Time' : period === 'monthly' ? `${months[reportStart.getMonth()].label} ${reportStart.getFullYear()}` : period === 'yearly' ? `${reportStart.getFullYear()}` : `${reportStart.toLocaleDateString()} to ${reportEnd.toLocaleDateString()}`,
            prevMonthName: prevMonthLabel,
            prevMonthYear: prevMonthYear,
            transactionTypeLabel: typeFilters.find(f => f.value === type)?.label || 'All',
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

        toast({ title: "Report Generated", description: `Report completed with ${filtered.length} entries.` });
      } catch (error) {
        console.error("Report generation error:", error);
        toast({ variant: "destructive", title: "Generation Failed", description: "Unexpected error occurred." });
      } finally {
        setIsGenerating(false);
      }
    }, 800);
  };

  const typeFilters = [
    { value: "all", label: "All" },
    { value: "deposits", label: "Deposits" },
    { value: "loans", label: "Loans" },
    { value: "repayments", label: "Repayments" },
    { value: "deposits_repayments", label: "Deposits & Repayments" },
  ];

  const generatePDFReport = (reportData: any) => {
    const doc = new jsPDF();
    const { 
      reportRange, prevMonthName, prevMonthYear, transactionTypeLabel,
      openingBalance, periodDeposits, periodLoans, periodPrincipal, periodInterest, periodFines,
      periodNetBalance, closingBalance, accumulatedDeposits, accumulatedOutstanding, data 
    } = reportData;

    doc.setFontSize(22);
    doc.text(`Group Transactions Report`, 14, 20);
    doc.setFontSize(12);
    doc.text(`Period: ${reportRange}`, 14, 28);
    doc.setTextColor(100);
    doc.text(`Type Filter: ${transactionTypeLabel}`, 14, 34);

    const summaryRows = [
      [`Opening Balance (Historical Carry-over)`, `Rs. ${openingBalance.toLocaleString('en-IN')}`],
      [`Total Deposits (Period)`, `Rs. ${periodDeposits.toLocaleString('en-IN')}`],
      [`Total Loans Issued (Period)`, `Rs. ${periodLoans.toLocaleString('en-IN')}`],
      [`Total Principal Repaid (Period)`, `Rs. ${periodPrincipal.toLocaleString('en-IN')}`],
      [`Total Interest Earned (Period)`, `Rs. ${periodInterest.toLocaleString('en-IN')}`],
      [`Total Fines Collected (Period)`, `Rs. ${periodFines.toLocaleString('en-IN')}`],
      [`Net Activity for Period`, `Rs. ${periodNetBalance.toLocaleString('en-IN')}`],
      [{ content: `Closing Net Position`, styles: { fontStyle: 'bold' } }, { content: `Rs. ${closingBalance.toLocaleString('en-IN')}`, styles: { fontStyle: 'bold' } }],
      [`Total Deposits accumulated`, `Rs. ${accumulatedDeposits.toLocaleString('en-IN')}`],
      [`Total Outstanding Loan Balance`, `Rs. ${accumulatedOutstanding.toLocaleString('en-IN')}`]
    ];

    autoTable(doc, {
      startY: 40,
      head: [['Financial Summary', 'Amount (INR)']],
      body: summaryRows,
      theme: 'striped',
      headStyles: { fillColor: [46, 125, 50], textColor: [255, 255, 255], fontSize: 12 },
      columnStyles: { 1: { halign: 'right' } },
      margin: { top: 40 }
    });

    const finalY = (doc as any).lastAutoTable.finalY;
    doc.setTextColor(0);
    doc.setFontSize(14);
    doc.text("Transaction Log:", 14, finalY + 15);

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

    doc.save(`Financial_Report_${reportRange.replace(/\s+/g, '_')}.pdf`);
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
    <div className="min-h-screen flex flex-col bg-[#eaedf7]">
      <Navbar />
      
      <main className="flex-1 p-4 sm:p-8 max-w-4xl mx-auto w-full space-y-6">
        <h1 className="text-3xl font-bold tracking-tight text-[#1a237e] font-headline">Reports</h1>
        
        <Card className="border border-slate-200 shadow-md rounded-lg bg-white overflow-hidden">
          <CardHeader className="pb-4">
            <CardTitle className="text-xl font-bold text-[#1e293b]">Export Transactions</CardTitle>
            <CardDescription className="text-slate-500">
              Generate and download transaction reports in PDF or Excel format.
            </CardDescription>
          </CardHeader>
          
          <CardContent className="space-y-8 pt-4">
            {/* Export Scope */}
            <div className="space-y-4">
              <Label className="text-sm font-semibold text-slate-700">Export Scope</Label>
              <RadioGroup value={scope} onValueChange={setScope} className="flex flex-col gap-3">
                <div className="flex items-center space-x-3">
                  <RadioGroupItem value="all" id="scope-all" className="h-5 w-5 border-[#3f51b5] text-[#3f51b5]" />
                  <Label htmlFor="scope-all" className="text-slate-600 font-medium cursor-pointer">All Members</Label>
                </div>
                <div className="flex items-center space-x-3">
                  <RadioGroupItem value="specific" id="scope-specific" className="h-5 w-5 border-[#3f51b5] text-[#3f51b5]" />
                  <Label htmlFor="scope-specific" className="text-slate-600 font-medium cursor-pointer">Specific Member</Label>
                </div>
              </RadioGroup>
              {scope === "specific" && (
                <div className="pl-8 pt-2">
                  <Select value={selectedMemberId} onValueChange={setSelectedMemberId}>
                    <SelectTrigger className="w-full sm:max-w-md bg-slate-50 border-slate-200">
                      <SelectValue placeholder="Select a member" />
                    </SelectTrigger>
                    <SelectContent>
                      {sortedMembers.map(m => (
                        <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>

            {/* Report Period */}
            <div className="space-y-4">
              <Label className="text-sm font-semibold text-slate-700">Report Period</Label>
              <RadioGroup value={period} onValueChange={setPeriod} className="flex flex-col gap-3">
                <div className="flex items-center space-x-3">
                  <RadioGroupItem value="all_time" id="period-all" className="h-5 w-5 border-[#3f51b5] text-[#3f51b5]" />
                  <Label htmlFor="period-all" className="text-slate-600 font-medium cursor-pointer">All Time</Label>
                </div>
                <div className="flex items-center space-x-3">
                  <RadioGroupItem value="monthly" id="period-monthly" className="h-5 w-5 border-[#3f51b5] text-[#3f51b5]" />
                  <Label htmlFor="period-monthly" className="text-slate-600 font-medium cursor-pointer">Monthly</Label>
                </div>
                <div className="flex items-center space-x-3">
                  <RadioGroupItem value="yearly" id="period-yearly" className="h-5 w-5 border-[#3f51b5] text-[#3f51b5]" />
                  <Label htmlFor="period-yearly" className="text-slate-600 font-medium cursor-pointer">Yearly</Label>
                </div>
                <div className="flex items-center space-x-3">
                  <RadioGroupItem value="custom" id="period-custom" className="h-5 w-5 border-[#3f51b5] text-[#3f51b5]" />
                  <Label htmlFor="period-custom" className="text-slate-600 font-medium cursor-pointer">Custom Range</Label>
                </div>
              </RadioGroup>

              {period === "monthly" && (
                <div className="pl-8 flex flex-col sm:flex-row gap-3 pt-2">
                  <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                    <SelectTrigger className="w-full sm:w-[160px] bg-slate-50 border-slate-200">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {months.map(m => (
                        <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Input 
                    type="number" 
                    value={selectedYear} 
                    onChange={e => setSelectedYear(e.target.value)} 
                    className="w-full sm:w-[100px] bg-slate-50 border-slate-200" 
                  />
                </div>
              )}

              {period === "yearly" && (
                <div className="pl-8 pt-2">
                  <Input 
                    type="number" 
                    value={selectedYear} 
                    onChange={e => setSelectedYear(e.target.value)} 
                    className="w-full sm:w-[120px] bg-slate-50 border-slate-200" 
                    placeholder="Year"
                  />
                </div>
              )}

              {period === "custom" && (
                <div className="pl-8 grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 max-w-md">
                  <div className="space-y-2">
                    <Label className="text-[10px] uppercase font-bold text-slate-400">From</Label>
                    <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="bg-slate-50 border-slate-200" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[10px] uppercase font-bold text-slate-400">To</Label>
                    <Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="bg-slate-50 border-slate-200" />
                  </div>
                </div>
              )}
            </div>

            {/* Transaction Type */}
            <div className="space-y-4">
              <Label className="text-sm font-semibold text-slate-700">Transaction Type</Label>
              <RadioGroup value={type} onValueChange={setType} className="flex flex-wrap gap-x-8 gap-y-4">
                {typeFilters.map(f => (
                  <div key={f.value} className="flex items-center space-x-3">
                    <RadioGroupItem value={f.value} id={`type-${f.value}`} className="h-5 w-5 border-[#3f51b5] text-[#3f51b5]" />
                    <Label htmlFor={`type-${f.value}`} className="text-slate-600 font-medium cursor-pointer">{f.label}</Label>
                  </div>
                ))}
              </RadioGroup>
            </div>

            {/* File Format */}
            <div className="space-y-4">
              <Label className="text-sm font-semibold text-slate-700">File Format</Label>
              <RadioGroup value={format} onValueChange={setFormat} className="flex flex-row gap-8">
                <div className="flex items-center space-x-3">
                  <RadioGroupItem value="pdf" id="format-pdf" className="h-5 w-5 border-[#3f51b5] text-[#3f51b5]" />
                  <Label htmlFor="format-pdf" className="text-slate-600 font-medium cursor-pointer">PDF</Label>
                </div>
                <div className="flex items-center space-x-3">
                  <RadioGroupItem value="xlsx" id="format-xlsx" className="h-5 w-5 border-[#3f51b5] text-[#3f51b5]" />
                  <Label htmlFor="format-xlsx" className="text-slate-600 font-medium cursor-pointer">Excel (XLSX)</Label>
                </div>
              </RadioGroup>
            </div>

            {/* Action */}
            <div className="pt-6">
              <Button 
                onClick={handleGenerateReport} 
                disabled={isGenerating} 
                className="w-full sm:w-auto min-w-[180px] bg-[#3f51b5] hover:bg-[#303f9f] text-white py-6 rounded-md shadow-sm text-base font-semibold"
              >
                {isGenerating ? (
                  <><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Generating...</>
                ) : (
                  'Generate Report'
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
