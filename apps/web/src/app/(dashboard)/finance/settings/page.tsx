'use client';

import { useState, useEffect, useCallback, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Building2,
  CreditCard,
  Receipt,
  XCircle,
  Plus,
  Pencil,
  Trash2,
  Star,
  Save,
  Landmark,
  Wallet,
  Smartphone,
  Banknote,
  QrCode,
  Loader2,
  Zap,
} from 'lucide-react';
import { toast } from 'sonner';
import { financeApi } from '@/lib/api';
import { RazorpayRouteTab } from './components/RazorpayRouteTab';

interface BankAccount {
  _id: string;
  name: string;
  accountNumber: string;
  bankName: string;
  ifscCode: string;
  branch?: string;
  isDefault: boolean;
}

interface PaymentMethod {
  code: string;
  name: string;
  icon: React.ReactNode;
  enabled: boolean;
}

const paymentMethodIcons: Record<string, React.ReactNode> = {
  cash: <Banknote className="h-5 w-5" />,
  card: <CreditCard className="h-5 w-5" />,
  upi: <QrCode className="h-5 w-5" />,
  bank_transfer: <Landmark className="h-5 w-5" />,
  cheque: <Receipt className="h-5 w-5" />,
  wallet: <Wallet className="h-5 w-5" />,
  mobile: <Smartphone className="h-5 w-5" />,
};

const defaultPaymentMethods: PaymentMethod[] = [
  { code: 'cash', name: 'Cash', icon: <Banknote className="h-5 w-5" />, enabled: true },
  { code: 'card', name: 'Card', icon: <CreditCard className="h-5 w-5" />, enabled: true },
  { code: 'upi', name: 'UPI', icon: <QrCode className="h-5 w-5" />, enabled: true },
  {
    code: 'bank_transfer',
    name: 'Bank Transfer',
    icon: <Landmark className="h-5 w-5" />,
    enabled: true,
  },
  { code: 'cheque', name: 'Cheque', icon: <Receipt className="h-5 w-5" />, enabled: true },
  { code: 'wallet', name: 'Digital Wallet', icon: <Wallet className="h-5 w-5" />, enabled: false },
  {
    code: 'mobile',
    name: 'Mobile Banking',
    icon: <Smartphone className="h-5 w-5" />,
    enabled: false,
  },
];

