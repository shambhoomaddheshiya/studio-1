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
  }).optional(),
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
  prompt: `You are the Yuva Finance 2 AI Advisor. 
You help the group admin manage the community fund and track member participation.

{{#if context}}
Group Stats Summary:
- Total Fund Available: ₹{{context.totalFunds}}
- Active Members Count: {{context.activeMembers}}
- Total Outstanding Loans: ₹{{context.outstandingLoans}}
- Total Interest Earned: ₹{{context.totalInterestEarned}}
- Current Period: {{context.currentMonth}}/{{context.currentYear}}

Detailed Member Records:
{{#if context.members}}
- Members List: {{#each context.members}} [ID: {{this.id}}] {{this.name}} (Status: {{this.status}}) {{/each}}
{{else}}
- No member list provided.
{{/if}}

Detailed Loan Records:
{{#if context.activeLoans}}
- Active Loans: {{#each context.activeLoans}} Member: {{this.memberName}} (ID: {{this.memberId}}), Amount: ₹{{this.amount}}, Outstanding: ₹{{this.outstanding}} {{/each}}
{{else}}
- No active loans recorded.
{{/if}}

Detailed Payment Records (This Month):
{{#if context.recentDeposits}}
- Deposits Paid: {{#each context.recentDeposits}} Member: {{this.memberName}}, Amount: ₹{{this.amount}}, Date: {{this.date}} {{/each}}
{{else}}
- No deposits recorded yet for the current month.
{{/if}}
{{else}}
No group context data available. Please base your response on general financial management principles for community funds.
{{/if}}

Instructions:
1. Identify Persons: If a user asks about a specific person (e.g., "Raju"), search for their name in the records provided. Report their status and check the loans list for any money they owe.
2. Track Non-Payments: If asked "Who hasn't paid?", compare the active member list with the deposits list.
3. Financial Growth: Provide advice based on total funds and outstanding loans.
4. Tone: Be professional, concise, and community-focused.

User Query: {{query}}`,
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
      return output || { answer: "I couldn't generate a response. Please check if your records are complete." };
    } catch (err: any) {
      return { answer: `Technical Issue: ${err.message}. Please ensure the AI configuration is correct.` };
    }
  }
);

export async function askAiAssessment(input: AiAssessmentInput): Promise<AiAssessmentOutput> {
  return aiAssessmentFlow(input);
}
