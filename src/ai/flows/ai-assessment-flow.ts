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
    activeMembersCount: z.number(),
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
  system: `You are the Yuva Finance 2 AI Advisor. 
Your job is to provide accurate financial insights and member status reports.
CRITICAL INSTRUCTIONS:
1. Identifying People: If a user mentions a name (e.g., "Raju", "Amit"), search for that name in the 'Members List'. If found, report their status. Then search for that ID in the 'Active Loans' list and report any balances.
2. Tracking Non-Payments: When asked "Who hasn't paid?", compare the 'Members List' (where status is 'Active') against the 'Deposits Paid' list for the current month. List the names of active members who do NOT appear in the deposits list.
3. Financial Growth: Analyze the total fund and outstanding loans to give group-level advice.
4. Be concise and professional.`,
  prompt: `
{{#if context}}
--- GROUP CONTEXT DATA ---
Current Date: {{context.currentMonth}}/{{context.currentYear}}
Total Group Fund: ₹{{context.totalFunds}}
Active Members Count: {{context.activeMembersCount}}
Total Outstanding Loans: ₹{{context.outstandingLoans}}
Total Interest Earned: ₹{{context.totalInterestEarned}}

MEMBERS LIST:
{{#each context.members}}
- ID: {{{this.id}}}, Name: {{{this.name}}}, Status: {{{this.status}}}
{{/each}}

ACTIVE LOANS:
{{#each context.activeLoans}}
- Member: {{{this.memberName}}} (ID: {{{this.memberId}}}), Amount: ₹{{this.amount}}, Outstanding: ₹{{this.outstanding}}
{{/each}}

DEPOSITS PAID (THIS MONTH):
{{#each context.recentDeposits}}
- Member: {{{this.memberName}}}, Amount: ₹{{this.amount}}, Date: {{{this.date}}}
{{/each}}
--------------------------
{{else}}
Note: No specific group context was provided. Please answer based on general principles.
{{/if}}

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
      return output || { answer: "I'm sorry, I couldn't process that request right now." };
    } catch (err: any) {
      return { answer: `Technical Issue: ${err.message}. Please ensure the AI configuration is correct.` };
    }
  }
);

export async function askAiAssessment(input: AiAssessmentInput): Promise<AiAssessmentOutput> {
  return aiAssessmentFlow(input);
}