import OpenAI from 'openai';
import { env } from '../../config/env';
import { logger } from '../../lib/logger';
import { ApiError } from '../../middleware/errorHandler';
import { buildToolsForUser, getPermittedTool } from './ai.tools';
import { areaIndex } from './ai.catalog';
import { buildSystemPrompt, loadAssistantContext } from './ai.prompts';
import type { ChatMessage, ToolContext, ToolDefinition, ToolResult } from './ai.types';

type ChatParam = OpenAI.Chat.Completions.ChatCompletionMessageParam;
type ChatTool = OpenAI.Chat.Completions.ChatCompletionTool;

/** SSE event sink wired to the HTTP response by the controller. */
export type Emit = (
  event: 'delta' | 'tool' | 'confirm' | 'form' | 'navigate' | 'done' | 'error',
  data: unknown
) => void;

// Safety bound on the agentic loop: model → tools → model → … Each iteration is
// one model turn; tool execution between turns doesn't count against this.
const MAX_ITERATIONS = 10;

// Multi-step platform work (find ids → read → act) needs the stronger model;
// simple questions answered by a dedicated tool stay on the fast, cheap one.
const PLATFORM_TOOL_NAMES = new Set(['list_api', 'call_api']);

// Short replies are flushed at the end of the turn; longer ones start streaming here.
const HOLD_CHARS = 160;
const EMPTY_REPLY =
  "I couldn't complete that. It may need details I don't have or a permission your role doesn't include — tell me a bit more, or open the relevant page and I'll guide you.";

/**
 * What the tools returned on each user's previous turn. The client replays only
 * the visible text, so without this a follow-up like "1" or "the second one"
 * loses the ids the assistant just found. Per process, 30 minutes.
 * ponytail: in-memory per API instance; move to Redis if the API is scaled out.
 */
const MEMORY_TTL_MS = 30 * 60 * 1000;
const lastTurnFacts = new Map<string, { at: number; facts: string }>();

function recall(userId: string): string | null {
  const m = lastTurnFacts.get(userId);
  if (!m || Date.now() - m.at > MEMORY_TTL_MS) return null;
  return m.facts;
}

function toOpenAITool(tool: ToolDefinition): ChatTool {
  return {
    type: 'function',
    function: {
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters,
    },
  };
}

function parseArgs(raw: string): Record<string, unknown> {
  if (!raw) return {};
  try {
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return {};
  }
}

class AiService {
  private client: OpenAI | null = null;

  isConfigured(): boolean {
    return !!env.OPENAI_API_KEY;
  }

  private getClient(): OpenAI {
    if (!env.OPENAI_API_KEY) {
      throw new ApiError(
        'AI_NOT_CONFIGURED',
        'OPENAI_API_KEY is not set. The AI assistant is disabled.',
        503
      );
    }
    if (!this.client) {
      this.client = new OpenAI({ apiKey: env.OPENAI_API_KEY });
    }
    return this.client;
  }

