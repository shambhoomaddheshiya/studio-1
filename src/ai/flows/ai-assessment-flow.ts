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
  model: 'googleai/gemini-2.0-flash',
  input: { schema: AiAssessmentInputSchema },
  prompt: `You are the Yuva Finance 2 AI Advisor. 
Your job is to provide accurate financial insights and member status reports based on the provided group context data.

CRITICAL INSTRUCTIONS:
1. Searching for People: If the user asks about a specific person (e.g., "Raju", "Amit"), FIRST look for them in the 'MEMBERS LIST' by matching their name (case-insensitive). 
   - If found, note their ID and Status.
   - Then, look for that ID in the 'ACTIVE LOANS' list to report their outstanding balance.
   - Also, look for that ID in the 'DEPOSITS PAID' list to see if they've paid this month.
   - If NOT found in the members list, say you couldn't find a member with that name.

2. Tracking Non-Payments: When asked "Who hasn't paid?" or "Who is pending?":
   - Identify all members from the 'MEMBERS LIST' whose Status is 'Active'.
   - Cross-reference their IDs with the 'DEPOSITS PAID' list for the current month.
   - List the names of all active members who do NOT appear in the 'DEPOSITS PAID' list.

3. Financial Health: Use the 'Total Group Fund', 'Total Outstanding Loans', and 'Total Interest Earned' to provide overall advice.

4. Be professional, concise, and helpful. Use currency symbols (₹) where appropriate.

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
- Member: {{{this.memberName}}} (ID: {{{this.memberId}}}), Amount: ₹{{this.amount}}, Date: {{{this.date}}}
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
      const { text } = await aiAssessmentPrompt(input);
      return { answer: text || "I'm sorry, I couldn't process that request right now." };
    } catch (err: any) {
      console.error('Genkit flow error:', err);
      return { answer: `Technical Issue: ${err.message}. Please check your environment configuration.` };
    }
  }
);

export async function askAiAssessment(input: AiAssessmentInput): Promise<AiAssessmentOutput> {
  return aiAssessmentFlow(input);
}
