'use server';
/**
 * @fileOverview An AI assistant that generates a brief explanation for a member's credit score.
 *
 * - explainCreditScore - A function that handles the credit score explanation process.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const AiCreditScoreExplanationInputSchema = z.object({
  memberId: z.string().describe('The unique ID of the member.'),
  creditScore: z.number().min(1).max(10).describe('The member\'s credit score within the group (1-10 scale).'),
  totalDeposit: z.number().min(0).describe('The total amount of money deposited by the member.'),
  totalLoanTaken: z.number().min(0).describe('The total amount of loans taken by the member.'),
  totalInterestPaid: z.number().min(0).describe('The total amount of interest paid by the member on loans.'),
  totalFinePaid: z.number().min(0).describe('The total amount of fines paid by the member.'),
  currentOutstandingLoan: z.number().min(0).describe('The current outstanding balance of all loans for the member.'),
  missedPaymentsCount: z.number().min(0).describe('The number of missed monthly deposit payments.'),
  loanRepaymentEfficiency: z.enum(['excellent', 'good', 'average', 'poor']).describe('A qualitative assessment of the member\'s loan repayment consistency.'),
});
export type AiCreditScoreExplanationInput = z.infer<typeof AiCreditScoreExplanationInputSchema>;

const AiCreditScoreExplanationOutputSchema = z.object({
  explanation: z.string().describe('A brief explanation of the member\'s credit score, highlighting key influencing factors.'),
  actionableInsights: z.array(z.string()).describe('A list of actionable insights or recommendations for the member to improve their credit standing.'),
});
export type AiCreditScoreExplanationOutput = z.infer<typeof AiCreditScoreExplanationOutputSchema>;

const explainCreditScorePrompt = ai.definePrompt({
  name: 'explainCreditScorePrompt',
  model: 'googleai/gemini-1.5-flash',
  input: { schema: AiCreditScoreExplanationInputSchema },
  output: { schema: AiCreditScoreExplanationOutputSchema },
  prompt: `You are an AI assistant for a finance group named Yuva Finance 2. Provide a brief explanation of a member's credit score ({{{creditScore}}}/10).
  
Member Standing:
- Deposits: ₹{{{totalDeposit}}}
- Loans Taken: ₹{{{totalLoanTaken}}}
- Interest Paid: ₹{{{totalInterestPaid}}}
- Outstanding: ₹{{{currentOutstandingLoan}}}
- Missed Payments: {{{missedPaymentsCount}}}
- Repayment Efficiency: {{{loanRepaymentEfficiency}}}

Explain the score and provide 3 actionable insights for improvement.`,
});

const explainCreditScoreFlow = ai.defineFlow(
  {
    name: 'explainCreditScoreFlow',
    inputSchema: AiCreditScoreExplanationInputSchema,
    outputSchema: AiCreditScoreExplanationOutputSchema,
  },
  async (input) => {
    const { output } = await explainCreditScorePrompt(input);
    if (!output) {
      throw new Error("No output generated from AI model.");
    }
    return output;
  }
);

export async function explainCreditScore(input: AiCreditScoreExplanationInput): Promise<AiCreditScoreExplanationOutput> {
  return explainCreditScoreFlow(input);
}