  /**
   * Run the streaming function-calling loop. Read tools run inline between model
   * turns; a write tool is never executed here — when the model calls one with
   * valid args, we emit a `confirm` event and stop, so the user can approve it
   * via executeAction(). Resolves on a final answer, a pending confirmation, or
   * loop exhaustion / abort.
   */
  async streamChat(
    ctx: ToolContext,
    messages: ChatMessage[],
    emit: Emit,
    signal?: AbortSignal
  ): Promise<void> {
    const client = this.getClient();

    const tools = buildToolsForUser(ctx.user);
    const context = await loadAssistantContext(ctx);
    const hasPlatform = tools.some((t) => t.name === 'call_api');
    const system = buildSystemPrompt(
      context,
      tools.map((t) => t.name),
      {
        areas: hasPlatform ? areaIndex(ctx.user) : undefined,
        pages: ctx.pages,
        currentPath: ctx.currentPath,
      }
    );
    const openaiTools = tools.map(toOpenAITool);

    const previous = messages.length > 1 ? recall(ctx.user.userId) : null;
    let said = '';
    let lastLink: { href: string; label: string } | null = null;
    const facts: string[] = [];
    const convo: ChatParam[] = [
      { role: 'system', content: system },
      ...(previous
        ? [
            {
              role: 'system',
              content: `Tool results from your previous turn in this conversation (ids are for your use only; never show them). Use them to resolve follow-ups like "1", "the second one" or "her":\n${previous}`,
            } as ChatParam,
          ]
        : []),
      ...messages.map((m) => ({ role: m.role, content: m.content }) as ChatParam),
    ];

    let model = env.OPENAI_CHAT_MODEL;

    try {
      for (let iteration = 0; iteration < MAX_ITERATIONS; iteration++) {
        if (signal?.aborted) return;

        const stream = await client.chat.completions.create(
          {
            model,
            messages: convo,
            // GPT-5.x on Chat Completions only allows function tools without
            // hidden reasoning; "none" is also the fastest setting for chat.
            ...(model.startsWith('gpt-5') ? { reasoning_effort: 'none' as unknown as 'low' } : {}),
            ...(openaiTools.length > 0 ? { tools: openaiTools, tool_choice: 'auto' as const } : {}),
            stream: true,
          },
          { signal }
        );

        let text = '';
        // Text is held back until it's clearly the answer: a model that writes a
        // reply and then calls a tool would otherwise show it twice.
        let flushed = 0;
        let sawToolCall = false;
        const toolCalls: Record<number, { id: string; name: string; args: string }> = {};

        for await (const chunk of stream) {
          const choice = chunk.choices[0];
          if (!choice) continue;
          const delta = choice.delta;

          if (delta?.content) {
            text += delta.content;
            if (!sawToolCall && (flushed > 0 || text.length >= HOLD_CHARS)) {
              emit('delta', { text: text.slice(flushed) });
              flushed = text.length;
            }
          }

          if (delta?.tool_calls) {
            sawToolCall = true;
            for (const tc of delta.tool_calls) {
              const idx = tc.index ?? 0;
              const acc = (toolCalls[idx] ??= { id: '', name: '', args: '' });
              if (tc.id) acc.id = tc.id;
              if (tc.function?.name) acc.name += tc.function.name;
              if (tc.function?.arguments) acc.args += tc.function.arguments;
            }
          }
        }

        const calls = Object.values(toolCalls).filter((c) => c.id && c.name);
        if (calls.length === 0) {
          // No tool requested — the model has produced its final answer.
          if (text.length > flushed) emit('delta', { text: text.slice(flushed) });
          said += text;
          if (!said.trim()) emit('delta', { text: EMPTY_REPLY });
          // Always offer the exact page the answer came from (e.g. this section's
          // timetable), even when the model forgot to include the link.
          else if (lastLink && !said.includes(lastLink.href)) {
            emit('delta', { text: `\n\n[${lastLink.label} →](${lastLink.href})` });
          }
          return;
        }
        said += text.slice(0, flushed);
        if (calls.some((c) => PLATFORM_TOOL_NAMES.has(c.name)))
          model = env.OPENAI_CHAT_MODEL_COMPLEX;

        // Replay the assistant's tool-call turn (required before any tool result).
        convo.push({
          role: 'assistant',
          content: text || null,
          tool_calls: calls.map((c) => ({
            id: c.id,
            type: 'function',
            function: { name: c.name, arguments: c.args || '{}' },
          })),
        });

        // Classify each call. A write tool with valid args is a *proposal*, not an
        // execution.
        const classified = calls.map((call) => {
          const tool = getPermittedTool(ctx.user, call.name);
          const args = parseArgs(call.args);
          const writes = tool?.kind === 'write' && (tool.isWrite ? tool.isWrite(args) : true);
          if (tool && writes && tool.argsSchema) {
            return {
              call,
              tool,
              args,
              write: true as const,
              parsed: tool.argsSchema.safeParse(args),
              dynamic: tool.buildForm?.(args) ?? null,
            };
          }
          return { call, tool, args, write: false as const };
        });

        // A write tool is a *proposal*, never executed here. Prefer an editable
        // inline form (the user completes/reviews it and submitting it == the
        // confirmation); fall back to the read-only confirm card for tools that
        // only declare `confirm` and were called with already-valid args.
        const proposable = classified.filter(
          (c) =>
            c.write && c.tool && (c.dynamic || c.tool.form || (c.parsed.success && c.tool.confirm))
        );
        if (proposable.length > 0) {
          // Propose the action(s) and stop — nothing is mutated until the user
          // submits. We don't call the model again, so the dangling tool_calls
          // (without results) never reach the API.
          for (const c of proposable) {
            if (!c.write || !c.tool) continue;
            // Prefill with strictly-valid values where the model supplied them,
            // else its raw (partial) args, so the user only fills what's missing.
            const prefill = c.parsed.success ? (c.parsed.data as Record<string, unknown>) : c.args;
            facts.push(
              `proposed ${c.tool.name}(${c.call.args || '{}'}) to the user for confirmation`
            );
            if (c.dynamic) {
              emit('form', {
                id: c.call.id,
                tool: c.tool.name,
                title: c.dynamic.form.title,
                submitLabel: c.dynamic.form.submitLabel,
                fields: c.dynamic.form.fields,
                values: c.dynamic.values,
              });
            } else if (c.tool.form) {
              emit('form', {
                id: c.call.id,
                tool: c.tool.name,
                title: c.tool.form.title,
                submitLabel: c.tool.form.submitLabel,
                fields: c.tool.form.fields,
                values: prefill,
              });
            } else if (c.parsed.success && c.tool.confirm) {
              emit('confirm', {
                id: c.call.id,
                tool: c.tool.name,
                args: prefill,
                ...c.tool.confirm(prefill),
              });
            }
          }
          return;
        }

        // No confirmable writes: produce a result for every call, then continue.
        for (const c of classified) {
          let content: unknown;
          if (c.write) {
            const issues = c.parsed.success ? [] : c.parsed.error.issues.map((i) => i.message);
            content = {
              error: `Cannot proceed yet: ${issues.join('; ')}. Ask the user for the missing details, then try again.`,
            };
          } else if (!c.tool) {
            content = { error: `The "${c.call.name}" tool is not available to you.` };
          } else {
            emit('tool', { name: c.call.name });
            content = await this.runTool(ctx, c.tool, c.args);
            const r = content as Partial<ToolResult> | undefined;
            if (r?.link) lastLink = { href: r.link, label: r.linkLabel ?? 'Open in CampusVerse' };
            const href = (content as { data?: { navigate?: string } })?.data?.navigate;
            if (href) emit('navigate', { href });
          }
          const json = JSON.stringify(content);
          facts.push(`${c.call.name}(${c.call.args || '{}'}) → ${json.slice(0, 2500)}`);
          convo.push({ role: 'tool', tool_call_id: c.call.id, content: json });
        }
      }

      // Loop exhausted — let the user know rather than going silent.
      emit('delta', {
        text: '\n\n_I had to stop after several steps. Try asking a more specific question._',
      });
    } finally {
      if (facts.length)
        lastTurnFacts.set(ctx.user.userId, {
          at: Date.now(),
          facts: facts.join('\n').slice(-8000),
        });
    }
  }

