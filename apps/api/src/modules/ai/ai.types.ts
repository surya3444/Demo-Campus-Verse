import type { ZodTypeAny } from 'zod';
import { TokenPayload } from '@campus-verse/shared';

/**
 * Per-request execution context handed to every tool. tenantId / branchId are
 * injected from the authenticated request — NEVER from model-provided args — so
 * a tool can only ever read/write the caller's own branch data.
 */
export interface ToolContext {
  tenantId: string;
  branchId: string;
  user: TokenPayload;
  /**
   * The caller's own student record id, resolved server-side when the caller is
   * a STUDENT. Student-scoped tools hard-filter on this so a student can only
   * ever read their own data — never another student's or branch aggregates.
   */
  studentId?: string;
}

/**
 * read  — runs inline during the chat loop (queries).
 * write — mutates data. The model only ever PROPOSES a write; the backend emits
 *         a confirmation card and waits for the user to confirm via the separate
 *         /ai/chat/execute endpoint before anything is saved.
 */
export type ToolKind = 'read' | 'write';

export interface ConfirmField {
  label: string;
  value: string;
}

/** What the user is shown before a write executes. */
export interface ConfirmCard {
  title: string;
  fields: ConfirmField[];
}

/** A single input rendered in an inline action form. `name` maps to an args key. */
export type FormFieldType = 'text' | 'email' | 'tel' | 'number' | 'textarea' | 'select' | 'date';

export interface FormFieldOption {
  value: string;
  label: string;
}

export interface FormField {
  name: string;
  label: string;
  type: FormFieldType;
  required?: boolean;
  placeholder?: string;
  /** Optional helper text shown under the field. */
  help?: string;
  /** Options for `select` fields. */
  options?: FormFieldOption[];
}

/**
 * An editable form a write tool exposes so the user can complete/review the
 * action inline instead of typing fields out in chat. Submitting the form is the
 * confirmation, so it goes straight to /ai/chat/execute (re-validated there).
 */
export interface ActionForm {
  title: string;
  submitLabel: string;
  fields: FormField[];
}

/**
 * A tool the assistant may call. Each maps to existing service methods and
 * declares the permission a user must hold to use it; the registry filters the
 * exposed tool set per request from the user's RBAC permissions.
 */
export interface ToolDefinition {
  name: string;
  description: string;
  kind: ToolKind;
  /** JSON Schema for the tool's arguments (business inputs only — never IDs). */
  parameters: Record<string, unknown>;
  /** Permission the caller must hold for this tool to be offered. */
  requiredPermission: { module: string; action: string };
  /**
   * When true, this tool reads only the caller's OWN student data (filtered by
   * ctx.studentId). Such tools are offered exclusively to STUDENT users, and
   * students are offered ONLY these tools — never the branch/operational ones.
   */
  studentScoped?: boolean;
  execute: (ctx: ToolContext, args: Record<string, unknown>) => Promise<ToolResult>;
  /** write tools only: strict validation before proposing/executing the action. */
  argsSchema?: ZodTypeAny;
  /** write tools only: build the confirmation card from validated args. */
  confirm?: (args: Record<string, unknown>) => ConfirmCard;
  /**
   * write tools only: an inline form the user fills in to complete the action.
   * Preferred over `confirm` — the assistant proposes the action and the client
   * renders this form prefilled with whatever the model could extract.
   */
  form?: ActionForm;
}

/** A write action proposed to the user, emitted over the `confirm` SSE event. */
export interface ProposedAction extends ConfirmCard {
  /** The model's tool_call id (correlates the proposal to the turn). */
  id: string;
  tool: string;
  args: Record<string, unknown>;
}

/** An editable action form proposed to the user, emitted over the `form` SSE event. */
export interface ProposedForm extends ActionForm {
  /** The model's tool_call id (correlates the proposal to the turn). */
  id: string;
  tool: string;
  /** Prefill values — strictly-valid where available, else the model's partial args. */
  values: Record<string, unknown>;
}

/**
 * What a tool returns. `data` is summarised by the model; `link` (optional) is a
 * deep link to the matching frontend page the model surfaces to the user.
 */
export interface ToolResult {
  data: unknown;
  link?: string;
}

/** A single chat turn as sent by the client / replayed to the model. */
export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}
