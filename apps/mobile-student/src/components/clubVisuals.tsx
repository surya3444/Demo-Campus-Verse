import { View } from 'react-native';
import Svg, { Defs, LinearGradient as SvgGradient, Path, Stop } from 'react-native-svg';
import {
  BookOpenText,
  Bot,
  Brain,
  Briefcase,
  Camera,
  Clapperboard,
  CodeXml,
  Cpu,
  Crown,
  Disc3,
  Drama,
  Feather,
  Flag,
  Flower2,
  Footprints,
  Globe,
  Guitar,
  HeartHandshake,
  Landmark,
  Lightbulb,
  LockKeyhole,
  Medal,
  MicVocal,
  Palette,
  PersonStanding,
  Ribbon,
  Rocket,
  Scissors,
  ScrollText,
  ShieldCheck,
  Sprout,
  TrendingUp,
  Trophy,
  Volleyball,
  Wrench,
  Zap,
  type LucideIcon,
} from 'lucide-react-native';

/** The web's club themes and crest icons (apps/web/src/components/clubs/clubVisuals.tsx). */
export const CLUB_THEMES: Record<string, { c1: string; c2: string }> = {
  ocean: { c1: '#1d4ed8', c2: '#0abfff' },
  aurora: { c1: '#0891b2', c2: '#a78bfa' },
  forest: { c1: '#047857', c2: '#34d399' },
  berry: { c1: '#6d28d9', c2: '#e879f9' },
  sunset: { c1: '#be123c', c2: '#fb923c' },
  ember: { c1: '#b91c1c', c2: '#f59e0b' },
  midnight: { c1: '#05286e', c2: '#3b82f6' },
  gold: { c1: '#a16207', c2: '#fde047' },
};
export const themeOf = (t?: string) => CLUB_THEMES[t ?? ''] ?? CLUB_THEMES.ocean;

const ICONS: Record<string, LucideIcon> = {
  circuit: Cpu,
  bot: Bot,
  bulb: Lightbulb,
  rocket: Rocket,
  code: CodeXml,
  shield: ShieldCheck,
  lock: LockKeyhole,
  zap: Zap,
  wrench: Wrench,
  handshake: HeartHandshake,
  medal: Medal,
  flag: Flag,
  sprout: Sprout,
  ribbon: Ribbon,
  flower: Flower2,
  landmark: Landmark,
  palette: Palette,
  drama: Drama,
  guitar: Guitar,
  disc: Disc3,
  dancer: PersonStanding,
  mic: MicVocal,
  camera: Camera,
  film: Clapperboard,
  feather: Feather,
  scroll: ScrollText,
  book: BookOpenText,
  brain: Brain,
  globe: Globe,
  trophy: Trophy,
  volleyball: Volleyball,
  footprints: Footprints,
  crown: Crown,
  chart: TrendingUp,
  briefcase: Briefcase,
  scissors: Scissors,
};

export const CLUB_CATEGORY: Record<string, { label: string; icon: string }> = {
  technical: { label: 'Technical', icon: 'circuit' },
  cultural: { label: 'Cultural', icon: 'drama' },
  arts: { label: 'Arts & Design', icon: 'palette' },
  sports: { label: 'Sports', icon: 'trophy' },
  social: { label: 'Social Impact', icon: 'handshake' },
  professional: { label: 'Professional', icon: 'briefcase' },
  literary: { label: 'Literary', icon: 'feather' },
  wellness: { label: 'Eco & Wellness', icon: 'sprout' },
};

export const iconFor = (icon?: string, category?: string): LucideIcon =>
  ICONS[icon ?? ''] ?? ICONS[CLUB_CATEGORY[category ?? '']?.icon ?? ''] ?? Trophy;

const SHIELD = 'M50 3 L92 17 V58 C92 86 73 104 50 113 C27 104 8 86 8 58 V17 Z';

/** The club crest: a gradient shield with the club's icon — as on the web. */
export function ClubCrest({ theme, icon, category, size = 56 }: { theme?: string; icon?: string; category?: string; size?: number }) {
  const th = themeOf(theme);
  const Glyph = iconFor(icon, category);
  const id = `${theme ?? 'ocean'}${size}`;
  return (
    <View style={{ width: size, height: size * 1.16, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size * 1.16} viewBox="0 0 100 116" style={{ position: 'absolute' }}>
        <Defs>
          <SvgGradient id={`f${id}`} x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={th.c2} />
            <Stop offset="1" stopColor={th.c1} />
          </SvgGradient>
        </Defs>
        <Path d={SHIELD} fill={`url(#f${id})`} stroke="#ffffff" strokeOpacity={0.55} strokeWidth={3} />
      </Svg>
      <Glyph size={size * 0.42} color="#FFFFFF" strokeWidth={2} style={{ marginTop: -size * 0.06 }} />
    </View>
  );
}
