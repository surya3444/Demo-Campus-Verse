'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useOnboarding } from '@/contexts/OnboardingContext';
import { toast } from 'sonner';
import { useAuthStore } from '@/store/authStore';
import { useBranchStore } from '@/store/branchStore';
import { organizationApi, authApi } from '@/lib/api';
import { ONBOARDING_STEPS } from './steps/constants';
import { WelcomeStep } from './steps/WelcomeStep';
import { BranchStep, generateBranchCode } from './steps/BranchStep';
import { AcademicSessionStep } from './steps/AcademicSessionStep';
import { AcademicStructureStep } from './steps/AcademicStructureStep';
import { InviteTeamStep } from './steps/InviteTeamStep';
import { ModulesStep } from './steps/ModulesStep';
import { SettingsStep } from './steps/SettingsStep';
import { CompleteStep } from './steps/CompleteStep';
import type { ClassItem, InvitedUser } from './steps/types';

// --- Persisted onboarding data helpers ---
const ONBOARDING_DATA_KEY = 'cv_onboarding_data';

interface PersistedOnboardingData {
  academicBatchId?: string | null;
  academicBatchName?: string | null;
  institutionType?: string;
  branchName?: string;
  classCount?: number;
  invitedCount?: number;
}

function loadPersistedData(): PersistedOnboardingData {
  try {
    const stored = localStorage.getItem(ONBOARDING_DATA_KEY);
    return stored ? JSON.parse(stored) : {};
  } catch {
    return {};
  }
}

function persistData(updates: Partial<PersistedOnboardingData>) {
  try {
    const current = loadPersistedData();
    localStorage.setItem(ONBOARDING_DATA_KEY, JSON.stringify({ ...current, ...updates }));
  } catch {
    /* persist failure is non-critical */
  }
}

