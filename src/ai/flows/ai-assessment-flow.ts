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

const AiAssessmentOutputSchema = z.object({
  answer: z.string().describe('The AI\'s response providing insights or answers.'),
});

export async function askAiAssessment(input: z.infer<typeof AiAssessmentInputSchema>) {
  return aiAssessmentFlow(input);
}

const aiAssessmentFlow = ai.defineFlow(
  {
    name: 'aiAssessmentFlow',
    inputSchema: AiAssessmentInputSchema,
    outputSchema: AiAssessmentOutputSchema,
  },
  async (input) => {
    const response = await ai.generate({
      prompt: `You are the Yuva Finance 2 AI Advisor. 
      You help the group admin manage the community fund effectively.
      
      Group Stats Context:
      - Total Fund Available: ₹${input.context?.totalFunds ?? 'Unknown'}
      - Active Members Count: ${input.context?.activeMembers ?? 'Unknown'}
      - Total Outstanding Loans: ₹${input.context?.outstandingLoans ?? 'Unknown'}
      - Total Interest Earned: ₹${input.context?.totalInterestEarned ?? 'Unknown'}
      - Current Date: ${input.context?.currentMonth}/${input.context?.currentYear}
      
      Detailed Data Available:
      - Members List: ${JSON.stringify(input.context?.members || [])}
      - Active Loans: ${JSON.stringify(input.context?.activeLoans || [])}
      - Recent Deposits (Current Period): ${JSON.stringify(input.context?.recentDeposits || [])}
      
      Instructions:
      1. Use the "Detailed Data" to answer specific questions about people, their loans, or their payment status.
      2. If a user asks "Who hasn't paid", compare the Members List with the Recent Deposits for the current month.
      3. If a user asks about a specific person (e.g., Raju), search for them in the Members and Loans data.
      4. If you don't find a specific person or data point, politely inform the user.
      5. Provide professional, insightful, and encouraging responses.
      6. Keep responses concise but comprehensive.
      
      User Question: ${input.query}`,
    });
    return { answer: response.text || 'I am sorry, I could not generate a response.' };
  }
);
