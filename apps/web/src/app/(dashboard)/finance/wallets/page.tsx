'use client';

import { useState, useEffect, useCallback } from 'react';
import { PageHeader, AddButton, ExportButton } from '@/components/ui/page-header';
import { DataTable, Column, DataTableAction } from '@/components/ui/data-table';
import { Badge } from '@/components/ui/badge';
import { StatCard } from '@/components/ui/stat-card';
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Card, CardContent } from '@/components/ui/card';
import {
  Wallet,
  IndianRupee,
  ArrowUpCircle,
  ArrowDownCircle,
  Eye,
  Plus,
  History,
  Search,
  GraduationCap,
  Loader2,
  CreditCard,
  ToggleLeft,
} from 'lucide-react';
import { toast } from 'sonner';
import { financeApi, studentApi } from '@/lib/api';

interface WalletData {
  _id: string;
  walletNumber: string;
  balance: number;
  totalCredits: number;
  totalDebits: number;
  isActive: boolean;
  lastTransactionDate?: string;
  student: {
    _id: string;
    admissionNumber: string;
    displayName: string;
    className?: string;
    sectionName?: string;
  } | null;
  createdAt: string;
}

interface WalletTransaction {
  _id: string;
  transactionNumber: string;
  type: 'credit' | 'debit';
  category: string;
  amount: number;
  balanceBefore: number;
  balanceAfter: number;
  description: string;
  paymentMode?: string;
  createdAt: string;
}

interface WalletStats {
  totalWallets: number;
  activeWallets: number;
  totalBalance: number;
  walletsWithBalance: number;
  totalCredits: number;
  totalDebits: number;
}

interface Student {
  _id: string;
  admissionNumber: string;
  firstName: string;
  lastName: string;
  displayName?: string;
  className?: string;
  sectionName?: string;
}

