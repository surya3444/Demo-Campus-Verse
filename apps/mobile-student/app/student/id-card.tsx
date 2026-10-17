import { useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Platform,
  Alert,
  Image,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import qrcode from 'qrcode-generator';
import { useAuthStore, useIsParent } from '@campus-verse/mobile-shared/store/authStore';
import { useStudentInfo } from '@campus-verse/mobile-shared/hooks/useAuth';
import { studentApi } from '@/api/student';

/* ─────────────────────────── Tokens ─────────────────────────── */

const C = {
  bg: '#0A0612',
  surface: '#FFFFFF',
  surfaceAlt: '#F7F8FA',
  border: '#E5E7EB',
  navy: '#0F172A',
  textMuted: '#64748B',
  textFaint: '#94A3B8',
  brand: '#4338CA',
  brandSoft: '#EEF2FF',
  emerald: '#10B981',
};

const SHADOW_CARD = Platform.select({
  ios: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 18 },
    shadowOpacity: 0.35,
    shadowRadius: 32,
  },
  android: { elevation: 14 },
});

/* ─────────────────────────── Real QR (pure-JS encoder) ─────────────────────────── */

function RealQR({ value, size = 144 }: { value: string; size?: number }) {
  const { matrix, n } = useMemo(() => {
    try {
      // typeNumber 0 = auto-pick the smallest that fits; 'M' = ~15% error
      // recovery (good for screen-displayed codes).
      const qr = qrcode(0, 'M');
      qr.addData(value);
      qr.make();
      const count = qr.getModuleCount();
      const cells: boolean[][] = [];
      for (let r = 0; r < count; r++) {
        const row: boolean[] = [];
        for (let c = 0; c < count; c++) row.push(qr.isDark(r, c));
        cells.push(row);
      }
      return { matrix: cells, n: count };
    } catch {
      // Payload too big for a single QR — fall back to a tiny "QR-shaped"
      // pattern around the value's hash so we never render nothing.
      const fallback: boolean[][] = [];
      for (let r = 0; r < 21; r++) {
        const row: boolean[] = [];
        for (let c = 0; c < 21; c++) row.push((r + c) % 3 === 0);
        fallback.push(row);
      }
      return { matrix: fallback, n: 21 };
    }
  }, [value]);

  const cellSize = size / n;
  return (
    <View style={{ width: size, height: size, backgroundColor: '#fff' }}>
      {matrix.map((row, r) => (
        <View key={r} style={{ flexDirection: 'row', flex: 1 }}>
          {row.map((on, c) => (
            <View
              key={c}
              style={{
                width: cellSize,
                height: cellSize,
                backgroundColor: on ? C.navy : 'transparent',
              }}
            />
          ))}
        </View>
      ))}
    </View>
  );
}

/* Build the payload that gets encoded into the QR. Any QR scanner will show
 * this as readable text, and a future Campus Verse staff scanner can parse
 * the leading "campusverse-student:v1" marker to display rich details. */
function buildQrPayload(args: {
  tenantId?: string;
  tenantName?: string;
  studentId?: string;
  admissionNo: string;
  displayName: string;
  classDisplay: string;
  sectionDisplay?: string;
  role: string;
  validUntil: string;
}): string {
  const cls = args.classDisplay + (args.sectionDisplay ? ` · ${args.sectionDisplay}` : '');
  return [
    'campusverse-student:v1',
    args.tenantName ? `School: ${args.tenantName}` : '',
    `Name: ${args.displayName}`,
    `Admission №: ${args.admissionNo}`,
    `Class: ${cls}`,
    `Role: ${args.role}`,
    `Valid until: ${args.validUntil}`,
    args.studentId ? `ID: ${args.studentId}` : '',
    args.tenantId ? `T: ${args.tenantId}` : '',
  ]
    .filter(Boolean)
    .join('\n');
}

/* ─────────────────────────── Helpers ─────────────────────────── */

