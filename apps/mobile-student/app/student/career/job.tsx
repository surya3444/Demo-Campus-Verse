import { useState } from 'react';
import { View, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Text, Rule, Pill, Button, color } from '@campus-verse/mobile-shared/design';
import { careerConnectApi } from '@/api/careerConnect';

export default function JobDetail() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [applied, setApplied] = useState(false);

  const { data: job } = useQuery({
    queryKey: ['cc-job', id],
    queryFn: () => careerConnectApi.getJob(id!),
    enabled: !!id,
  });

  const apply = useMutation({
    mutationFn: () => careerConnectApi.applyToJob(id!, {}),
    onSuccess: () => {
      setApplied(true);
      Alert.alert('Application sent', 'You can track this from My applications.');
    },
    onError: (err: { message?: string }) => {
      Alert.alert('Could not apply', err?.message || 'Please try again later.');
    },
  });

  if (!job) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: color.paper,
          paddingTop: insets.top + 40,
          paddingHorizontal: 22,
        }}
      >
        <StatusBar style="dark" />
        <Text variant="body" tone="inkMute" italic>
          Pulling the listing…
        </Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: color.paper }}>
      <StatusBar style="light" />
      {/* Ink masthead */}
      <View
        style={{
          backgroundColor: color.ink,
          paddingTop: insets.top + 14,
          paddingBottom: 30,
          paddingHorizontal: 22,
        }}
      >
        <TouchableOpacity onPress={() => router.back()} hitSlop={10}>
          <Text variant="micro" tone="onInkMute">
            ← Back
          </Text>
        </TouchableOpacity>
        <View style={{ height: 18 }} />
        <Text variant="eyebrow" tone="marigold">
          {job.companyName ?? 'Company'}
        </Text>
        <View style={{ height: 10 }} />
        <Text variant="display" tone="onInk" italic>
          {job.title}
        </Text>
        <View style={{ height: 14 }} />
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
          {job.jobType && <Pill label={job.jobType} tone="marigold" variant="solid" size="xs" />}
          {job.location && <Pill label={job.location} tone="ink" variant="outline" size="xs" />}
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ padding: 22, paddingBottom: 140 }}
      >
        {/* Foreword */}
        {job.description && (
          <View
            style={{
              borderLeftWidth: 2,
              borderLeftColor: color.marigold,
              paddingLeft: 14,
              marginBottom: 28,
            }}
          >
            <Text variant="eyebrow" tone="inkFaint">
              About the role
            </Text>
            <View style={{ height: 8 }} />
            <Text variant="body" tone="inkSoft" style={{ lineHeight: 22 }}>
              {job.description}
            </Text>
          </View>
        )}

        {/* Facts ledger */}
        <Text variant="eyebrow" tone="inkFaint">
          01 · Facts
        </Text>
        <View style={{ height: 12 }} />
        <Rule tone="ruleStrong" />
        <Fact label="Openings" value={job.openings ? String(job.openings) : '—'} />
        <Fact
          label="Stipend / CTC"
          value={
            job.salaryRange?.min
              ? `₹${(job.salaryRange.min / 100000).toFixed(1)}L – ₹${((job.salaryRange.max ?? 0) / 100000).toFixed(1)}L`
              : '—'
          }
        />
        <Fact
          label="Deadline"
          value={
            job.applicationDeadline
              ? new Date(job.applicationDeadline).toLocaleDateString('en-IN', {
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric',
                })
              : '—'
          }
        />
        <Fact
          label="Min GPA"
          value={job.eligibility?.minGpa ? String(job.eligibility.minGpa) : '—'}
        />

        {/* Skills */}
        {job.skills && job.skills.length > 0 && (
          <View style={{ marginTop: 24 }}>
            <Text variant="eyebrow" tone="inkFaint">
              02 · Skills wanted
            </Text>
            <View style={{ height: 12 }} />
            <Rule tone="ruleStrong" />
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 14 }}>
              {job.skills.map((s) => (
                <Pill key={s} label={s} tone="indigo" size="sm" />
              ))}
            </View>
          </View>
        )}

        <View style={{ height: 32 }} />
        <Button
          label={applied ? 'Application sent ✓' : apply.isPending ? 'Sending…' : 'Apply now'}
          variant={applied ? 'outline' : 'marigold'}
          size="lg"
          full
          loading={apply.isPending}
          onPress={() => apply.mutate()}
          disabled={applied}
        />
        <View style={{ height: 14 }} />
        <Text variant="micro" tone="inkFaint" align="center">
          The placement cell will review your profile before forwarding it to{' '}
          {job.companyName ?? 'the company'}.
        </Text>
      </ScrollView>
    </View>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <View>
      <View
        style={{
          flexDirection: 'row',
          paddingVertical: 14,
        }}
      >
        <Text variant="caption" tone="inkMute" style={{ width: 130 }}>
          {label}
        </Text>
        <Text variant="bodyStrong" tone="ink" italic style={{ flex: 1 }}>
          {value}
        </Text>
      </View>
      <View style={{ height: 1, backgroundColor: color.rule }} />
    </View>
  );
}
