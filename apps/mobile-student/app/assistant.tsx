import { AssistantScreen } from '@campus-verse/mobile-shared/design';

/** Web paths in assistant replies that have a screen in this app. */
const ROUTES: Array<[RegExp, string]> = [
  [/timetable/, '/(tabs)/timetable'],
  [/^\/student\/fees|^\/finance/, '/(tabs)/pay'],
  [/^\/student\/attendance|^\/attendance/, '/(tabs)/attendance'],
  [/^\/student\/grades|^\/exams/, '/(tabs)/grades'],
  [/^\/student\/assignments|^\/teaching\/assignments/, '/(tabs)/assignments'],
  [/^\/clubs/, '/student/clubs'],
  [/^\/career-connect/, '/student/career'],
  [/^\/health/, '/(tabs)/health'],
  [/^\/hostel/, '/(tabs)/hostel'],
];

export default function Assistant() {
  return (
    <AssistantScreen
      suggestions={[
        'What classes do I have today?',
        'How much fee is pending and when is it due?',
        'What is my attendance this month?',
        'Which clubs can I join?',
      ]}
      routeFor={(href) => ROUTES.find(([rx]) => rx.test(href))?.[1] ?? null}
    />
  );
}
