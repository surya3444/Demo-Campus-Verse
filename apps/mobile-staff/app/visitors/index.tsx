import { useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { StatusBar } from 'expo-status-bar';
import * as Haptics from 'expo-haptics';
import { Building2, Clock, LogOut, UserPlus } from 'lucide-react-native';
import { Text, ScreenHeader, Surface, brand, color } from '@campus-verse/mobile-shared/design';
import { apiClient } from '@campus-verse/mobile-shared/api/client';

interface Visitor {
  _id: string;
  name: string;
  phone?: string;
  company?: string;
  purpose?: string;
  hostName?: string;
  hostDepartment?: string;
  status: string;
  checkInTime?: string;
  checkOutTime?: string;
  passCode?: string;
  numberOfVisitors?: number;
}

const FILTERS = [
  { key: 'checked_in', label: 'On campus' },
  { key: 'expected', label: 'Expected' },
  { key: 'checked_out', label: 'Left' },
] as const;
const time = (d?: string) => (d ? new Date(d).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' }) : '');

/** The gate register: who is on campus now, who is expected, who has left. Live data. */
export default function Visitors() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const qc = useQueryClient();
  const [filter, setFilter] = useState<(typeof FILTERS)[number]['key']>('checked_in');
  const list = useQuery({
    queryKey: ['visitors'],
    queryFn: async () => (await apiClient.get('/visitors', { params: { limit: 100 } })).data.data as Visitor[],
  });
  const checkOut = useMutation({
    mutationFn: (id: string) => apiClient.put(`/visitors/${id}/check-out`),
    onSuccess: () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
      qc.invalidateQueries({ queryKey: ['visitors'] });
    },
  });

  const all = list.data ?? [];
  const bucket = (v: Visitor) => (v.status === 'checked_in' ? 'checked_in' : v.status === 'checked_out' ? 'checked_out' : 'expected');
  const shown = all.filter((v) => bucket(v) === filter);
  const counts = Object.fromEntries(FILTERS.map((f) => [f.key, all.filter((v) => bucket(v) === f.key).length]));

  return (
    <View style={{ flex: 1, backgroundColor: color.paper }}>
      <StatusBar style="dark" />
      <FlatList
        data={shown}
        keyExtractor={(v) => v._id}
        refreshControl={<RefreshControl refreshing={list.isRefetching} onRefresh={() => list.refetch()} tintColor={brand.navy700} />}
        contentContainerStyle={{ paddingHorizontal: 18, paddingBottom: insets.bottom + 110 }}
        ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
        ListHeaderComponent={
          <View style={{ marginBottom: 14 }}>
            <ScreenHeader eyebrow="Front desk" title="Visitors" subtitle={`${counts.checked_in ?? 0} on campus right now`} />
            <View style={{ flexDirection: 'row', gap: 8, marginTop: 16 }}>
              {FILTERS.map((f) => {
                const on = filter === f.key;
                return (
                  <Pressable key={f.key} onPress={() => setFilter(f.key)} style={{ flex: 1 }}>
                    <View style={{ height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: on ? brand.navy800 : color.card, borderWidth: 1, borderColor: on ? brand.navy800 : color.rule }}>
                      <Text variant="micro" style={{ color: on ? '#fff' : brand.navy800, fontFamily: 'DMSans_700Bold', fontSize: 12 }}>
                        {f.label} · {counts[f.key] ?? 0}
                      </Text>
                    </View>
                  </Pressable>
                );
              })}
            </View>
            {list.isLoading ? <ActivityIndicator color={brand.navy700} style={{ marginTop: 24 }} /> : null}
          </View>
        }
        ListEmptyComponent={
          list.isLoading ? null : (
            <Text variant="body" tone="inkMute" align="center" style={{ marginTop: 24 }}>
              No one here.
            </Text>
          )
        }
        renderItem={({ item: v }) => (
          <Surface>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <View style={{ flex: 1 }}>
                <Text variant="h3" tone="ink">
                  {v.name}
                  {v.numberOfVisitors && v.numberOfVisitors > 1 ? ` +${v.numberOfVisitors - 1}` : ''}
                </Text>
                <Text variant="caption" tone="inkMute" numberOfLines={1}>
                  {v.purpose}
                  {v.hostName ? ` · meeting ${v.hostName}` : ''}
                </Text>
              </View>
              {v.passCode ? (
                <View style={{ paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, backgroundColor: brand.navy50 }}>
                  <Text variant="micro" style={{ fontFamily: 'CVMono_700Bold', color: brand.navy700 }}>
                    {v.passCode}
                  </Text>
                </View>
              ) : null}
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 10, gap: 14 }}>
              {v.company ? (
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Building2 size={13} color={color.inkMute} />
                  <Text variant="caption" tone="inkMute" style={{ marginLeft: 4 }}>
                    {v.company}
                  </Text>
                </View>
              ) : null}
              {v.checkInTime ? (
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Clock size={13} color={color.inkMute} />
                  <Text variant="caption" tone="inkMute" style={{ marginLeft: 4 }}>
                    In {time(v.checkInTime)}
                    {v.checkOutTime ? ` · out ${time(v.checkOutTime)}` : ''}
                  </Text>
                </View>
              ) : null}
              <View style={{ flex: 1 }} />
              {v.status === 'checked_in' ? (
                <Pressable onPress={() => checkOut.mutate(v._id)} disabled={checkOut.isPending}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, height: 32, borderRadius: 999, borderWidth: 1.5, borderColor: color.ruleStrong }}>
                    {checkOut.isPending && checkOut.variables === v._id ? <ActivityIndicator size="small" color={brand.navy700} /> : <LogOut size={14} color={brand.navy800} />}
                    <Text variant="micro" style={{ marginLeft: 5, color: brand.navy800, fontFamily: 'DMSans_700Bold' }}>
                      Check out
                    </Text>
                  </View>
                </Pressable>
              ) : null}
            </View>
          </Surface>
        )}
      />
      <View style={{ position: 'absolute', left: 18, right: 18, bottom: insets.bottom + 16 }}>
        <Pressable onPress={() => router.push('/visitors/new' as never)}>
          <View style={{ height: 54, borderRadius: 18, backgroundColor: brand.navy800, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}>
            <UserPlus size={19} color="#fff" />
            <Text variant="h3" tone="onInk" style={{ marginLeft: 8 }}>
              Register a visitor
            </Text>
          </View>
        </Pressable>
      </View>
    </View>
  );
}
