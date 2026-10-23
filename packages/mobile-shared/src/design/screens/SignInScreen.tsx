import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { Link } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { ArrowRight, CircleAlert, Eye, EyeOff, Fingerprint, LockKeyhole, Mail, ScanFace } from 'lucide-react-native';
import { useAuthStore } from '../../store/authStore';
import { useBiometrics, getBiometricLabel } from '../../hooks/useBiometrics';
import { AnimatedLogoMark, Wordmark } from '../components/Logo';
import { Text } from '../components/Text';
import { brand, color, elevation } from '../tokens';

export interface SignInProps {
  /** e.g. "Staff" or "Student" — shown as the portal label. */
  portal: string;
  /** Tagline under the name, with its last word in cyan, e.g. "Teach with intent." */
  tagline: [lead: string, accent: string];
}

/**
 * CampusVerse sign-in, shared by the Staff and Student apps: a navy hero with
 * the animated logo, then a white card with the form. Validation and
 * biometric sign-in are unchanged from the original screens.
 */
export function SignInScreen({ portal, tagline }: SignInProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});
  const [focus, setFocus] = useState<'email' | 'password' | null>(null);
  const passwordRef = useRef<TextInput>(null);

  const login = useAuthStore((s) => s.login);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const { isAvailable, isEnabled, biometricType, authenticate } = useBiometrics();

  useEffect(() => {
    if (isEnabled && isAvailable && !isAuthenticated) void authenticate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEnabled, isAvailable]);

  const validate = () => {
    const e: typeof errors = {};
    if (!email.trim()) e.email = 'Email is required';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) e.email = 'That doesn’t look like an email';
    if (!password) e.password = 'Password is required';
    else if (password.length < 6) e.password = 'At least 6 characters';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const submit = async () => {
    if (!validate()) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => undefined);
      return;
    }
    setLoading(true);
    try {
      await login({ email: email.trim(), password });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
    } catch (error: unknown) {
      Alert.alert('Sign-in failed', error instanceof Error ? error.message : 'Check your email and password and try again.');
    } finally {
      setLoading(false);
    }
  };

  const field = (name: 'email' | 'password') => [
    s.input,
    {
      borderColor: errors[name] ? brand.danger : focus === name ? brand.navy700 : color.ruleStrong,
      backgroundColor: focus === name ? '#FFFFFF' : color.paperWarm,
    },
  ];
  const iconTint = (name: 'email' | 'password') => (focus === name ? brand.navy700 : color.inkFaint);
  const Bio = biometricType === 'facial' ? ScanFace : Fingerprint;

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1, backgroundColor: brand.navy900 }}>
      <StatusBar style="light" />
      <ScrollView contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled" bounces={false}>
        <LinearGradient colors={[brand.navy950, brand.navy800, brand.navy700]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.hero}>
          {/* CampusVerse cyan glow + rings, echoing the web hero */}
          <View style={[s.ring, { width: 360, height: 360, right: -150, top: -120 }]} />
          <View style={[s.ring, { width: 240, height: 240, right: -90, top: -60, borderColor: 'rgba(10,197,255,0.22)' }]} />
          <View style={s.glow} />

          <View style={s.portal}>
            <View style={s.portalDot} />
            <Text variant="eyebrow" tone="onInk" style={{ letterSpacing: 2.2 }}>
              {portal} app
            </Text>
          </View>

          <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 22 }}>
            <AnimatedLogoMark size={64} tone="white" loop={false} />
            <View style={{ marginLeft: 14 }}>
              <Wordmark width={178} lettersOnly tone="white" />
              <Text variant="bodyStrong" tone="onInkMute" style={{ marginTop: 6 }}>
                {tagline[0]}{' '}
                <Text variant="bodyStrong" tone="onInk" italic>
                  {tagline[1]}
                </Text>
              </Text>
            </View>
          </View>
        </LinearGradient>

        <View style={s.card}>
          <Text variant="display" tone="ink">
            Welcome{' '}
            <Text variant="display" italic>
              back.
            </Text>
          </Text>
          <Text variant="body" tone="inkMute" style={{ marginTop: 6, marginBottom: 26 }}>
            Sign in with your campus account.
          </Text>

          <Text variant="eyebrow" tone="inkMute" style={s.label}>
            Email
          </Text>
          <View style={field('email')}>
            <Mail size={18} color={iconTint('email')} strokeWidth={1.75} />
            <TextInput
              style={s.text}
              placeholder="you@campus.edu"
              placeholderTextColor={color.inkGhost}
              value={email}
              onChangeText={(t) => {
                setEmail(t);
                if (errors.email) setErrors({ ...errors, email: undefined });
              }}
              onFocus={() => setFocus('email')}
              onBlur={() => setFocus(null)}
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
              returnKeyType="next"
              onSubmitEditing={() => passwordRef.current?.focus()}
              editable={!loading}
            />
          </View>
          {errors.email ? <FieldError text={errors.email} /> : <View style={{ height: 18 }} />}

          <Text variant="eyebrow" tone="inkMute" style={s.label}>
            Password
          </Text>
          <View style={field('password')}>
            <LockKeyhole size={18} color={iconTint('password')} strokeWidth={1.75} />
            <TextInput
              ref={passwordRef}
              style={s.text}
              placeholder="Your password"
              placeholderTextColor={color.inkGhost}
              value={password}
              onChangeText={(t) => {
                setPassword(t);
                if (errors.password) setErrors({ ...errors, password: undefined });
              }}
              onFocus={() => setFocus('password')}
              onBlur={() => setFocus(null)}
              secureTextEntry={!show}
              autoCapitalize="none"
              autoComplete="password"
              returnKeyType="done"
              onSubmitEditing={submit}
              editable={!loading}
            />
            <Pressable onPress={() => setShow(!show)} hitSlop={12} accessibilityLabel={show ? 'Hide password' : 'Show password'}>
              {show ? <EyeOff size={18} color={color.inkFaint} /> : <Eye size={18} color={color.inkFaint} />}
            </Pressable>
          </View>
          {errors.password ? <FieldError text={errors.password} /> : null}

          <Link href="/(auth)/forgot-password" asChild>
            <Pressable style={{ alignSelf: 'flex-end', paddingVertical: 10, marginBottom: 14 }}>
              <Text variant="bodyStrong" tone="navy" style={{ fontSize: 13 }}>
                Forgot password?
              </Text>
            </Pressable>
          </Link>

          <Pressable onPress={submit} disabled={loading} style={({ pressed }) => [{ opacity: pressed ? 0.9 : 1, transform: [{ scale: pressed ? 0.985 : 1 }] }]}>
            <LinearGradient colors={[brand.navy800, brand.navy700]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={[s.cta, loading && { opacity: 0.75 }]}>
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Text variant="h3" tone="onInk">
                    Sign in
                  </Text>
                  <ArrowRight size={18} color="#fff" style={{ marginLeft: 8 }} />
                </>
              )}
            </LinearGradient>
          </Pressable>

          {isAvailable && isEnabled && (
            <Pressable onPress={() => void authenticate()} disabled={loading} style={s.bio}>
              <Bio size={20} color={brand.navy700} />
              <Text variant="bodyStrong" tone="ink" style={{ marginLeft: 10 }}>
                {getBiometricLabel(biometricType)}
              </Text>
            </Pressable>
          )}

          <Text variant="caption" tone="inkFaint" align="center" style={{ marginTop: 30 }}>
            Trouble signing in?{' '}
            <Text variant="caption" tone="navy" style={{ fontFamily: 'DMSans_700Bold' }}>
              Ask your campus admin.
            </Text>
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function FieldError({ text }: { text: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 7, marginBottom: 12 }}>
      <CircleAlert size={13} color={brand.danger} />
      <Text variant="caption" style={{ color: brand.danger, marginLeft: 6 }}>
        {text}
      </Text>
    </View>
  );
}

const s = StyleSheet.create({
  hero: { paddingTop: 64, paddingHorizontal: 24, paddingBottom: 64, overflow: 'hidden' },
  ring: { position: 'absolute', borderRadius: 999, borderWidth: 1, borderColor: 'rgba(255,255,255,0.10)' },
  glow: {
    position: 'absolute',
    width: 260,
    height: 260,
    borderRadius: 999,
    right: -80,
    top: -70,
    backgroundColor: 'rgba(10,197,255,0.18)',
  },
  portal: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.10)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.16)',
  },
  portalDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: brand.cyan400, marginRight: 8 },
  card: {
    flex: 1,
    marginTop: -32,
    backgroundColor: color.card,
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    paddingHorizontal: 24,
    paddingTop: 30,
    paddingBottom: 40,
    ...elevation.lifted,
  },
  label: { marginBottom: 8 },
  input: {
    height: 54,
    borderRadius: 16,
    borderWidth: 1.5,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
  },
  text: { flex: 1, marginLeft: 12, fontFamily: 'DMSans_500Medium', fontSize: 15.5, color: brand.navy800 },
  cta: { height: 56, borderRadius: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', ...elevation.soft },
  bio: {
    marginTop: 14,
    height: 52,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: color.ruleStrong,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
