import { useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { authApi, useAuthStore } from '@campus-verse/mobile-shared';

/* ─────────────────────────── Tokens (mirrors login) ─────────────────────────── */

const C = {
  navy: '#1e1b4b',
  cyan: '#06b6d4',
  bg: '#f8fafc',
  card: '#ffffff',
  border: '#e2e8f0',
  text: '#0f172a',
  textMuted: '#64748b',
  textFaint: '#94a3b8',
  rose: '#e11d48',
  emerald: '#10b981',
};
const MONO = 'SpaceMono';
const EYEBROW = 'ACCOUNT SECURITY';

/* ─────────────────────────── DotGrid backdrop ─────────────────────────── */

function DotGrid({ rows = 5, cols = 14 }: { rows?: number; cols?: number }) {
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {Array.from({ length: rows }).map((_, r) => (
        <View
          key={r}
          style={{
            flexDirection: 'row',
            justifyContent: 'space-around',
            paddingTop: r === 0 ? 14 : 18,
          }}
        >
          {Array.from({ length: cols }).map((_, c) => (
            <View
              key={c}
              style={{
                width: 2,
                height: 2,
                borderRadius: 1,
                backgroundColor: 'rgba(255,255,255,0.18)',
                opacity: 0.5,
              }}
            />
          ))}
        </View>
      ))}
    </View>
  );
}

/* ─────────────────────────── Password requirement checks ─────────────────────────── */

type Check = { label: string; ok: boolean };

function evaluatePassword(pw: string): Check[] {
  return [
    { label: '8+ characters', ok: pw.length >= 8 },
    { label: 'Uppercase letter', ok: /[A-Z]/.test(pw) },
    { label: 'Lowercase letter', ok: /[a-z]/.test(pw) },
    { label: 'Number', ok: /\d/.test(pw) },
    { label: 'Special (@$!%*?&)', ok: /[@$!%*?&]/.test(pw) },
  ];
}

/* ─────────────────────────── Screen ─────────────────────────── */

