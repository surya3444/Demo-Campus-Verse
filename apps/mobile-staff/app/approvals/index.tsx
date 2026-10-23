import { useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { StatusBar } from 'expo-status-bar';
import * as Haptics from 'expo-haptics';
import { CalendarRange, Check, CircleCheckBig, X } from 'lucide-react-native';
import { Text, ScreenHeader, Surface, brand, color } from '@campus-verse/mobile-shared/design';
import { apiClient } from '@campus-verse/mobile-shared/api/client';

interface LeaveRequest {
  _id: string;
  leaveTypeName?: string;
  leaveType: string;
  fromDate: string;
  toDate: string;
  days: number;
  isHalfDay?: boolean;
  reason?: string;
  appliedAt?: string;
  staff?: { displayName?: string; employeeId?: string };
}

const fmt = (d: string) => new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
const errorText = (e: unknown) =>
  (e as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message ?? 'That didn’t go through. Try again.';

/** Leave requests waiting on you — approve, or reject with a reason. Live data. */
export default function Approvals() {
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();
  const [rejecting, setRejecting] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const [note, setNote] = useState<Record<string, string>>({});

  const pending = useQuery({
    queryKey: ['leave-approvals'],
    queryFn: async () => (await apiClient.get('/hr/leaves/pending-approvals', { params: { limit: 50 } })).data.data as LeaveRequest[],
  });
  const decide = useMutation({
    mutationFn: ({ id, d, remarks }: { id: string; d: 'approve' | 'reject'; remarks?: string }) =>
      apiClient.put(`/hr/leaves/${id}/${d}`, remarks ? { remarks } : {}),
    onSuccess: (_r, v) => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
      setNote((n) => ({ ...n, [v.id]: v.d === 'approve' ? 'Approved' : 'Rejected' }));
      setRejecting(null);
      setReason('');
      qc.invalidateQueries({ queryKey: ['leave-approvals-count'] });
    },
    onError: (e, v) => setNote((n) => ({ ...n, [v.id]: errorText(e) })),
  });

  const items = pending.data ?? [];
  const open = items.filter((r) => !note[r._id] || !/^(Approved|Rejected)$/.test(note[r._id]));
  return (
    <View style={{ flex: 1, backgroundColor: color.paper }}>
      <StatusBar style="dark" />
      <FlatList
        data={items}
        keyExtractor={(r) => r._id}
        refreshControl={<RefreshControl refreshing={pending.isRefetching} onRefresh={() => (setNote({}), pending.refetch())} tintColor={brand.navy700} />}
        contentContainerStyle={{ paddingHorizontal: 18, paddingBottom: insets.bottom + 30 }}
        ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
        ListHeaderComponent={
          <View style={{ marginBottom: 16 }}>
            <ScreenHeader eyebrow="Approvals" title="Leave requests" subtitle={pending.isLoading ? 'Loading…' : open.length ? `${open.length} waiting on you` : 'You’re all caught up'} />
            {pending.isLoading ? <ActivityIndicator color={brand.navy700} style={{ marginTop: 24 }} /> : null}
          </View>
        }
        ListEmptyComponent={
          pending.isLoading ? null : (
            <View style={{ alignItems: 'center', marginTop: 40 }}>
              <CircleCheckBig size={44} color={brand.success} />
              <Text variant="h2" tone="ink" style={{ marginTop: 12 }}>
                Nothing to approve
              </Text>
              <Text variant="body" tone="inkMute" style={{ marginTop: 4 }}>
                New requests will show up here.
              </Text>
            </View>
          )
        }
        renderItem={({ item: r }) => {
          const done = note[r._id] === 'Approved' || note[r._id] === 'Rejected';
          const busy = decide.isPending && decide.variables?.id === r._id;
          return (
            <Surface style={{ opacity: done ? 0.6 : 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <View style={{ width: 42, height: 42, borderRadius: 21, backgroundColor: brand.navy50, alignItems: 'center', justifyContent: 'center' }}>
                  <Text variant="bodyStrong" style={{ color: brand.navy700, fontFamily: 'PlusJakartaSans_800ExtraBold' }}>
                    {(r.staff?.displayName ?? '?').split(' ').map((w) => w[0]).slice(0, 2).join('')}
                  </Text>
                </View>
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text variant="h3" tone="ink">
                    {r.staff?.displayName ?? 'Staff member'}
                  </Text>
                  <Text variant="caption" tone="inkMute">
                    {r.leaveTypeName ?? r.leaveType} · {r.staff?.employeeId}
                  </Text>
                </View>
                <View style={{ paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, backgroundColor: brand.navy50 }}>
                  <Text variant="micro" style={{ color: brand.navy700, fontFamily: 'DMSans_700Bold' }}>
                    {r.isHalfDay ? 'Half day' : `${r.days} day${r.days === 1 ? '' : 's'}`}
                  </Text>
                </View>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 12 }}>
                <CalendarRange size={15} color={color.inkMute} />
                <Text variant="bodyStrong" tone="ink" style={{ marginLeft: 6 }}>
                  {fmt(r.fromDate)}
                  {r.toDate && r.toDate !== r.fromDate ? ` – ${fmt(r.toDate)}` : ''}
                </Text>
              </View>
              {r.reason ? (
                <Text variant="body" tone="inkSoft" style={{ marginTop: 6 }}>
                  “{r.reason}”
                </Text>
              ) : null}

              {done ? (
                <Text variant="bodyStrong" style={{ marginTop: 12, color: note[r._id] === 'Approved' ? brand.success : brand.danger }}>
                  {note[r._id]}
                </Text>
              ) : rejecting === r._id ? (
                <View style={{ marginTop: 12 }}>
                  <TextInput value={reason} onChangeText={setReason} placeholder="Reason for rejecting (shared with them)" placeholderTextColor={color.inkGhost} multiline style={{ minHeight: 64, borderWidth: 1.5, borderColor: color.ruleStrong, borderRadius: 12, padding: 12, fontFamily: 'DMSans_500Medium', fontSize: 14.5, color: brand.navy800, textAlignVertical: 'top' }} />
                  <View style={{ flexDirection: 'row', gap: 10, marginTop: 10 }}>
                    <Btn label="Reject leave" tone="danger" disabled={!reason.trim() || busy} busy={busy} onPress={() => decide.mutate({ id: r._id, d: 'reject', remarks: reason.trim() })} />
                    <Btn label="Back" tone="ghost" onPress={() => (setRejecting(null), setReason(''))} />
                  </View>
                </View>
              ) : (
                <View style={{ flexDirection: 'row', gap: 10, marginTop: 14 }}>
                  <Btn label="Approve" icon={Check} busy={busy} onPress={() => decide.mutate({ id: r._id, d: 'approve' })} />
                  <Btn label="Reject" icon={X} tone="ghost" onPress={() => setRejecting(r._id)} />
                </View>
              )}
              {note[r._id] && !done ? (
                <Text variant="caption" style={{ color: brand.danger, marginTop: 8 }}>
                  {note[r._id]}
                </Text>
              ) : null}
            </Surface>
          );
        }}
      />
    </View>
  );
}

function Btn({ label, onPress, icon: Glyph, tone = 'primary', disabled, busy }: { label: string; onPress: () => void; icon?: typeof Check; tone?: 'primary' | 'ghost' | 'danger'; disabled?: boolean; busy?: boolean }) {
  const bg = tone === 'primary' ? brand.navy800 : tone === 'danger' ? brand.danger : color.card;
  const fg = tone === 'ghost' ? brand.navy800 : '#fff';
  return (
    <Pressable onPress={onPress} disabled={disabled || busy} style={{ flex: 1 }}>
      <View style={{ height: 44, borderRadius: 12, backgroundColor: bg, borderWidth: tone === 'ghost' ? 1.5 : 0, borderColor: color.ruleStrong, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', opacity: disabled ? 0.5 : 1 }}>
        {busy ? <ActivityIndicator color={fg} /> : Glyph ? <Glyph size={17} color={fg} /> : null}
        <Text variant="bodyStrong" style={{ color: fg, marginLeft: Glyph || busy ? 6 : 0 }}>
          {label}
        </Text>
      </View>
    </Pressable>
  );
}
