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
  totalLoanRepaid: z.number().min(0).optional().describe('The total principal amount repaid by the member.'),
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
  prompt: `You are a financial analyst for Yuva Finance 2. Explain credit scores based on group-specific contribution and repayment data.

Provide a brief explanation of a member's credit score ({{{creditScore}}}/10).
  
Member Details:
- Total Deposits: ₹{{{totalDeposit}}}
- Total Loans Taken: ₹{{{totalLoanTaken}}}
- Total Interest Paid: ₹{{{totalInterestPaid}}}
- Outstanding Balance: ₹{{{currentOutstandingLoan}}}
- Missed Payments: {{{missedPaymentsCount}}}
- Repayment Rating: {{{loanRepaymentEfficiency}}}

Explain why they have this score and provide 3 specific actionable insights for them to improve or maintain it.
Return your response as a JSON object with two fields: "explanation" (string) and "actionableInsights" (array of strings).`,
});

const explainCreditScoreFlow = ai.defineFlow(
  {
    name: 'explainCreditScoreFlow',
    inputSchema: AiCreditScoreExplanationInputSchema,
    outputSchema: AiCreditScoreExplanationOutputSchema,
  },
  async (input) => {
    try {
      const { text } = await explainCreditScorePrompt(input);
      if (!text) throw new Error("AI response was empty.");
      
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
      
      return { 
        explanation: text,
        actionableInsights: ["Review transaction history.", "Ensure timely deposits.", "Reduce outstanding debt."]
      };
    } catch (err: any) {
      console.error('Credit score AI error:', err);
      return { 
        explanation: `Analysis currently unavailable: ${err.message}`,
        actionableInsights: ["Manually review transaction history.", "Check for missed monthly deposits."]
      };
    }
  }
);

export async function explainCreditScore(input: AiCreditScoreExplanationInput): Promise<AiCreditScoreExplanationOutput> {
  return explainCreditScoreFlow(input);
}
