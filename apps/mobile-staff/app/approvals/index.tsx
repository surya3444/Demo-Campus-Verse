import { useState } from 'react';
import { View, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import {
  Text,
  Pill,
  Button,
  Segmented,
  EmptyState,
  color,
} from '@campus-verse/mobile-shared/design';

/**
 * Approvals inbox — one window.
 *
 * Manager opens one screen, sees leave, expense and concession requests in a
 * unified timeline. Each row carries the requester, brief, amount/duration,
 * and inline approve / decline actions.
 */

type Kind = 'leave' | 'expense' | 'concession';
interface Request {
  id: string;
  kind: Kind;
  who: string;
  whoRole: string;
  whenISO: string;
  brief: string;
  detail: string;
}

const SAMPLE: Request[] = [
  {
    id: 'r1',
    kind: 'leave',
    who: 'Asha Verma',
    whoRole: 'Maths · X-B',
    whenISO: '2026-05-19',
    brief: '3 days · personal',
    detail: 'Family wedding · 19–21 May',
  },
  {
    id: 'r2',
    kind: 'expense',
    who: 'Rajat Khanna',
    whoRole: 'Sports',
    whenISO: '2026-05-17',
    brief: '₹4,250',
    detail: 'Inter-school tournament transport',
  },
  {
    id: 'r3',
    kind: 'leave',
    who: 'Ritu Sen',
    whoRole: 'English · IX-A',
    whenISO: '2026-05-22',
    brief: '1 day · sick',
    detail: 'Doctor appointment · 22 May',
  },
  {
    id: 'r4',
    kind: 'concession',
    who: 'Parent of Aarav S.',
    whoRole: 'Class VII-A',
    whenISO: '2026-05-15',
    brief: '₹12,000 · Term II',
    detail: 'Sibling discount request',
  },
  {
    id: 'r5',
    kind: 'expense',
    who: 'Anita Rao',
    whoRole: 'Library',
    whenISO: '2026-05-14',
    brief: '₹2,180',
    detail: 'Annual periodical subscription',
  },
];

const TONE: Record<Kind, 'marigold' | 'indigo' | 'sage'> = {
  leave: 'marigold',
  expense: 'indigo',
  concession: 'sage',
};

export default function Approvals() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [filter, setFilter] = useState<'all' | Kind>('all');
  const items = filter === 'all' ? SAMPLE : SAMPLE.filter((r) => r.kind === filter);

  const act = (id: string, action: 'approve' | 'decline') => {
    Alert.alert(action === 'approve' ? 'Approved' : 'Declined', `Request ${id} ${action}d.`);
  };

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
          Approvals · {SAMPLE.length} on your desk
        </Text>
        <View style={{ height: 10 }} />
        <Text variant="hero" tone="ink">
          Decisions
        </Text>
        <Text variant="hero" tone="ink" italic>
          to make.
        </Text>
        <View style={{ height: 24 }} />

        <Segmented<'all' | Kind>
          segments={[
            { key: 'all', label: 'All', count: SAMPLE.length },
            {
              key: 'leave',
              label: 'Leave',
              count: SAMPLE.filter((r) => r.kind === 'leave').length,
            },
            {
              key: 'expense',
              label: 'Expense',
              count: SAMPLE.filter((r) => r.kind === 'expense').length,
            },
            {
              key: 'concession',
              label: 'Fees',
              count: SAMPLE.filter((r) => r.kind === 'concession').length,
            },
          ]}
          value={filter}
          onChange={setFilter}
        />

        {items.length === 0 ? (
          <View style={{ marginTop: 22 }}>
            <EmptyState
              eyebrow="Inbox zero"
              title="Nothing pending."
              description="When colleagues need your sign-off, you'll find it here."
            />
          </View>
        ) : (
          items.map((r, i) => (
            <View
              key={r.id}
              style={{
                marginTop: 18,
                paddingVertical: 20,
                paddingHorizontal: 18,
                backgroundColor: color.card,
                borderRadius: 10,
                borderWidth: 1,
                borderColor: color.rule,
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Text variant="kicker" tone="inkFaint" style={{ marginRight: 8 }}>
                  {String(i + 1).padStart(2, '0')}
                </Text>
                <Pill label={r.kind} tone={TONE[r.kind]} size="xs" />
                <View style={{ flex: 1 }} />
                <Text variant="micro" tone="inkFaint">
                  {new Date(r.whenISO).toLocaleDateString('en-IN', {
                    day: 'numeric',
                    month: 'short',
                  })}
                </Text>
              </View>
              <View style={{ height: 12 }} />
              <Text variant="h2" tone="ink" italic>
                {r.who}
              </Text>
              <Text variant="caption" tone="inkFaint" style={{ marginTop: 2 }}>
                {r.whoRole}
              </Text>
              <View style={{ height: 12 }} />
              <View
                style={{
                  borderLeftWidth: 2,
                  borderLeftColor: color[TONE[r.kind]],
                  paddingLeft: 12,
                }}
              >
                <Text variant="numSmall" tone="ink">
                  {r.brief}
                </Text>
                <Text variant="caption" tone="inkMute" style={{ marginTop: 4 }}>
                  {r.detail}
                </Text>
              </View>
              <View style={{ height: 16 }} />
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <Button
                  label="Decline"
                  variant="outline"
                  onPress={() => act(r.id, 'decline')}
                  style={{ flex: 1 }}
                />
                <Button
                  label="Approve"
                  variant="ink"
                  onPress={() => act(r.id, 'approve')}
                  style={{ flex: 1 }}
                />
              </View>
            </View>
          ))
        )}
      </ScrollView>
    </View>
  );
}
