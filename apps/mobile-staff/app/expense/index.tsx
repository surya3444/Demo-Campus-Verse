import { ActivityIndicator, FlatList, Pressable, RefreshControl, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { StatusBar } from 'expo-status-bar';
import { Plus, Receipt } from 'lucide-react-native';
import { Text, ScreenHeader, Surface, brand, color } from '@campus-verse/mobile-shared/design';
import { apiClient } from '@campus-verse/mobile-shared/api/client';

interface Expense {
  _id: string;
  expenseNumber?: string;
  title: string;
  category: string;
  amount: number;
  status: string;
  createdAt: string;
}

const STATUS: Record<string, { label: string; bg: string; fg: string }> = {
  draft: { label: 'Draft', bg: '#EDF0F3', fg: '#526C98' },
  submitted: { label: 'Submitted', bg: '#E1ECFE', fg: '#053495' },
  pending_approval: { label: 'Awaiting approval', bg: '#FEF3C7', fg: '#D97706' },
  approved: { label: 'Approved', bg: '#DCFCE7', fg: '#16A34A' },
  rejected: { label: 'Rejected', bg: '#FEE2E2', fg: '#DC2626' },
  paid: { label: 'Paid', bg: '#DCFCE7', fg: '#16A34A' },
};
const inr = (n: number) => `₹${Math.round(n).toLocaleString('en-IN')}`;

/** My expense claims and where each one stands. Live data. */
export default function Expenses() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const list = useQuery({
    queryKey: ['my-expenses'],
    queryFn: async () => (await apiClient.get('/expenses/my', { params: { limit: 50 } })).data.data as Expense[],
  });
  const items = list.data ?? [];
  const pending = items.filter((e) => !['approved', 'paid', 'rejected', 'draft'].includes(e.status)).reduce((s, e) => s + e.amount, 0);

  return (
    <View style={{ flex: 1, backgroundColor: color.paper }}>
      <StatusBar style="dark" />
      <FlatList
        data={items}
        keyExtractor={(e) => e._id}
        refreshControl={<RefreshControl refreshing={list.isRefetching} onRefresh={() => list.refetch()} tintColor={brand.navy700} />}
        contentContainerStyle={{ paddingHorizontal: 18, paddingBottom: insets.bottom + 110 }}
        ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
        ListHeaderComponent={
          <View style={{ marginBottom: 14 }}>
            <ScreenHeader eyebrow="Expenses" title="My claims" subtitle={pending ? `${inr(pending)} awaiting approval` : 'Submit bills for reimbursement'} />
            {list.isLoading ? <ActivityIndicator color={brand.navy700} style={{ marginTop: 24 }} /> : null}
          </View>
        }
        ListEmptyComponent={
          list.isLoading ? null : (
            <View style={{ alignItems: 'center', marginTop: 30 }}>
              <Receipt size={40} color={brand.navy300} />
              <Text variant="body" tone="inkMute" style={{ marginTop: 10 }}>
                No claims yet.
              </Text>
            </View>
          )
        }
        renderItem={({ item: e }) => {
          const st = STATUS[e.status] ?? { label: e.status, bg: '#EDF0F3', fg: '#526C98' };
          return (
            <Surface>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <View style={{ flex: 1 }}>
                  <Text variant="h3" tone="ink" numberOfLines={1}>
                    {e.title}
                  </Text>
                  <Text variant="caption" tone="inkMute">
                    {e.category[0].toUpperCase() + e.category.slice(1)} · {new Date(e.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                    {e.expenseNumber ? ` · ${e.expenseNumber}` : ''}
                  </Text>
                </View>
                <Text variant="numMid" tone="ink">
                  {inr(e.amount)}
                </Text>
              </View>
              <View style={{ alignSelf: 'flex-start', marginTop: 10, paddingHorizontal: 9, paddingVertical: 3, borderRadius: 999, backgroundColor: st.bg }}>
                <Text variant="micro" style={{ color: st.fg, fontFamily: 'DMSans_700Bold' }}>
                  {st.label}
                </Text>
              </View>
            </Surface>
          );
        }}
      />
      <View style={{ position: 'absolute', left: 18, right: 18, bottom: insets.bottom + 16 }}>
        <Pressable onPress={() => router.push('/expense/new' as never)}>
          <View style={{ height: 54, borderRadius: 18, backgroundColor: brand.navy800, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}>
            <Plus size={19} color="#fff" />
            <Text variant="h3" tone="onInk" style={{ marginLeft: 8 }}>
              New claim
            </Text>
          </View>
        </Pressable>
      </View>
    </View>
  );
}
