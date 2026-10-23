import { AssistantScreen } from '@campus-verse/mobile-shared/design';

/** Web paths in assistant replies that have a screen in this app. */
const ROUTES: Array<[RegExp, string]> = [
  [/^\/(organization|teaching)\/timetable/, '/(tabs)/timetable'],
  [/^\/attendance/, '/(tabs)/attendance'],
  [/^\/teaching\/(gradebook|grades)/, '/teaching/gradebook'],
  [/^\/teaching\/assignments/, '/(tabs)/assignments'],
  [/^\/hr\/leaves/, '/hr/leaves'],
  [/^\/hr\/payslips|^\/hr\/payroll/, '/hr/payslips'],
  [/^\/finance\/fee-counter/, '/finance/counter'],
  [/^\/visitors/, '/visitors'],
  [/^\/communications\/announcements/, '/school/announcements'],
  [/^\/communications\/calendar/, '/school/calendar'],
];

export default function Assistant() {
  return (
    <AssistantScreen
      suggestions={[
        'What do I teach today, and where?',
        'Which of my classes had the lowest attendance this week?',
        'Show the timetable for my first class',
        'How many leave days do I have left?',
      ]}
      routeFor={(href) => ROUTES.find(([rx]) => rx.test(href))?.[1] ?? null}
    />
  );
}
