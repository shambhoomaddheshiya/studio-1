'use server';
/**
 * @fileOverview An AI assistant that suggests concise and relevant comments for various financial transactions.
 *
 * - aiTransactionCommentAssistant - A function that generates a suggested comment for a given transaction.
 * - AiTransactionCommentAssistantInput - The input type for the aiTransactionCommentAssistant function.
 * - AiTransactionCommentAssistantOutput - The return type for the aiTransactionCommentAssistant function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const AiTransactionCommentAssistantInputSchema = z.object({
  transactionType: z.enum([
    'deposit',
    'loan_disbursement',
    'loan_repayment',
    'interest_payment',
    'fine_payment',
    'other'
  ]).describe('The type of financial transaction (e.g., deposit, loan_disbursement, loan_repayment, interest_payment, fine_payment, other).'),
  amount: z.number().describe('The monetary amount of the transaction.'),
  memberName: z.string().describe('The name of the member associated with the transaction.'),
  transactionDate: z.string().optional().describe('The date of the transaction in 