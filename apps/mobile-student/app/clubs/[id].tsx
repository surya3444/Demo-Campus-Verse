import { ActivityIndicator, Image, Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { Check, ChevronLeft, Clock, MapPin, Plus, Sparkles, Users } from 'lucide-react-native';
import { Text, Surface, SectionTitle, brand, color } from '@campus-verse/mobile-shared/design';
import { clubsApi } from '@/api/clubs';
import { CLUB_CATEGORY, ClubCrest, themeOf } from '@/components/clubVisuals';

/** One club: its story, when it meets, who runs it, and join/leave. */
export default function ClubDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const qc = useQueryClient();
  const club = useQuery({ queryKey: ['clubs', id], queryFn: () => clubsApi.get(id!), enabled: !!id });
  const toggle = useMutation({
    mutationFn: () => (club.data?.isMember ? clubsApi.leave(id!) : clubsApi.join(id!)),
    onSuccess: () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined),
    onSettled: () => qc.invalidateQueries({ queryKey: ['clubs'] }),
  });

  const c = club.data;
  if (!c) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: color.paper }}>
        <ActivityIndicator color={brand.navy700} />
      </View>
    );
  }
  const th = themeOf(c.theme);
  return (
    <View style={{ flex: 1, backgroundColor: color.paper }}>
      <StatusBar style="light" />
      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 110 }} showsVerticalScrollIndicator={false}>
        <LinearGradient colors={[th.c1, th.c2]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ paddingTop: insets.top + 10, paddingHorizontal: 20, paddingBottom: 28, overflow: 'hidden' }}>
          <View style={{ position: 'absolute', right: -70, top: -60, width: 260, height: 260, borderRadius: 999, borderWidth: 26, borderColor: 'rgba(255,255,255,0.12)' }} />
          <Pressable onPress={() => router.back()} hitSlop={10} accessibilityLabel="Back" style={{ width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.18)' }}>
            <ChevronLeft size={20} color="#fff" />
          </Pressable>
          <View style={{ alignItems: 'center', marginTop: 10 }}>
            <ClubCrest theme={c.theme} icon={c.icon} category={c.category} size={84} />
            <Text variant="micro" style={{ marginTop: 14, color: 'rgba(255,255,255,0.85)', fontFamily: 'DMSans_700Bold', letterSpacing: 1.4 }}>
              {(CLUB_CATEGORY[c.category]?.label ?? c.category).toUpperCase()}
              {c.institutionName ? ` · ${c.institutionName}` : ''}
            </Text>
            <Text variant="display" tone="onInk" align="center" style={{ marginTop: 6 }}>
              {c.name}
            </Text>
            {c.tagline ? (
              <Text variant="body" align="center" style={{ marginTop: 8, color: 'rgba(255,255,255,0.88)' }}>
                {c.tagline}
              </Text>
            ) : null}
            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 16 }}>
              {(c.faces ?? []).slice(0, 5).map((f, i) =>
                f.photo ? <Image key={i} source={{ uri: f.photo }} style={{ width: 30, height: 30, borderRadius: 15, marginLeft: i ? -9 : 0, borderWidth: 2, borderColor: '#fff' }} /> : null
              )}
              <Users size={15} color="#fff" style={{ marginLeft: 10 }} />
              <Text variant="bodyStrong" tone="onInk" style={{ marginLeft: 5 }}>
                {c.memberCount} members
              </Text>
            </View>
          </View>
        </LinearGradient>

        <View style={{ paddingHorizontal: 18 }}>
          {c.meeting?.day || c.meeting?.venue ? (
            <Surface style={{ marginTop: 16 }}>
              {c.meeting?.day ? <Row icon={Clock} label="Meets" value={[c.meeting.day, c.meeting.time].filter(Boolean).join(' · ')} /> : null}
              {c.meeting?.venue ? <Row icon={MapPin} label="Where" value={c.meeting.venue} /> : null}
            </Surface>
          ) : null}

          {c.description ? (
            <>
              <SectionTitle title="About" />
              <Text variant="body" tone="inkSoft">
                {c.description}
              </Text>
            </>
          ) : null}

          {c.highlights?.length ? (
            <>
              <SectionTitle title="Highlights" />
              <View style={{ gap: 8 }}>
                {c.highlights.map((h) => (
                  <View key={h} style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
                    <Sparkles size={16} color={th.c1} style={{ marginTop: 3 }} />
                    <Text variant="body" tone="ink" style={{ marginLeft: 10, flex: 1 }}>
                      {h}
                    </Text>
                  </View>
                ))}
              </View>
            </>
          ) : null}

          {c.coordinator?.name ? (
            <>
              <SectionTitle title="Faculty coordinator" />
              <Surface>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  {c.coordinator.photo ? <Image source={{ uri: c.coordinator.photo }} style={{ width: 44, height: 44, borderRadius: 22 }} /> : null}
                  <Text variant="h3" tone="ink" style={{ marginLeft: 12 }}>
                    {c.coordinator.name}
                  </Text>
                </View>
              </Surface>
            </>
          ) : null}

          {c.tags?.length ? (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 20 }}>
              {c.tags.map((t) => (
                <View key={t} style={{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, backgroundColor: color.card, borderWidth: 1, borderColor: color.rule }}>
                  <Text variant="micro" tone="inkMute">
                    #{t}
                  </Text>
                </View>
              ))}
            </View>
          ) : null}
        </View>
      </ScrollView>

      <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 18, paddingTop: 12, paddingBottom: insets.bottom + 12, backgroundColor: color.paper, borderTopWidth: 1, borderTopColor: color.rule }}>
        <Pressable onPress={() => toggle.mutate()} disabled={toggle.isPending}>
          <LinearGradient colors={c.isMember ? [brand.success, '#22C55E'] : [th.c1, th.c2]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ height: 54, borderRadius: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}>
            {toggle.isPending ? <ActivityIndicator color="#fff" /> : c.isMember ? <Check size={19} color="#fff" /> : <Plus size={19} color="#fff" />}
            <Text variant="h3" tone="onInk" style={{ marginLeft: 8 }}>
              {c.isMember ? 'You’re a member · Leave' : 'Join this club'}
            </Text>
          </LinearGradient>
        </Pressable>
      </View>
    </View>
  );
}

function Row({ icon: Glyph, label, value }: { icon: typeof Clock; label: string; value: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 6 }}>
      <Glyph size={17} color={brand.navy700} />
      <Text variant="caption" tone="inkMute" style={{ marginLeft: 10, width: 60 }}>
        {label}
      </Text>
      <Text variant="bodyStrong" tone="ink" style={{ flex: 1 }}>
        {value}
      </Text>
    </View>
  );
}
