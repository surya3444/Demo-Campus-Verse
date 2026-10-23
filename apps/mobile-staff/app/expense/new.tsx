import { useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { StatusBar } from 'expo-status-bar';
import * as Haptics from 'expo-haptics';
import { Send } from 'lucide-react-native';
import { Text, ScreenHeader, brand, color } from '@campus-verse/mobile-shared/design';
import { apiClient } from '@campus-verse/mobile-shared/api/client';
import { Field, Choice } from '@/components/Field';

const CATEGORIES = ['travel', 'supplies', 'equipment', 'maintenance', 'events', 'utilities', 'other'] as const;
type Category = (typeof CATEGORIES)[number];
const errorText = (e: unknown) =>
  (e as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message ?? 'Couldn’t submit the claim. Try again.';

/** New expense claim: saved, then submitted for approval in one step. */
export default function NewExpense() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const qc = useQueryClient();
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState<Category | null>(null);
  const [description, setDescription] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  const save = useMutation({
    mutationFn: async () => {
      const created = (await apiClient.post('/expenses', { title: title.trim(), amount: Number(amount), category, description: description.trim() || undefined })).data.data as { _id: string };
      await apiClient.put(`/expenses/${created._id}/submit`);
    },
    onSuccess: () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
      qc.invalidateQueries({ queryKey: ['my-expenses'] });
      router.back();
    },
  });

  const submit = () => {
    const e: Record<string, string> = {};
    if (!title.trim()) e.title = 'What is this for?';
    if (!(Number(amount) > 0)) e.amount = 'Enter the amount';
    if (!category) e.category = 'Pick a category';
    setErrors(e);
    if (!Object.keys(e).length) save.mutate();
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: color.paper }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <StatusBar style="dark" />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 18, paddingBottom: insets.bottom + 30 }} keyboardShouldPersistTaps="handled">
        <ScreenHeader eyebrow="Expenses" title="New claim" subtitle="Submitted straight to your approver." />
        <View style={{ height: 18 }} />
        <Field label="What for" required value={title} onChangeText={setTitle} placeholder="e.g. Lab chemicals for practicals" error={errors.title} />
        <Field label="Amount (₹)" required value={amount} onChangeText={setAmount} keyboardType="decimal-pad" error={errors.amount} />
        <Choice label="Category" options={CATEGORIES.map((c) => ({ value: c, label: c[0].toUpperCase() + c.slice(1) }))} value={category} onChange={setCategory} />
        {errors.category ? (
          <Text variant="caption" style={{ color: brand.danger, marginTop: -8, marginBottom: 10 }}>
            {errors.category}
          </Text>
        ) : null}
        <Field label="Notes" value={description} onChangeText={setDescription} multiline />
        {save.isError ? (
          <Text variant="caption" style={{ color: brand.danger, marginBottom: 10 }}>
            {errorText(save.error)}
          </Text>
        ) : null}
        <Pressable onPress={submit} disabled={save.isPending}>
          <View style={{ height: 54, borderRadius: 18, backgroundColor: brand.navy800, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', opacity: save.isPending ? 0.7 : 1 }}>
            {save.isPending ? <ActivityIndicator color="#fff" /> : <Send size={18} color="#fff" />}
            <Text variant="h3" tone="onInk" style={{ marginLeft: 8 }}>
              Submit claim
            </Text>
          </View>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
