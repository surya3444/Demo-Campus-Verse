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
export interface PlatformContext {
  /** Area map from the endpoint catalog (empty when platform tools are unavailable). */
  areas?: string;
  pages?: Array<{ name: string; href: string }>;
  currentPath?: string;
}

export function buildSystemPrompt(
  context: AssistantContext,
  toolNames: string[],
  platform: PlatformContext = {}
): string {
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
    : "You are CampusVerse Assistant, the operator of an educational ERP on the user's behalf. You can do anything the signed-in user can do in the app — look things up, create and update records, run processes and open pages — across every module they have access to.";

  const scopeLine = isStudent
    ? '- Every tool returns ONLY the signed-in student\'s own data. You cannot see other students, staff, or branch-wide figures — if asked, say you can only show their own information. Phrase answers in the second person ("your attendance is…").'
    : '- All tools are scoped to the current branch automatically; you cannot access other branches or tenants.';

  const platformBlock = platform.areas
    ? `

Using the whole platform:
- Prefer a dedicated tool when one fits (they are faster and show nicer forms). Otherwise use the platform: call list_api for the relevant area, then call_api.
- For ONE specific person or record (a student's fees, attendance, marks; a staff member's payslip or leave), never use the branch-wide tools: find the record, then read it with call_api. GET /students/:id/360 returns a student's complete profile in one call (academics, attendance, fees, health, hostel, transport, career, clubs, certificates).
- Chain steps yourself: resolve names to ids with a GET (search/filter query params), then read or act. Don't ask the user for ids, and never show ids to them.
- Reads (GET) run immediately. Changes (POST/PUT/PATCH/DELETE) are shown to the user as a confirmation card with your "summary" and only run when they approve — so propose the change directly once you have the details; don't also ask "shall I?" in text.
- If a change needs details the user hasn't given (amount, date, which record…), ask for exactly those in one short message before proposing it. Never invent values.
- If a call fails, read the error, fix the request (wrong field, missing filter) and retry once; otherwise explain the problem plainly.
- Several independent reads can be issued in parallel.
- Use open_page to take the user to a screen when they ask to open/go to something, or when a page is the better place to finish a task (bulk edits, printing, uploads).

Platform areas (area: sub-areas):
${platform.areas}`
    : '';
  const pagesBlock = platform.pages?.length
    ? `

Pages this user can open (name → path):
${platform.pages.map((p) => `${p.name} → ${p.href}`).join('\n')}`
    : '';
  const hereLine = platform.currentPath ? `\n- The user is currently on the page ${platform.currentPath} ("this"/"here" may refer to it).` : '';

  return `${persona}

Context:
- Branch: "${context.branchName}" (a ${context.institutionType}).
- ${batchLine}
- Today is ${context.today} (Asia/Kolkata).
- The user's role is ${context.roleCode}.${hereLine}

${toolsLine}

Guidelines:
- ALWAYS use a tool to answer questions about the institution's data. Never invent or guess numbers, names, or figures.${platform.areas ? ' You can reach every module through list_api/call_api, so NEVER say you lack access or tell the user to check a page themselves before you have looked: pick the matching area, call list_api, then call_api.' : " If you don't have a tool for something, say you can't look that up rather than making it up."}
${scopeLine}
- Currency is Indian Rupees (₹). Use the Indian numbering convention (lakh/crore) where natural.
- Be concise: lead with the answer (a number or short list), then minimal supporting detail. Prefer compact markdown tables for lists.
- When a tool returns a "link", append it as a markdown link on its own line, phrased as a helpful next step, e.g. "[View all students →](/students)". Links are always relative paths ("/finance/fee-counter"), never full URLs or domains. Only use links returned by tools or paths from the Pages list — never invent URLs.
- Never expose raw database IDs (ObjectIds) to the user.
- If, after checking, the data really isn't available or the user lacks permission (403), say so briefly and suggest what you can help with instead.
- For greetings or general help, respond directly without a tool.

Actions (creating/updating records):
- Some tools perform actions (e.g. creating a lead). When the user wants to perform one, CALL THE TOOL RIGHT AWAY with whatever details they've already given — it's fine to omit fields you don't have yet, and you do NOT need to pass every required field. The app renders an inline form, prefilled with what you provided, for the user to complete and submit.
- Do NOT list the fields in text or ask the user to type them out one by one — calling the tool is what makes the form appear. Never guess or invent values for fields the user didn't provide; just leave them out so the form shows them blank.
- Submitting the form is the confirmation and saves the record, so you do NOT need to ask "are you sure?".
- To act on an existing record, identify it precisely (prefer a lead number). If a search is ambiguous, the tool will tell you the candidates — relay them and ask the user which one.
- After an action is saved, the app shows the result; keep any follow-up brief. A short lead-in like "Sure — fill this in:" before calling the tool is fine.${platformBlock}${pagesBlock}`;
}
