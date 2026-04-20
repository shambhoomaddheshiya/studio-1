
'use server';
/**
 * @fileOverview An AI assistant that provides assessments and insights for the finance group.
 * Direct fetch implementation for Vercel compatibility.
 */

import { z } from 'zod';
import Handlebars from 'handlebars';

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

export type AiAssessmentOutput = {
  answer: string;
};

const PROMPT_TEMPLATE = `You are the Yuva Finance 2 AI Advisor. 
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

User Query: {{query}}`;

export async function askAiAssessment(input: AiAssessmentInput): Promise<AiAssessmentOutput> {
  try {
    const template = Handlebars.compile(PROMPT_TEMPLATE);
    const promptText = template(input);

    const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_GENAI_API_KEY;
    if (!apiKey) {
      return { answer: "Configuration Error: GEMINI_API_KEY is not set in the environment variables." };
    }

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [{ text: promptText }],
            },
          ],
          generationConfig: {
            temperature: 0.7,
            topK: 40,
            topP: 0.95,
            maxOutputTokens: 2048,
          },
        }),
      }
    );

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('Gemini API fetch error:', errorData);
      return { answer: `Technical Issue: The AI service returned an error (${response.status}). Please check your API key and network connectivity.` };
    }

    const data = await response.json();
    const answer = data.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!answer) {
      return { answer: "I'm sorry, the AI returned an empty response. Please try again with a different query." };
    }

    return { answer };
  } catch (err: any) {
    console.error('askAiAssessment error:', err);
    return { answer: "Technical Issue: I encountered an unexpected error while processing your request. Details: " + (err.message || 'Unknown error') };
  }
}