  /**
   * Execute a previously-proposed write action after the user confirmed it.
   * Re-checks permission and re-validates args server-side — the client is never
   * trusted. Throws ApiError on permission / validation / execution failure.
   */
  async executeAction(
    ctx: ToolContext,
    toolName: string,
    rawArgs: Record<string, unknown>
  ): Promise<ToolResult> {
    const tool = getPermittedTool(ctx.user, toolName);
    if (!tool || tool.kind !== 'write' || !tool.argsSchema || tool.isWrite?.(rawArgs) === false) {
      throw new ApiError('AI_ACTION_NOT_ALLOWED', 'This action is not available to you.', 403);
    }
    const parsed = tool.argsSchema.safeParse(rawArgs);
    if (!parsed.success) {
      throw new ApiError(
        'AI_ACTION_INVALID',
        parsed.error.issues.map((i) => i.message).join('; '),
        400
      );
    }
    return tool.execute(ctx, parsed.data as Record<string, unknown>);
  }

  private async runTool(
    ctx: ToolContext,
    tool: ToolDefinition,
    args: Record<string, unknown>
  ): Promise<unknown> {
    try {
      const result = await tool.execute(ctx, args);
      logger.debug(
        { tool: tool.name, args, result: JSON.stringify(result).slice(0, 400) },
        'AI tool call'
      );
      return result;
    } catch (err) {
      logger.warn({ err, tool: tool.name, tenantId: ctx.tenantId }, 'AI tool execution failed');
      return { error: err instanceof Error ? err.message : 'Tool execution failed' };
    }
  }
}

export const aiService = new AiService();
