import { View, Text, ScrollView, StyleSheet, ActivityIndicator } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { useLocalSearchParams } from 'expo-router';
import { hrApi } from '@campus-verse/mobile-shared';

const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

function formatINR(n: number): string {
  return '₹' + n.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

export default function PayslipDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();

  const { data, isLoading } = useQuery({
    queryKey: ['payslip', id],
    queryFn: () => hrApi.getPayslipById(id as string),
    enabled: !!id,
  });

  if (isLoading || !data) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', backgroundColor: '#F9F8F5' }}>
        <ActivityIndicator color="#053495" />
      </View>
    );
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: '#F9F8F5' }}
      contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
    >
      {/* Hero */}
      <View style={s.hero}>
        <Text style={s.period}>
          {MONTHS[data.month - 1]} {data.year}
        </Text>
        <Text style={s.netLabel}>Net Payable</Text>
        <Text style={s.netAmount}>{formatINR(data.netPayable)}</Text>
        {data.paymentDate && (
          <Text style={s.paidOn}>
            Paid on {new Date(data.paymentDate).toLocaleDateString('en-IN')}
          </Text>
        )}
      </View>

      {/* Working days */}
      <View style={s.row}>
        <Tile label="Working Days" value={String(data.workingDays)} />
        <Tile label="Present" value={String(data.daysPresent)} color="#10b981" />
        <Tile label="LOP" value={String(data.lopDays)} color="#ef4444" />
      </View>

      {/* Earnings */}
      <Section title="Earnings" total={data.grossEarnings} totalColor="#10b981">
        {data.earnings.map((e) => (
          <Line key={e.code} label={e.label} amount={e.amount} />
        ))}
      </Section>

      {/* Deductions */}
      <Section title="Deductions" total={-data.totalDeductions} totalColor="#ef4444">
        {data.deductions.map((d) => (
          <Line key={d.code} label={d.label} amount={-d.amount} />
        ))}
      </Section>

      {/* Net total */}
      <View style={s.netRow}>
        <Text style={s.netRowLabel}>Net Pay</Text>
        <Text style={s.netRowAmount}>{formatINR(data.netPayable)}</Text>
      </View>

      {/* Bank */}
      {data.bankDetails && (
        <View style={s.card}>
          <Text style={s.cardTitle}>Bank Details</Text>
          {data.bankDetails.accountHolder && (
            <KV k="Account Holder" v={data.bankDetails.accountHolder} />
          )}
          {data.bankDetails.bankName && <KV k="Bank" v={data.bankDetails.bankName} />}
          {data.bankDetails.accountNumber && (
            <KV k="Account Number" v={data.bankDetails.accountNumber} />
          )}
          {data.bankDetails.ifscCode && <KV k="IFSC" v={data.bankDetails.ifscCode} />}
          {data.paymentReference && <KV k="Payment Ref" v={data.paymentReference} />}
        </View>
      )}
    </ScrollView>
  );
}

function Tile({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <View style={s.tile}>
      <Text style={[s.tileValue, color && { color }]}>{value}</Text>
      <Text style={s.tileLabel}>{label}</Text>
    </View>
  );
}

function Section({
  title,
  total,
  totalColor,
  children,
}: {
  title: string;
  total: number;
  totalColor: string;
  children: React.ReactNode;
}) {
  return (
    <View style={s.card}>
      <Text style={s.cardTitle}>{title}</Text>
      {children}
      <View style={s.sectionTotal}>
        <Text style={s.sectionTotalLabel}>Total</Text>
        <Text style={[s.sectionTotalAmount, { color: totalColor }]}>{formatINR(total)}</Text>
      </View>
    </View>
  );
}

function Line({ label, amount }: { label: string; amount: number }) {
  return (
    <View style={s.line}>
      <Text style={s.lineLabel}>{label}</Text>
      <Text style={s.lineAmount}>{formatINR(amount)}</Text>
    </View>
  );
}

function KV({ k, v }: { k: string; v: string }) {
  return (
    <View style={s.kv}>
      <Text style={s.kvK}>{k}</Text>
      <Text style={s.kvV}>{v}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  hero: {
    backgroundColor: '#042A6C',
    padding: 24,
    borderRadius: 16,
    alignItems: 'center',
    marginBottom: 14,
  },
  period: {
    color: '#C4D9FD',
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  netLabel: { color: '#84AFFB', fontSize: 12, marginTop: 10 },
  netAmount: { color: '#fff', fontSize: 34, fontWeight: '800', marginTop: 4 },
  paidOn: { color: '#C4D9FD', fontSize: 12, marginTop: 6 },
  row: { flexDirection: 'row', marginBottom: 14 },
  tile: {
    flex: 1,
    marginHorizontal: 4,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#EDF0F3',
  },
  tileValue: { fontSize: 22, fontWeight: '800', color: '#042A6C' },
  tileLabel: { fontSize: 11, color: '#8998B3', marginTop: 2, fontWeight: '600' },
  card: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#EDF0F3',
  },
  cardTitle: { fontSize: 14, fontWeight: '700', color: '#042A6C', marginBottom: 10 },
  line: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 },
  lineLabel: { fontSize: 13, color: '#3E5683' },
  lineAmount: { fontSize: 13, color: '#042A6C', fontWeight: '600' },
  sectionTotal: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#EDF0F3',
  },
  sectionTotalLabel: { fontSize: 13, fontWeight: '700', color: '#526C98' },
  sectionTotalAmount: { fontSize: 15, fontWeight: '800' },
  netRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: '#F0F5FE',
    padding: 16,
    borderRadius: 12,
    marginBottom: 14,
    alignItems: 'center',
  },
  netRowLabel: { fontSize: 14, fontWeight: '700', color: '#042A6C' },
  netRowAmount: { fontSize: 20, fontWeight: '800', color: '#042A6C' },
  kv: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 5 },
  kvK: { fontSize: 12, color: '#8998B3', fontWeight: '600' },
  kvV: { fontSize: 13, color: '#042A6C', fontWeight: '600' },
});