function FinanceSettingsContent() {
  const searchParams = useSearchParams();
  const initialTab = searchParams.get('tab') || 'bank-accounts';
  const [activeTab, setActiveTab] = useState(initialTab);
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);

  // Bank Accounts
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [bankDialogOpen, setBankDialogOpen] = useState(false);
  const [editingBank, setEditingBank] = useState<BankAccount | null>(null);
  const [bankForm, setBankForm] = useState({
    name: '',
    accountNumber: '',
    bankName: '',
    ifscCode: '',
    branch: '',
    isDefault: false,
  });

  // Payment Methods
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>(defaultPaymentMethods);

  // Receipt Settings
  const [receiptSettings, setReceiptSettings] = useState({
    prefix: 'RCP',
    startNumber: 1001,
    showLogo: true,
    showSignature: true,
    footerText: 'Thank you for your payment!',
  });

  // Cancellation Settings
  const [cancellationSettings, setCancellationSettings] = useState({
    allowCancellation: true,
    cancellationCharge: 500,
    requireApproval: true,
  });

  // Fetch all settings on mount
  const fetchSettings = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await financeApi.getFinanceSettings();
      if (response.success && response.data) {
        const settings = response.data;

        // Update receipt settings
        if (settings.receiptSettings) {
          setReceiptSettings((prev) => ({ ...prev, ...settings.receiptSettings }));
        }

        // Update cancellation settings
        if (settings.cancellationSettings) {
          setCancellationSettings((prev) => ({ ...prev, ...settings.cancellationSettings }));
        }
      }
    } catch (error) {
      console.error('Failed to fetch settings:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Fetch bank accounts
  const fetchBankAccounts = useCallback(async () => {
    try {
      const response = await financeApi.getBankAccounts();
      if (response.success && response.data) {
        const data = response.data.bankAccounts || response.data;
        setBankAccounts(Array.isArray(data) ? data : []);
      }
    } catch (error) {
      console.error('Failed to fetch bank accounts:', error);
    }
  }, []);

  // Fetch payment methods
  const fetchPaymentMethods = useCallback(async () => {
    try {
      const response = await financeApi.getPaymentMethods();
      if (response.success && response.data) {
        const methods = response.data.paymentMethods || response.data;
        if (Array.isArray(methods)) {
          setPaymentMethods(
            methods.map((m) => ({
              ...m,
              icon: paymentMethodIcons[m.code] || <CreditCard className="h-5 w-5" />,
            }))
          );
        }
      }
    } catch (error) {
      console.error('Failed to fetch payment methods:', error);
    }
  }, []);

  useEffect(() => {
    fetchSettings();
    fetchBankAccounts();
    fetchPaymentMethods();
  }, [fetchSettings, fetchBankAccounts, fetchPaymentMethods]);

  // Bank Account handlers
  const handleOpenBankDialog = (bank?: BankAccount) => {
    if (bank) {
      setEditingBank(bank);
      setBankForm({
        name: bank.name,
        accountNumber: bank.accountNumber,
        bankName: bank.bankName,
        ifscCode: bank.ifscCode,
        branch: bank.branch || '',
        isDefault: bank.isDefault,
      });
    } else {
      setEditingBank(null);
      setBankForm({
        name: '',
        accountNumber: '',
        bankName: '',
        ifscCode: '',
        branch: '',
        isDefault: false,
      });
    }
    setBankDialogOpen(true);
  };

  const handleSaveBankAccount = async () => {
    if (!bankForm.name || !bankForm.accountNumber || !bankForm.bankName || !bankForm.ifscCode) {
      toast.error('Please fill all required fields');
      return;
    }

    setIsProcessing(true);
    try {
      if (editingBank) {
        const response = await financeApi.updateBankAccount(editingBank._id, bankForm);
        if (response.success) {
          toast.success('Bank account updated');
          fetchBankAccounts();
          setBankDialogOpen(false);
        } else {
          toast.error(response.error?.message || 'Failed to update bank account');
        }
      } else {
        const response = await financeApi.addBankAccount(bankForm);
        if (response.success) {
          toast.success('Bank account added');
          fetchBankAccounts();
          setBankDialogOpen(false);
        } else {
          toast.error(response.error?.message || 'Failed to add bank account');
        }
      }
    } catch (error) {
      console.error('Failed to save bank account:', error);
      toast.error('Failed to save bank account');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDeleteBankAccount = async (id: string) => {
    const account = bankAccounts.find((b) => b._id === id);
    if (account?.isDefault) {
      toast.error('Cannot delete default account');
      return;
    }

    if (!confirm('Are you sure you want to delete this bank account?')) {
      return;
    }

    try {
      const response = await financeApi.deleteBankAccount(id);
      if (response.success) {
        toast.success('Bank account deleted');
        fetchBankAccounts();
      } else {
        toast.error(response.error?.message || 'Failed to delete bank account');
      }
    } catch (error) {
      console.error('Failed to delete bank account:', error);
      toast.error('Failed to delete bank account');
    }
  };

  const handleSetDefaultAccount = async (id: string) => {
    try {
      const response = await financeApi.updateBankAccount(id, { isDefault: true });
      if (response.success) {
        toast.success('Default account updated');
        fetchBankAccounts();
      } else {
        toast.error(response.error?.message || 'Failed to update default account');
      }
    } catch (error) {
      console.error('Failed to set default account:', error);
      toast.error('Failed to update default account');
    }
  };

  // Payment Method handlers
  const handleTogglePaymentMethod = async (code: string) => {
    const method = paymentMethods.find((m) => m.code === code);
    if (!method) return;

    try {
      const response = await financeApi.updatePaymentMethod(code, !method.enabled);
      if (response.success) {
        setPaymentMethods((prev) =>
          prev.map((m) => (m.code === code ? { ...m, enabled: !m.enabled } : m))
        );
      } else {
        toast.error(response.error?.message || 'Failed to update payment method');
      }
    } catch (error) {
      console.error('Failed to toggle payment method:', error);
      // Fallback to local state update
      setPaymentMethods((prev) =>
        prev.map((m) => (m.code === code ? { ...m, enabled: !m.enabled } : m))
      );
    }
  };

  // Save handlers for each settings section
  const handleSaveReceiptSettings = async () => {
    setIsProcessing(true);
    try {
      const response = await financeApi.updateFinanceSettings({ receiptSettings });
      if (response.success) {
        toast.success('Receipt settings saved');
      } else {
        toast.error(response.error?.message || 'Failed to save settings');
      }
    } catch (error) {
      console.error('Failed to save receipt settings:', error);
      toast.error('Failed to save settings');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSaveCancellationSettings = async () => {
    setIsProcessing(true);
    try {
      const response = await financeApi.updateFinanceSettings({ cancellationSettings });
      if (response.success) {
        toast.success('Cancellation settings saved');
      } else {
        toast.error(response.error?.message || 'Failed to save settings');
      }
    } catch (error) {
      console.error('Failed to save cancellation settings:', error);
      toast.error('Failed to save settings');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSavePaymentMethods = async () => {
    setIsProcessing(true);
    try {
      // Save all payment method states
      const promises = paymentMethods.map((m) => financeApi.updatePaymentMethod(m.code, m.enabled));
      await Promise.all(promises);
      toast.success('Payment methods saved');
    } catch (error) {
      console.error('Failed to save payment methods:', error);
      toast.error('Failed to save settings');
    } finally {
      setIsProcessing(false);
    }
  };

  // Approval handlers
  if (isLoading) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Finance Settings"
          description="Configure finance module settings and preferences"
        />
        <Card>
          <CardContent className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            <span className="ml-2 text-muted-foreground">Loading settings...</span>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Finance Settings"
        description="Configure finance module settings and preferences"
      />

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="bank-accounts" className="gap-2">
            <Building2 className="h-4 w-4" />
            <span className="hidden sm:inline">Bank</span>
          </TabsTrigger>
          <TabsTrigger value="payment-methods" className="gap-2">
            <CreditCard className="h-4 w-4" />
            <span className="hidden sm:inline">Payment</span>
          </TabsTrigger>
          <TabsTrigger value="receipt" className="gap-2">
            <Receipt className="h-4 w-4" />
            <span className="hidden sm:inline">Receipt</span>
          </TabsTrigger>
          <TabsTrigger value="cancellation" className="gap-2">
            <XCircle className="h-4 w-4" />
            <span className="hidden sm:inline">Cancel</span>
          </TabsTrigger>
          <TabsTrigger value="razorpay-route" className="gap-2">
            <Zap className="h-4 w-4" />
            <span className="hidden sm:inline">Route</span>
          </TabsTrigger>
        </TabsList>

        {/* Bank Accounts Tab */}
        <TabsContent value="bank-accounts" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Bank Accounts</CardTitle>
                <CardDescription>Manage bank accounts for fee collection</CardDescription>
              </div>
              <Button onClick={() => handleOpenBankDialog()} className="gap-2">
                <Plus className="h-4 w-4" />
                Add Account
              </Button>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {bankAccounts.map((account) => (
                  <div
                    key={account._id}
                    className={`p-4 rounded-lg border ${
                      account.isDefault ? 'border-primary bg-primary/5' : 'bg-muted/30'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-4">
                        <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center">
                          <Landmark className="h-6 w-6 text-primary" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="font-semibold">{account.name}</h4>
                            {account.isDefault && (
                              <Badge className="bg-primary/10 text-primary">
                                <Star className="h-3 w-3 mr-1" />
                                Default
                              </Badge>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground mt-1">
                            {account.bankName} - {account.branch}
                          </p>
                          <div className="flex gap-4 mt-2 text-sm">
                            <span>
                              A/C: <span className="font-mono">{account.accountNumber}</span>
                            </span>
                            <span>
                              IFSC: <span className="font-mono">{account.ifscCode}</span>
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {!account.isDefault && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleSetDefaultAccount(account._id)}
                          >
                            Set Default
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleOpenBankDialog(account)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDeleteBankAccount(account._id)}
                          disabled={account.isDefault}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}

                {bankAccounts.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    No bank accounts configured. Add one to get started.
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Payment Methods Tab */}
        <TabsContent value="payment-methods" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Payment Methods</CardTitle>
              <CardDescription>
                Enable or disable payment methods for fee collection
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2">
                {paymentMethods.map((method) => (
                  <div
                    key={method.code}
                    className="flex items-center justify-between p-4 rounded-lg border"
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`h-10 w-10 rounded-lg flex items-center justify-center ${
                          method.enabled
                            ? 'bg-primary/10 text-primary'
                            : 'bg-muted text-muted-foreground'
                        }`}
                      >
                        {method.icon}
                      </div>
                      <div>
                        <p className="font-medium">{method.name}</p>
                        <p className="text-xs text-muted-foreground capitalize">
                          {method.code.replace('_', ' ')}
                        </p>
                      </div>
                    </div>
                    <Switch
                      checked={method.enabled}
                      onCheckedChange={() => handleTogglePaymentMethod(method.code)}
                    />
                  </div>
                ))}
              </div>
              <div className="flex justify-end mt-6">
                <Button onClick={handleSavePaymentMethods} disabled={isProcessing}>
                  {isProcessing ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4 mr-2" />
                  )}
                  {isProcessing ? 'Saving...' : 'Save Changes'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Receipt Settings Tab */}
        <TabsContent value="receipt" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Receipt Settings</CardTitle>
              <CardDescription>Configure receipt numbering and display options</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Receipt Prefix</Label>
                  <Input
                    value={receiptSettings.prefix}
                    onChange={(e) =>
                      setReceiptSettings((prev) => ({ ...prev, prefix: e.target.value }))
                    }
                    placeholder="e.g., RCP"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Starting Number</Label>
                  <Input
                    type="number"
                    value={receiptSettings.startNumber}
                    onChange={(e) =>
                      setReceiptSettings((prev) => ({
                        ...prev,
                        startNumber: parseInt(e.target.value) || 1,
                      }))
                    }
                  />
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">Show Organization Logo</p>
                    <p className="text-sm text-muted-foreground">
                      Display logo on printed receipts
                    </p>
                  </div>
                  <Switch
                    checked={receiptSettings.showLogo}
                    onCheckedChange={(checked) =>
                      setReceiptSettings((prev) => ({ ...prev, showLogo: checked }))
                    }
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">Show Signature Line</p>
                    <p className="text-sm text-muted-foreground">
                      Include signature line on receipts
                    </p>
                  </div>
                  <Switch
                    checked={receiptSettings.showSignature}
                    onCheckedChange={(checked) =>
                      setReceiptSettings((prev) => ({ ...prev, showSignature: checked }))
                    }
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Footer Text</Label>
                <Input
                  value={receiptSettings.footerText}
                  onChange={(e) =>
                    setReceiptSettings((prev) => ({ ...prev, footerText: e.target.value }))
                  }
                  placeholder="Text to display at the bottom of receipts"
                />
              </div>

              <div className="flex justify-end">
                <Button onClick={handleSaveReceiptSettings} disabled={isProcessing}>
                  {isProcessing ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4 mr-2" />
                  )}
                  {isProcessing ? 'Saving...' : 'Save Changes'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Cancellation Settings Tab */}
        <TabsContent value="cancellation" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Cancellation Settings</CardTitle>
              <CardDescription>Configure fee cancellation and refund policies</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Allow Cancellation</p>
                  <p className="text-sm text-muted-foreground">
                    Enable cancellation of fee transactions
                  </p>
                </div>
                <Switch
                  checked={cancellationSettings.allowCancellation}
                  onCheckedChange={(checked) =>
                    setCancellationSettings((prev) => ({ ...prev, allowCancellation: checked }))
                  }
                />
              </div>

              {cancellationSettings.allowCancellation && (
                <>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">Require Approval</p>
                      <p className="text-sm text-muted-foreground">
                        Cancellations require approval before processing
                      </p>
                    </div>
                    <Switch
                      checked={cancellationSettings.requireApproval}
                      onCheckedChange={(checked) =>
                        setCancellationSettings((prev) => ({ ...prev, requireApproval: checked }))
                      }
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Cancellation Charge</Label>
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground">₹</span>
                      <Input
                        type="number"
                        value={cancellationSettings.cancellationCharge}
                        onChange={(e) =>
                          setCancellationSettings((prev) => ({
                            ...prev,
                            cancellationCharge: parseInt(e.target.value) || 0,
                          }))
                        }
                        className="w-32"
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Fixed charge deducted from refund amount
                    </p>
                  </div>
                </>
              )}

              <div className="flex justify-end">
                <Button onClick={handleSaveCancellationSettings} disabled={isProcessing}>
                  {isProcessing ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4 mr-2" />
                  )}
                  {isProcessing ? 'Saving...' : 'Save Changes'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Razorpay Route Tab */}
        <TabsContent value="razorpay-route" className="space-y-4">
          <RazorpayRouteTab />
        </TabsContent>
      </Tabs>

      {/* Bank Account Dialog */}
      <Dialog open={bankDialogOpen} onOpenChange={setBankDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingBank ? 'Edit Bank Account' : 'Add Bank Account'}</DialogTitle>
            <DialogDescription>
              {editingBank
                ? 'Update bank account details'
                : 'Add a new bank account for fee collection'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Account Name *</Label>
              <Input
                value={bankForm.name}
                onChange={(e) => setBankForm((prev) => ({ ...prev, name: e.target.value }))}
                placeholder="e.g., Main Collection Account"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Account Number *</Label>
                <Input
                  value={bankForm.accountNumber}
                  onChange={(e) =>
                    setBankForm((prev) => ({ ...prev, accountNumber: e.target.value }))
                  }
                  placeholder="Account number"
                />
              </div>
              <div className="space-y-2">
                <Label>IFSC Code *</Label>
                <Input
                  value={bankForm.ifscCode}
                  onChange={(e) =>
                    setBankForm((prev) => ({ ...prev, ifscCode: e.target.value.toUpperCase() }))
                  }
                  placeholder="e.g., SBIN0001234"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Bank Name *</Label>
                <Input
                  value={bankForm.bankName}
                  onChange={(e) => setBankForm((prev) => ({ ...prev, bankName: e.target.value }))}
                  placeholder="Bank name"
                />
              </div>
              <div className="space-y-2">
                <Label>Branch</Label>
                <Input
                  value={bankForm.branch}
                  onChange={(e) => setBankForm((prev) => ({ ...prev, branch: e.target.value }))}
                  placeholder="Branch name"
                />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Switch
                checked={bankForm.isDefault}
                onCheckedChange={(checked) =>
                  setBankForm((prev) => ({ ...prev, isDefault: checked }))
                }
              />
              <Label>Set as default account</Label>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setBankDialogOpen(false)}
              disabled={isProcessing}
            >
              Cancel
            </Button>
            <Button onClick={handleSaveBankAccount} disabled={isProcessing}>
              {isProcessing ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : editingBank ? (
                'Update'
              ) : (
                'Add Account'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function FinanceSettingsPage() {
  return (
    <Suspense
      fallback={
        <div className="space-y-6">
          <PageHeader
            title="Finance Settings"
            description="Configure finance module settings and preferences"
          />
          <Card>
            <CardContent className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              <span className="ml-2 text-muted-foreground">Loading settings...</span>
            </CardContent>
          </Card>
        </div>
      }
    >
      <FinanceSettingsContent />
    </Suspense>
  );
}
