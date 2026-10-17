'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { LocationSelector } from '@/components/ui/location-selector';
import {
  Building2,
  ArrowRight,
  ArrowLeft,
  Loader2,
  School,
  GraduationCap,
  Library,
} from 'lucide-react';
import { cn } from '@/lib/utils';

export type InstitutionType = 'school' | 'college' | 'university';

interface BranchData {
  name: string;
  code: string;
  institutionType: InstitutionType;
  city: string;
  state: string;
  country: string;
  pincode: string;
  phone: string;
  email: string;
}

const INSTITUTION_OPTIONS: Array<{
  value: InstitutionType;
  label: string;
  description: string;
  icon: React.ReactNode;
}> = [
  {
    value: 'school',
    label: 'School',
    description: 'K-12 with grades and sections',
    icon: <School className="h-5 w-5" />,
  },
  {
    value: 'college',
    label: 'College',
    description: 'Streams, years and sections',
    icon: <GraduationCap className="h-5 w-5" />,
  },
  {
    value: 'university',
    label: 'University',
    description: 'Departments, years and sections',
    icon: <Library className="h-5 w-5" />,
  },
];

interface BranchStepProps {
  branchData: BranchData;
  setBranchData: (data: BranchData) => void;
  saving: boolean;
  onSave: () => void;
  goBack: () => void;
}

export function generateBranchCode(name: string) {
  return name
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9\s]/g, '')
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w.slice(0, 4))
    .join('-')
    .slice(0, 12);
}

export function BranchStep({ branchData, setBranchData, saving, onSave, goBack }: BranchStepProps) {
  return (
    <Card className="max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Building2 className="h-5 w-5 text-primary" />
          Create Your First Branch
        </CardTitle>
        <CardDescription>
          A branch represents a physical campus or location of your institution.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Institution type — premium tile selector */}
        <div className="space-y-3">
          <h3 className="font-medium text-sm text-muted-foreground uppercase tracking-wider">
            What kind of institution is this?
          </h3>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            {INSTITUTION_OPTIONS.map((opt) => {
              const isOn = branchData.institutionType === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setBranchData({ ...branchData, institutionType: opt.value })}
                  className={cn(
                    'group relative overflow-hidden rounded-xl border-2 p-4 text-left transition-all',
                    isOn
                      ? 'border-primary bg-primary/5 shadow-sm'
                      : 'border-input bg-background hover:border-primary/30'
                  )}
                >
                  {isOn && (
                    <span className="absolute right-3 top-3 h-2 w-2 rounded-full bg-primary" />
                  )}
                  <div
                    className={cn(
                      'mb-3 inline-flex h-10 w-10 items-center justify-center rounded-lg transition-colors',
                      isOn
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary'
                    )}
                  >
                    {opt.icon}
                  </div>
                  <p className="font-medium text-sm">{opt.label}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">{opt.description}</p>
                </button>
              );
            })}
          </div>
        </div>

        {/* Basic Info */}
        <div className="space-y-4">
          <h3 className="font-medium text-sm text-muted-foreground uppercase tracking-wider">
            Basic Information
          </h3>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="branch-name">
                Branch Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="branch-name"
                placeholder="e.g., Main Campus"
                value={branchData.name}
                onChange={(e) => setBranchData({ ...branchData, name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="branch-code">Branch Code</Label>
              <Input
                id="branch-code"
                placeholder={generateBranchCode(branchData.name) || 'Auto-generated'}
                value={branchData.code}
                onChange={(e) =>
                  setBranchData({ ...branchData, code: e.target.value.toUpperCase() })
                }
              />
              <p className="text-xs text-muted-foreground">
                Auto-generated from name. Override if needed.
              </p>
            </div>
          </div>
        </div>

        {/* Location */}
        <div className="space-y-4">
          <h3 className="font-medium text-sm text-muted-foreground uppercase tracking-wider">
            Location
          </h3>
          <LocationSelector
            value={{
              country: branchData.country,
              state: branchData.state,
              city: branchData.city,
            }}
            onChange={(location) =>
              setBranchData({
                ...branchData,
                country: location.country || 'India',
                state: location.state || '',
                city: location.city || '',
              })
            }
            showCountry={true}
            required
          />
          <div className="space-y-2">
            <Label htmlFor="pincode">
              Pincode <span className="text-destructive">*</span>
            </Label>
            <Input
              id="pincode"
              placeholder="e.g., 110001"
              value={branchData.pincode}
              onChange={(e) => {
                const value = e.target.value.replace(/\D/g, '').slice(0, 6);
                setBranchData({ ...branchData, pincode: value });
              }}
              className="w-1/3"
            />
          </div>
        </div>

        {/* Contact */}
        <div className="space-y-4">
          <h3 className="font-medium text-sm text-muted-foreground uppercase tracking-wider">
            Contact (Optional)
          </h3>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="branch-phone">Phone</Label>
              <div className="flex">
                <span className="inline-flex items-center px-3 text-sm text-muted-foreground bg-muted border border-r-0 border-input rounded-l-md">
                  +91
                </span>
                <Input
                  id="branch-phone"
                  placeholder="9876543210"
                  value={branchData.phone}
                  onChange={(e) => {
                    const value = e.target.value.replace(/\D/g, '').slice(0, 10);
                    setBranchData({ ...branchData, phone: value });
                  }}
                  className="rounded-l-none"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="branch-email">Email</Label>
              <Input
                id="branch-email"
                type="email"
                placeholder="info@campus.edu.in"
                value={branchData.email}
                onChange={(e) => setBranchData({ ...branchData, email: e.target.value })}
              />
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between pt-4 border-t">
          <Button variant="outline" onClick={goBack} className="gap-2">
            <ArrowLeft className="h-4 w-4" /> Back
          </Button>
          <Button onClick={onSave} disabled={saving} className="gap-2">
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <ArrowRight className="h-4 w-4" />
            )}
            Create Branch & Continue
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
