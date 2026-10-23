import { useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { StatusBar } from 'expo-status-bar';
import * as Haptics from 'expo-haptics';
import { BadgeCheck, LogIn } from 'lucide-react-native';
import { Text, ScreenHeader, Surface, brand, color } from '@campus-verse/mobile-shared/design';
import { apiClient } from '@campus-verse/mobile-shared/api/client';
import { Field } from '@/components/Field';

const errorText = (e: unknown) =>
  (e as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message ?? 'Couldn’t register the visitor. Try again.';

/** Walk-in registration: saves the visitor and checks them in, issuing a pass code. */
export default function NewVisitor() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const qc = useQueryClient();
  const [f, setF] = useState({ name: '', phone: '', purpose: '', hostName: '', hostDepartment: '', company: '', numberOfVisitors: '1', vehicleNumber: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pass, setPass] = useState<string | null>(null);
  const set = (k: keyof typeof f) => (v: string) => setF((p) => ({ ...p, [k]: v }));

  const save = useMutation({
    mutationFn: async () => {
      const body = {
        name: f.name.trim(),
        phone: f.phone.trim(),
        purpose: f.purpose.trim(),
        hostName: f.hostName.trim(),
        hostDepartment: f.hostDepartment.trim() || undefined,
        company: f.company.trim() || undefined,
        vehicleNumber: f.vehicleNumber.trim() || undefined,
        numberOfVisitors: Math.max(1, parseInt(f.numberOfVisitors, 10) || 1),
        type: 'walk_in',
      };
      const created = (await apiClient.post('/visitors', body)).data.data as { _id: string; passCode?: string };
      const inRes = (await apiClient.put(`/visitors/${created._id}/check-in`)).data.data as { passCode?: string } | undefined;
      return inRes?.passCode ?? created.passCode ?? '';
    },
    onSuccess: (code) => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
      qc.invalidateQueries({ queryKey: ['visitors'] });
      setPass(code || 'issued');
    },
  });

  const submit = () => {
    const e: Record<string, string> = {};
    if (!f.name.trim()) e.name = 'Name is required';
    if (!f.phone.trim()) e.phone = 'Phone is required';
    if (!f.purpose.trim()) e.purpose = 'Purpose is required';
    if (!f.hostName.trim()) e.hostName = 'Who are they meeting?';
    setErrors(e);
    if (!Object.keys(e).length) save.mutate();
  };

  if (pass) {
    return (
      <View style={{ flex: 1, backgroundColor: color.paper, padding: 24, paddingTop: insets.top + 80, alignItems: 'center' }}>
        <StatusBar style="dark" />
        <BadgeCheck size={56} color={brand.success} />
        <Text variant="display" tone="ink" align="center" style={{ marginTop: 16 }}>
          {f.name} is checked in
        </Text>
        <Surface style={{ marginTop: 22, alignItems: 'center', alignSelf: 'stretch' }}>
          <Text variant="eyebrow" tone="inkMute">
            Pass code
          </Text>
          <Text variant="numLarge" tone="navy" style={{ marginTop: 6, fontFamily: 'CVMono_700Bold', letterSpacing: 3 }}>
            {pass}
          </Text>
        </Surface>
        <Pressable onPress={() => router.back()} style={{ alignSelf: 'stretch', marginTop: 22 }}>
          <View style={{ height: 52, borderRadius: 16, backgroundColor: brand.navy800, alignItems: 'center', justifyContent: 'center' }}>
            <Text variant="h3" tone="onInk">
              Done
            </Text>
          </View>
        </Pressable>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: color.paper }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <StatusBar style="dark" />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 18, paddingBottom: insets.bottom + 30 }} keyboardShouldPersistTaps="handled">
        <ScreenHeader eyebrow="Front desk" title="Register a visitor" subtitle="Saves the visitor and checks them in with a pass." />
        <View style={{ height: 18 }} />
        <Field label="Full name" required value={f.name} onChangeText={set('name')} error={errors.name} />
        <Field label="Phone" required value={f.phone} onChangeText={set('phone')} keyboardType="phone-pad" error={errors.phone} />
        <Field label="Purpose of visit" required value={f.purpose} onChangeText={set('purpose')} placeholder="e.g. Parent meeting, delivery" error={errors.purpose} />
        <Field label="Meeting" required value={f.hostName} onChangeText={set('hostName')} placeholder="Staff member's name" error={errors.hostName} />
        <Field label="Department" value={f.hostDepartment} onChangeText={set('hostDepartment')} />
        <Field label="Company" value={f.company} onChangeText={set('company')} />
        <View style={{ flexDirection: 'row', gap: 12 }}>
          <View style={{ flex: 1 }}>
            <Field label="People" value={f.numberOfVisitors} onChangeText={set('numberOfVisitors')} keyboardType="number-pad" />
          </View>
          <View style={{ flex: 2 }}>
            <Field label="Vehicle number" value={f.vehicleNumber} onChangeText={set('vehicleNumber')} autoCapitalize="characters" />
          </View>
        </View>
        {save.isError ? (
          <Text variant="caption" style={{ color: brand.danger, marginBottom: 10 }}>
            {errorText(save.error)}
          </Text>
        ) : null}
        <Pressable onPress={submit} disabled={save.isPending}>
          <View style={{ height: 54, borderRadius: 18, backgroundColor: brand.navy800, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', opacity: save.isPending ? 0.7 : 1 }}>
            {save.isPending ? <ActivityIndicator color="#fff" /> : <LogIn size={19} color="#fff" />}
            <Text variant="h3" tone="onInk" style={{ marginLeft: 8 }}>
              Check in visitor
            </Text>
          </View>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
