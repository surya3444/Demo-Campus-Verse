import { useState } from 'react';
import { View, ScrollView, TouchableOpacity, TextInput } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Text, Rule, color } from '@campus-verse/mobile-shared/design';

/**
 * Fee counter — front desk.
 *
 * A search-driven lookup screen for the office assistant on a tablet. Top
 * is a large search field with student name / admission no. / phone. Recent
 * lookups appear below as numbered rows.
 */

const RECENT = [
  { id: 's1', adm: 'CV-2024-0142', name: 'Aarav Sharma', class: 'VIII-A', due: 24500 },
  { id: 's2', adm: 'CV-2024-0117', name: 'Diya Patel', class: 'X-B', due: 0 },
  { id: 's3', adm: 'CV-2024-0203', name: 'Vihaan Kumar', class: 'V-A', due: 8200 },
  { id: 's4', adm: 'CV-2024-0089', name: 'Ananya Reddy', class: 'XII-A', due: 51800 },
];

export default function FeeCounter() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState('');
  const items = query
    ? RECENT.filter(
        (r) =>
          r.name.toLowerCase().includes(query.toLowerCase()) ||
          r.adm.toLowerCase().includes(query.toLowerCase())
      )
    : RECENT;

  return (
    <View style={{ flex: 1, backgroundColor: color.paper }}>
      <StatusBar style="dark" />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingTop: insets.top + 18,
          paddingBottom: 60,
          paddingHorizontal: 22,
        }}
      >
        <TouchableOpacity onPress={() => router.back()} hitSlop={10}>
          <Text variant="micro" tone="inkMute">
            ← Home
          </Text>
        </TouchableOpacity>
        <View style={{ height: 18 }} />
        <Text variant="eyebrow" tone="marigold">
          Fee counter · Office
        </Text>
        <View style={{ height: 10 }} />
        <Text variant="hero" tone="ink">
          Collect
        </Text>
        <Text variant="hero" tone="ink" italic>
          a fee.
        </Text>
        <View style={{ height: 24 }} />

        {/* Search */}
        <View
          style={{
            paddingHorizontal: 18,
            paddingVertical: 16,
            backgroundColor: color.card,
            borderRadius: 10,
            borderWidth: 1,
            borderColor: color.ruleStrong,
          }}
        >
          <Text variant="eyebrow" tone="inkFaint">
            Search
          </Text>
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Name, admission №, or parent phone"
            placeholderTextColor={color.inkFaint}
            style={{
              fontFamily: query ? 'Fraunces_500Medium_Italic' : 'DMSans_400Regular',
              fontSize: 20,
              color: color.ink,
              paddingVertical: 6,
            }}
          />
        </View>

        <View style={{ height: 18 }} />
        <Text variant="eyebrow" tone="inkFaint">
          {query ? `${items.length} match${items.length === 1 ? '' : 'es'}` : 'Recent · today'}
        </Text>
        <View style={{ height: 8 }} />
        <Rule />

        {items.map((r, i) => (
          <TouchableOpacity
            key={r.id}
            activeOpacity={0.6}
            onPress={() => router.push(`/finance/collect?id=${r.id}` as never)}
          >
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                paddingVertical: 18,
                borderBottomWidth: 1,
                borderBottomColor: color.rule,
              }}
            >
              <Text variant="kicker" tone="inkFaint" style={{ width: 34 }}>
                {String(i + 1).padStart(2, '0')}
              </Text>
              <View style={{ flex: 1 }}>
                <Text variant="h2" tone="ink" italic>
                  {r.name}
                </Text>
                <Text variant="caption" tone="inkMute" style={{ marginTop: 2 }}>
                  {r.adm} · {r.class}
                </Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text variant="eyebrow" tone={r.due === 0 ? 'sage' : 'brick'}>
                  {r.due === 0 ? 'Cleared' : 'Outstanding'}
                </Text>
                <Text variant="numMid" tone={r.due === 0 ? 'sage' : 'ink'}>
                  ₹{r.due.toLocaleString('en-IN')}
                </Text>
              </View>
            </View>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
}
