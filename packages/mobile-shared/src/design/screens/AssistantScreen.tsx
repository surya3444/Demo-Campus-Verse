import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { ArrowUp, Check, ChevronLeft, RotateCcw, Sparkles, X } from 'lucide-react-native';
import { API_URL } from '../../api/client';
import {
  executeAssistantAction,
  streamAssistant,
  type ChatTurn,
  type FormFieldSpec,
  type ProposedAction,
} from '../../api/assistant';
import { AnimatedLogoMark, LogoMark } from '../components/Logo';
import { Text } from '../components/Text';
import { brand, color, elevation } from '../tokens';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  tool?: string;
  action?: ProposedAction;
  actionState?: 'pending' | 'running' | 'done' | 'cancelled' | 'error';
  actionNote?: string;
  error?: boolean;
}

const WEB_URL = process.env.EXPO_PUBLIC_WEB_URL || API_URL.replace('://api.', '://').replace(/\/api\/v1\/?$/, '');
const TOOL_LABELS: Record<string, string> = {
  list_api: 'Finding the right place',
  call_api: 'Working on it',
  get_timetable: 'Opening the timetable',
  find_students: 'Looking up students',
  get_fee_dues: 'Checking fees',
  get_fee_collection: 'Checking collections',
  get_attendance_today: 'Checking attendance',
  get_branch_summary: 'Gathering today’s summary',
};

export interface AssistantProps {
  /** Prompts shown on an empty chat, suited to the app's users. */
  suggestions: string[];
  /** Map a web path from a reply (e.g. /students/123) to an in-app route, or null to open the web. */
  routeFor?: (href: string) => string | null;
}

/**
 * The CampusVerse Assistant on mobile — the same assistant as the web. It
 * reads and acts across the platform as the signed-in user; anything that
 * changes data appears as a card to confirm (or a form to complete) first.
 */
