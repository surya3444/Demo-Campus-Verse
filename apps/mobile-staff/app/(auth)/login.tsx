import { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
  Alert,
  StyleSheet,
} from 'react-native';
import { Link } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '@campus-verse/mobile-shared/store/authStore';
import { useBiometrics, getBiometricLabel } from '@campus-verse/mobile-shared/hooks/useBiometrics';

/* ─────────────────────────── Tokens ─────────────────────────── */

const C = {
  navy: '#1e1b4b',
  navyDeep: '#0f0d2e',
  cyan: '#06b6d4',
  cyanSoft: 'rgba(6,182,212,0.15)',
  bg: '#f8fafc',
  card: '#ffffff',
  border: '#e2e8f0',
  borderSoft: '#f1f5f9',
  text: '#0f172a',
  textMuted: '#64748b',
  textFaint: '#94a3b8',
  rose: '#e11d48',
};
const MONO = 'SpaceMono';

const ROLE_EYEBROW = 'TEACHER PORTAL';
const HERO_ACCENT_WORD = 'intent.';

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

/* ─────────────────────────── Screen ─────────────────────────── */

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});
  const [emailFocused, setEmailFocused] = useState(false);
  const [passwordFocused, setPasswordFocused] = useState(false);

  const login = useAuthStore((state) => state.login);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const passwordRef = useRef<TextInput>(null);

  const {
    isAvailable: biometricAvailable,
    isEnabled: biometricEnabled,
    biometricType,
    authenticate: biometricAuth,
  } = useBiometrics();

  useEffect(() => {
    if (biometricEnabled && biometricAvailable && !isAuthenticated) {
      handleBiometricLogin();
    }
  }, [biometricEnabled, biometricAvailable]);

  const validateForm = (): boolean => {
    const newErrors: { email?: string; password?: string } = {};
    if (!email.trim()) {
      newErrors.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      newErrors.email = 'Invalid email format';
    }
    if (!password) {
      newErrors.password = 'Password is required';
    } else if (password.length < 6) {
      newErrors.password = 'Password must be at least 6 characters';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleLogin = async () => {
    if (!validateForm()) return;
    setIsLoading(true);
    try {
      await login({ email: email.trim(), password });
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : 'Invalid email or password. Please try again.';
      Alert.alert('Sign-in failed', message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleBiometricLogin = async () => {
    await biometricAuth();
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={{ flex: 1, backgroundColor: C.navy }}
    >
      {/* Force a light status bar against the navy hero — overrides the root
          layout's color-scheme-based default while this screen is mounted. */}
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

          {/* Eyebrow */}
          <Text style={$.eyebrow}>{ROLE_EYEBROW}</Text>

          {/* Wordmark with brand-cyan glyph tile */}
          <View style={$.brandRow}>
            <View style={$.brandTile}>
              <Ionicons name="school" size={26} color="#fff" />
              <View style={$.brandTileDot}>
                <View style={$.brandTileDotInner} />
              </View>
            </View>
            <View style={{ marginLeft: 14, flex: 1 }}>
              <Text style={$.brand}>CampusVerse</Text>
              <Text style={$.brandTag}>
                Teach with <Text style={$.brandTagAccent}>{HERO_ACCENT_WORD}</Text>
              </Text>
            </View>
          </View>
        </View>

        {/* ═════════════════════════ FORM CARD ═════════════════════════ */}
        <View style={$.card}>
          {/* Heading */}
          <Text style={$.welcome}>
            Welcome <Text style={$.welcomeAccent}>back.</Text>
          </Text>
          <Text style={$.subtitle}>Sign in to pick up where you left off.</Text>

          {/* Email */}
          <View style={{ marginBottom: 18 }}>
            <Text style={$.label}>EMAIL</Text>
            <View
              style={[
                $.inputWrap,
                {
                  backgroundColor: emailFocused ? '#fafafe' : C.bg,
                  borderColor: errors.email ? C.rose : emailFocused ? C.navy : C.border,
                },
              ]}
            >
              <Ionicons name="mail-outline" size={17} color={emailFocused ? C.navy : C.textFaint} />
              <TextInput
                style={$.input}
                placeholder="you@school.edu"
                placeholderTextColor={C.textFaint}
                value={email}
                onChangeText={(text) => {
                  setEmail(text);
                  if (errors.email) setErrors({ ...errors, email: undefined });
                }}
                onFocus={() => setEmailFocused(true)}
                onBlur={() => setEmailFocused(false)}
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
                returnKeyType="next"
                onSubmitEditing={() => passwordRef.current?.focus()}
                editable={!isLoading}
              />
            </View>
            {errors.email && <FieldError text={errors.email} />}
          </View>

          {/* Password */}
          <View style={{ marginBottom: 12 }}>
            <Text style={$.label}>PASSWORD</Text>
            <View
              style={[
                $.inputWrap,
                {
                  backgroundColor: passwordFocused ? '#fafafe' : C.bg,
                  borderColor: errors.password ? C.rose : passwordFocused ? C.navy : C.border,
                },
              ]}
            >
              <Ionicons
                name="lock-closed-outline"
                size={17}
                color={passwordFocused ? C.navy : C.textFaint}
              />
              <TextInput
                ref={passwordRef}
                style={$.input}
                placeholder="••••••••"
                placeholderTextColor={C.textFaint}
                value={password}
                onChangeText={(text) => {
                  setPassword(text);
                  if (errors.password) setErrors({ ...errors, password: undefined });
                }}
                onFocus={() => setPasswordFocused(true)}
                onBlur={() => setPasswordFocused(false)}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                autoComplete="password"
                returnKeyType="done"
                onSubmitEditing={handleLogin}
                editable={!isLoading}
              />
              <TouchableOpacity
                onPress={() => setShowPassword(!showPassword)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons
                  name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                  size={17}
                  color={C.textFaint}
                />
              </TouchableOpacity>
            </View>
            {errors.password && <FieldError text={errors.password} />}
          </View>

          {/* Forgot */}
          <Link href="/(auth)/forgot-password" asChild>
            <TouchableOpacity
              style={{ alignSelf: 'flex-end', marginBottom: 22, paddingVertical: 4 }}
            >
              <Text style={$.forgot}>Forgot password →</Text>
            </TouchableOpacity>
          </Link>

          {/* Sign In */}
          <TouchableOpacity onPress={handleLogin} disabled={isLoading} activeOpacity={0.85}>
            <View style={[$.cta, isLoading && { opacity: 0.7 }]}>
              {isLoading ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <>
                  <Text style={$.ctaText}>Sign in</Text>
                  <Ionicons name="arrow-forward" size={17} color="#fff" style={{ marginLeft: 8 }} />
                </>
              )}
            </View>
          </TouchableOpacity>

          {/* Biometric */}
          {biometricAvailable && biometricEnabled && (
            <View style={{ marginTop: 22 }}>
              <View style={$.divider}>
                <View style={$.dividerLine} />
                <Text style={$.dividerLabel}>OR CONTINUE WITH</Text>
                <View style={$.dividerLine} />
              </View>

              <TouchableOpacity
                onPress={handleBiometricLogin}
                disabled={isLoading}
                activeOpacity={0.7}
              >
                <View style={$.bioButton}>
                  <Ionicons
                    name={biometricType === 'facial' ? 'scan' : 'finger-print'}
                    size={20}
                    color={C.navy}
                  />
                  <Text style={$.bioButtonText}>{getBiometricLabel(biometricType)}</Text>
                </View>
              </TouchableOpacity>
            </View>
          )}

          {/* Footer */}
          <View style={{ marginTop: 32, alignItems: 'center' }}>
            <Text style={$.footerText}>
              Need help? <Text style={$.footerAccent}>Contact your school admin.</Text>
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
  /* Hero */
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
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: -0.6,
  },
  brandTag: {
    color: 'rgba(255,255,255,0.65)',
    fontSize: 13.5,
    marginTop: 2,
    fontWeight: '500',
  },
  brandTagAccent: { fontStyle: 'italic', fontWeight: '300', color: C.cyan },

  /* Card */
  card: {
    flex: 1,
    backgroundColor: C.card,
    borderTopLeftRadius: 36,
    borderTopRightRadius: 36,
    marginTop: -28,
    paddingHorizontal: 26,
    paddingTop: 36,
    paddingBottom: 26,
  },
  welcome: {
    fontSize: 26,
    fontWeight: '800',
    color: C.text,
    letterSpacing: -0.6,
  },
  welcomeAccent: { fontStyle: 'italic', fontWeight: '300', color: C.navy },
  subtitle: { fontSize: 13.5, color: C.textMuted, marginTop: 4, marginBottom: 30 },

  /* Inputs */
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

  forgot: { fontSize: 12.5, fontWeight: '700', color: C.navy, letterSpacing: 0.2 },

  /* CTA */
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

  /* Divider */
  divider: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  dividerLine: { flex: 1, height: 1, backgroundColor: C.border },
  dividerLabel: {
    fontFamily: MONO,
    color: C.textMuted,
    fontSize: 9.5,
    fontWeight: '700',
    letterSpacing: 1.6,
    marginHorizontal: 12,
  },

  /* Biometric */
  bioButton: {
    height: 52,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    backgroundColor: C.bg,
    borderWidth: 1.5,
    borderColor: C.border,
  },
  bioButtonText: {
    fontWeight: '700',
    fontSize: 15,
    marginLeft: 10,
    color: C.navy,
    letterSpacing: -0.2,
  },

  /* Footer */
  footerText: { color: C.textMuted, fontSize: 12, textAlign: 'center' },
  footerAccent: { fontWeight: '700', color: C.navy },
});
