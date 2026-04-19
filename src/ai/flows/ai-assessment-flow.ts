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
  }).optional().describe('Current group financial summary for context.'),
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
    const { output } = await ai.generate({
      prompt: `You are the Yuva Finance 2 AI Advisor. 
      You help the group admin manage the community fund effectively.
      
      Group Stats Context:
      - Total Fund Available: ₹${input.context?.totalFunds ?? 'Unknown'}
      - Active Members: ${input.context?.activeMembers ?? 'Unknown'}
      - Total Outstanding Loans: ₹${input.context?.outstandingLoans ?? 'Unknown'}
      - Total Interest Earned: ₹${input.context?.totalInterestEarned ?? 'Unknown'}
      
      User Question: ${input.query}
      
      Provide a professional, insightful, and encouraging response. 
      - If the user asks for financial status, use the context provided.
      - If they ask for suggestions, focus on fund growth, loan repayment efficiency, or member engagement.
      - Keep responses concise but comprehensive.`,
    });
    return { answer: output?.text || 'I am sorry, I could not generate a response.' };
  }
);
