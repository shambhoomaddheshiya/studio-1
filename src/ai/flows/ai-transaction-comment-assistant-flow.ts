'use server';
/**
 * @fileOverview An AI assistant that suggests concise and relevant comments for various financial transactions.
 *
 * - aiTransactionCommentAssistant - A function that generates a suggested comment for a given transaction.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const AiTransactionCommentAssistantInputSchema = z.object({
  transactionType: z.string().describe('The type of financial transaction.'),
  amount: z.number().describe('The monetary amount of the transaction.'),
  memberName: z.string().describe('The name of the member associated with the transaction.'),
});
export type AiTransactionCommentAssistantInput = z.infer<typeof AiTransactionCommentAssistantInputSchema>;

const AiTransactionCommentAssistantOutputSchema = z.object({
  suggestedComment: z.string().describe('A concise and relevant comment for the transaction.'),
});
export type AiTransactionCommentAssistantOutput = z.infer<typeof AiTransactionCommentAssistantOutputSchema>;

const commentPrompt = ai.definePrompt({
  name: 'commentPrompt',
  model: 'googleai/gemini-1.5-flash',
  input: { schema: AiTransactionCommentAssistantInputSchema },
  output: { schema: AiTransactionCommentAssistantOutputSchema },
  prompt: `Generate a concise (max 10 words) and professional ledger comment for a {{transactionType}} of ₹{{amount}} for {{memberName}}.`,
});

const aiTransactionCommentAssistantFlow = ai.defineFlow(
  {
    name: 'aiTransactionCommentAssistantFlow',
    inputSchema: AiTransactionCommentAssistantInputSchema,
    outputSchema: AiTransactionCommentAssistantOutputSchema,
  },
  async (input) => {
    try {
      const { output } = await commentPrompt(input);
      if (!output) {
        throw new Error("No output generated from AI model.");
      }
      return output;
    } catch (err: any) {
      return { suggestedComment: "Transaction recorded." };
    }
  }
);

export async function aiTransactionCommentAssistant(input: AiTransactionCommentAssistantInput): Promise<AiTransactionCommentAssistantOutput> {
  return aiTransactionCommentAssistantFlow(input);
}