export default function ChangePasswordScreen() {
  const router = useRouter();
  const refreshUser = useAuthStore((s) => s.refreshUser);
  const mustChange = useAuthStore((s) => s.user?.mustChangePassword);

  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showNext, setShowNext] = useState(false);
  const [showCurrent, setShowCurrent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<{ current?: string; next?: string; confirm?: string }>({});
  const [focused, setFocused] = useState<'current' | 'next' | 'confirm' | null>(null);

  const nextRef = useRef<TextInput>(null);
  const confirmRef = useRef<TextInput>(null);

  const checks = useMemo(() => evaluatePassword(next), [next]);
  const allChecksPass = checks.every((c) => c.ok);

  const validate = (): boolean => {
    const e: typeof errors = {};
    if (!current) e.current = 'Current password is required';
    if (!next) e.next = 'New password is required';
    else if (!allChecksPass) e.next = 'Password does not meet all requirements';
    else if (next === current) e.next = 'New password must be different';
    if (!confirm) e.confirm = 'Please confirm your new password';
    else if (next !== confirm) e.confirm = 'Passwords do not match';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    setLoading(true);
    try {
      await authApi.changePassword({
        currentPassword: current,
        newPassword: next,
        confirmPassword: confirm,
      });
      await refreshUser();
      Alert.alert('Password updated', 'Your password has been changed successfully.', [
        { text: 'Continue', onPress: () => router.replace('/(tabs)') },
      ]);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to change password';
      Alert.alert('Error', msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={{ flex: 1, backgroundColor: C.navy }}
    >
      <StatusBar style="light" />
      <ScrollView
        contentContainerStyle={{ flexGrow: 1 }}
        keyboardShouldPersistTaps="handled"
        bounces={false}
      >
        {/* ═════════════════════════ HERO ═════════════════════════ */}
        <View style={$.hero}>
          <View style={$.heroOrb} />
          <View style={$.heroDots}>
            <DotGrid />
          </View>

          <Text style={$.eyebrow}>{EYEBROW}</Text>

          <View style={$.brandRow}>
            <View style={$.brandTile}>
              <Ionicons name="shield-checkmark" size={26} color="#fff" />
              <View style={$.brandTileDot}>
                <View style={$.brandTileDotInner} />
              </View>
            </View>
            <View style={{ marginLeft: 14, flex: 1 }}>
              <Text style={$.brand}>
                {mustChange ? 'Set a new' : 'Change'} <Text style={$.brandAccent}>password.</Text>
              </Text>
              <Text style={$.brandTag}>
                {mustChange ? 'Required before continuing.' : 'Keep your account protected.'}
              </Text>
            </View>
          </View>
        </View>

        {/* ═════════════════════════ FORM CARD ═════════════════════════ */}
        <View style={$.card}>
          {/* Current Password */}
          <View style={{ marginBottom: 18 }}>
            <Text style={$.label}>CURRENT PASSWORD</Text>
            <View
              style={[
                $.inputWrap,
                {
                  backgroundColor: focused === 'current' ? '#fafafe' : C.bg,
                  borderColor: errors.current ? C.rose : focused === 'current' ? C.navy : C.border,
                },
              ]}
            >
              <Ionicons
                name="lock-closed-outline"
                size={17}
                color={focused === 'current' ? C.navy : C.textFaint}
              />
              <TextInput
                style={$.input}
                value={current}
                onChangeText={(t) => {
                  setCurrent(t);
                  if (errors.current) setErrors({ ...errors, current: undefined });
                }}
                onFocus={() => setFocused('current')}
                onBlur={() => setFocused(null)}
                secureTextEntry={!showCurrent}
                placeholder="Enter your current password"
                placeholderTextColor={C.textFaint}
                autoCapitalize="none"
                autoComplete="current-password"
                returnKeyType="next"
                onSubmitEditing={() => nextRef.current?.focus()}
                editable={!loading}
              />
              <TouchableOpacity
                onPress={() => setShowCurrent(!showCurrent)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons
                  name={showCurrent ? 'eye-off-outline' : 'eye-outline'}
                  size={17}
                  color={C.textFaint}
                />
              </TouchableOpacity>
            </View>
            {errors.current && <FieldError text={errors.current} />}
          </View>

          {/* New Password */}
          <View style={{ marginBottom: 10 }}>
            <Text style={$.label}>NEW PASSWORD</Text>
            <View
              style={[
                $.inputWrap,
                {
                  backgroundColor: focused === 'next' ? '#fafafe' : C.bg,
                  borderColor: errors.next ? C.rose : focused === 'next' ? C.navy : C.border,
                },
              ]}
            >
              <Ionicons
                name="key-outline"
                size={17}
                color={focused === 'next' ? C.navy : C.textFaint}
              />
              <TextInput
                ref={nextRef}
                style={$.input}
                value={next}
                onChangeText={(t) => {
                  setNext(t);
                  if (errors.next) setErrors({ ...errors, next: undefined });
                }}
                onFocus={() => setFocused('next')}
                onBlur={() => setFocused(null)}
                secureTextEntry={!showNext}
                placeholder="Pick a strong one"
                placeholderTextColor={C.textFaint}
                autoCapitalize="none"
                autoComplete="new-password"
                returnKeyType="next"
                onSubmitEditing={() => confirmRef.current?.focus()}
                editable={!loading}
              />
              <TouchableOpacity
                onPress={() => setShowNext(!showNext)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons
                  name={showNext ? 'eye-off-outline' : 'eye-outline'}
                  size={17}
                  color={C.textFaint}
                />
              </TouchableOpacity>
            </View>
            {errors.next && <FieldError text={errors.next} />}
          </View>

          {/* Requirements checklist */}
          {next.length > 0 && (
            <View style={$.checks}>
              {checks.map((c) => (
                <View key={c.label} style={$.checkRow}>
                  <Ionicons
                    name={c.ok ? 'checkmark-circle' : 'ellipse-outline'}
                    size={13}
                    color={c.ok ? C.emerald : C.textFaint}
                  />
                  <Text
                    style={[
                      $.checkText,
                      { color: c.ok ? C.emerald : C.textMuted, fontWeight: c.ok ? '600' : '400' },
                    ]}
                  >
                    {c.label}
                  </Text>
                </View>
              ))}
            </View>
          )}

          {/* Confirm */}
          <View style={{ marginTop: next.length > 0 ? 14 : 18, marginBottom: 22 }}>
            <Text style={$.label}>CONFIRM NEW PASSWORD</Text>
            <View
              style={[
                $.inputWrap,
                {
                  backgroundColor: focused === 'confirm' ? '#fafafe' : C.bg,
                  borderColor: errors.confirm ? C.rose : focused === 'confirm' ? C.navy : C.border,
                },
              ]}
            >
              <Ionicons
                name="checkmark-done-outline"
                size={17}
                color={focused === 'confirm' ? C.navy : C.textFaint}
              />
              <TextInput
                ref={confirmRef}
                style={$.input}
                value={confirm}
                onChangeText={(t) => {
                  setConfirm(t);
                  if (errors.confirm) setErrors({ ...errors, confirm: undefined });
                }}
                onFocus={() => setFocused('confirm')}
                onBlur={() => setFocused(null)}
                secureTextEntry={!showNext}
                placeholder="Re-enter the new password"
                placeholderTextColor={C.textFaint}
                autoCapitalize="none"
                autoComplete="new-password"
                returnKeyType="done"
                onSubmitEditing={handleSubmit}
                editable={!loading}
              />
            </View>
            {errors.confirm && <FieldError text={errors.confirm} />}
          </View>

          {/* CTA */}
          <TouchableOpacity onPress={handleSubmit} disabled={loading} activeOpacity={0.85}>
            <View style={[$.cta, loading && { opacity: 0.7 }]}>
              {loading ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <>
                  <Text style={$.ctaText}>Update password</Text>
                  <Ionicons name="arrow-forward" size={17} color="#fff" style={{ marginLeft: 8 }} />
                </>
              )}
            </View>
          </TouchableOpacity>

          <View style={{ marginTop: 28, alignItems: 'center' }}>
            <Text style={$.footerText}>
              Trouble signing in? <Text style={$.footerAccent}>Contact your school admin.</Text>
            </Text>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function FieldError({ text }: { text: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 6, marginLeft: 2 }}>
      <Ionicons name="alert-circle" size={13} color={C.rose} />
      <Text style={{ color: C.rose, fontSize: 12, marginLeft: 5, fontWeight: '500' }}>{text}</Text>
    </View>
  );
}

/* ─────────────────────────── Styles ─────────────────────────── */

const $ = StyleSheet.create({
  hero: {
    backgroundColor: C.navy,
    paddingTop: 80,
    paddingHorizontal: 28,
    paddingBottom: 56,
    overflow: 'hidden',
  },
  heroOrb: {
    position: 'absolute',
    width: 280,
    height: 280,
    borderRadius: 140,
    backgroundColor: 'rgba(6,182,212,0.18)',
    top: -100,
    right: -90,
    opacity: 0.7,
  },
  heroDots: {
    position: 'absolute',
    top: 70,
    left: 0,
    right: 0,
    height: 200,
    opacity: 0.6,
  },
  eyebrow: {
    fontFamily: MONO,
    color: 'rgba(255,255,255,0.55)',
    fontSize: 10.5,
    letterSpacing: 3,
    marginBottom: 18,
  },
  brandRow: { flexDirection: 'row', alignItems: 'center' },
  brandTile: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandTileDot: {
    position: 'absolute',
    top: -4,
    right: -4,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: C.cyan,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: C.cyan,
    shadowOpacity: 0.6,
    shadowOffset: { width: 0, height: 0 },
    shadowRadius: 6,
  },
  brandTileDotInner: { width: 5, height: 5, borderRadius: 2.5, backgroundColor: '#fff' },
  brand: {
    color: '#fff',
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: -0.6,
  },
  brandAccent: { fontStyle: 'italic', fontWeight: '300', color: C.cyan },
  brandTag: {
    color: 'rgba(255,255,255,0.65)',
    fontSize: 12.5,
    marginTop: 2,
    fontWeight: '500',
  },

  card: {
    flex: 1,
    backgroundColor: C.card,
    borderTopLeftRadius: 36,
    borderTopRightRadius: 36,
    marginTop: -28,
    paddingHorizontal: 26,
    paddingTop: 36,
    paddingBottom: 36,
  },

  label: {
    fontFamily: MONO,
    fontSize: 9.5,
    fontWeight: '700',
    color: C.textMuted,
    letterSpacing: 1.6,
    marginBottom: 6,
    marginLeft: 2,
  },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    paddingHorizontal: 14,
    height: 52,
    borderWidth: 1.5,
  },
  input: {
    flex: 1,
    marginLeft: 10,
    fontSize: 15,
    color: C.text,
  },

  checks: {
    backgroundColor: C.bg,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginTop: 4,
  },
  checkRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 2 },
  checkText: { fontSize: 12, marginLeft: 8, letterSpacing: 0.1 },

  cta: {
    backgroundColor: C.navy,
    height: 54,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    shadowColor: C.cyan,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 14,
    elevation: 6,
  },
  ctaText: { color: '#fff', fontWeight: '700', fontSize: 16, letterSpacing: -0.2 },

  footerText: { color: C.textMuted, fontSize: 12, textAlign: 'center' },
  footerAccent: { fontWeight: '700', color: C.navy },
});
