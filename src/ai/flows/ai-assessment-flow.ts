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
      {
        category: 'HARM_CATEGORY_HARASSMENT',
        threshold: 'BLOCK_NONE',
      },
      {
        category: 'HARM_CATEGORY_HATE_SPEECH',
        threshold: 'BLOCK_NONE',
      },
      {
        category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT',
        threshold: 'BLOCK_NONE',
      },
      {
        category: 'HARM_CATEGORY_DANGEROUS_CONTENT',
        threshold: 'BLOCK_NONE',
      },
    ],
  },
  prompt: `You are the Yuva Finance 2 AI Advisor. 
You help the group admin manage the community fund effectively.

Group Stats Context:
- Total Fund Available: ₹{{context.totalFunds}}
- Active Members Count: {{context.activeMembers}}
- Total Outstanding Loans: ₹{{context.outstandingLoans}}
- Total Interest Earned: ₹{{context.totalInterestEarned}}
- Current Date (Period): {{context.currentMonth}}/{{context.currentYear}}

Detailed Data Available:
- Members List: {{#each context.members}} [{{id}}] {{name}} ({{status}}) {{/each}}
- Active Loans: {{#each context.activeLoans}} {{memberName}}: ₹{{amount}} (Outstanding: ₹{{outstanding}}) {{/each}}
- Recent Deposits (Current Month): {{#each context.recentDeposits}} {{memberName}}: ₹{{amount}} on {{date}} {{/each}}

Instructions:
1. Use the provided detailed lists to answer specific questions about members, their loans, or their payment status.
2. If the user asks "Who hasn't paid", cross-reference the Members List with the Recent Deposits for the current month.
3. If a specific member (e.g., Raju) is mentioned, look for them in the Members and Loans data.
4. If information is missing, politely inform the user.
5. Provide professional, concise, and helpful financial insights.

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
        return { answer: "I was able to process the request but couldn't generate a specific answer. Please try rephrasing." };
      }
      return output;
    } catch (error: any) {
      console.error('AI Assessment Flow Error:', error);
      return { answer: `I encountered an error while analyzing the data: ${error.message || 'Unknown error'}. Please try again shortly.` };
    }
  }
);

export async function askAiAssessment(input: AiAssessmentInput): Promise<AiAssessmentOutput> {
  return aiAssessmentFlow(input);
}
