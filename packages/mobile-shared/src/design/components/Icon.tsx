import { color } from '../tokens';

/**
 * Icons are lucide-react-native — the set the web uses — imported by name,
 * e.g. `import { CalendarClock } from 'lucide-react-native'`. Spread these
 * defaults so they match the web's 1.75 stroke: <CalendarClock {...ICON} />.
 */
export const ICON = { size: 20, strokeWidth: 1.75, color: color.ink } as const;
