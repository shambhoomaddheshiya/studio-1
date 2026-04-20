'use server';
/**
 * @fileOverview An AI assistant that provides assessments and insights for the finance group.
 *
 * - askAiAssessment - A function that handles general group analysis and Q&A.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const AiAssessmentInputSchema = z.object({
  query: z.string().describe('The user\'s question or request for insight.'),
  context: z.object({
    totalFunds: z.number(),
    activeMembers: z.number(),
    outstandingLoans: z.number(),
    totalInterestEarned: z.number(),
    currentMonth: z.number(),
    currentYear: z.number(),
    members: z.array(z.object({
      id: z.string(),
      name: z.string(),
      status: z.string(),
    })).optional(),
    activeLoans: z.array(z.object({
      id: z.string(),
      memberId: z.string(),
      memberName: z.string().optional(),
      amount: z.number(),
      outstanding: z.number(),
    })).optional(),
    recentDeposits: z.array(z.object({
      memberId: z.string(),
      memberName: z.string().optional(),
      amount: z.number(),
      date: z.string(),
    })).optional(),
  }).optional().describe('Current group financial summary and detailed records for context.'),
});
export type AiAssessmentInput = z.infer<typeof AiAssessmentInputSchema>;

const AiAssessmentOutputSchema = z.object({
  answer: z.string().describe('The AI\'s response providing insights or answers.'),
});
export type AiAssessmentOutput = z.infer<typeof AiAssessmentOutputSchema>;

const aiAssessmentPrompt = ai.definePrompt({
  name: 'aiAssessmentPrompt',
  model: 'googleai/gemini-1.5-flash',
  input: { schema: AiAssessmentInputSchema },
  output: { schema: AiAssessmentOutputSchema },
  config: {
    safetySettings: [
      { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' },
      { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_NONE' },
      { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
      { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' },
    ],
  },
  prompt: `You are the Yuva Finance 2 AI Advisor. 
You help the group admin manage the community fund effectively.

Group Stats Context:
- Total Fund Available: ₹{{context.totalFunds}}
- Active Members Count: {{context.activeMembers}}
- Total Outstanding Loans: ₹{{context.outstandingLoans}}
- Total Interest Earned: ₹{{context.totalInterestEarned}}
- Current Period: {{context.currentMonth}}/{{context.currentYear}}

Detailed Member Data:
{{#if context.members}}
- Members List: {{#each context.members}} [{{id}}] {{name}} ({{status}}) {{/each}}
{{else}}
- No member list available.
{{/if}}

Detailed Loan Data:
{{#if context.activeLoans}}
- Active Loans: {{#each context.activeLoans}} {{memberName}}: ₹{{amount}} (Outstanding: ₹{{outstanding}}) {{/each}}
{{else}}
- No active loans currently.
{{/if}}

Detailed Payment Data (Current Month):
{{#if context.recentDeposits}}
- Recent Deposits: {{#each context.recentDeposits}} {{memberName}}: ₹{{amount}} on {{date}} {{/each}}
{{else}}
- No deposits recorded yet for this month.
{{/if}}

Instructions:
1. If the user asks "Who hasn't paid this month?", cross-reference the "Members List" with the "Recent Deposits". An active member is considered "paid" if they appear in the Recent Deposits list. List names clearly.
2. If the user asks about a specific person (e.g., Raju), look for them in the "Members List". If found, report their status and check "Active Loans" for any outstanding debt.
3. Provide professional, concise, and helpful financial advice based strictly on the provided data.
4. If you cannot find the answer in the data, explain what is missing.

User Question: {{query}}`,
});

const aiAssessmentFlow = ai.defineFlow(
  {
    name: 'aiAssessmentFlow',
    inputSchema: AiAssessmentInputSchema,
    outputSchema: AiAssessmentOutputSchema,
  },
  async (input) => {
    try {
      const { output } = await aiAssessmentPrompt(input);
      if (!output) {
        return { answer: "I'm sorry, I couldn't generate an answer based on the current data. Please ensure your records are up to date." };
      }
      return output;
    } catch (err: any) {
      console.error("Genkit Flow Error:", err);
      return { answer: `I encountered a technical issue while analyzing the group records: ${err.message}. Please try again in a few moments.` };
    }
  }
);

export async function askAiAssessment(input: AiAssessmentInput): Promise<AiAssessmentOutput> {
  return aiAssessmentFlow(input);
}
