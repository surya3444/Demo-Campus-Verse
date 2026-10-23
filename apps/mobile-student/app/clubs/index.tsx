import { useState } from 'react';
import { ActivityIndicator, FlatList, Image, Pressable, ScrollView, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { Check, Clock, Plus, Search, Users } from 'lucide-react-native';
import { Text, ScreenHeader, brand, color, elevation } from '@campus-verse/mobile-shared/design';
import { clubsApi, type Club } from '@/api/clubs';
import { CLUB_CATEGORY, ClubCrest, themeOf } from '@/components/clubVisuals';

/** Clubs directory: search, filter by category, join in one tap. */
export default function Clubs() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<string | null>(null);
  const clubs = useQuery({ queryKey: ['clubs', 'all'], queryFn: () => clubsApi.list() });

  const toggle = useMutation({
    mutationFn: (c: Club) => (c.isMember ? clubsApi.leave(c._id) : clubsApi.join(c._id)),
    onMutate: () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined),
    onSettled: () => qc.invalidateQueries({ queryKey: ['clubs'] }),
  });

  const all = clubs.data ?? [];
  const q = search.trim().toLowerCase();
  const shown = all.filter(
    (c) =>
      (!category || c.category === category) &&
      (!q || [c.name, c.tagline, ...(c.tags ?? [])].some((v) => v?.toLowerCase().includes(q)))
  );
  const joined = all.filter((c) => c.isMember).length;
  const cats = Object.entries(CLUB_CATEGORY).filter(([k]) => all.some((c) => c.category === k));

  return (
    <View style={{ flex: 1, backgroundColor: color.paper }}>
      <StatusBar style="dark" />
      <FlatList
        data={shown}
        keyExtractor={(c) => c._id}
        contentContainerStyle={{ paddingHorizontal: 18, paddingBottom: insets.bottom + 30 }}
        ListHeaderComponent={
          <View>
            <ScreenHeader eyebrow="Campus · Clubs" title="Find your people" subtitle={`${all.length} clubs on campus${joined ? ` · you’re in ${joined}` : ''}`} />
            <View style={[{ flexDirection: 'row', alignItems: 'center', height: 48, borderRadius: 16, backgroundColor: color.card, borderWidth: 1, borderColor: color.rule, paddingHorizontal: 14, marginTop: 16 }, elevation.soft]}>
              <Search size={18} color={color.inkFaint} />
              <TextInput value={search} onChangeText={setSearch} placeholder="Search clubs or interests" placeholderTextColor={color.inkGhost} style={{ flex: 1, marginLeft: 10, fontFamily: 'DMSans_500Medium', fontSize: 15, color: brand.navy800 }} />
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingVertical: 14 }}>
              {[[null, 'All'] as const, ...cats.map(([k, v]) => [k, v.label] as const)].map(([key, label]) => {
                const on = category === key;
                return (
                  <Pressable key={label} onPress={() => setCategory(key)}>
                    <View style={{ paddingHorizontal: 14, height: 34, borderRadius: 999, justifyContent: 'center', backgroundColor: on ? brand.navy800 : color.card, borderWidth: 1, borderColor: on ? brand.navy800 : color.rule }}>
                      <Text variant="micro" style={{ color: on ? '#fff' : brand.navy800, fontFamily: 'DMSans_700Bold', fontSize: 12 }}>
                        {label}
                      </Text>
                    </View>
                  </Pressable>
                );
              })}
            </ScrollView>
            {clubs.isLoading ? <ActivityIndicator color={brand.navy700} style={{ marginTop: 30 }} /> : null}
          </View>
        }
        ItemSeparatorComponent={() => <View style={{ height: 14 }} />}
        renderItem={({ item: c }) => <ClubCard club={c} onOpen={() => router.push(`/clubs/${c._id}` as never)} onToggle={() => toggle.mutate(c)} busy={toggle.isPending && toggle.variables?._id === c._id} />}
        ListEmptyComponent={
          clubs.isLoading ? null : (
            <Text variant="body" tone="inkMute" align="center" style={{ marginTop: 30 }}>
              No clubs match that.
            </Text>
          )
        }
      />
    </View>
  );
}

function ClubCard({ club: c, onOpen, onToggle, busy }: { club: Club; onOpen: () => void; onToggle: () => void; busy: boolean }) {
  const th = themeOf(c.theme);
  return (
    <Pressable onPress={onOpen}>
      <View style={[{ borderRadius: 22, backgroundColor: color.card, overflow: 'hidden', borderWidth: 1, borderColor: color.rule }, elevation.soft]}>
        <LinearGradient colors={[th.c1, th.c2]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ padding: 16, flexDirection: 'row', alignItems: 'center' }}>
          <View style={{ position: 'absolute', right: -40, top: -50, width: 150, height: 150, borderRadius: 999, borderWidth: 18, borderColor: 'rgba(255,255,255,0.12)' }} />
          <ClubCrest theme={c.theme} icon={c.icon} category={c.category} size={50} />
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text variant="micro" style={{ color: 'rgba(255,255,255,0.8)', fontFamily: 'DMSans_700Bold', letterSpacing: 1.2 }}>
              {(CLUB_CATEGORY[c.category]?.label ?? c.category).toUpperCase()}
            </Text>
            <Text variant="h2" tone="onInk" numberOfLines={1}>
              {c.name}
            </Text>
          </View>
        </LinearGradient>
        <View style={{ padding: 14 }}>
          {c.tagline ? (
            <Text variant="body" tone="inkSoft" numberOfLines={2}>
              {c.tagline}
            </Text>
          ) : null}
          <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 12 }}>
            <View style={{ flexDirection: 'row', marginRight: 8 }}>
              {(c.faces ?? []).slice(0, 3).map((f, i) =>
                f.photo ? <Image key={i} source={{ uri: f.photo }} style={{ width: 24, height: 24, borderRadius: 12, marginLeft: i ? -8 : 0, borderWidth: 2, borderColor: '#fff' }} /> : null
              )}
            </View>
            <Users size={14} color={color.inkMute} />
            <Text variant="caption" tone="inkMute" style={{ marginLeft: 4 }}>
              {c.memberCount}
            </Text>
            {c.meeting?.day ? (
              <>
                <Clock size={14} color={color.inkMute} style={{ marginLeft: 12 }} />
                <Text variant="caption" tone="inkMute" style={{ marginLeft: 4, flex: 1 }} numberOfLines={1}>
                  {c.meeting.day}
                </Text>
              </>
            ) : (
              <View style={{ flex: 1 }} />
            )}
            <Pressable onPress={onToggle} disabled={busy} hitSlop={6}>
              <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, height: 34, borderRadius: 999, backgroundColor: c.isMember ? brand.successWash : brand.navy800 }}>
                {busy ? (
                  <ActivityIndicator size="small" color={c.isMember ? brand.success : '#fff'} />
                ) : c.isMember ? (
                  <Check size={15} color={brand.success} />
                ) : (
                  <Plus size={15} color="#fff" />
                )}
                <Text variant="micro" style={{ marginLeft: 5, fontFamily: 'DMSans_700Bold', fontSize: 12, color: c.isMember ? brand.success : '#fff' }}>
                  {c.isMember ? 'Joined' : 'Join'}
                </Text>
              </View>
            </Pressable>
          </View>
        </View>
      </View>
    </Pressable>
  );
}