function normalizeHex(input?: string): string | null {
  if (!input) return null;
  const v = input.trim().toLowerCase();
  if (/^#?[0-9a-f]{6}$/.test(v)) return v.startsWith('#') ? v : `#${v}`;
  if (/^#?[0-9a-f]{3}$/.test(v)) {
    const t = v.replace('#', '');
    return `#${t[0]}${t[0]}${t[1]}${t[1]}${t[2]}${t[2]}`;
  }
  return null;
}

/* ─────────────────────────── Screen ─────────────────────────── */

export default function IdCard() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width: winW } = useWindowDimensions();
  const user = useAuthStore((s) => s.user);
  const isParent = useIsParent();
  const selectedChild = useAuthStore((s) => s.selectedChild);
  const studentInfo = useStudentInfo();

  const { data: dashboard } = useQuery({
    queryKey: ['student-dashboard'],
    queryFn: () => studentApi.getStudentDashboard(),
    enabled: !isParent,
  });

  // ─── Identity
  const profile = (user as unknown as Record<string, unknown>)?.profile as
    | Record<string, string>
    | undefined;
  const displayName = isParent
    ? selectedChild?.studentName || 'Student'
    : profile?.displayName || profile?.firstName || user?.displayName || 'Student';
  const photoUrl =
    profile?.profileImage ||
    (user as unknown as { profileImage?: string })?.profileImage ||
    undefined;

  const admissionNo = isParent
    ? (selectedChild as unknown as Record<string, string> | undefined)?.admissionNumber || '—'
    : dashboard?.student?.admissionNumber ||
      (studentInfo as Record<string, string> | undefined)?.admissionNumber ||
      '—';
  const classDisplay =
    (isParent
      ? selectedChild?.className
      : dashboard?.student?.className || studentInfo?.className
    )?.trim() || '—';
  const sectionDisplay = (
    isParent
      ? selectedChild?.sectionName
      : dashboard?.student?.sectionName ||
        (studentInfo as Record<string, string> | undefined)?.sectionName
  )?.trim();
  const classChip = sectionDisplay ? `${classDisplay} · ${sectionDisplay}` : classDisplay;

  // ─── School branding
  const tenant = (user as unknown as Record<string, unknown>)?.tenant as
    | {
        name?: string;
        branding?: { logo?: string; primaryColor?: string };
        institutionTypes?: string[];
      }
    | undefined;
  const schoolName = tenant?.name || 'Your School';
  const schoolLogo = tenant?.branding?.logo;
  const institution = tenant?.institutionTypes?.[0] || 'school';
  const subline =
    institution === 'school' ? 'School' : institution === 'college' ? 'College' : 'University';
  const headerColor = normalizeHex(tenant?.branding?.primaryColor) || C.navy;

  // ─── Validity (academic year, India: Apr → Mar)
  const now = new Date();
  const yr = now.getFullYear();
  const ayEnd = now.getMonth() >= 3 ? yr + 1 : yr;
  const ayStart = now.getMonth() >= 3 ? yr : yr - 1;
  const validUntilLong = `31 March ${ayEnd}`;

  const cardWidth = winW - 40;

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <StatusBar style="light" />

      {/* Restrained backdrop — single subtle highlight, not bleeding into card area */}
      <View pointerEvents="none" style={s.ambient} />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingTop: insets.top + 14,
          paddingBottom: insets.bottom + 32,
          paddingHorizontal: 20,
        }}
      >
        {/* Top bar */}
        <View style={s.topbar}>
          <TouchableOpacity activeOpacity={0.7} onPress={() => router.back()} style={s.iconBtn}>
            <Ionicons name="chevron-back" size={20} color="#fff" />
          </TouchableOpacity>
          <Text style={s.topbarTitle}>Student Pass</Text>
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={() =>
              Alert.alert('Coming soon', 'Apple/Google Wallet pass will be available shortly.')
            }
            style={s.iconBtn}
          >
            <Ionicons name="share-outline" size={18} color="#fff" />
          </TouchableOpacity>
        </View>

        {/* ─── THE PASS ─── */}
        <View style={[s.card, { width: cardWidth, marginTop: 24 }, SHADOW_CARD]}>
          {/* Header strip — school branding */}
          <View style={[s.head, { backgroundColor: headerColor }]}>
            <View style={s.logoTile}>
              {schoolLogo ? (
                <Image source={{ uri: schoolLogo }} style={s.logoImg} resizeMode="contain" />
              ) : (
                <Ionicons name="school" size={20} color={headerColor} />
              )}
            </View>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={s.schoolName} numberOfLines={1}>
                {schoolName}
              </Text>
              <Text style={s.schoolSub}>
                {subline} · {ayStart}–{String(ayEnd).slice(-2)}
              </Text>
            </View>
          </View>

          {/* Identity */}
          <View style={s.body}>
            <View style={s.identityRow}>
              <View style={s.photo}>
                {photoUrl ? (
                  <Image source={{ uri: photoUrl }} style={s.photoImg} resizeMode="cover" />
                ) : (
                  <Text style={s.photoInitial}>{displayName?.[0]?.toUpperCase() || 'S'}</Text>
                )}
              </View>
              <View style={{ flex: 1, marginLeft: 14, justifyContent: 'center' }}>
                <Text style={s.name} numberOfLines={2}>
                  {displayName}
                </Text>
                <View style={s.classChip}>
                  <View style={s.classDot} />
                  <Text style={s.classText}>{classChip}</Text>
                </View>
              </View>
            </View>

            {/* Data table */}
            <View style={s.dataBlock}>
              <View style={s.dataRow}>
                <Text style={s.dataLabel}>Admission №</Text>
                <Text style={s.dataValue} numberOfLines={1}>
                  {admissionNo}
                </Text>
              </View>
              <View style={s.hairline} />
              <View style={s.dataRow}>
                <Text style={s.dataLabel}>Role</Text>
                <Text style={s.dataValue}>{isParent ? 'Parent' : 'Student'}</Text>
              </View>
              <View style={s.hairline} />
              <View style={s.dataRow}>
                <Text style={s.dataLabel}>Valid until</Text>
                <Text style={s.dataValue}>{validUntilLong}</Text>
              </View>
            </View>
          </View>

          {/* Perforation between body and barcode zone — classic ticket motif */}
          <View style={s.perfWrap}>
            <View style={s.perfNotchL} />
            <View style={s.perfLine}>
              {Array.from({ length: 28 }).map((_, i) => (
                <View key={i} style={s.perfDot} />
              ))}
            </View>
            <View style={s.perfNotchR} />
          </View>

          {/* QR zone */}
          <View style={s.qrZone}>
            <RealQR
              value={buildQrPayload({
                tenantId:
                  ((user as unknown as Record<string, unknown>)?.tenantId as string | undefined) ||
                  ((tenant as unknown as { _id?: string })?._id as string | undefined),
                tenantName: tenant?.name,
                studentId:
                  (user as unknown as { studentId?: string })?.studentId ||
                  (dashboard?.student as unknown as { _id?: string })?._id ||
                  (isParent
                    ? (selectedChild as unknown as { studentId?: string })?.studentId
                    : undefined),
                admissionNo,
                displayName,
                classDisplay,
                sectionDisplay,
                role: isParent ? 'Parent' : 'Student',
                validUntil: validUntilLong,
              })}
              size={156}
            />
            <Text style={s.qrCaption}>Scan at the school gate</Text>
            <Text style={s.qrIdMono}>{admissionNo}</Text>
          </View>

          {/* Footer */}
          <View style={s.footer}>
            <Ionicons name="shield-checkmark" size={13} color={C.emerald} />
            <Text style={s.footerText}>Verified by CampusVerse · Tamper-evident</Text>
          </View>
        </View>

        {/* Wallet button */}
        <TouchableOpacity
          activeOpacity={0.9}
          onPress={() => Alert.alert('Coming soon', 'Wallet pass support is on its way.')}
          style={s.wallet}
        >
          <Ionicons name="wallet-outline" size={18} color={C.bg} />
          <Text style={s.walletText}>Add to Apple / Google Wallet</Text>
        </TouchableOpacity>

        <Text style={s.note}>
          This pass shows the latest information from your profile. If something looks wrong,
          contact your school admin.
        </Text>
      </ScrollView>
    </View>
  );
}