export default function OnboardingPage() {
  const router = useRouter();
  const { user, updateUser } = useAuthStore();
  const { initializeBranchSelection } = useBranchStore();
  const { currentStep, setCurrentStep, resetOnboarding } = useOnboarding();
  const [saving, setSaving] = useState(false);
  const submittingRef = useRef(false);

  // The tenant declared its type at signup — pre-select it so a university
  // owner isn't silently defaulted to a school branch. Still overridable in
  // the branch step (a university group may well run a school branch).
  const tenantInstitutionType = (user?.tenant?.institutionTypes?.[0] || 'school') as
    | 'school'
    | 'college'
    | 'university';

  // Branch form state
  const [branchData, setBranchData] = useState({
    name: '',
    code: '',
    institutionType: tenantInstitutionType,
    city: '',
    state: '',
    country: 'India',
    pincode: '',
    phone: '',
    email: '',
  });

  // Academic state
  const [institutionType, setInstitutionType] = useState<string>(tenantInstitutionType);
  const [academicBatchId, setAcademicBatchId] = useState<string | null>(null);
  const [academicBatchName, setAcademicBatchName] = useState<string | null>(null);
  const [createdClasses, setCreatedClasses] = useState<ClassItem[]>([]);

  // Module selection state
  const [selectedModules, setSelectedModules] = useState<string[]>(
    user?.tenant?.subscription?.features || ['core', 'students', 'attendance', 'teaching']
  );

  // Invited team state
  const [invitedUsers, setInvitedUsers] = useState<InvitedUser[]>([]);

  // Settings state
  const [settings, setSettings] = useState({
    timezone: 'Asia/Kolkata',
    dateFormat: 'DD/MM/YYYY',
    currency: 'INR',
    fiscalYearStart: '04-01',
  });

  // Fix #2: Guard — redirect away if onboarding already completed
  useEffect(() => {
    if (user?.tenant?.onboardingCompleted === true) {
      resetOnboarding();
      router.replace('/dashboard');
    }
  }, [user?.tenant?.onboardingCompleted, router, resetOnboarding]);

  // Fix #1: Restore persisted data on mount (survives refresh)
  useEffect(() => {
    const data = loadPersistedData();
    if (data.academicBatchId) setAcademicBatchId(data.academicBatchId);
    if (data.academicBatchName) setAcademicBatchName(data.academicBatchName);
    if (data.institutionType) setInstitutionType(data.institutionType);
    if (data.branchName) setBranchData((prev) => ({ ...prev, name: data.branchName! }));
  }, []);

  // Fix #3: If at academic-structure step but missing academicBatchId, go back
  useEffect(() => {
    if (ONBOARDING_STEPS[currentStep]?.id === 'academic-structure' && !academicBatchId) {
      setCurrentStep(currentStep - 1);
    }
  }, [currentStep, academicBatchId, setCurrentStep]);

  const step = ONBOARDING_STEPS[currentStep];

  // Don't render wizard if already onboarded (guard effect will redirect)
  if (user?.tenant?.onboardingCompleted === true) {
    return null;
  }

  const goNext = () => {
    if (currentStep < ONBOARDING_STEPS.length - 1) {
      setCurrentStep(currentStep + 1);
    }
  };

  const goBack = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleCreateBranch = async () => {
    if (!branchData.name || !branchData.city || !branchData.state) {
      toast.error('Please fill in all required fields');
      return;
    }
    // The API's createBranchSchema requires a 6-digit pincode — catch it here
    // instead of letting the request 400 with a generic validation error.
    if (!/^\d{6}$/.test(branchData.pincode)) {
      toast.error('Please enter a valid 6-digit pincode');
      return;
    }

    if (submittingRef.current) return;
    submittingRef.current = true;
    setSaving(true);
    try {
      const code = branchData.code || generateBranchCode(branchData.name);
      const response = await organizationApi.createBranch({
        name: branchData.name,
        code,
        institutionType: branchData.institutionType,
        location: {
          city: branchData.city,
          state: branchData.state,
          country: branchData.country,
          pincode: branchData.pincode,
        },
        contact:
          branchData.phone || branchData.email
            ? {
                phone: branchData.phone || undefined,
                email: branchData.email || undefined,
              }
            : undefined,
      });
      if (response.success) {
        const newBranch = response.data;
        if (newBranch?._id) {
          initializeBranchSelection(
            [
              {
                _id: newBranch._id,
                name: newBranch.name,
                code: newBranch.code,
                institutionType: newBranch.institutionType,
              },
            ],
            'global'
          );
          const instType = newBranch.institutionType || 'school';
          setInstitutionType(instType);
          persistData({ branchName: newBranch.name, institutionType: instType });
        }
        toast.success('Branch created successfully!');
        goNext();
      }
    } catch (error: unknown) {
      const err = error as { response?: { data?: { error?: { message?: string } } } };
      toast.error(err.response?.data?.error?.message || 'Failed to create branch');
    } finally {
      setSaving(false);
      submittingRef.current = false;
    }
  };

  const handleAcademicSessionSave = (batchId: string, batchName: string) => {
    setAcademicBatchId(batchId);
    setAcademicBatchName(batchName);
    persistData({ academicBatchId: batchId, academicBatchName: batchName });
    goNext();
  };

  const handleAcademicStructureSave = (classes: ClassItem[]) => {
    setCreatedClasses(classes);
    persistData({ classCount: classes.length });
    goNext();
  };

  const handleInviteTeamSave = (users: InvitedUser[]) => {
    setInvitedUsers(users);
    persistData({ invitedCount: users.length });
    goNext();
  };

  const handleSaveModules = async () => {
    if (submittingRef.current) return;
    submittingRef.current = true;
    setSaving(true);
    try {
      const response = await organizationApi.updateModules(selectedModules);
      if (response.success) {
        toast.success('Modules updated!');
        goNext();
      }
    } catch {
      toast.error('Failed to save modules');
    } finally {
      setSaving(false);
      submittingRef.current = false;
    }
  };

  const handleSaveSettings = async () => {
    if (submittingRef.current) return;
    submittingRef.current = true;
    setSaving(true);
    try {
      const response = await organizationApi.updateSettings(settings);
      if (response.success) {
        toast.success('Settings saved!');
        goNext();
      }
    } catch {
      toast.error('Failed to save settings');
    } finally {
      setSaving(false);
      submittingRef.current = false;
    }
  };

  // Fix #3: Ensure auth store is updated before navigating to dashboard
  const handleComplete = async () => {
    if (submittingRef.current) return;
    submittingRef.current = true;
    setSaving(true);
    try {
      const response = await organizationApi.completeOnboarding();
      if (response.success) {
        // Refresh profile to get updated onboardingCompleted flag
        let profileUpdated = false;
        try {
          const profileRes = await authApi.getProfile();
          if (profileRes.success) {
            updateUser(profileRes.data);
            profileUpdated = true;
          }
        } catch {
          // getProfile failed — fall through to manual update
        }

        // Fallback: manually set the flag so ProtectedRoute won't redirect back
        if (!profileUpdated && user?.tenant) {
          updateUser({ tenant: { ...user.tenant, onboardingCompleted: true } });
        }

        // Clean up persisted onboarding state
        resetOnboarding();
        router.push('/dashboard');
      }
    } catch (error: unknown) {
      const err = error as { response?: { data?: { error?: { message?: string } } } };
      toast.error(err.response?.data?.error?.message || 'Failed to complete onboarding');
    } finally {
      setSaving(false);
      submittingRef.current = false;
    }
  };

  const toggleModule = (code: string) => {
    setSelectedModules((prev) =>
      prev.includes(code) ? prev.filter((m) => m !== code) : [...prev, code]
    );
  };

  // Persisted data for CompleteStep summary (survives refresh)
  const persisted = loadPersistedData();

  return (
    <div className="space-y-8">
      {step.id === 'welcome' && <WelcomeStep goNext={goNext} />}

      {step.id === 'branch' && (
        <BranchStep
          branchData={branchData}
          setBranchData={setBranchData}
          saving={saving}
          onSave={handleCreateBranch}
          goBack={goBack}
        />
      )}

      {step.id === 'academic-session' && (
        <AcademicSessionStep
          fiscalYearStart={settings.fiscalYearStart}
          saving={saving}
          setSaving={setSaving}
          onSave={handleAcademicSessionSave}
          goBack={goBack}
        />
      )}

      {step.id === 'academic-structure' && academicBatchId && (
        <AcademicStructureStep
          institutionType={institutionType}
          branchId={useBranchStore.getState().selectedBranchId ?? undefined}
          academicBatchId={academicBatchId}
          saving={saving}
          setSaving={setSaving}
          onSave={handleAcademicStructureSave}
          goBack={goBack}
        />
      )}

      {step.id === 'invite-team' && (
        <InviteTeamStep
          saving={saving}
          setSaving={setSaving}
          branchId={useBranchStore.getState().selectedBranchId}
          branchName={useBranchStore.getState().getSelectedBranch()?.name || branchData.name}
          onSave={handleInviteTeamSave}
          onSkip={goNext}
          goBack={goBack}
        />
      )}

      {step.id === 'modules' && (
        <ModulesStep
          selectedModules={selectedModules}
          onToggleModule={toggleModule}
          subscriptionFeatures={user?.tenant?.subscription?.features || []}
          saving={saving}
          onSave={handleSaveModules}
          onSkip={goNext}
          goBack={goBack}
        />
      )}

      {step.id === 'settings' && (
        <SettingsStep
          settings={settings}
          setSettings={setSettings}
          saving={saving}
          onSave={handleSaveSettings}
          onSkip={goNext}
          goBack={goBack}
        />
      )}

      {step.id === 'complete' && (
        <CompleteStep
          branchName={branchData.name || persisted.branchName || ''}
          academicBatchName={academicBatchName || persisted.academicBatchName || null}
          classCount={createdClasses.length || persisted.classCount || 0}
          invitedCount={invitedUsers.length || persisted.invitedCount || 0}
          moduleCount={selectedModules.length}
          saving={saving}
          onComplete={handleComplete}
        />
      )}
    </div>
  );
}
