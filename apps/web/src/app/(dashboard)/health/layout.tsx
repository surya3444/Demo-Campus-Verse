import { ModuleBar } from '@/components/connect/kit';

export default function HealthConnectLayout({ children }: { children: React.ReactNode }) {
  return (
    <div>
      <ModuleBar moduleId="health" accent="health" />
      {children}
    </div>
  );
}