export default function WalletsPage() {
  const [wallets, setWallets] = useState<WalletData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [balanceFilter, setBalanceFilter] = useState<string>('all');

  // Stats
  const [stats, setStats] = useState<WalletStats>({
    totalWallets: 0,
    activeWallets: 0,
    totalBalance: 0,
    walletsWithBalance: 0,
    totalCredits: 0,
    totalDebits: 0,
  });

  // Dialog states
  const [selectedWallet, setSelectedWallet] = useState<WalletData | null>(null);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [topUpDialogOpen, setTopUpDialogOpen] = useState(false);
  const [transactionsDialogOpen, setTransactionsDialogOpen] = useState(false);

  // Create wallet form state
  const [studentSearch, setStudentSearch] = useState('');
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [searchResults, setSearchResults] = useState<Student[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  // Top-up form state
  const [topUpAmount, setTopUpAmount] = useState('');
  const [topUpPaymentMode, setTopUpPaymentMode] = useState('cash');
  const [topUpDescription, setTopUpDescription] = useState('');

  // Transactions state
  const [transactions, setTransactions] = useState<WalletTransaction[]>([]);
  const [isLoadingTransactions, setIsLoadingTransactions] = useState(false);

  // Fetch wallets
  const fetchWallets = useCallback(async () => {
    setIsLoading(true);
    try {
      const params: { hasBalance?: boolean } = {};
      if (balanceFilter === 'with-balance') params.hasBalance = true;
      else if (balanceFilter === 'zero-balance') params.hasBalance = false;

      const response = await financeApi.getWallets(params);
      if (response.success && response.data) {
        setWallets(Array.isArray(response.data) ? response.data : response.data.wallets || []);
      }
    } catch (error) {
      console.error('Failed to fetch wallets:', error);
      toast.error('Failed to fetch wallets');
    } finally {
      setIsLoading(false);
    }
  }, [balanceFilter]);

  // Fetch stats
  const fetchStats = useCallback(async () => {
    try {
      const response = await financeApi.getWalletStats();
      if (response.success && response.data) {
        setStats(response.data);
      }
    } catch (error) {
      console.error('Failed to fetch stats:', error);
    }
  }, []);

  useEffect(() => {
    fetchWallets();
    fetchStats();
  }, [fetchWallets, fetchStats]);

  const columns: Column<WalletData>[] = [
    {
      key: 'walletNumber',
      header: 'Wallet No.',
      sortable: true,
      cell: (row) => (
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <Wallet className="h-5 w-5 text-primary" />
          </div>
          <span className="font-mono font-medium">{row.walletNumber}</span>
        </div>
      ),
    },
    {
      key: 'student',
      header: 'Student',
      cell: (row) =>
        row.student ? (
          <div>
            <p className="font-medium">{row.student.displayName}</p>
            <p className="text-xs text-muted-foreground">{row.student.admissionNumber}</p>
          </div>
        ) : (
          <span className="text-muted-foreground">-</span>
        ),
    },
    {
      key: 'class',
      header: 'Class',
      cell: (row) =>
        row.student?.className ? (
          <Badge variant="outline">
            {row.student.className} - {row.student.sectionName}
          </Badge>
        ) : (
          <span className="text-muted-foreground">-</span>
        ),
    },
    {
      key: 'balance',
      header: 'Balance',
      sortable: true,
      cell: (row) => (
        <span className={`font-bold ${row.balance > 0 ? 'text-success' : 'text-muted-foreground'}`}>
          ₹{row.balance.toLocaleString()}
        </span>
      ),
    },
    {
      key: 'totalCredits',
      header: 'Total Credits',
      sortable: true,
      cell: (row) => <span className="text-success">+₹{row.totalCredits.toLocaleString()}</span>,
    },
    {
      key: 'totalDebits',
      header: 'Total Debits',
      sortable: true,
      cell: (row) => <span className="text-destructive">-₹{row.totalDebits.toLocaleString()}</span>,
    },
    {
      key: 'isActive',
      header: 'Status',
      cell: (row) => (
        <Badge
          variant="secondary"
          className={row.isActive ? 'bg-success/10 text-success' : 'bg-muted text-muted-foreground'}
        >
          {row.isActive ? 'Active' : 'Inactive'}
        </Badge>
      ),
    },
  ];

  const actions: DataTableAction<WalletData>[] = [
    {
      label: 'View Details',
      icon: <Eye className="mr-2 h-4 w-4" />,
      onClick: (row) => {
        setSelectedWallet(row);
        setViewDialogOpen(true);
      },
    },
    {
      label: 'Top Up',
      icon: <ArrowUpCircle className="mr-2 h-4 w-4" />,
      onClick: (row) => {
        setSelectedWallet(row);
        setTopUpDialogOpen(true);
      },
      show: (row: WalletData) => row.isActive,
    },
    {
      label: 'View Transactions',
      icon: <History className="mr-2 h-4 w-4" />,
      onClick: async (row) => {
        setSelectedWallet(row);
        setTransactionsDialogOpen(true);
        await fetchTransactions(row._id);
      },
    },
    {
      label: 'Toggle Status',
      icon: <ToggleLeft className="mr-2 h-4 w-4" />,
      onClick: async (row) => {
        try {
          await financeApi.toggleWalletStatus(row._id, !row.isActive);
          toast.success(`Wallet ${row.isActive ? 'deactivated' : 'activated'}`);
          fetchWallets();
        } catch {
          toast.error('Failed to update wallet status');
        }
      },
    },
  ];

  const handleSearchStudents = async () => {
    if (!studentSearch.trim()) return;

    setIsSearching(true);
    try {
      const response = await studentApi.getStudents({ search: studentSearch, limit: 10 });
      if (response.success && response.data) {
        setSearchResults(response.data.students || response.data);
      }
    } catch {
      toast.error('Failed to search students');
    } finally {
      setIsSearching(false);
    }
  };

  const handleCreateWallet = async () => {
    if (!selectedStudent) {
      toast.error('Please select a student');
      return;
    }

    setIsProcessing(true);
    try {
      const response = await financeApi.createWallet(selectedStudent._id);
      if (response.success) {
        toast.success('Wallet created successfully');
        setCreateDialogOpen(false);
        resetCreateForm();
        fetchWallets();
        fetchStats();
      } else {
        toast.error(response.error?.message || 'Failed to create wallet');
      }
    } catch (error: unknown) {
      const err = error as { response?: { data?: { error?: { message?: string } } } };
      toast.error(err.response?.data?.error?.message || 'Failed to create wallet');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleTopUp = async () => {
    if (!selectedWallet || !topUpAmount || parseFloat(topUpAmount) <= 0) {
      toast.error('Please enter a valid amount');
      return;
    }

    setIsProcessing(true);
    try {
      const response = await financeApi.topUpWallet(selectedWallet._id, {
        amount: parseFloat(topUpAmount),
        paymentMode: topUpPaymentMode,
        description: topUpDescription || 'Wallet top-up',
      });

      if (response.success) {
        toast.success('Wallet topped up successfully');
        setTopUpDialogOpen(false);
        resetTopUpForm();
        fetchWallets();
        fetchStats();
      } else {
        toast.error(response.error?.message || 'Failed to top up wallet');
      }
    } catch {
      toast.error('Failed to top up wallet');
    } finally {
      setIsProcessing(false);
    }
  };

  const fetchTransactions = async (walletId: string) => {
    setIsLoadingTransactions(true);
    try {
      const response = await financeApi.getWalletTransactions(walletId, { limit: 50 });
      if (response.success && response.data) {
        setTransactions(
          Array.isArray(response.data) ? response.data : response.data.transactions || []
        );
      }
    } catch {
      toast.error('Failed to fetch transactions');
    } finally {
      setIsLoadingTransactions(false);
    }
  };

  const resetCreateForm = () => {
    setStudentSearch('');
    setSelectedStudent(null);
    setSearchResults([]);
  };

  const resetTopUpForm = () => {
    setTopUpAmount('');
    setTopUpPaymentMode('cash');
    setTopUpDescription('');
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Student Wallets" description="Manage prepaid wallet accounts">
        <ExportButton />
        <AddButton onClick={() => setCreateDialogOpen(true)} label="Create Wallet" />
      </PageHeader>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4 stagger-animation">
        <StatCard
          title="Total Wallets"
          value={stats.totalWallets}
          icon={Wallet}
          variant="primary"
        />
        <StatCard
          title="Active Wallets"
          value={stats.activeWallets}
          icon={CreditCard}
          variant="success"
        />
        <StatCard
          title="Total Balance"
          value={`₹${(stats.totalBalance / 1000).toFixed(0)}K`}
          icon={IndianRupee}
          variant="warning"
        />
        <StatCard
          title="With Balance"
          value={stats.walletsWithBalance}
          icon={ArrowUpCircle}
          variant="default"
        />
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap gap-4">
            <div className="flex items-center gap-2">
              <Label className="text-sm">Balance:</Label>
              <Select value={balanceFilter} onValueChange={setBalanceFilter}>
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Wallets</SelectItem>
                  <SelectItem value="with-balance">With Balance</SelectItem>
                  <SelectItem value="zero-balance">Zero Balance</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      {isLoading ? (
        <Card>
          <CardContent className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            <span className="ml-2 text-muted-foreground">Loading wallets...</span>
          </CardContent>
        </Card>
      ) : (
        <DataTable
          data={wallets}
          columns={columns}
          actions={actions}
          searchable
          searchPlaceholder="Search by wallet number or student..."
        />
      )}

      {/* Create Wallet Dialog */}
      <Dialog
        open={createDialogOpen}
        onOpenChange={(open) => {
          setCreateDialogOpen(open);
          if (!open) resetCreateForm();
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="h-5 w-5" />
              Create Wallet
            </DialogTitle>
            <DialogDescription>Create a new wallet for a student</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Search Student</Label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search by name or admission number..."
                    value={studentSearch}
                    onChange={(e) => setStudentSearch(e.target.value)}
                    className="pl-9"
                    onKeyDown={(e) => e.key === 'Enter' && handleSearchStudents()}
                  />
                </div>
                <Button onClick={handleSearchStudents} disabled={isSearching}>
                  {isSearching ? 'Searching...' : 'Search'}
                </Button>
              </div>
            </div>

            {searchResults.length > 0 && !selectedStudent && (
              <div className="border rounded-lg max-h-40 overflow-y-auto">
                {searchResults.map((student) => (
                  <div
                    key={student._id}
                    className="p-3 hover:bg-muted/50 cursor-pointer border-b last:border-b-0"
                    onClick={() => {
                      setSelectedStudent(student);
                      setSearchResults([]);
                    }}
                  >
                    <p className="font-medium">
                      {student.displayName || `${student.firstName} ${student.lastName}`}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {student.admissionNumber} | {student.className} - {student.sectionName}
                    </p>
                  </div>
                ))}
              </div>
            )}

            {selectedStudent && (
              <div className="p-3 rounded-lg bg-muted/50 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <GraduationCap className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium">
                      {selectedStudent.displayName ||
                        `${selectedStudent.firstName} ${selectedStudent.lastName}`}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {selectedStudent.admissionNumber} | {selectedStudent.className} -{' '}
                      {selectedStudent.sectionName}
                    </p>
                  </div>
                </div>
                <Button variant="ghost" size="sm" onClick={() => setSelectedStudent(null)}>
                  Change
                </Button>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setCreateDialogOpen(false)}
              disabled={isProcessing}
            >
              Cancel
            </Button>
            <Button onClick={handleCreateWallet} disabled={isProcessing || !selectedStudent}>
              {isProcessing ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                'Create Wallet'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Wallet Dialog */}
      <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Wallet Details</DialogTitle>
            <DialogDescription>View wallet information</DialogDescription>
          </DialogHeader>

          {selectedWallet && (
            <div className="space-y-4">
              <div className="flex items-center gap-4 p-4 rounded-lg bg-muted/50">
                <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center">
                  <Wallet className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <h3 className="font-mono font-semibold">{selectedWallet.walletNumber}</h3>
                  {selectedWallet.student && (
                    <p className="text-sm text-muted-foreground">
                      {selectedWallet.student.displayName}
                    </p>
                  )}
                </div>
              </div>

              <div className="p-4 rounded-lg bg-gradient-to-br from-primary/5 to-primary/10 border border-primary/20">
                <p className="text-sm text-muted-foreground">Current Balance</p>
                <p className="text-3xl font-bold text-primary">
                  ₹{selectedWallet.balance.toLocaleString()}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="p-3 rounded-lg border">
                  <p className="text-sm text-muted-foreground">Total Credits</p>
                  <p className="font-medium text-success">
                    +₹{selectedWallet.totalCredits.toLocaleString()}
                  </p>
                </div>
                <div className="p-3 rounded-lg border">
                  <p className="text-sm text-muted-foreground">Total Debits</p>
                  <p className="font-medium text-destructive">
                    -₹{selectedWallet.totalDebits.toLocaleString()}
                  </p>
                </div>
              </div>

              <div className="p-3 rounded-lg border">
                <p className="text-sm text-muted-foreground">Status</p>
                <Badge
                  className={
                    selectedWallet.isActive
                      ? 'bg-success/10 text-success mt-1'
                      : 'bg-muted text-muted-foreground mt-1'
                  }
                >
                  {selectedWallet.isActive ? 'Active' : 'Inactive'}
                </Badge>
              </div>

              {selectedWallet.lastTransactionDate && (
                <div className="p-3 rounded-lg border">
                  <p className="text-sm text-muted-foreground">Last Transaction</p>
                  <p className="font-medium mt-1">
                    {new Date(selectedWallet.lastTransactionDate).toLocaleDateString('en-IN', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Top Up Dialog */}
      <Dialog
        open={topUpDialogOpen}
        onOpenChange={(open) => {
          setTopUpDialogOpen(open);
          if (!open) resetTopUpForm();
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ArrowUpCircle className="h-5 w-5 text-success" />
              Top Up Wallet
            </DialogTitle>
            <DialogDescription>Add funds to the wallet</DialogDescription>
          </DialogHeader>

          {selectedWallet && (
            <div className="space-y-4">
              <div className="p-4 rounded-lg bg-muted/50">
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Wallet</span>
                  <span className="font-mono">{selectedWallet.walletNumber}</span>
                </div>
                <div className="flex justify-between mt-2">
                  <span className="text-sm text-muted-foreground">Current Balance</span>
                  <span className="font-bold text-primary">
                    ₹{selectedWallet.balance.toLocaleString()}
                  </span>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Amount *</Label>
                <Input
                  type="number"
                  placeholder="Enter amount"
                  value={topUpAmount}
                  onChange={(e) => setTopUpAmount(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label>Payment Mode *</Label>
                <Select value={topUpPaymentMode} onValueChange={setTopUpPaymentMode}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cash">Cash</SelectItem>
                    <SelectItem value="upi">UPI</SelectItem>
                    <SelectItem value="card">Card</SelectItem>
                    <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                    <SelectItem value="cheque">Cheque</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Description (Optional)</Label>
                <Input
                  placeholder="e.g., Monthly top-up"
                  value={topUpDescription}
                  onChange={(e) => setTopUpDescription(e.target.value)}
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setTopUpDialogOpen(false)}
              disabled={isProcessing}
            >
              Cancel
            </Button>
            <Button onClick={handleTopUp} disabled={isProcessing || !topUpAmount}>
              {isProcessing ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Processing...
                </>
              ) : (
                'Top Up'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Transactions Dialog */}
      <Dialog open={transactionsDialogOpen} onOpenChange={setTransactionsDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <History className="h-5 w-5" />
              Transaction History
            </DialogTitle>
            <DialogDescription>
              {selectedWallet && `Wallet: ${selectedWallet.walletNumber}`}
            </DialogDescription>
          </DialogHeader>

          {isLoadingTransactions ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : transactions.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">No transactions found</div>
          ) : (
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {transactions.map((txn) => (
                <div
                  key={txn._id}
                  className="flex items-center justify-between p-3 rounded-lg border"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`h-10 w-10 rounded-lg flex items-center justify-center ${
                        txn.type === 'credit'
                          ? 'bg-success/10 text-success'
                          : 'bg-destructive/10 text-destructive'
                      }`}
                    >
                      {txn.type === 'credit' ? (
                        <ArrowUpCircle className="h-5 w-5" />
                      ) : (
                        <ArrowDownCircle className="h-5 w-5" />
                      )}
                    </div>
                    <div>
                      <p className="font-medium">{txn.description}</p>
                      <p className="text-xs text-muted-foreground">
                        {txn.transactionNumber} | {txn.category}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p
                      className={`font-bold ${
                        txn.type === 'credit' ? 'text-success' : 'text-destructive'
                      }`}
                    >
                      {txn.type === 'credit' ? '+' : '-'}₹{txn.amount.toLocaleString()}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(txn.createdAt).toLocaleDateString('en-IN', {
                        day: 'numeric',
                        month: 'short',
                      })}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
