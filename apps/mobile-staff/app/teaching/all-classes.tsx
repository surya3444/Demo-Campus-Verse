import {
  View,
  Text,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
} from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { useState, useCallback } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, Stack } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { teachingApi, TeachingClass, getSubjects } from '@/api/teaching';

const { width: SW } = Dimensions.get('window');
const PAD = 20;
const CLASS_W = (SW - PAD * 2 - 12) / 2;
const ACCENT = [
  '#4f46e5',
  '#0891b2',
  '#059669',
  '#d97706',
  '#dc2626',
  '#7c3aed',
  '#db2777',
  '#0d9488',
];

function ClassCard({ item, idx }: { item: TeachingClass; idx: number }) {
  const router = useRouter();
  const c = ACCENT[idx % ACCENT.length];
  const subs = getSubjects(item);
  return (
    <TouchableOpacity
      activeOpacity={0.7}
      onPress={() =>
        router.push(
          `/teaching/class-detail?sectionId=${item.sectionId}&className=${encodeURIComponent(item.className)}&sectionName=${encodeURIComponent(item.sectionName)}`
        )
      }
      style={{ width: CLASS_W, marginBottom: 12 }}
    >
      <View style={s.clCard}>
        <View style={[s.clStrip, { backgroundColor: c }]} />
        <View style={s.clBody}>
          <Text style={s.clTitle} numberOfLines={1}>
            {item.className}
          </Text>
          <Text style={s.clSub}>
            Sec {item.sectionName} · {item.studentCount} students
          </Text>
          {subs.length > 0 && (
            <View style={{ flexDirection: 'row', marginTop: 6, flexWrap: 'wrap' }}>
              {subs.slice(0, 2).map((sub, i) => (
                <View
                  key={sub.subjectId}
                  style={[s.clPill, { backgroundColor: `${ACCENT[(idx + i) % ACCENT.length]}10` }]}
                >
                  <Text
                    style={{
                      fontSize: 9,
                      fontWeight: '700',
                      color: ACCENT[(idx + i) % ACCENT.length],
                    }}
                  >
                    {sub.subjectName}
                  </Text>
                </View>
              ))}
              {subs.length > 2 && (
                <Text style={{ fontSize: 10, color: '#94a3b8', alignSelf: 'center' }}>
                  +{subs.length - 2}
                </Text>
              )}
            </View>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
}

export default function AllClassesScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [refreshing, setRefreshing] = useState(false);

  const { data: classes, refetch } = useQuery({
    queryKey: ['my-classes'],
    queryFn: () => teachingApi.getMyClasses(),
  });

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }, [refetch]);

  const count = classes?.length || 0;

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={{ flex: 1, backgroundColor: '#f8fafc' }}>
        {/* Hero header */}
        <View style={s.hero}>
          <View style={s.heroCircle} />
          <View style={{ paddingTop: insets.top + 8, paddingBottom: 24, paddingHorizontal: 20 }}>
            <TouchableOpacity
              onPress={() => router.back()}
              activeOpacity={0.7}
              style={s.backBtn}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons name="chevron-back" size={22} color="#ffffff" />
              <Text style={s.backText}>Back</Text>
            </TouchableOpacity>

            <Text style={s.heroTitle}>My Classes</Text>
            <Text style={s.heroSubtitle}>
              {count} class{count !== 1 ? 'es' : ''} assigned
            </Text>
          </View>
        </View>

        {/* Content card */}
        <View style={s.cardContainer}>
          <ScrollView
            style={{ flex: 1 }}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#4f46e5" />
            }
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ padding: PAD, paddingBottom: 40 }}
          >
            {!classes || !classes.length ? (
              <View style={s.empty}>
                <Ionicons name="school-outline" size={26} color="#d1d5db" />
                <Text style={s.emptyT}>No classes assigned yet</Text>
              </View>
            ) : (
              <View
                style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' }}
              >
                {classes.map((c, i) => (
                  <ClassCard key={c.sectionId} item={c} idx={i} />
                ))}
              </View>
            )}
          </ScrollView>
        </View>
      </View>
    </>
  );
}

const s = StyleSheet.create({
  hero: {
    backgroundColor: '#4f46e5',
    overflow: 'hidden',
  },
  heroCircle: {
    position: 'absolute',
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: 'rgba(255,255,255,0.06)',
    top: -30,
    right: -40,
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    marginLeft: -4,
  },
  backText: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 16,
    fontWeight: '500',
    marginLeft: 2,
  },
  heroTitle: {
    color: '#ffffff',
    fontSize: 26,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  heroSubtitle: {
    color: 'rgba(199,210,254,0.9)',
    fontSize: 14,
    fontWeight: '500',
    marginTop: 4,
  },
  cardContainer: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    marginTop: -16,
  },

  /* Class cards */
  clCard: {
    backgroundColor: '#fff',
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#f0f0f0',
  },
  clStrip: { height: 4 },
  clBody: { padding: 12 },
  clTitle: { fontSize: 14, fontWeight: '700', color: '#1e293b' },
  clSub: { fontSize: 11, color: '#94a3b8', marginTop: 2 },
  clPill: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, marginRight: 4 },

  /* Empty */
  empty: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 28,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#f0f0f0',
  },
  emptyT: { color: '#94a3b8', fontSize: 13, marginTop: 8 },
});
