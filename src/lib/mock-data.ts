export interface Member {
  id: string;
  name: string;
  mobile: string;
  status: 'Active' | 'Inactive';
  totalDeposit: number;
  totalLoanTaken: number;
  totalInterestPaid: number;
  totalFinePaid: number;
  currentOutstandingLoan: number;
  creditScore: number;
}

export interface Transaction {
  id: string;
  memberId: string;
  memberName: string;
  type: 'deposit' | 'loan' | 'interest_payment' | 'repayment' | 'fine_payment';
  amount: number;
  date: string;
  comment: string;
}

export const MOCK_MEMBERS: Member[] = [
  {
    id: 'FF-001',
    name: 'Rajesh Sharma',
    mobile: '9876543210',
    status: 'Active',
    totalDeposit: 12000,
    totalLoanTaken: 50000,
    totalInterestPaid: 4500,
    totalFinePaid: 100,
    currentOutstandingLoan: 35000,
    creditScore: 8.5,
  },
  {
    id: 'FF-002',
    name: 'Priya Verma',
    mobile: '9123456789',
    status: 'Active',
    totalDeposit: 15000,
    totalLoanTaken: 20000,
    totalInterestPaid: 1200,
    totalFinePaid: 0,
    currentOutstandingLoan: 0,
    creditScore: 9.2,
  },
  {
    id: 'FF-003',
    name: 'Amit Singh',
    mobile: '8877665544',
    status: 'Inactive',
    totalDeposit: 5000,
    totalLoanTaken: 0,
    totalInterestPaid: 0,
    totalFinePaid: 500,
    currentOutstandingLoan: 0,
    creditScore: 4.5,
  }
];

export const MOCK_TRANSACTIONS: Transaction[] = [
  {
    id: 'TX-101',
    memberId: 'FF-001',
    memberName: 'Rajesh Sharma',
    type: 'deposit',
    amount: 500,
    date: '2024-03-01',
    comment: 'Monthly deposit for March',
  },
  {
    id: 'TX-102',
    memberId: 'FF-002',
    memberName: 'Priya Verma',
    type: 'loan',
    amount: 10000,
    date: '2024-03-05',
    comment: 'Education loan disbursement',
  },
  {
    id: 'TX-103',
    memberId: 'FF-001',
    memberName: 'Rajesh Sharma',
    type: 'repayment',
    amount: 2000,
    date: '2024-03-10',
    comment: 'Principal repayment',
  }
];