'use server';
/**
 * @fileOverview An AI assistant that generates a brief explanation for a member's credit score.
 *
 * - explainCreditScore - A function that handles the credit score explanation process.
 * - AiCreditScoreExplanationInput - The input type for the explainCreditScore function.
 * - AiCreditScoreExplanationOutput - The return type for the explainCreditScore function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const AiCreditScoreExplanationInputSchema = z.object({
  memberId: z.string().describe('The unique ID of the member.'),
  creditScore: z.number().min(1).max(10).describe('The member\u0027s credit score within the group (1-10 scale).'),
  totalDeposit: z.number().min(0).describe('The total amount of money deposited by the member.'),
  totalLoanTaken: z.number().min(0).describe('The total amount of loans taken by the member.'),
  totalInterestPaid: z.number().min(0).describe('The total amount of interest paid by the member on loans.'),
  totalFinePaid: z.number().min(0).describe('The total amount of fines paid by the member.'),
  currentOutstandingLoan: z.number().min(0).describe('The current outstanding balance of all loans for the member.'),
  missedPaymentsCount: z.number().min(0).describe('The number of missed monthly deposit payments.'),
  loanRepaymentEfficiency: z.enum(['excellent', 'good', 'average', 'poor']).describe('A qualitative assessment of the member\u0027s loan repayment consistency.'),
});
export type AiCreditScoreExplanationInput = z.infer<typeof AiCreditScoreExplanationInputSchema>;

const AiCreditScoreExplanationOutputSchema = z.object({
  explanation: z.string().describe('A brief explanation of the member\u0027s credit score, highlighting key influencing factors.'),
  actionableInsights: z.array(z.string()).describe('A list of actionable insights or recommendations for the member to improve their credit standing.'),
});
export type AiCreditScoreExplanationOutput = z.infer<typeof AiCreditScoreExplanationOutputSchema>;

export async function explainCreditScore(input: AiCreditScoreExplanationInput): Promise<AiCreditScoreExplanationOutput> {
  return aiCreditScoreExplanationFlow(input);
}

const explainCreditScorePrompt = ai.definePrompt({
  name: 'explainCreditScorePrompt',
  input: { schema: AiCreditScoreExplanationInputSchema },
  output: { schema: AiCreditScoreExplanationOutputSchema },
  prompt: `You are an AI assistant for a finance group named FundFlow. Your task is to provide a brief and clear explanation of a member's credit score within the group, highlighting the most significant positive and negative factors that influenced it. Additionally, you must offer a list of actionable insights or recommendations for the member to improve their credit standing and financial behavior within the group.

The member's credit score is: {{{creditScore}}} (on a scale of 1 to 10).

Here is a summary of their financial standing within the group:
- Member ID: {{{memberId}}}
- Total Deposits: ₹{{{totalDeposit}}}
- Total Loan Taken: ₹{{{totalLoanTaken}}}
- Total Interest Paid: ₹{{{totalInterestPaid}}}
- Total Fine Paid: ₹{{{totalFinePaid}}}
- Current Outstanding Loan: ₹{{{currentOutstandingLoan}}}
- Missed Payments Count: {{{missedPaymentsCount}}} (Number of times monthly deposits were missed)
- Loan Repayment Efficiency: {{{loanRepaymentEfficiency}}}

Based on this information, generate a JSON object containing the explanation and actionable insights, following the provided output schema.`,
});

const aiCreditScoreExplanationFlow = ai.defineFlow(
  {
    name: 'aiCreditScoreExplanationFlow',
    inputSchema: AiCreditScoreExplanationInputSchema,
    outputSchema: AiCreditScoreExplanationOutputSchema,
  },
  async (input) => {
    const { output } = await explainCreditScorePrompt(input);
    return output!;
  },
);
