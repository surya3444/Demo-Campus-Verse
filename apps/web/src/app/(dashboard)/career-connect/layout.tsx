import { ModuleBar } from '@/components/connect/kit';

export default function CareerConnectLayout({ children }: { children: React.ReactNode }) {
  return (
    <div>
      <ModuleBar moduleId="careerConnect" accent="career" />
      {children}
    </div>
  );
}