export function AssistantScreen({ suggestions, routeFor }: AssistantProps) {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const scroll = useRef<ScrollView>(null);
  const abort = useRef<(() => void) | null>(null);

  useEffect(() => () => abort.current?.(), []);
  const patch = (id: string, f: (m: Message) => Message) => setMessages((ms) => ms.map((m) => (m.id === id ? f(m) : m)));
  const openLink = (href: string) => {
    if (/^https?:/.test(href)) return void Linking.openURL(href);
    const route = routeFor?.(href);
    if (route) router.push(route as never);
    else void Linking.openURL(`${WEB_URL}${href}`);
  };

  const send = async (text: string) => {
    const content = text.trim();
    if (!content || streaming) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
    const history: ChatTurn[] = messages.filter((m) => m.text.trim()).map((m) => ({ role: m.role, content: m.text }));
    const userMsg: Message = { id: `u${Date.now()}`, role: 'user', text: content };
    const replyId = `a${Date.now()}`;
    setMessages((ms) => [...ms, userMsg, { id: replyId, role: 'assistant', text: '' }]);
    setInput('');
    setStreaming(true);
    abort.current = await streamAssistant([...history, { role: 'user', content }], {
      onDelta: (t) => patch(replyId, (m) => ({ ...m, text: m.text + t, tool: undefined })),
      onTool: (name) => patch(replyId, (m) => ({ ...m, tool: name })),
      onAction: (action) => patch(replyId, (m) => ({ ...m, action, actionState: 'pending', tool: undefined })),
      onNavigate: (href) => openLink(href),
      onError: (msg) => patch(replyId, (m) => ({ ...m, text: m.text || msg, error: !m.text, tool: undefined })),
      onDone: () => {
        setStreaming(false);
        patch(replyId, (m) => ({ ...m, tool: undefined }));
      },
    });
  };

  const runAction = async (m: Message, args: Record<string, unknown>) => {
    if (!m.action) return;
    patch(m.id, (x) => ({ ...x, actionState: 'running' }));
    try {
      const r = await executeAssistantAction(m.action.tool, args);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
      patch(m.id, (x) => ({ ...x, actionState: 'done', actionNote: r.message ?? 'Done.' }));
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message;
      patch(m.id, (x) => ({ ...x, actionState: 'error', actionNote: msg ?? 'That couldn’t be completed.' }));
    }
  };

  const empty = messages.length === 0;
  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: color.paper }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <StatusBar style="light" />
      <LinearGradient colors={[brand.navy950, brand.navy800]} style={{ paddingTop: insets.top + 8, paddingBottom: 14, paddingHorizontal: 16 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Pressable onPress={() => router.back()} hitSlop={10} accessibilityLabel="Back" style={{ width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.12)' }}>
            <ChevronLeft size={20} color="#fff" />
          </Pressable>
          <View style={{ marginLeft: 12, flex: 1 }}>
            <Text variant="h3" tone="onInk">
              CampusVerse Assistant
            </Text>
            <Text variant="micro" tone="onInkMute">
              Asks and acts across your campus — you confirm every change
            </Text>
          </View>
          {!empty ? (
            <Pressable onPress={() => (abort.current?.(), setMessages([]), setStreaming(false))} hitSlop={10} accessibilityLabel="New chat">
              <RotateCcw size={19} color="#fff" />
            </Pressable>
          ) : null}
        </View>
      </LinearGradient>

      <ScrollView
        ref={scroll}
        onContentSizeChange={() => scroll.current?.scrollToEnd({ animated: true })}
        contentContainerStyle={{ padding: 16, paddingBottom: 24, flexGrow: 1 }}
        keyboardShouldPersistTaps="handled"
      >
        {empty ? (
          <View style={{ alignItems: 'center', marginTop: 34 }}>
            <AnimatedLogoMark size={84} />
            <Text variant="h1" tone="ink" align="center" style={{ marginTop: 22 }}>
              Ask{' '}
              <Text variant="h1" italic>
                anything
              </Text>{' '}
              about campus
            </Text>
            <Text variant="body" tone="inkMute" align="center" style={{ marginTop: 8, maxWidth: 300 }}>
              Look things up, take actions or jump to the right screen.
            </Text>
            <View style={{ marginTop: 24, alignSelf: 'stretch', gap: 10 }}>
              {suggestions.map((s) => (
                <Pressable key={s} onPress={() => send(s)}>
                  <View style={[{ flexDirection: 'row', alignItems: 'center', padding: 14, borderRadius: 16, backgroundColor: color.card, borderWidth: 1, borderColor: color.rule }, elevation.soft]}>
                    <Sparkles size={16} color={brand.cyan600} />
                    <Text variant="bodyStrong" tone="ink" style={{ marginLeft: 10, flex: 1 }}>
                      {s}
                    </Text>
                  </View>
                </Pressable>
              ))}
            </View>
          </View>
        ) : (
          messages.map((m) =>
            m.role === 'user' ? (
              <View key={m.id} style={{ alignSelf: 'flex-end', maxWidth: '85%', marginBottom: 12 }}>
                <LinearGradient colors={[brand.navy800, brand.navy700]} style={{ paddingHorizontal: 14, paddingVertical: 10, borderRadius: 18, borderBottomRightRadius: 6 }}>
                  <Text variant="body" tone="onInk">
                    {m.text}
                  </Text>
                </LinearGradient>
              </View>
            ) : (
              <View key={m.id} style={{ flexDirection: 'row', marginBottom: 14 }}>
                <View style={{ marginTop: 2, marginRight: 8 }}>
                  <LogoMark size={26} />
                </View>
                <View style={{ flex: 1 }}>
                  {m.text ? (
                    <View style={[{ backgroundColor: m.error ? brand.dangerWash : color.card, borderRadius: 18, borderTopLeftRadius: 6, padding: 14, borderWidth: 1, borderColor: color.rule }, elevation.soft]}>
                      <Markdown text={m.text} onLink={openLink} />
                    </View>
                  ) : null}
                  {m.tool || (streaming && !m.text && !m.action && m === messages[messages.length - 1]) ? (
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: m.text ? 8 : 4 }}>
                      <ActivityIndicator size="small" color={brand.cyan600} />
                      <Text variant="caption" tone="inkMute" style={{ marginLeft: 8 }}>
                        {(m.tool && TOOL_LABELS[m.tool]) || 'Thinking'}…
                      </Text>
                    </View>
                  ) : null}
                  {m.action ? <ActionCard message={m} onRun={(args) => runAction(m, args)} onCancel={() => patch(m.id, (x) => ({ ...x, actionState: 'cancelled' }))} /> : null}
                </View>
              </View>
            )
          )
        )}
      </ScrollView>

      <View style={{ paddingHorizontal: 12, paddingTop: 8, paddingBottom: insets.bottom + 10, backgroundColor: color.paper, borderTopWidth: 1, borderTopColor: color.rule }}>
        <View style={[{ flexDirection: 'row', alignItems: 'flex-end', backgroundColor: color.card, borderRadius: 22, borderWidth: 1, borderColor: color.ruleStrong, paddingLeft: 16, paddingRight: 6, paddingVertical: 6 }, elevation.soft]}>
          <TextInput
            value={input}
            onChangeText={setInput}
            placeholder="Ask the assistant…"
            placeholderTextColor={color.inkGhost}
            multiline
            style={{ flex: 1, maxHeight: 120, paddingVertical: 8, fontFamily: 'DMSans_500Medium', fontSize: 15.5, color: brand.navy800 }}
            onSubmitEditing={() => send(input)}
          />
          <Pressable onPress={() => send(input)} disabled={!input.trim() || streaming} accessibilityLabel="Send" style={{ width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', backgroundColor: input.trim() && !streaming ? brand.navy800 : color.paperDeep }}>
            {streaming ? <ActivityIndicator size="small" color={brand.navy700} /> : <ArrowUp size={19} color={input.trim() ? '#fff' : color.inkFaint} />}
          </Pressable>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

/* ───────────── Confirmation card / editable form ───────────── */

function ActionCard({ message, onRun, onCancel }: { message: Message; onRun: (args: Record<string, unknown>) => void; onCancel: () => void }) {
  const a = message.action!;
  const state = message.actionState;
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(Object.entries(a.form?.values ?? {}).map(([k, v]) => [k, v == null ? '' : String(v)]))
  );
  const fields = (a.form?.fields ?? []).filter((f) => f.type !== 'hidden');
  const missing = fields.filter((f) => f.required && !values[f.name]?.trim());
  const busy = state === 'running';
  const closed = state === 'done' || state === 'cancelled';

  const submit = () => {
    if (a.form) {
      if (missing.length) return;
      const args: Record<string, unknown> = {};
      for (const f of a.form.fields) {
        const raw = values[f.name]?.trim();
        if (raw) args[f.name] = f.type === 'number' ? Number(raw) : raw;
      }
      onRun(args);
    } else onRun(a.args ?? {});
  };

  return (
    <View style={[{ marginTop: 8, backgroundColor: color.card, borderRadius: 18, borderWidth: 1.5, borderColor: state === 'done' ? brand.success : brand.navy200, padding: 14 }, elevation.soft]}>
      <Text variant="h3" tone="ink">
        {a.title}
      </Text>
      {!a.form && a.fields?.length ? (
        <View style={{ marginTop: 10, gap: 6 }}>
          {a.fields.map((f) => (
            <View key={f.label} style={{ flexDirection: 'row' }}>
              <Text variant="caption" tone="inkMute" style={{ width: 110 }}>
                {f.label}
              </Text>
              <Text variant="caption" tone="ink" style={{ flex: 1, fontFamily: 'DMSans_500Medium' }}>
                {f.value}
              </Text>
            </View>
          ))}
        </View>
      ) : null}
      {a.form && !closed ? (
        <View style={{ marginTop: 10, gap: 10 }}>
          {fields.map((f) => (
            <FormInput key={f.name} field={f} value={values[f.name] ?? ''} onChange={(v) => setValues((p) => ({ ...p, [f.name]: v }))} disabled={busy} />
          ))}
        </View>
      ) : null}
      {message.actionNote ? (
        <Text variant="caption" style={{ marginTop: 10, color: state === 'error' ? brand.danger : brand.success, fontFamily: 'DMSans_500Medium' }}>
          {message.actionNote}
        </Text>
      ) : null}
      {state === 'cancelled' ? (
        <Text variant="caption" tone="inkFaint" style={{ marginTop: 10 }}>
          Cancelled — nothing was changed.
        </Text>
      ) : null}
      {!closed ? (
        <View style={{ flexDirection: 'row', gap: 10, marginTop: 14 }}>
          <Pressable onPress={submit} disabled={busy || (a.form ? missing.length > 0 : false)} style={{ flex: 1, height: 44, borderRadius: 12, backgroundColor: brand.navy800, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', opacity: busy || (a.form && missing.length) ? 0.6 : 1 }}>
            {busy ? <ActivityIndicator color="#fff" /> : <Check size={17} color="#fff" />}
            <Text variant="bodyStrong" tone="onInk" style={{ marginLeft: 6 }}>
              {state === 'error' ? 'Try again' : (a.form?.submitLabel ?? 'Confirm')}
            </Text>
          </Pressable>
          <Pressable onPress={onCancel} disabled={busy} style={{ height: 44, paddingHorizontal: 16, borderRadius: 12, borderWidth: 1.5, borderColor: color.ruleStrong, alignItems: 'center', justifyContent: 'center', flexDirection: 'row' }}>
            <X size={16} color={color.inkMute} />
            <Text variant="bodyStrong" tone="inkMute" style={{ marginLeft: 4 }}>
              Cancel
            </Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

function FormInput({ field, value, onChange, disabled }: { field: FormFieldSpec; value: string; onChange: (v: string) => void; disabled?: boolean }) {
  return (
    <View>
      <Text variant="micro" tone="inkMute" style={{ marginBottom: 5 }}>
        {field.label}
        {field.required ? <Text variant="micro" style={{ color: brand.danger }}> *</Text> : null}
      </Text>
      {field.type === 'select' && field.options ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
          {field.options.map((o) => {
            const on = value === o.value;
            return (
              <Pressable key={o.value} disabled={disabled} onPress={() => onChange(o.value)} style={{ paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999, borderWidth: 1.5, borderColor: on ? brand.navy700 : color.ruleStrong, backgroundColor: on ? brand.navy50 : color.card }}>
                <Text variant="caption" style={{ color: on ? brand.navy700 : color.inkMute, fontFamily: 'DMSans_500Medium' }}>
                  {o.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      ) : (
        <TextInput
          value={value}
          onChangeText={onChange}
          editable={!disabled}
          placeholder={field.type === 'date' ? 'YYYY-MM-DD' : field.placeholder}
          placeholderTextColor={color.inkGhost}
          keyboardType={field.type === 'number' ? 'numeric' : field.type === 'email' ? 'email-address' : field.type === 'tel' ? 'phone-pad' : 'default'}
          multiline={field.type === 'textarea'}
          style={{ borderWidth: 1.5, borderColor: color.ruleStrong, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, minHeight: field.type === 'textarea' ? 72 : 44, fontFamily: 'DMSans_500Medium', fontSize: 14.5, color: brand.navy800, textAlignVertical: field.type === 'textarea' ? 'top' : 'center' }}
        />
      )}
    </View>
  );
}

/* ───────────── Compact Markdown (what the assistant writes) ───────────── */

function Inline({ text, onLink, tone = 'ink' as const }: { text: string; onLink: (href: string) => void; tone?: 'ink' }) {
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`|\[[^\]]+\]\([^)]+\))/g).filter(Boolean);
  return (
    <Text variant="body" tone={tone}>
      {parts.map((p, i) => {
        if (p.startsWith('**')) return <Text key={i} variant="bodyStrong" tone="ink" style={{ fontFamily: 'DMSans_700Bold' }}>{p.slice(2, -2)}</Text>;
        if (p.startsWith('`')) return <Text key={i} variant="caption" style={{ fontFamily: 'CVMono_500Medium', color: brand.navy700 }}>{p.slice(1, -1)}</Text>;
        const link = /^\[([^\]]+)\]\(([^)]+)\)$/.exec(p);
        if (link) return <Text key={i} variant="bodyStrong" onPress={() => onLink(link[2])} style={{ color: brand.cyan600, fontFamily: 'DMSans_700Bold' }}>{link[1]}</Text>;
        return <Text key={i} variant="body" tone="ink">{p}</Text>;
      })}
    </Text>
  );
}

function Markdown({ text, onLink }: { text: string; onLink: (href: string) => void }) {
  const lines = text.replace(/\r/g, '').split('\n');
  const out: React.ReactNode[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (/^\s*\|/.test(line)) {
      const rows: string[][] = [];
      while (i < lines.length && /^\s*\|/.test(lines[i])) {
        const cells = lines[i].trim().replace(/^\||\|$/g, '').split('|').map((c) => c.trim());
        if (!cells.every((c) => /^:?-{2,}:?$/.test(c))) rows.push(cells);
        i++;
      }
      i--;
      out.push(<Table key={`t${i}`} rows={rows} onLink={onLink} />);
    } else if (/^#{1,6}\s/.test(line)) {
      out.push(<Text key={i} variant="h3" tone="ink" style={{ marginTop: out.length ? 8 : 0, marginBottom: 2 }}>{line.replace(/^#+\s/, '').replace(/\*\*/g, '')}</Text>);
    } else if (/^\s*([-*•]|\d+\.)\s+/.test(line)) {
      const marker = /^\s*(\d+)\./.exec(line)?.[1];
      out.push(
        <View key={i} style={{ flexDirection: 'row', marginTop: 3 }}>
          <Text variant="body" tone="cyan" style={{ width: 18 }}>{marker ? `${marker}.` : '•'}</Text>
          <View style={{ flex: 1 }}><Inline text={line.replace(/^\s*([-*•]|\d+\.)\s+/, '')} onLink={onLink} /></View>
        </View>
      );
    } else if (line.trim()) {
      out.push(<View key={i} style={{ marginTop: out.length ? 6 : 0 }}><Inline text={line} onLink={onLink} /></View>);
    }
  }
  return <View>{out}</View>;
}

function Table({ rows, onLink }: { rows: string[][]; onLink: (href: string) => void }) {
  if (!rows.length) return null;
  const [head, ...body] = rows;
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 8, marginBottom: 2 }}>
      <View style={{ borderRadius: 12, borderWidth: 1, borderColor: color.rule, overflow: 'hidden' }}>
        {[head, ...body].map((r, ri) => (
          <View key={ri} style={{ flexDirection: 'row', backgroundColor: ri === 0 ? brand.navy50 : ri % 2 ? color.card : color.paperWarm }}>
            {r.map((c, ci) => (
              <View key={ci} style={{ minWidth: 96, maxWidth: 200, paddingHorizontal: 10, paddingVertical: 8, borderLeftWidth: ci ? 1 : 0, borderLeftColor: color.rule }}>
                {ri === 0 ? (
                  <Text variant="micro" style={{ color: brand.navy700, fontFamily: 'DMSans_700Bold' }}>{c.replace(/\*\*/g, '')}</Text>
                ) : (
                  <Inline text={c} onLink={onLink} />
                )}
              </View>
            ))}
          </View>
        ))}
      </View>
    </ScrollView>
  );
}
