
"use client"

import React, { useState, useMemo } from "react";
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

export default function ReportsPage() {
  const { toast } = useToast();
  const db = useFirestore();
  const [isGenerating, setIsGenerating] = useState(false);
  
  // Form States
  const [scope, setScope] = useState("all");
  const [selectedMemberId, setSelectedMemberId] = useState<string>("");
  const [period, setPeriod] = useState("all_time");
  const [selectedMonth, setSelectedMonth] = useState<string>(new Date().getMonth().toString());
  const [selectedYear, setSelectedYear] = useState<string>(new Date().getFullYear().toString());
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [type, setType] = useState("all");
  const [format, setFormat] = useState("excel");
  
  // Data Fetching
  const membersRef = useMemoFirebase(() => collection(db, 'members'), [db]);
  const { data: members } = useCollection(membersRef);

  const transactionsRef = useMemoFirebase(() => collection(db, 'transactions'), [db]);
  const { data: allTransactions } = useCollection(transactionsRef);

  const handleGenerateReport = () => {
    if (!allTransactions) {
      toast({
        variant: "destructive",
        title: "No data available",
        description: "Transaction records are still loading or do not exist.",
      });
      return;
    }

    setIsGenerating(true);
    
    // Simulate slight delay for professional feel
    setTimeout(() => {
      try {
        // 1. Filter Data
        let filtered = allTransactions.filter(tx => {
          // Scope Filter
          if (scope === "specific" && selectedMemberId && tx.memberId !== selectedMemberId) return false;

          // Period Filter
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

          // Type Filter
          if (type === "deposits" && tx.transactionType !== 'Deposit') return false;
          if (type === "loans" && tx.transactionType !== 'LoanDisbursement') return false;
          if (type === "repayments" && !['PrincipalRepayment', 'InterestPayment', 'FinePayment'].includes(tx.transactionType)) return false;
          if (type === "dep_rep" && !['Deposit', 'PrincipalRepayment', 'InterestPayment', 'FinePayment'].includes(tx.transactionType)) return false;

          return true;
        });

        // 2. Generate CSV
        const headers = ["Date", "Member Name", "Member ID", "Type", "Category", "Impact", "Amount", "Comment"];
        const rows = filtered.map(tx => [
          tx.transactionDate ? new Date(tx.transactionDate).toLocaleDateString() : 'N/A',
          tx.memberName || 'N/A',
          tx.memberId || 'N/A',
          tx.transactionType || 'N/A',
          tx.fundCategory || 'N/A',
          tx.balanceImpact || 'N/A',
          tx.amount || 0,
          `"${(tx.comment || '').replace(/"/g, '""')}"`
        ]);

        const csvContent = [
          headers.join(","),
          ...rows.map(r => r.join(","))
        ].join("\n");

        // 3. Trigger Download
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        const filename = `YuvaFinance_Report_${new Date().toISOString().split('T')[0]}.${format === 'excel' ? 'csv' : 'pdf.csv'}`;
        
        link.setAttribute("href", url);
        link.setAttribute("download", filename);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        toast({
          title: "Report Generated",
          description: `The report for ${filtered.length} transactions has been downloaded.`,
        });
      } catch (error) {
        console.error("Report generation error:", error);
        toast({
          variant: "destructive",
          title: "Generation Failed",
          description: "An unexpected error occurred while processing the report.",
        });
      } finally {
        setIsGenerating(false);
      }
    }, 1000);
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <Navbar />
      
      <main className="flex-1 p-4 sm:p-8 max-w-4xl mx-auto w-full space-y-6">
        <header className="flex flex-col gap-2">
          <h1 className="text-4xl font-bold tracking-tight text-[#1e293b] font-headline">Reports</h1>
        </header>

        <Card className="border border-slate-200 shadow-sm rounded-xl overflow-hidden">
          <CardHeader className="pb-4">
            <CardTitle className="text-2xl font-bold text-[#1e293b]">Export Transactions</CardTitle>
            <CardDescription className="text-slate-500 text-base">
              Generate and download transaction reports in PDF or Excel format.
            </CardDescription>
          </CardHeader>
          
          <CardContent className="space-y-8 pt-2">
            {/* Export Scope */}
            <div className="space-y-3">
              <Label className="text-slate-600 font-medium text-sm">Export Scope</Label>
              <RadioGroup value={scope} onValueChange={setScope} className="flex flex-col space-y-2">
                <div className="flex items-center space-x-3">
                  <RadioGroupItem value="all" id="scope-all" className="border-primary text-primary" />
                  <Label htmlFor="scope-all" className="font-normal text-slate-700 cursor-pointer">All Members</Label>
                </div>
                <div className="flex items-center space-x-3">
                  <RadioGroupItem value="specific" id="scope-specific" className="border-primary text-primary" />
                  <Label htmlFor="scope-specific" className="font-normal text-slate-700 cursor-pointer">Specific Member</Label>
                </div>
              </RadioGroup>
              
              {scope === "specific" && (
                <div className="mt-2 pl-7 max-w-sm">
                  <Select value={selectedMemberId} onValueChange={setSelectedMemberId}>
                    <SelectTrigger className="bg-white border-slate-200">
                      <SelectValue placeholder="Select a member" />
                    </SelectTrigger>
                    <SelectContent>
                      {members?.map(m => (
                        <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>

            {/* Report Period */}
            <div className="space-y-3">
              <Label className="text-slate-600 font-medium text-sm">Report Period</Label>
              <RadioGroup value={period} onValueChange={setPeriod} className="flex flex-col space-y-2">
                <div className="flex items-center space-x-3">
                  <RadioGroupItem value="all_time" id="period-all" className="border-primary text-primary" />
                  <Label htmlFor="period-all" className="font-normal text-slate-700 cursor-pointer">All Time</Label>
                </div>
                <div className="flex items-center space-x-3">
                  <RadioGroupItem value="monthly" id="period-monthly" className="border-primary text-primary" />
                  <Label htmlFor="period-monthly" className="font-normal text-slate-700 cursor-pointer">Monthly</Label>
                </div>
                <div className="flex items-center space-x-3">
                  <RadioGroupItem value="yearly" id="period-yearly" className="border-primary text-primary" />
                  <Label htmlFor="period-yearly" className="font-normal text-slate-700 cursor-pointer">Yearly</Label>
                </div>
                <div className="flex items-center space-x-3">
                  <RadioGroupItem value="custom" id="period-custom" className="border-primary text-primary" />
                  <Label htmlFor="period-custom" className="font-normal text-slate-700 cursor-pointer">Custom Range</Label>
                </div>
              </RadioGroup>

              {period === "monthly" && (
                <div className="mt-2 pl-7 flex gap-2 max-w-sm">
                  <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                    <SelectTrigger className="bg-white border-slate-200">
                      <SelectValue placeholder="Month" />
                    </SelectTrigger>
                    <SelectContent>
                      {Array.from({ length: 12 }).map((_, i) => (
                        <SelectItem key={i} value={i.toString()}>
                          {new Date(0, i).toLocaleString('default', { month: 'long' })}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Input 
                    type="number" 
                    value={selectedYear} 
                    onChange={(e) => setSelectedYear(e.target.value)}
                    className="w-24 bg-white border-slate-200" 
                  />
                </div>
              )}

              {period === "yearly" && (
                <div className="mt-2 pl-7 max-w-sm">
                  <Input 
                    type="number" 
                    value={selectedYear} 
                    onChange={(e) => setSelectedYear(e.target.value)}
                    className="w-24 bg-white border-slate-200" 
                  />
                </div>
              )}

              {period === "custom" && (
                <div className="mt-2 pl-7 flex items-center gap-2 max-w-md">
                  <Input 
                    type="date" 
                    value={startDate} 
                    onChange={(e) => setStartDate(e.target.value)}
                    className="bg-white border-slate-200" 
                  />
                  <span className="text-slate-400">to</span>
                  <Input 
                    type="date" 
                    value={endDate} 
                    onChange={(e) => setEndDate(e.target.value)}
                    className="bg-white border-slate-200" 
                  />
                </div>
              )}
            </div>

            {/* Transaction Type */}
            <div className="space-y-3">
              <Label className="text-slate-600 font-medium text-sm">Transaction Type</Label>
              <RadioGroup value={type} onValueChange={setType} className="flex flex-row flex-wrap gap-x-6 gap-y-2">
                <div className="flex items-center space-x-3">
                  <RadioGroupItem value="all" id="type-all" className="border-primary text-primary" />
                  <Label htmlFor="type-all" className="font-normal text-slate-700 cursor-pointer">All</Label>
                </div>
                <div className="flex items-center space-x-3">
                  <RadioGroupItem value="deposits" id="type-deposits" className="border-primary text-primary" />
                  <Label htmlFor="type-deposits" className="font-normal text-slate-700 cursor-pointer">Deposits</Label>
                </div>
                <div className="flex items-center space-x-3">
                  <RadioGroupItem value="loans" id="type-loans" className="border-primary text-primary" />
                  <Label htmlFor="type-loans" className="font-normal text-slate-700 cursor-pointer">Loans</Label>
                </div>
                <div className="flex items-center space-x-3">
                  <RadioGroupItem value="repayments" id="type-repayments" className="border-primary text-primary" />
                  <Label htmlFor="type-repayments" className="font-normal text-slate-700 cursor-pointer">Repayments</Label>
                </div>
                <div className="flex items-center space-x-3">
                  <RadioGroupItem value="dep_rep" id="type-dep-rep" className="border-primary text-primary" />
                  <Label htmlFor="type-dep-rep" className="font-normal text-slate-700 cursor-pointer">Deposits & Repayments</Label>
                </div>
              </RadioGroup>
            </div>

            {/* File Format */}
            <div className="space-y-3">
              <Label className="text-slate-600 font-medium text-sm">File Format</Label>
              <RadioGroup value={format} onValueChange={setFormat} className="flex flex-row space-x-6">
                <div className="flex items-center space-x-3">
                  <RadioGroupItem value="pdf" id="format-pdf" className="border-primary text-primary" />
                  <Label htmlFor="format-pdf" className="font-normal text-slate-700 cursor-pointer">PDF</Label>
                </div>
                <div className="flex items-center space-x-3">
                  <RadioGroupItem value="excel" id="format-excel" className="border-primary text-primary" />
                  <Label htmlFor="format-excel" className="font-normal text-slate-700 cursor-pointer">Excel (XLSX)</Label>
                </div>
              </RadioGroup>
            </div>

            {/* Generate Button */}
            <div className="pt-4">
              <Button 
                onClick={handleGenerateReport} 
                disabled={isGenerating}
                className="bg-[#3f51b5] hover:bg-[#303f9f] text-white px-8 py-2 h-auto text-sm font-medium rounded-md"
              >
                {isGenerating ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Generating...</>
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
