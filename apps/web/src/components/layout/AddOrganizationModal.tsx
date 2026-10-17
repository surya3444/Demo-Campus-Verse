'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2, Building2, AlertCircle, CreditCard, CheckCircle2, ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { useAuthStore } from '@/store/authStore';

// Razorpay types from src/types/razorpay.d.ts
type RazorpayResponse = RazorpayPaymentResponse;

const addOrgSchema = z.object({
  organizationName: z.string().min(2, 'Organization name must be at least 2 characters'),
  institutionType: z.enum(['school', 'college', 'university'], {
    required_error: 'Please select an institution type',
  }),
});

type AddOrgForm = z.infer<typeof addOrgSchema>;

interface AddOrganizationModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type Step = 'info' | 'payment' | 'success';

export function AddOrganizationModal({ open, onOpenChange }: AddOrganizationModalProps) {
  const [step, setStep] = useState<Step>('info');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [orderData, setOrderData] = useState<{
    orderId: string;
    amount: number;
    pendingOrgId: string;
    organizationName: string;
    keyId: string;
  } | null>(null);
  const [createdOrg, setCreatedOrg] = useState<{
    name: string;
    tenantId: string;
  } | null>(null);

  const { user } = useAuthStore();

  const {
    register,
    handleSubmit,
    setValue,
    reset,
    watch,
    formState: { errors },
  } = useForm<AddOrgForm>({
    resolver: zodResolver(addOrgSchema),
  });

  const institutionType = watch('institutionType');

  // Load Razorpay script
  const loadRazorpayScript = (): Promise<boolean> => {
    return new Promise((resolve) => {
      if (window.Razorpay) {
        resolve(true);
        return;
      }
      const script = document.createElement('script');
      script.src = 'https://checkout.razorpay.com/v1/checkout.js';
      script.onload = () => resolve(true);
      script.onerror = () => resolve(false);
      document.body.appendChild(script);
    });
  };

  // Step 1: Create order and proceed to payment
  const onSubmitInfo = async (data: AddOrgForm) => {
    setIsLoading(true);
    setError(null);

    try {
      // Create Razorpay order
      const response = await api.post('/auth/organizations/create-order', data);

      if (response.data.success) {
        setOrderData(response.data.data);
        setStep('payment');
      }
    } catch (err: unknown) {
      const error = err as { response?: { data?: { error?: { message?: string } } } };
      const message = error.response?.data?.error?.message || 'Failed to create order';
      setError(message);
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  };

  // Step 2: Process payment
  const handlePayment = async () => {
    if (!orderData) return;

    setIsLoading(true);
    setError(null);

    try {
      const scriptLoaded = await loadRazorpayScript();
      if (!scriptLoaded) {
        throw new Error('Failed to load payment gateway');
      }

      const options: RazorpayOptions = {
        key: orderData.keyId,
        amount: orderData.amount,
        currency: 'INR',
        name: 'Campus Verse',
        description: `New Organization: ${orderData.organizationName}`,
        order_id: orderData.orderId,
        handler: async (response: RazorpayResponse) => {
          // Verify payment on backend
          try {
            const verifyResponse = await api.post('/auth/organizations/verify-payment', {
              orderId: response.razorpay_order_id,
              paymentId: response.razorpay_payment_id,
              signature: response.razorpay_signature,
              pendingOrgId: orderData.pendingOrgId,
            });

            if (verifyResponse.data.success) {
              setCreatedOrg({
                name: verifyResponse.data.data.name,
                tenantId: verifyResponse.data.data.tenantId,
              });
              setStep('success');
              toast.success('Organization created successfully!');
            }
          } catch (err: unknown) {
            const error = err as { response?: { data?: { error?: { message?: string } } } };
            const message = error.response?.data?.error?.message || 'Payment verification failed';
            setError(message);
            toast.error(message);
          } finally {
            setIsLoading(false);
          }
        },
        prefill: {
          name: user?.profile?.displayName || '',
          email: user?.email || '',
        },
        theme: {
          color: '#6366f1',
        },
        modal: {
          ondismiss: () => {
            setIsLoading(false);
          },
        },
      };

      const razorpay = new window.Razorpay!(options);
      razorpay.open();
    } catch (err: unknown) {
      const error = err as { message?: string };
      const message = error.message || 'Payment failed';
      setError(message);
      toast.error(message);
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    reset();
    setError(null);
    setStep('info');
    setOrderData(null);
    setCreatedOrg(null);
    onOpenChange(false);
  };

  const handleSuccessClose = () => {
    handleClose();
    // Reload the page to reflect new organization
    window.location.reload();
  };

  const formatAmount = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 0,
    }).format(amount / 100);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <div className="p-2 bg-primary/10 rounded-lg">
              {step === 'success' ? (
                <CheckCircle2 className="h-5 w-5 text-green-600" />
              ) : step === 'payment' ? (
                <CreditCard className="h-5 w-5 text-primary" />
              ) : (
                <Building2 className="h-5 w-5 text-primary" />
              )}
            </div>
            {step === 'success'
              ? 'Organization Created!'
              : step === 'payment'
                ? 'Complete Payment'
                : 'Add New Organization'}
          </DialogTitle>
          <DialogDescription>
            {step === 'success'
              ? 'Your new organization is ready to use.'
              : step === 'payment'
                ? 'Complete the payment to create your organization.'
                : 'Create a new organization under your account.'}
          </DialogDescription>
        </DialogHeader>

        {error && (
          <div className="flex items-center gap-2 p-3 text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-lg">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Step 1: Organization Info */}
        {step === 'info' && (
          <form onSubmit={handleSubmit(onSubmitInfo)} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="organizationName">Organization Name</Label>
              <Input
                id="organizationName"
                placeholder="e.g., ABC International School"
                disabled={isLoading}
                {...register('organizationName')}
              />
              {errors.organizationName && (
                <p className="text-sm text-destructive">{errors.organizationName.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="institutionType">Institution Type</Label>
              <Select
                disabled={isLoading}
                onValueChange={(value) =>
                  setValue('institutionType', value as 'school' | 'college' | 'university')
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select institution type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="school">School</SelectItem>
                  <SelectItem value="college">College</SelectItem>
                  <SelectItem value="university">University</SelectItem>
                </SelectContent>
              </Select>
              {errors.institutionType && (
                <p className="text-sm text-destructive">{errors.institutionType.message}</p>
              )}
            </div>

            {/* Pricing info */}
            <div className="p-4 bg-muted/50 rounded-lg border">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Organization Setup Fee</span>
                <span className="font-semibold">₹999</span>
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                One-time payment. Includes 1 year of access with basic features.
              </p>
            </div>

            <div className="flex justify-end gap-3 pt-4">
              <Button type="button" variant="outline" onClick={handleClose} disabled={isLoading}>
                Cancel
              </Button>
              <Button type="submit" disabled={isLoading}>
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Processing...
                  </>
                ) : (
                  'Continue to Payment'
                )}
              </Button>
            </div>
          </form>
        )}

        {/* Step 2: Payment */}
        {step === 'payment' && orderData && (
          <div className="space-y-4">
            <div className="p-4 bg-muted/50 rounded-lg border space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Organization</span>
                <span className="font-medium">{orderData.organizationName}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Type</span>
                <span className="font-medium capitalize">{institutionType}</span>
              </div>
              <div className="border-t pt-3 flex items-center justify-between">
                <span className="font-medium">Total Amount</span>
                <span className="text-lg font-bold text-primary">
                  {formatAmount(orderData.amount)}
                </span>
              </div>
            </div>

            <div className="flex justify-between gap-3 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => setStep('info')}
                disabled={isLoading}
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back
              </Button>
              <Button onClick={handlePayment} disabled={isLoading}>
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <CreditCard className="mr-2 h-4 w-4" />
                    Pay {formatAmount(orderData.amount)}
                  </>
                )}
              </Button>
            </div>
          </div>
        )}

        {/* Step 3: Success */}
        {step === 'success' && createdOrg && (
          <div className="space-y-4">
            <div className="p-6 text-center">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle2 className="h-8 w-8 text-green-600" />
              </div>
              <h3 className="text-lg font-semibold mb-2">{createdOrg.name}</h3>
              <p className="text-sm text-muted-foreground">
                Your organization has been created successfully. You can now switch to it from the
                organization menu.
              </p>
            </div>

            <div className="flex justify-center pt-4">
              <Button onClick={handleSuccessClose}>Done</Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
