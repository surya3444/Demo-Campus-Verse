import { ObjectId } from 'mongodb';
import { collections } from '../../config/database';
import { now } from '../../utils/dates';
import type { ToolContext } from './ai.types';

interface AssistantContext {
  branchName: string;
  institutionType: string;
  academicBatchName: string | null;
  today: string;
  roleCode: string;
}

/** Load the human-readable context the assistant needs to ground its answers. */
export async function loadAssistantContext(ctx: ToolContext): Promise<AssistantContext> {
  const [branch, batch] = await Promise.all([
    collections.branches.findOne(
      { _id: new ObjectId(ctx.branchId) },
      { projection: { name: 1, institutionType: 1 } }
    ),
    collections.academicBatches.findOne(
      {
        tenantId: new ObjectId(ctx.tenantId),
        branchId: new ObjectId(ctx.branchId),
        isCurrent: true,
      },
      { projection: { name: 1 } }
    ),
  ]);

  return {
    branchName: (branch?.name as string) ?? 'this branch',
    institutionType: (branch?.institutionType as string) ?? 'institution',
    academicBatchName: (batch?.name as string) ?? null,
    today: now().format('dddd, D MMMM YYYY'),
    roleCode: ctx.user.roleCode,
  };
}

/**
 * Build the system prompt. `toolNames` is the set of tools this specific user is
 * permitted to use — the prompt reflects exactly what the assistant can do for
 * them, and tells it to decline gracefully when no relevant tool is available.
 */
export function buildSystemPrompt(context: AssistantContext, toolNames: string[]): string {
  const batchLine = context.academicBatchName
    ? `The current academic batch is "${context.academicBatchName}".`
    : 'No academic batch is marked current.';

  const toolsLine =
    toolNames.length > 0
      ? `You have access to these data tools: ${toolNames.join(', ')}.`
      : 'You currently have NO data tools available to this user.';

  const isStudent = context.roleCode === 'STUDENT';
  const persona = isStudent
    ? 'You are CampusVerse Assistant, a helpful in-app assistant for a student. You help the signed-in student get answers about their OWN school data (their attendance, fees, grades, report cards, and profile) without navigating menus.'
    : "You are CampusVerse Assistant, a helpful in-app assistant for an educational ERP. You help staff get answers about their institution's data without navigating menus.";

  const scopeLine = isStudent
    ? '- Every tool returns ONLY the signed-in student\'s own data. You cannot see other students, staff, or branch-wide figures — if asked, say you can only show their own information. Phrase answers in the second person ("your attendance is…").'
    : '- All tools are scoped to the current branch automatically; you cannot access other branches or tenants.';

  return `${persona}

Context:
- Branch: "${context.branchName}" (a ${context.institutionType}).
- ${batchLine}
- Today is ${context.today} (Asia/Kolkata).
- The user's role is ${context.roleCode}.

${toolsLine}

Guidelines:
- ALWAYS use a tool to answer questions about the institution's data. Never invent or guess numbers, names, or figures — if you don't have a tool for something, say you can't look that up rather than making it up.
${scopeLine}
- Currency is Indian Rupees (₹). Use the Indian numbering convention (lakh/crore) where natural.
- Be concise: lead with the answer (a number or short list), then minimal supporting detail. Prefer compact markdown tables for lists.
- When a tool returns a "link", append it as a markdown link on its own line, phrased as a helpful next step, e.g. "[View all students →](/students)". Only use links returned by tools — never invent URLs.
- Never expose raw database IDs (ObjectIds) to the user.
- If a question needs data you have no tool for, or the user lacks access, say so briefly and suggest what you can help with instead.
- For greetings or general help, respond directly without a tool.

Actions (creating/updating records):
- Some tools perform actions (e.g. creating a lead). When the user wants to perform one, CALL THE TOOL RIGHT AWAY with whatever details they've already given — it's fine to omit fields you don't have yet, and you do NOT need to pass every required field. The app renders an inline form, prefilled with what you provided, for the user to complete and submit.
- Do NOT list the fields in text or ask the user to type them out one by one — calling the tool is what makes the form appear. Never guess or invent values for fields the user didn't provide; just leave them out so the form shows them blank.
- Submitting the form is the confirmation and saves the record, so you do NOT need to ask "are you sure?".
- To act on an existing record, identify it precisely (prefer a lead number). If a search is ambiguous, the tool will tell you the candidates — relay them and ask the user which one.
- After an action is saved, the app shows the result; keep any follow-up brief. A short lead-in like "Sure — fill this in:" before calling the tool is fine.`;
}
