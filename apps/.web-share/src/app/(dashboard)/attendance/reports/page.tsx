import { redirect } from 'next/navigation';

export default function AttendanceReportsRedirect() {
  redirect('/attendance/view');
}