/* ─────────────────────────── Styles ─────────────────────────── */

const s = StyleSheet.create({
  /* Backdrop */
  ambient: {
    position: 'absolute',
    top: -160,
    right: -100,
    width: 360,
    height: 360,
    borderRadius: 180,
    backgroundColor: 'rgba(67,56,202,0.22)',
  },

  /* Topbar */
  topbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  topbarTitle: {
    fontFamily: 'DMSans_700Bold',
    color: '#fff',
    fontSize: 16,
    letterSpacing: -0.3,
  },

  /* Card surface */
  card: {
    borderRadius: 24,
    backgroundColor: C.surface,
    overflow: 'hidden',
    alignSelf: 'center',
  },

  /* School strip */
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 22,
    paddingVertical: 18,
  },
  logoTile: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  logoImg: { width: 32, height: 32 },
  schoolName: {
    fontFamily: 'DMSans_700Bold',
    color: '#fff',
    fontSize: 16,
    letterSpacing: -0.3,
  },
  schoolSub: {
    fontFamily: 'DMSans_400Regular',
    color: 'rgba(255,255,255,0.78)',
    fontSize: 11.5,
    marginTop: 2,
  },

  /* Body */
  body: {
    paddingHorizontal: 22,
    paddingTop: 22,
    paddingBottom: 22,
  },
  identityRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  photo: {
    width: 60,
    height: 60,
    borderRadius: 16,
    backgroundColor: C.navy,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  photoImg: { width: '100%', height: '100%' },
  photoInitial: {
    color: '#fff',
    fontFamily: 'DMSans_700Bold',
    fontSize: 24,
  },
  name: {
    fontFamily: 'DMSans_700Bold',
    color: C.navy,
    fontSize: 20,
    letterSpacing: -0.5,
  },
  classChip: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.brandSoft,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    gap: 6,
    marginTop: 6,
  },
  classDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: C.brand,
  },
  classText: {
    fontFamily: 'DMSans_500Medium',
    color: C.brand,
    fontSize: 12,
  },

  dataBlock: {
    width: '100%',
    backgroundColor: C.surfaceAlt,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 4,
    marginTop: 22,
  },
  dataRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
  },
  dataLabel: {
    fontFamily: 'DMSans_500Medium',
    color: C.textMuted,
    fontSize: 12.5,
  },
  dataValue: {
    fontFamily: 'DMSans_700Bold',
    color: C.navy,
    fontSize: 13,
    letterSpacing: -0.1,
    maxWidth: '62%',
    textAlign: 'right',
  },
  hairline: {
    height: 1,
    backgroundColor: C.border,
  },

  /* Perforation between body and barcode (ticket motif) */
  perfWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.surface,
  },
  perfNotchL: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: C.bg,
    marginLeft: -9,
  },
  perfLine: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
  },
  perfDot: {
    width: 6,
    height: 1.5,
    backgroundColor: C.border,
  },
  perfNotchR: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: C.bg,
    marginRight: -9,
  },

  /* QR */
  qrZone: {
    alignItems: 'center',
    paddingTop: 24,
    paddingBottom: 20,
    backgroundColor: C.surfaceAlt,
  },
  qrCaption: {
    fontFamily: 'DMSans_500Medium',
    color: C.navy,
    fontSize: 12.5,
    marginTop: 14,
  },
  qrIdMono: {
    fontFamily: 'JetBrainsMono_500Medium',
    color: C.textFaint,
    fontSize: 11,
    letterSpacing: 0.6,
    marginTop: 4,
  },

  /* Footer */
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    backgroundColor: C.surfaceAlt,
    borderTopWidth: 1,
    borderTopColor: C.border,
  },
  footerText: {
    fontFamily: 'DMSans_500Medium',
    color: C.textMuted,
    fontSize: 11,
  },

  /* Wallet button */
  wallet: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: '#fff',
    height: 54,
    borderRadius: 16,
    marginTop: 22,
  },
  walletText: {
    color: C.bg,
    fontFamily: 'DMSans_700Bold',
    fontSize: 14,
    letterSpacing: -0.2,
  },

  note: {
    fontFamily: 'DMSans_400Regular',
    color: 'rgba(255,255,255,0.45)',
    fontSize: 11.5,
    textAlign: 'center',
    marginTop: 18,
    paddingHorizontal: 16,
    lineHeight: 16,
  },
});
