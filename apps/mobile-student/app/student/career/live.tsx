import { useState } from 'react';
import { ActivityIndicator, FlatList, Image, Linking, Pressable, RefreshControl, ScrollView, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { StatusBar } from 'expo-status-bar';
import { ArrowUpRight, Briefcase, MapPin, Radar, Search, Sparkles } from 'lucide-react-native';
import { Text, ScreenHeader, brand, color, elevation } from '@campus-verse/mobile-shared/design';
import { vpoApi, type LiveJob } from '@/api/careerConnect';

const ago = (iso?: string) => {
  if (!iso) return '';
  const h = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 36e5));
  return h < 1 ? 'just now' : h < 24 ? `${h}h ago` : `${Math.round(h / 24)}d ago`;
};

/**
 * Virtual Placement Office — live job openings in India, pulled from public
 * company job boards, refreshed through the day. Apply on the company's site.
 */
export default function LiveOpenings() {
  const insets = useSafeAreaInsets();
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<string | null>(null);
  const [fresher, setFresher] = useState(false);
  const feed = useQuery({
    queryKey: ['vpo', search, category, fresher],
    queryFn: () => vpoApi.jobs({ search: search || undefined, category: category ?? undefined, fresher: fresher ? 'true' : undefined, limit: 40 }),
    staleTime: 5 * 60_000,
  });
  const jobs = feed.data?.jobs ?? [];
  const cats = (feed.data?.categories ?? []).map((c) => (typeof c === 'string' ? c : c.name)).slice(0, 10);

  return (
    <View style={{ flex: 1, backgroundColor: color.paper }}>
      <StatusBar style="dark" />
      <FlatList
        data={jobs}
        keyExtractor={(j) => j.id}
        refreshControl={<RefreshControl refreshing={feed.isRefetching} onRefresh={() => feed.refetch()} tintColor={brand.navy700} />}
        contentContainerStyle={{ paddingHorizontal: 18, paddingBottom: insets.bottom + 30 }}
        ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
        ListHeaderComponent={
          <View>
            <ScreenHeader
              eyebrow="Career Connect · Virtual Placement Office"
              title="Live openings"
              subtitle={feed.data ? `${feed.data.total.toLocaleString('en-IN')} roles across India, updated ${ago(feed.data.updatedAt)}` : 'Jobs across India from company career pages'}
              right={<Radar size={22} color={brand.cyan600} />}
            />
            <View style={[{ flexDirection: 'row', alignItems: 'center', height: 48, borderRadius: 16, backgroundColor: color.card, borderWidth: 1, borderColor: color.rule, paddingHorizontal: 14, marginTop: 16 }, elevation.soft]}>
              <Search size={18} color={color.inkFaint} />
              <TextInput value={search} onChangeText={setSearch} placeholder="Role, company or skill" placeholderTextColor={color.inkGhost} returnKeyType="search" style={{ flex: 1, marginLeft: 10, fontFamily: 'DMSans_500Medium', fontSize: 15, color: brand.navy800 }} />
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingVertical: 14 }}>
              <Chip label="Freshers" icon={Sparkles} on={fresher} onPress={() => setFresher(!fresher)} />
              <Chip label="All roles" on={!category} onPress={() => setCategory(null)} />
              {cats.map((c) => (
                <Chip key={c} label={c} on={category === c} onPress={() => setCategory(category === c ? null : c)} />
              ))}
            </ScrollView>
            {feed.isLoading ? <ActivityIndicator color={brand.navy700} style={{ marginTop: 30 }} /> : null}
          </View>
        }
        renderItem={({ item }) => <JobCard job={item} />}
        ListEmptyComponent={
          feed.isLoading ? null : (
            <Text variant="body" tone="inkMute" align="center" style={{ marginTop: 30 }}>
              {feed.isError ? 'The job feed is unavailable right now.' : 'No openings match that yet.'}
            </Text>
          )
        }
      />
    </View>
  );
}

function Chip({ label, on, onPress, icon: Glyph }: { label: string; on: boolean; onPress: () => void; icon?: typeof Sparkles }) {
  return (
    <Pressable onPress={onPress}>
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, height: 34, borderRadius: 999, backgroundColor: on ? brand.navy800 : color.card, borderWidth: 1, borderColor: on ? brand.navy800 : color.rule }}>
        {Glyph ? <Glyph size={14} color={on ? '#fff' : brand.cyan600} style={{ marginRight: 6 }} /> : null}
        <Text variant="micro" style={{ color: on ? '#fff' : brand.navy800, fontFamily: 'DMSans_700Bold', fontSize: 12 }}>
          {label}
        </Text>
      </View>
    </Pressable>
  );
}

function JobCard({ job }: { job: LiveJob }) {
  const host = job.website ? job.website.replace(/^https?:\/\//, '').split('/')[0] : '';
  const logo = job.logo || (host ? `https://www.google.com/s2/favicons?domain=${host}&sz=128` : '');
  return (
    <Pressable onPress={() => Linking.openURL(job.url)}>
      <View style={[{ backgroundColor: color.card, borderRadius: 20, padding: 14, borderWidth: 1, borderColor: color.rule }, elevation.soft]}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <View style={{ width: 46, height: 46, borderRadius: 14, backgroundColor: color.paperWarm, borderWidth: 1, borderColor: color.rule, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
            {logo ? <Image source={{ uri: logo }} style={{ width: 30, height: 30 }} /> : <Briefcase size={20} color={brand.navy700} />}
          </View>
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text variant="h3" tone="ink" numberOfLines={2}>
              {job.title}
            </Text>
            <Text variant="caption" tone="inkMute" numberOfLines={1}>
              {job.company}
            </Text>
          </View>
          <ArrowUpRight size={18} color={color.inkFaint} />
        </View>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8, marginTop: 12 }}>
          <Tag text={job.remote ? 'Remote' : job.city || job.location || 'India'} icon={MapPin} />
          {job.type ? <Tag text={job.type} /> : null}
          {job.fresher ? <Tag text="Fresher-friendly" tone="cyan" /> : null}
          {job.salary ? <Tag text={job.salary} tone="green" /> : null}
          <View style={{ flex: 1 }} />
          <Text variant="micro" tone="inkFaint">
            {ago(job.postedAt)}
          </Text>
        </View>
      </View>
    </Pressable>
  );
}

function Tag({ text, icon: Glyph, tone }: { text: string; icon?: typeof MapPin; tone?: 'cyan' | 'green' }) {
  const bg = tone === 'cyan' ? brand.cyan50 : tone === 'green' ? brand.successWash : color.paperDeep;
  const fg = tone === 'cyan' ? brand.cyan700 : tone === 'green' ? brand.success : color.inkMute;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 9, paddingVertical: 4, borderRadius: 999, backgroundColor: bg }}>
      {Glyph ? <Glyph size={12} color={fg} style={{ marginRight: 4 }} /> : null}
      <Text variant="micro" style={{ color: fg, fontFamily: 'DMSans_500Medium' }}>
        {text}
      </Text>
    </View>
  );
}
