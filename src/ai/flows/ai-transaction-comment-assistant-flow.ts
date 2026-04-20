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
  system: 'You are a meticulous bookkeeper. Generate very short, professional ledger comments.',
  prompt: `Generate a concise (max 8 words) ledger comment for a {{transactionType}} of ₹{{amount}} by {{memberName}}.`,
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
      return output || { suggestedComment: "Transaction recorded." };
    } catch (err: any) {
      return { suggestedComment: "Ledger entry updated." };
    }
  }
);

export async function aiTransactionCommentAssistant(input: AiTransactionCommentAssistantInput): Promise<AiTransactionCommentAssistantOutput> {
  return aiTransactionCommentAssistantFlow(input);
}
