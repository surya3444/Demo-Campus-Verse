'use client';

import {
  FeeCollectedCelebration,
  type FeeCollectedDetails,
} from '@/components/finance/FeeCollectedCelebration';
import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DataTable, Column, DataTableAction } from '@/components/ui/data-table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import {
  IndianRupee,
  Search,
  Receipt,
  CreditCard,
  Banknote,
  QrCode,
  Printer,
  CheckCircle,
  AlertCircle,
  Wallet,
  Sparkles,
  Loader2,
  Eye,
  XCircle,
  TrendingUp,
  FileText,
  RefreshCw,
} from 'lucide-react';
import { toast } from 'sonner';
import { financeApi, academicApi } from '@/lib/api';
import { useRazorpay } from '@/hooks/useRazorpay';

// Types
interface StudentAssignmentComponentSnapshot {
  componentCode: string;
  name: string;
  type?: 'mandatory' | 'optional' | 'service-based';
  totalAmount: number;
}

interface StudentAssignment {
  _id: string;
  type: 'tuition' | 'hostel' | 'transport' | 'other';
  totalFee: number;
  paidAmount: number;
  dueAmount: number;
  components?: StudentAssignmentComponentSnapshot[];
}

interface Student {
  _id: string;
  studentId: string;
  name: string;
  class: string;
  section: string;
  totalFee: number;
  paidAmount: number;
  dueAmount: number;
  assignmentId: string;
  assignments?: StudentAssignment[];
  hasHostelFee?: boolean;
  status: 'paid' | 'partial' | 'pending';
}

interface AssignmentComponent {
  componentCode: string;
  name: string;
  originalAmount: number;
  discountAmount: number;
  finalAmount: number;
  taxAmount: number;
  totalAmount: number;
}

interface AssignmentInstallment {
  installmentNumber: number;
  name: string;
  dueDate: string;
  amount: number;
  fineAmount: number;
  totalDue: number;
  paidAmount: number;
  balance: number;
  status: 'pending' | 'partial' | 'paid' | 'overdue';
}

interface AssignmentDetails {
  _id: string;
  type?: string;
  components: AssignmentComponent[];
  installments: AssignmentInstallment[];
  summary: {
    totalFee: number;
    totalDiscount: number;
    totalTax: number;
    netPayable: number;
    totalPaid: number;
    totalFine: number;
    balance: number;
  };
}

interface Transaction {
  _id: string;
  receiptNo: string;
  studentName: string;
  studentId: string;
  class: string;
  section: string;
  amount: number;
  paymentMode: 'cash' | 'card' | 'upi' | 'online' | 'cheque';
  feeType: string;
  date: string;
  collectedBy: string;
  status: 'completed' | 'cancelled' | 'refunded';
  installmentNumbers?: number[];
  components?: Array<{ componentCode: string; name: string; amount: number }>;
}

interface FeeCounterStats {
  todayCollection: number;
  totalCollected: number;
  pendingDues: number;
  studentsCleared: number;
  totalStudents: number;
}

const printReceipt = async (transactionId: string) => {
  const loadingToast = toast.loading('Generating receipt...');
  try {
    const blob = await financeApi.getReceipt(transactionId);
    const url = URL.createObjectURL(blob);
    const printWindow = window.open(url);
    if (printWindow) {
      printWindow.onload = () => printWindow.print();
    } else {
      // Popup blocked — fall back to download
      const link = document.createElement('a');
      link.href = url;
      link.download = `Receipt-${transactionId}.pdf`;
      link.click();
    }
    toast.dismiss(loadingToast);
  } catch {
    toast.dismiss(loadingToast);
    toast.error('Failed to generate receipt');
  }
};

const paymentModeIcons: Record<string, React.ElementType> = {
  cash: Banknote,
  card: CreditCard,
  upi: QrCode,
  online: CreditCard,
  cheque: Receipt,
};

export default function FeeCounterPage() {
  const searchParams = useSearchParams();
  const initialTab = searchParams.get('tab') || 'collect';
  const [activeTab, setActiveTab] = useState(initialTab);

  // Collect tab state
  const [students, setStudents] = useState<Student[]>([]);
  const [stats, setStats] = useState<FeeCounterStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [celebration, setCelebration] = useState<FeeCollectedDetails | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [selectedAssignmentId, setSelectedAssignmentId] = useState<string>('');
  const [assignmentDetails, setAssignmentDetails] = useState<AssignmentDetails | null>(null);
  const [loadingAssignment, setLoadingAssignment] = useState(false);
  // Set of component codes the admin has ticked for collection. Used so the
  // admin can collect e.g. only Transport Fee or only Lab Fee. Empty set =>
  // collect the assignment as a whole at the manually entered amount.
  const [selectedComponentCodes, setSelectedComponentCodes] = useState<Set<string>>(new Set());
  // When the dialog is opened by clicking a single component chip in the
  // student row, we pre-seed the selection with just that component instead
  // of defaulting to "all". Cleared after the dialog hydrates.
  const [pendingComponentPreselection, setPendingComponentPreselection] = useState<string[] | null>(
    null
  );
  const { openCheckout } = useRazorpay();

  // Fetch the full fee assignment (with components + installments) whenever
  // the user picks a different assignment in the payment dialog. This is what
  // powers the price breakdown UI.
  useEffect(() => {
    if (!paymentDialogOpen || !selectedAssignmentId) {
      setAssignmentDetails(null);
      setSelectedComponentCodes(new Set());
      return;
    }
    let cancelled = false;
    setLoadingAssignment(true);
    financeApi
      .getAssignment(selectedAssignmentId)
      .then((res) => {
        if (cancelled) return;
        if (res.success && res.data) {
          const details = res.data as AssignmentDetails;
          setAssignmentDetails(details);
          // If the dialog was opened via a single-component chip click,
          // honour that preselection. Otherwise default to "all selected"
          // so existing behaviour for the main Collect button is unchanged.
          if (pendingComponentPreselection && pendingComponentPreselection.length > 0) {
            setSelectedComponentCodes(new Set(pendingComponentPreselection));
            setPendingComponentPreselection(null);
          } else {
            setSelectedComponentCodes(
              new Set((details.components || []).map((c) => c.componentCode))
            );
          }
        }
      })
      .catch((err) => {
        console.error('Failed to load fee assignment details:', err);
      })
      .finally(() => {
        if (!cancelled) setLoadingAssignment(false);
      });
    return () => {
      cancelled = true;
    };
  }, [paymentDialogOpen, selectedAssignmentId]);

  // When the admin ticks/unticks components, recompute the payment amount
  // automatically. We cap at the assignment's outstanding balance so picking
  // every component on a partially paid assignment never overcollects.
  useEffect(() => {
    if (!assignmentDetails) return;
    const components = assignmentDetails.components || [];
    if (components.length === 0) return;

    const allSelected =
      selectedComponentCodes.size === components.length &&
      components.every((c) => selectedComponentCodes.has(c.componentCode));

    if (allSelected) {
      // Collecting everything → use the actual outstanding balance (which
      // accounts for any prior partial payments).
      setPaymentAmount(String(assignmentDetails.summary.balance));
    } else {
      const sum = components
        .filter((c) => selectedComponentCodes.has(c.componentCode))
        .reduce((acc, c) => acc + (c.totalAmount || 0), 0);
      // Don't let the picked total exceed what's still due.
      const capped = Math.min(sum, assignmentDetails.summary.balance);
      setPaymentAmount(String(capped));
    }
  }, [selectedComponentCodes, assignmentDetails]);

  // Transactions tab state
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isLoadingTransactions, setIsLoadingTransactions] = useState(false);
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);
  const [transactionDialogOpen, setTransactionDialogOpen] = useState(false);
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [dateRange, setDateRange] = useState('today');
  const [paymentModeFilter, setPaymentModeFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [isSyncing, setIsSyncing] = useState(false);
  const [currentBatchId, setCurrentBatchId] = useState<string>('');

  // Class/section filters (shared between Collect & Transactions tabs)
  const [classOptions, setClassOptions] = useState<
    Array<{ _id: string; displayName: string; sections?: Array<{ _id: string; name: string }> }>
  >([]);
  const [filterClassId, setFilterClassId] = useState<string>('all');
  const [filterSectionId, setFilterSectionId] = useState<string>('all');
  const [filterSections, setFilterSections] = useState<Array<{ _id: string; name: string }>>([]);

  // Load classes once
  useEffect(() => {
    academicApi
      .getClasses()
      .then((res) => {
        if (res.success && res.data) setClassOptions(res.data);
      })
      .catch(() => {});
  }, []);

  // Load sections when class changes
  useEffect(() => {
    if (filterClassId !== 'all') {
      const cls = classOptions.find((c) => c._id === filterClassId);
      if (cls?.sections && cls.sections.length > 0) {
        setFilterSections(cls.sections);
      } else {
        academicApi
          .getSections({ classId: filterClassId })
          .then((res) => {
            if (res.success && res.data) setFilterSections(res.data);
          })
          .catch(() => setFilterSections([]));
      }
    } else {
      setFilterSections([]);
      setFilterSectionId('all');
    }
  }, [filterClassId, classOptions]);

  // Fetch current academic batch
  useEffect(() => {
    academicApi
      .getCurrentBatch()
      .then((res) => {
        if (res.success && res.data?._id) {
          setCurrentBatchId(res.data._id);
        }
      })
      .catch(() => {});
  }, []);

  const handleSync = async () => {
    if (!currentBatchId) {
      toast.error('No active academic batch found');
      return;
    }
    setIsSyncing(true);
    try {
      const response = await financeApi.syncFeeAssignments(currentBatchId);
      if (response.success) {
        const {
          assigned,
          appliedByStructure = [],
        }: {
          assigned: number;
          appliedByStructure?: Array<{
            structureId: string;
            structureName: string;
            code: string;
            count: number;
          }>;
        } = response.data;

        if (assigned > 0) {
          // Build a multi-line breakdown so the cashier can see exactly
          // which fee structures were applied and to how many students.
          const top = appliedByStructure.slice(0, 6);
          const rest = appliedByStructure.length - top.length;
          const description =
            top.map((s) => `• ${s.structureName} → ${s.count}`).join('\n') +
            (rest > 0 ? `\n…and ${rest} more` : '');
          toast.success(
            `Synced ${assigned} new assignment${assigned === 1 ? '' : 's'}`,
            description ? { description } : undefined
          );
          await Promise.all([fetchStudents(), fetchStats()]);
        } else {
          toast.info('All students are already in sync');
        }
      } else {
        toast.error(response.error?.message || 'Sync failed');
      }
    } catch {
      toast.error('Failed to sync fee assignments');
    } finally {
      setIsSyncing(false);
    }
  };

  // Fetch functions
  const fetchStudents = useCallback(async () => {
    try {
      const response = await financeApi.searchStudentsForFeeCounter({
        search: searchQuery || undefined,
        classId: filterClassId !== 'all' ? filterClassId : undefined,
        sectionId: filterSectionId !== 'all' ? filterSectionId : undefined,
      });
      if (response.success) {
        setStudents(response.data || []);
      }
    } catch (error) {
      console.error('Failed to fetch students:', error);
    }
  }, [searchQuery, filterClassId, filterSectionId]);

  const fetchStats = useCallback(async () => {
    try {
      const response = await financeApi.getFeeCounterStats();
      if (response.success) {
        setStats(response.data);
      }
    } catch (error) {
      console.error('Failed to fetch stats:', error);
    }
  }, []);

  const fetchTransactions = useCallback(async () => {
    setIsLoadingTransactions(true);
    try {
      const params: Record<string, string> = {};
      if (paymentModeFilter !== 'all') params.paymentMode = paymentModeFilter;
      if (statusFilter !== 'all') params.status = statusFilter;
      if (filterClassId !== 'all') params.classId = filterClassId;
      if (filterSectionId !== 'all') params.sectionId = filterSectionId;

      const today = new Date();
      if (dateRange === 'today') {
        params.fromDate = today.toISOString().split('T')[0];
        params.toDate = today.toISOString().split('T')[0];
      } else if (dateRange === 'week') {
        const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
        params.fromDate = weekAgo.toISOString().split('T')[0];
        params.toDate = today.toISOString().split('T')[0];
      } else if (dateRange === 'month') {
        const monthAgo = new Date(today.getFullYear(), today.getMonth(), 1);
        params.fromDate = monthAgo.toISOString().split('T')[0];
        params.toDate = today.toISOString().split('T')[0];
      }

      const response = await financeApi.getTransactions(params);
      if (response.success) {
        setTransactions(response.data?.data || response.data || []);
      }
    } catch (error) {
      console.error('Failed to fetch transactions:', error);
    } finally {
      setIsLoadingTransactions(false);
    }
  }, [dateRange, paymentModeFilter, statusFilter, filterClassId, filterSectionId]);

  // Initial load
  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      await Promise.all([fetchStudents(), fetchStats()]);
      setIsLoading(false);
    };
    loadData();
  }, [fetchStudents, fetchStats]);

  // Load tab data on tab change
  useEffect(() => {
    if (activeTab === 'transactions' && transactions.length === 0) {
      fetchTransactions();
    }
  }, [activeTab, transactions.length, fetchTransactions]);

  // Refetch on filter changes
  useEffect(() => {
    if (activeTab === 'transactions' && !isLoadingTransactions) {
      fetchTransactions();
    }
  }, [dateRange, paymentModeFilter, statusFilter, filterClassId, filterSectionId]);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      if (!isLoading) {
        fetchStudents();
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery, fetchStudents, isLoading]);

  // Handlers
  const getInitials = (name: string) =>
    name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase();

  const handleCollectFee = (student: Student) => {
    setSelectedStudent(student);
    // If student has multiple assignments, default to first with balance
    const firstWithDue = student.assignments?.find((a) => a.dueAmount > 0);
    if (firstWithDue) {
      setSelectedAssignmentId(firstWithDue._id);
      setPaymentAmount(firstWithDue.dueAmount.toString());
    } else {
      setSelectedAssignmentId(student.assignmentId);
      setPaymentAmount(student.dueAmount.toString());
    }
    setPaymentDialogOpen(true);
  };

  // Open the dialog scoped to one specific fee assignment (e.g. just transport).
  // Used when a student has multiple fee types and the admin clicks the
  // per-type Collect button on the expanded row.
  const handleCollectAssignment = (student: Student, assignment: StudentAssignment) => {
    setSelectedStudent(student);
    setSelectedAssignmentId(assignment._id);
    setPaymentAmount(String(assignment.dueAmount));
    setPaymentDialogOpen(true);
  };

  // Open the dialog with a SINGLE component pre-ticked. Used by the inline
  // breakdown chips so the cashier can collect just one component (e.g.
  // "Tuition Fee" or "Transport Fee") with one click.
  const handleCollectComponent = (
    student: Student,
    assignment: StudentAssignment,
    componentCode: string
  ) => {
    setSelectedStudent(student);
    setSelectedAssignmentId(assignment._id);
    setPendingComponentPreselection([componentCode]);
    // The exact amount will be recalculated by the dialog's useEffect once
    // assignmentDetails loads, but seed it with the component's snapshotted
    // amount so the field isn't blank during the brief load.
    const comp = (assignment.components || []).find((c) => c.componentCode === componentCode);
    setPaymentAmount(String(comp?.totalAmount ?? assignment.dueAmount));
    setPaymentDialogOpen(true);
  };

  // Collect every outstanding assignment for a student in one go. Loops the
  // existing per-assignment collectFee endpoint so server-side accounting,
  // receipts and audit trail stay consistent with the regular flow.
  const handleCollectAllForStudent = async (student: Student) => {
    const dueAssignments = (student.assignments || []).filter((a) => a.dueAmount > 0);
    if (dueAssignments.length === 0) {
      toast.info('No outstanding dues for this student');
      return;
    }

    const totalDue = dueAssignments.reduce((acc, a) => acc + a.dueAmount, 0);
    const ok = window.confirm(
      `Collect ALL outstanding fees for ${student.name}?\n\n` +
        dueAssignments
          .map(
            (a) =>
              `• ${a.type[0].toUpperCase() + a.type.slice(1)} Fee: ₹${a.dueAmount.toLocaleString()}`
          )
          .join('\n') +
        `\n\nTotal: ₹${totalDue.toLocaleString()} (Cash)`
    );
    if (!ok) return;

    setIsProcessing(true);
    let collectedTotal = 0;
    let failures = 0;
    const receiptIds: string[] = [];
    let lastReceiptNumber: string | undefined;
    let lastIssuer: FeeCollectedDetails['issuer'];
    try {
      for (const a of dueAssignments) {
        try {
          const res = await financeApi.collectFee({
            studentId: student._id,
            assignmentId: a._id,
            amount: a.dueAmount,
            paymentMode: 'cash',
          });
          if (res.success) {
            collectedTotal += a.dueAmount;
            if (res.data?._id) receiptIds.push(res.data._id);
            if (res.data?.receiptNumber) lastReceiptNumber = res.data.receiptNumber;
            if (res.data?.issuer) lastIssuer = res.data.issuer;
          } else {
            failures += 1;
          }
        } catch (err) {
          console.error(`Collect-all failed for assignment ${a._id}:`, err);
          failures += 1;
        }
      }

      if (collectedTotal > 0) {
        setCelebration({
          studentName: student.name,
          amount: collectedTotal,
          paymentMode: 'cash',
          receiptNumber: lastReceiptNumber,
          issuer: lastIssuer,
          transactionId: receiptIds[receiptIds.length - 1],
          receiptCount: receiptIds.length,
        });
      }
      if (collectedTotal > 0 && failures > 0) {
        // The celebration shows what went through; flag what didn't.
        toast.warning(
          `${failures} fee${failures === 1 ? '' : 's'} for ${student.name} failed to collect`
        );
      } else if (collectedTotal === 0) {
        toast.error('Failed to collect any fees');
      }

      await Promise.all([fetchStudents(), fetchStats(), fetchTransactions()]);
    } finally {
      setIsProcessing(false);
    }
  };

  const handlePaymentSubmit = async () => {
    if (!selectedStudent) return;

    setIsProcessing(true);
    try {
      // Razorpay online payment flow
      if (paymentMethod === 'razorpay') {
        const keyId = process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID;
        if (!keyId) {
          toast.error('Online payment is not configured. Please contact admin.');
          setIsProcessing(false);
          return;
        }

        const initResponse = await financeApi.initiateOnlinePayment({
          studentId: selectedStudent._id,
          assignmentId: selectedAssignmentId || selectedStudent.assignmentId,
          amount: Number(paymentAmount),
        });

        if (!initResponse.success) {
          toast.error(initResponse.error?.message || 'Failed to initiate payment');
          setIsProcessing(false);
          return;
        }

        const { orderId, amount: orderAmount, currency } = initResponse.data;

        const paymentResponse = await openCheckout({
          key: keyId,
          amount: orderAmount,
          currency: currency || 'INR',
          name: 'Campus Verse',
          description: `Fee payment for ${selectedStudent.name}`,
          order_id: orderId,
          handler: () => {},
          prefill: { name: selectedStudent.name },
          theme: { color: '#6366f1' },
        });

        if (!paymentResponse) {
          toast.info('Payment cancelled');
          setIsProcessing(false);
          return;
        }

        const verifyResponse = await financeApi.verifyOnlinePayment({
          orderId: paymentResponse.razorpay_order_id,
          paymentId: paymentResponse.razorpay_payment_id,
          signature: paymentResponse.razorpay_signature,
        });

        if (verifyResponse.success) {
          setCelebration({
            studentName: selectedStudent.name,
            amount: Number(paymentAmount),
            paymentMode: 'razorpay',
            online: true,
            receiptNumber: verifyResponse.data?.receiptNumber,
            issuer: verifyResponse.data?.issuer,
            transactionId: verifyResponse.data?._id,
          });
          setPaymentDialogOpen(false);
          setSelectedStudent(null);
          setPaymentAmount('');
          // Always refetch all three so "Today's Collection", student dues, and
          // the Transactions list reflect the new payment immediately —
          // regardless of whether the user has visited the Transactions tab yet.
          await Promise.all([fetchStudents(), fetchStats(), fetchTransactions()]);
        } else {
          toast.error(verifyResponse.error?.message || 'Payment verification failed');
        }
        setIsProcessing(false);
        return;
      }

      // Build the components array from the admin's selection. Only includes
      // ticked items so receipts show exactly what was collected (e.g.
      // "Transport Fee" or "Lab + Library").
      const pickedComponents =
        assignmentDetails?.components
          ?.filter((c) => selectedComponentCodes.has(c.componentCode))
          .map((c) => ({
            componentCode: c.componentCode,
            name: c.name,
            amount: c.totalAmount,
          })) || [];

      // Standard payment modes (cash, card, upi, online)
      const response = await financeApi.collectFee({
        studentId: selectedStudent._id,
        assignmentId: selectedAssignmentId || selectedStudent.assignmentId,
        amount: Number(paymentAmount),
        paymentMode: paymentMethod as 'cash' | 'card' | 'upi' | 'online',
        components: pickedComponents.length > 0 ? pickedComponents : undefined,
      });

      if (response.success) {
        setCelebration({
          studentName: selectedStudent.name,
          amount: Number(paymentAmount),
          paymentMode: paymentMethod,
          online: paymentMethod === 'online',
          receiptNumber: response.data?.receiptNumber,
          issuer: response.data?.issuer,
          transactionId: response.data?._id,
        });
        setPaymentDialogOpen(false);
        setSelectedStudent(null);
        setPaymentAmount('');
        // Always refetch all three so "Today's Collection", student dues, and
        // the Transactions list reflect the new payment immediately —
        // regardless of whether the user has visited the Transactions tab yet.
        await Promise.all([fetchStudents(), fetchStats(), fetchTransactions()]);
      } else {
        toast.error(response.error?.message || 'Failed to collect payment');
      }
    } catch (error) {
      toast.error('Failed to collect payment');
      console.error('Payment error:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCancelTransaction = async () => {
    if (!selectedTransaction || !cancelReason.trim()) {
      toast.error('Please provide a reason for cancellation');
      return;
    }

    setIsProcessing(true);
    try {
      const response = await financeApi.cancelTransaction(selectedTransaction._id, cancelReason);
      if (response.success) {
        toast.success('Transaction cancelled successfully');
        setCancelDialogOpen(false);
        setCancelReason('');
        setSelectedTransaction(null);
        await Promise.all([fetchTransactions(), fetchStats()]);
      } else {
        toast.error(response.error?.message || 'Failed to cancel transaction');
      }
    } catch (error) {
      toast.error('Failed to cancel transaction');
      console.error('Cancel error:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  const formatCurrency = (amount: number) => {
    if (amount >= 100000) {
      return `₹${(amount / 100000).toFixed(1)}L`;
    }
    return `₹${amount.toLocaleString()}`;
  };

  // Transaction columns
  const transactionColumns: Column<Transaction>[] = [
    {
      key: 'receiptNo',
      header: 'Receipt',
      sortable: true,
      cell: (row) => (
        <div className="flex items-center gap-3">
          <div
            className={`h-10 w-10 rounded-lg flex items-center justify-center ${
              row.status === 'completed'
                ? 'bg-success/10'
                : row.status === 'cancelled'
                  ? 'bg-destructive/10'
                  : 'bg-warning/10'
            }`}
          >
            <Receipt
              className={`h-5 w-5 ${
                row.status === 'completed'
                  ? 'text-success'
                  : row.status === 'cancelled'
                    ? 'text-destructive'
                    : 'text-warning'
              }`}
            />
          </div>
          <p className="font-medium font-mono">{row.receiptNo}</p>
        </div>
      ),
    },
    {
      key: 'studentName',
      header: 'Student',
      cell: (row) => (
        <div className="flex items-center gap-3">
          <Avatar className="h-8 w-8">
            <AvatarFallback className="bg-primary/10 text-primary text-xs">
              {getInitials(row.studentName)}
            </AvatarFallback>
          </Avatar>
          <div>
            <p className="text-sm font-medium">{row.studentName}</p>
            <p className="text-xs text-muted-foreground">
              Class {row.class}-{row.section}
            </p>
          </div>
        </div>
      ),
    },
    {
      key: 'feeType',
      header: 'Fee Type',
      cell: (row) => {
        const components = row.components || [];
        if (components.length === 0) {
          return <span className="text-sm text-muted-foreground">{row.feeType || '—'}</span>;
        }
        return (
          <div className="flex flex-wrap gap-1 max-w-[240px]">
            {components.slice(0, 3).map((c, i) => (
              <Badge
                key={`${c.componentCode}-${i}`}
                variant="outline"
                className="text-xs font-normal"
              >
                {c.name}
              </Badge>
            ))}
            {components.length > 3 && (
              <Badge variant="outline" className="text-xs font-normal">
                +{components.length - 3}
              </Badge>
            )}
          </div>
        );
      },
    },
    {
      key: 'installmentNumbers',
      header: 'Installment',
      cell: (row) => {
        const nums = row.installmentNumbers || [];
        if (nums.length === 0) {
          return <span className="text-xs text-muted-foreground">—</span>;
        }
        return (
          <div className="flex flex-wrap gap-1">
            {nums.map((n) => (
              <Badge
                key={n}
                variant="secondary"
                className="text-xs bg-primary/10 text-primary border-primary/20"
              >
                #{n}
              </Badge>
            ))}
          </div>
        );
      },
    },
    {
      key: 'amount',
      header: 'Amount',
      sortable: true,
      cell: (row) => (
        <div className="flex items-center gap-1 font-semibold">
          <IndianRupee className="h-4 w-4 text-muted-foreground" />
          {row.amount.toLocaleString()}
        </div>
      ),
    },
    {
      key: 'paymentMode',
      header: 'Mode',
      cell: (row) => {
        const Icon = paymentModeIcons[row.paymentMode] || Receipt;
        return (
          <div className="flex items-center gap-2">
            <Icon className="h-4 w-4 text-muted-foreground" />
            <span className="capitalize">{row.paymentMode}</span>
          </div>
        );
      },
    },
    {
      key: 'date',
      header: 'Date',
      sortable: true,
      cell: (row) => (
        <div className="text-sm">
          <p>
            {new Date(row.date).toLocaleDateString('en-IN', {
              day: 'numeric',
              month: 'short',
            })}
          </p>
          <p className="text-muted-foreground text-xs">
            {new Date(row.date).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
          </p>
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      cell: (row) => (
        <Badge
          variant="secondary"
          className={`capitalize ${
            row.status === 'completed'
              ? 'bg-success/10 text-success border-success/20'
              : row.status === 'cancelled'
                ? 'bg-destructive/10 text-destructive border-destructive/20'
                : 'bg-warning/10 text-warning border-warning/20'
          }`}
        >
          {row.status}
        </Badge>
      ),
    },
  ];

  const transactionActions: DataTableAction<Transaction>[] = [
    {
      label: 'View Details',
      icon: <Eye className="mr-2 h-4 w-4" />,
      onClick: (row) => {
        setSelectedTransaction(row);
        setTransactionDialogOpen(true);
      },
    },
    {
      label: 'Print Receipt',
      icon: <Printer className="mr-2 h-4 w-4" />,
      onClick: (row) => {
        printReceipt(row._id);
      },
    },
    {
      label: 'Cancel',
      icon: <XCircle className="mr-2 h-4 w-4" />,
      onClick: (row) => {
        setSelectedTransaction(row);
        setCancelDialogOpen(true);
      },
      variant: 'destructive',
      disabled: (row) => row.status !== 'completed',
    },
  ];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[50vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary via-primary/95 to-primary/80 p-6 text-white">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-0 right-0 w-64 h-64 bg-white rounded-full blur-3xl" />
        </div>
        <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-white/70" />
              <span className="text-white/70 text-sm font-medium">
                {new Date().toLocaleDateString('en-US', {
                  weekday: 'long',
                  month: 'long',
                  day: 'numeric',
                })}
              </span>
            </div>
            <h1 className="text-2xl font-semibold">Fee Counter</h1>
            <p className="text-white/70 text-sm">Collect fees, view transactions & manage dues</p>
          </div>
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="sm"
              className="text-white/70 hover:text-white hover:bg-white/10"
              onClick={handleSync}
              disabled={isSyncing}
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${isSyncing ? 'animate-spin' : ''}`} />
              {isSyncing ? 'Syncing...' : 'Sync'}
            </Button>
            <div className="text-right">
              <p className="text-white/60 text-xs">Today&apos;s Collection</p>
              <p className="text-xl font-bold">{formatCurrency(stats?.todayCollection || 0)}</p>
            </div>
            <div className="h-12 w-12 rounded-xl bg-white/10 flex items-center justify-center">
              <Receipt className="h-6 w-6" />
            </div>
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card className="border">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Collected Today</p>
                <p className="text-2xl font-bold text-emerald-600">
                  {formatCurrency(stats?.todayCollection || 0)}
                </p>
              </div>
              <div className="h-10 w-10 rounded-xl bg-emerald-500/10 flex items-center justify-center">
                <TrendingUp className="h-5 w-5 text-emerald-600" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Collected</p>
                <p className="text-2xl font-bold">{formatCurrency(stats?.totalCollected || 0)}</p>
              </div>
              <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <Wallet className="h-5 w-5 text-primary" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Pending Dues</p>
                <p className="text-2xl font-bold text-amber-600">
                  {formatCurrency(stats?.pendingDues || 0)}
                </p>
              </div>
              <div className="h-10 w-10 rounded-xl bg-amber-500/10 flex items-center justify-center">
                <AlertCircle className="h-5 w-5 text-amber-600" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Students Cleared</p>
                <p className="text-2xl font-bold">
                  {stats?.studentsCleared || 0}
                  <span className="text-base text-muted-foreground">
                    /{stats?.totalStudents || 0}
                  </span>
                </p>
              </div>
              <div className="h-10 w-10 rounded-xl bg-blue-500/10 flex items-center justify-center">
                <CheckCircle className="h-5 w-5 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="bg-muted p-1">
          <TabsTrigger
            value="collect"
            className="gap-2 data-[state=active]:bg-white data-[state=active]:shadow-sm"
          >
            <Wallet className="h-4 w-4" />
            Collect
          </TabsTrigger>
          <TabsTrigger
            value="transactions"
            className="gap-2 data-[state=active]:bg-white data-[state=active]:shadow-sm"
          >
            <FileText className="h-4 w-4" />
            Transactions
            {transactions.length > 0 && (
              <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-xs">
                {transactions.length}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        {/* Collect Tab */}
        <TabsContent value="collect" className="space-y-4 m-0">
          <Card className="border">
            <CardHeader className="pb-4 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                  <CardTitle className="text-lg">Collect Fee</CardTitle>
                  <p className="text-sm text-muted-foreground mt-1">
                    Search for a student to collect fee
                  </p>
                </div>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search by name or student ID..."
                    className="pl-9 w-80 bg-muted/50 border-transparent focus:bg-white focus:border-border"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-2">
                  <Label className="text-sm">Class:</Label>
                  <Select value={filterClassId} onValueChange={setFilterClassId}>
                    <SelectTrigger className="w-44">
                      <SelectValue placeholder="All classes" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All classes</SelectItem>
                      {classOptions.map((cls) => (
                        <SelectItem key={cls._id} value={cls._id}>
                          {cls.displayName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {filterClassId !== 'all' && filterSections.length > 0 && (
                  <div className="flex items-center gap-2">
                    <Label className="text-sm">Section:</Label>
                    <Select value={filterSectionId} onValueChange={setFilterSectionId}>
                      <SelectTrigger className="w-36">
                        <SelectValue placeholder="All sections" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All sections</SelectItem>
                        {filterSections.map((sec) => (
                          <SelectItem key={sec._id} value={sec._id}>
                            {sec.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                {(filterClassId !== 'all' || filterSectionId !== 'all') && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setFilterClassId('all');
                      setFilterSectionId('all');
                    }}
                  >
                    Clear
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {students.length === 0 ? (
                searchQuery ? (
                  <div className="text-center py-12 text-muted-foreground">
                    No students found matching your search
                  </div>
                ) : (
                  <div className="rounded-xl border border-dashed bg-muted/20 p-8 text-center space-y-4">
                    <div className="mx-auto h-12 w-12 rounded-full bg-amber-100 flex items-center justify-center">
                      <AlertCircle className="h-6 w-6 text-amber-600" />
                    </div>
                    <div>
                      <p className="font-semibold text-foreground">
                        No students with fee assignments
                      </p>
                      <p className="text-sm text-muted-foreground mt-1 max-w-md mx-auto">
                        Either no fee structures match your students&apos; grades, or the
                        assignments haven&apos;t been generated yet. Click Sync to find every
                        student in this branch and create assignments from any matching fee
                        structures.
                      </p>
                    </div>
                    <Button onClick={handleSync} disabled={isSyncing} className="gap-2">
                      <RefreshCw className={`h-4 w-4 ${isSyncing ? 'animate-spin' : ''}`} />
                      {isSyncing ? 'Syncing…' : 'Sync now'}
                    </Button>
                  </div>
                )
              ) : (
                <div className="space-y-3">
                  {students.map((student) => {
                    const hasMultipleAssignments = (student.assignments?.length || 0) > 1;
                    // For the inline breakdown row: gather components from
                    // the (single) assignment if there's just one. For
                    // multi-assignment students the per-type rows below
                    // already show each fee type, so we skip the chip row.
                    const singleAssignmentComponents =
                      !hasMultipleAssignments && student.assignments && student.assignments[0]
                        ? student.assignments[0].components || []
                        : [];
                    return (
                      <div
                        key={student._id}
                        className="rounded-xl border hover:border-primary/30 transition-all duration-200 group overflow-hidden"
                      >
                        {/* Student summary header */}
                        <div className="flex items-center justify-between p-4 hover:bg-muted/20">
                          <div className="flex items-center gap-4">
                            <Avatar className="h-12 w-12 ring-2 ring-primary/10">
                              <AvatarFallback className="bg-gradient-to-br from-primary/20 to-primary/10 text-primary font-medium">
                                {getInitials(student.name)}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <p className="font-medium text-foreground group-hover:text-primary transition-colors">
                                {student.name}
                              </p>
                              <p className="text-sm text-muted-foreground">
                                {student.studentId} | Class {student.class}-{student.section}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-6">
                            <div className="text-right">
                              <p className="text-sm text-muted-foreground">Total Fee</p>
                              <p className="font-semibold">₹{student.totalFee.toLocaleString()}</p>
                            </div>
                            <div className="text-right">
                              <p className="text-sm text-muted-foreground">Due Amount</p>
                              <p
                                className={`font-semibold ${
                                  student.dueAmount > 0 ? 'text-destructive' : 'text-success'
                                }`}
                              >
                                ₹{student.dueAmount.toLocaleString()}
                              </p>
                            </div>
                            <Badge
                              variant="secondary"
                              className={`capitalize ${
                                student.status === 'paid'
                                  ? 'bg-success/10 text-success border-success/20'
                                  : student.status === 'partial'
                                    ? 'bg-warning/10 text-warning border-warning/20'
                                    : 'bg-destructive/10 text-destructive border-destructive/20'
                              }`}
                            >
                              {student.status}
                            </Badge>
                            {/* Single-assignment students keep the simple header button.
                                Multi-assignment students get a "Collect All" header button
                                in addition to the per-type buttons below. */}
                            {!hasMultipleAssignments ? (
                              <Button
                                onClick={() => handleCollectFee(student)}
                                disabled={student.dueAmount === 0}
                                className="gap-2"
                              >
                                <IndianRupee className="h-4 w-4" />
                                Collect
                              </Button>
                            ) : (
                              <Button
                                onClick={() => handleCollectAllForStudent(student)}
                                disabled={student.dueAmount === 0 || isProcessing}
                                className="gap-2"
                              >
                                {isProcessing ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <IndianRupee className="h-4 w-4" />
                                )}
                                Collect All
                              </Button>
                            )}
                          </div>
                        </div>

                        {/* Inline component breakdown for single-assignment
                            students. Each row has the fee details on the
                            left and a Collect button on the right so the
                            cashier can pay individual fees with one click.
                            The main "Collect" button (above) still collects
                            everything together. */}
                        {!hasMultipleAssignments && singleAssignmentComponents.length > 0 && (
                          <div className="border-t bg-muted/10 divide-y divide-border/40">
                            <div className="px-4 py-2 flex items-center justify-between">
                              <span className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">
                                Fee Components
                              </span>
                              <span className="text-[11px] text-muted-foreground">
                                Pay individually below or use{' '}
                                <span className="font-medium">Collect</span> above for everything
                              </span>
                            </div>
                            {singleAssignmentComponents.map((c) => {
                              const isOptional = c.type === 'optional';
                              const assignment = student.assignments?.[0];
                              return (
                                <div
                                  key={c.componentCode}
                                  className="flex items-center justify-between gap-4 px-4 py-2.5 hover:bg-muted/20 transition-colors"
                                >
                                  <div className="flex items-center gap-3 min-w-0">
                                    <div
                                      className={`h-8 w-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                                        isOptional
                                          ? 'bg-violet-100 text-violet-600'
                                          : 'bg-blue-100 text-blue-600'
                                      }`}
                                    >
                                      <Receipt className="h-4 w-4" />
                                    </div>
                                    <div className="min-w-0">
                                      <div className="flex items-center gap-2">
                                        <p className="font-medium text-sm">{c.name}</p>
                                        {isOptional ? (
                                          <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-violet-100 text-violet-700 border border-violet-200">
                                            Optional
                                          </span>
                                        ) : (
                                          <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 border border-blue-200">
                                            Mandatory
                                          </span>
                                        )}
                                      </div>
                                      <p className="text-[11px] text-muted-foreground">
                                        {c.componentCode}
                                      </p>
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-4 shrink-0">
                                    <div className="text-right">
                                      <p className="text-[11px] text-muted-foreground">Amount</p>
                                      <p className="text-sm font-semibold">
                                        ₹{c.totalAmount.toLocaleString()}
                                      </p>
                                    </div>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      className="gap-1.5"
                                      disabled={!assignment || assignment.dueAmount === 0}
                                      onClick={() => {
                                        if (assignment) {
                                          handleCollectComponent(
                                            student,
                                            assignment,
                                            c.componentCode
                                          );
                                        }
                                      }}
                                    >
                                      <IndianRupee className="h-3.5 w-3.5" />
                                      Collect
                                    </Button>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}

                        {/* Per-fee-type collect rows for multi-assignment students */}
                        {hasMultipleAssignments && student.assignments && (
                          <div className="border-t bg-muted/20 divide-y divide-border/40">
                            {student.assignments.map((a) => {
                              const isCleared = a.dueAmount === 0;
                              return (
                                <div
                                  key={a._id}
                                  className="flex items-center justify-between gap-4 px-4 py-2.5"
                                >
                                  <div className="flex items-center gap-3 min-w-0">
                                    <div
                                      className={`h-8 w-8 rounded-lg flex items-center justify-center ${
                                        a.type === 'hostel'
                                          ? 'bg-purple-100 text-purple-600'
                                          : a.type === 'transport'
                                            ? 'bg-amber-100 text-amber-600'
                                            : a.type === 'tuition'
                                              ? 'bg-blue-100 text-blue-600'
                                              : 'bg-muted text-muted-foreground'
                                      }`}
                                    >
                                      <Receipt className="h-4 w-4" />
                                    </div>
                                    <div>
                                      <p className="text-sm font-medium capitalize">{a.type} Fee</p>
                                      <p className="text-[11px] text-muted-foreground">
                                        Total ₹{a.totalFee.toLocaleString()} · Paid ₹
                                        {a.paidAmount.toLocaleString()}
                                      </p>
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-3 shrink-0">
                                    <div className="text-right">
                                      <p className="text-[11px] text-muted-foreground">Due</p>
                                      <p
                                        className={`text-sm font-semibold ${
                                          isCleared ? 'text-success' : 'text-destructive'
                                        }`}
                                      >
                                        ₹{a.dueAmount.toLocaleString()}
                                      </p>
                                    </div>
                                    <Button
                                      size="sm"
                                      variant={isCleared ? 'outline' : 'default'}
                                      onClick={() => handleCollectAssignment(student, a)}
                                      disabled={isCleared}
                                      className="gap-1.5"
                                    >
                                      {isCleared ? (
                                        <>
                                          <CheckCircle className="h-3.5 w-3.5" />
                                          Cleared
                                        </>
                                      ) : (
                                        <>
                                          <IndianRupee className="h-3.5 w-3.5" />
                                          Collect
                                        </>
                                      )}
                                    </Button>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Transactions Tab */}
        <TabsContent value="transactions" className="space-y-4 m-0">
          {/* Filters */}
          <div className="flex flex-wrap gap-4">
            <div className="flex items-center gap-2">
              <Label className="text-sm">Date Range:</Label>
              <Select value={dateRange} onValueChange={setDateRange}>
                <SelectTrigger className="w-36">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="today">Today</SelectItem>
                  <SelectItem value="week">This Week</SelectItem>
                  <SelectItem value="month">This Month</SelectItem>
                  <SelectItem value="all">All Time</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <Label className="text-sm">Mode:</Label>
              <Select value={paymentModeFilter} onValueChange={setPaymentModeFilter}>
                <SelectTrigger className="w-28">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="cash">Cash</SelectItem>
                  <SelectItem value="card">Card</SelectItem>
                  <SelectItem value="upi">UPI</SelectItem>
                  <SelectItem value="online">Online</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <Label className="text-sm">Status:</Label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                  <SelectItem value="refunded">Refunded</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <Label className="text-sm">Class:</Label>
              <Select value={filterClassId} onValueChange={setFilterClassId}>
                <SelectTrigger className="w-44">
                  <SelectValue placeholder="All classes" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All classes</SelectItem>
                  {classOptions.map((cls) => (
                    <SelectItem key={cls._id} value={cls._id}>
                      {cls.displayName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {filterClassId !== 'all' && filterSections.length > 0 && (
              <div className="flex items-center gap-2">
                <Label className="text-sm">Section:</Label>
                <Select value={filterSectionId} onValueChange={setFilterSectionId}>
                  <SelectTrigger className="w-36">
                    <SelectValue placeholder="All sections" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All sections</SelectItem>
                    {filterSections.map((sec) => (
                      <SelectItem key={sec._id} value={sec._id}>
                        {sec.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          {isLoadingTransactions ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : (
            <DataTable
              data={transactions}
              columns={transactionColumns}
              actions={transactionActions}
              searchable
              searchPlaceholder="Search by receipt no, student name..."
            />
          )}
        </TabsContent>
      </Tabs>

      {/* Payment Dialog */}
      <Dialog open={paymentDialogOpen} onOpenChange={setPaymentDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl">Collect Fee Payment</DialogTitle>
            <DialogDescription>Record fee payment for {selectedStudent?.name}</DialogDescription>
          </DialogHeader>

          {selectedStudent && (
            <div className="space-y-6">
              <div className="flex items-center gap-4 p-4 bg-muted/30 rounded-xl">
                <Avatar className="h-12 w-12 ring-2 ring-primary/10">
                  <AvatarFallback className="bg-gradient-to-br from-primary/20 to-primary/10 text-primary font-medium">
                    {getInitials(selectedStudent.name)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <p className="font-medium">{selectedStudent.name}</p>
                  <p className="text-sm text-muted-foreground">{selectedStudent.studentId}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-muted-foreground">Due Amount</p>
                  <p className="font-semibold text-destructive">
                    ₹{selectedStudent.dueAmount.toLocaleString()}
                  </p>
                </div>
              </div>

              {/* Assignment selector for students with multiple fee types */}
              {selectedStudent.assignments && selectedStudent.assignments.length > 1 && (
                <div className="space-y-2">
                  <Label>Fee Type</Label>
                  <div className="space-y-2">
                    {selectedStudent.assignments
                      .filter((a) => a.dueAmount > 0)
                      .map((a) => (
                        <button
                          key={a._id}
                          type="button"
                          className={`w-full flex items-center justify-between p-3 rounded-lg border text-left transition-colors ${
                            selectedAssignmentId === a._id
                              ? 'border-primary bg-primary/5'
                              : 'border-border hover:border-primary/30'
                          }`}
                          onClick={() => {
                            setSelectedAssignmentId(a._id);
                            setPaymentAmount(a.dueAmount.toString());
                          }}
                        >
                          <div>
                            <p className="font-medium capitalize text-sm">{a.type} Fee</p>
                            <p className="text-xs text-muted-foreground">
                              Total: ₹{a.totalFee.toLocaleString()} | Paid: ₹
                              {a.paidAmount.toLocaleString()}
                            </p>
                          </div>
                          <p className="font-semibold text-destructive">
                            ₹{a.dueAmount.toLocaleString()}
                          </p>
                        </button>
                      ))}
                  </div>
                </div>
              )}

              {/* Price breakdown — components and installments for the selected assignment */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Fee Breakdown</Label>
                  <div className="flex items-center gap-3 text-[11px]">
                    {assignmentDetails?.components && assignmentDetails.components.length > 0 && (
                      <>
                        <button
                          type="button"
                          className="text-primary hover:underline"
                          onClick={() =>
                            setSelectedComponentCodes(
                              new Set(
                                (assignmentDetails.components || []).map((c) => c.componentCode)
                              )
                            )
                          }
                        >
                          Select all
                        </button>
                        <span className="text-muted-foreground">·</span>
                        <button
                          type="button"
                          className="text-primary hover:underline"
                          onClick={() => setSelectedComponentCodes(new Set())}
                        >
                          Clear
                        </button>
                      </>
                    )}
                    {assignmentDetails?.installments &&
                      assignmentDetails.installments.length > 0 && (
                        <span className="text-muted-foreground">
                          · {assignmentDetails.installments.length} installment
                          {assignmentDetails.installments.length === 1 ? '' : 's'}
                        </span>
                      )}
                  </div>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Tick the items you want to collect. The payment amount updates automatically.
                </p>
                {loadingAssignment ? (
                  <div className="rounded-xl border bg-muted/30 p-6 flex items-center justify-center">
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                    <span className="ml-2 text-xs text-muted-foreground">Loading breakdown...</span>
                  </div>
                ) : assignmentDetails ? (
                  <div className="rounded-xl border bg-muted/30 overflow-hidden">
                    {/* Component lines */}
                    {assignmentDetails.components && assignmentDetails.components.length > 0 ? (
                      <div className="divide-y divide-border/40">
                        {assignmentDetails.components.map((c) => {
                          const hasDiscount = (c.discountAmount || 0) > 0;
                          const hasTax = (c.taxAmount || 0) > 0;
                          const isSelected = selectedComponentCodes.has(c.componentCode);
                          const toggle = () => {
                            setSelectedComponentCodes((prev) => {
                              const next = new Set(prev);
                              if (next.has(c.componentCode)) {
                                next.delete(c.componentCode);
                              } else {
                                next.add(c.componentCode);
                              }
                              return next;
                            });
                          };
                          return (
                            <label
                              key={c.componentCode}
                              className={`flex items-start gap-3 px-4 py-2.5 text-sm cursor-pointer transition-colors ${
                                isSelected ? 'bg-primary/5' : 'hover:bg-muted/40'
                              }`}
                            >
                              <Checkbox
                                checked={isSelected}
                                onCheckedChange={toggle}
                                className="mt-0.5"
                              />
                              <div className="min-w-0 flex-1">
                                <p className="font-medium text-foreground">{c.name}</p>
                                {(hasDiscount || hasTax) && (
                                  <p className="text-[11px] text-muted-foreground mt-0.5">
                                    {hasDiscount && (
                                      <span className="text-success">
                                        − ₹{c.discountAmount.toLocaleString()} discount
                                      </span>
                                    )}
                                    {hasDiscount && hasTax && <span className="mx-1">·</span>}
                                    {hasTax && <span>+ ₹{c.taxAmount.toLocaleString()} tax</span>}
                                  </p>
                                )}
                              </div>
                              <div className="text-right shrink-0">
                                {hasDiscount ? (
                                  <>
                                    <p className="text-[11px] text-muted-foreground line-through">
                                      ₹{c.originalAmount.toLocaleString()}
                                    </p>
                                    <p className="font-semibold">
                                      ₹{c.totalAmount.toLocaleString()}
                                    </p>
                                  </>
                                ) : (
                                  <p className="font-semibold">₹{c.totalAmount.toLocaleString()}</p>
                                )}
                              </div>
                            </label>
                          );
                        })}
                      </div>
                    ) : (
                      <p className="px-4 py-3 text-xs text-muted-foreground">
                        No component breakdown available
                      </p>
                    )}

                    {/* Summary footer */}
                    <div className="bg-muted/60 px-4 py-3 space-y-1 border-t">
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>Subtotal</span>
                        <span>₹{assignmentDetails.summary.totalFee.toLocaleString()}</span>
                      </div>
                      {assignmentDetails.summary.totalDiscount > 0 && (
                        <div className="flex items-center justify-between text-xs text-success">
                          <span>Discount</span>
                          <span>− ₹{assignmentDetails.summary.totalDiscount.toLocaleString()}</span>
                        </div>
                      )}
                      {assignmentDetails.summary.totalTax > 0 && (
                        <div className="flex items-center justify-between text-xs text-muted-foreground">
                          <span>Tax</span>
                          <span>+ ₹{assignmentDetails.summary.totalTax.toLocaleString()}</span>
                        </div>
                      )}
                      {assignmentDetails.summary.totalFine > 0 && (
                        <div className="flex items-center justify-between text-xs text-warning">
                          <span>Fine</span>
                          <span>+ ₹{assignmentDetails.summary.totalFine.toLocaleString()}</span>
                        </div>
                      )}
                      <div className="flex items-center justify-between text-sm font-semibold pt-1 border-t border-border/60">
                        <span>Net Payable</span>
                        <span>₹{assignmentDetails.summary.netPayable.toLocaleString()}</span>
                      </div>
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>Already Paid</span>
                        <span>₹{assignmentDetails.summary.totalPaid.toLocaleString()}</span>
                      </div>
                      <div className="flex items-center justify-between text-sm font-bold text-destructive">
                        <span>Balance Due</span>
                        <span>₹{assignmentDetails.summary.balance.toLocaleString()}</span>
                      </div>
                    </div>

                    {/* Installments (compact) */}
                    {assignmentDetails.installments &&
                      assignmentDetails.installments.length > 0 && (
                        <div className="border-t bg-background/40 px-4 py-2.5">
                          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
                            Installments
                          </p>
                          <div className="space-y-1">
                            {assignmentDetails.installments.map((inst) => {
                              const statusColor =
                                inst.status === 'paid'
                                  ? 'text-success'
                                  : inst.status === 'overdue'
                                    ? 'text-destructive'
                                    : inst.status === 'partial'
                                      ? 'text-warning'
                                      : 'text-muted-foreground';
                              return (
                                <div
                                  key={inst.installmentNumber}
                                  className="flex items-center justify-between text-[11px]"
                                >
                                  <span className="text-muted-foreground">
                                    #{inst.installmentNumber} {inst.name} ·{' '}
                                    {new Date(inst.dueDate).toLocaleDateString('en-IN', {
                                      day: 'numeric',
                                      month: 'short',
                                    })}
                                  </span>
                                  <span className={`font-medium ${statusColor}`}>
                                    ₹{inst.balance.toLocaleString()} {inst.status}
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                  </div>
                ) : null}
              </div>

              <div className="space-y-2">
                <Label htmlFor="amount">Payment Amount</Label>
                <div className="relative">
                  <IndianRupee className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="amount"
                    type="number"
                    placeholder="Enter amount"
                    className="pl-9 h-12 text-lg"
                    value={paymentAmount}
                    onChange={(e) => setPaymentAmount(e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Payment Method</Label>
                <div className="grid grid-cols-5 gap-2">
                  {[
                    { id: 'cash', icon: Banknote, label: 'Cash' },
                    { id: 'card', icon: CreditCard, label: 'Card' },
                    { id: 'upi', icon: QrCode, label: 'UPI' },
                    { id: 'online', icon: Wallet, label: 'Online' },
                    { id: 'razorpay', icon: CreditCard, label: 'Pay Online' },
                  ].map((method) => (
                    <button
                      key={method.id}
                      type="button"
                      onClick={() => setPaymentMethod(method.id)}
                      className={`flex flex-col items-center gap-2 p-3 rounded-xl border-2 transition-all ${
                        paymentMethod === method.id
                          ? 'border-primary bg-primary/5'
                          : 'border-border hover:border-primary/30'
                      }`}
                    >
                      <method.icon
                        className={`h-5 w-5 ${paymentMethod === method.id ? 'text-primary' : 'text-muted-foreground'}`}
                      />
                      <span
                        className={`text-xs font-medium ${paymentMethod === method.id ? 'text-primary' : 'text-muted-foreground'}`}
                      >
                        {method.label}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => setPaymentDialogOpen(false)}
                  disabled={isProcessing}
                >
                  Cancel
                </Button>
                <Button
                  className="flex-1 gap-2"
                  onClick={handlePaymentSubmit}
                  disabled={isProcessing || !paymentAmount || Number(paymentAmount) <= 0}
                >
                  {isProcessing ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <CheckCircle className="h-4 w-4" />
                  )}
                  {paymentMethod === 'razorpay' ? 'Pay Online' : 'Collect'} ₹
                  {Number(paymentAmount || 0).toLocaleString()}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Transaction Details Dialog */}
      <Dialog open={transactionDialogOpen} onOpenChange={setTransactionDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Transaction Details</DialogTitle>
            <DialogDescription>Receipt #{selectedTransaction?.receiptNo}</DialogDescription>
          </DialogHeader>

          {selectedTransaction && (
            <div className="space-y-6">
              <div className="flex items-center justify-between p-4 rounded-lg bg-muted/50">
                <div className="flex items-center gap-4">
                  <Avatar className="h-12 w-12">
                    <AvatarFallback className="bg-primary/10 text-primary">
                      {getInitials(selectedTransaction.studentName)}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="font-medium">{selectedTransaction.studentName}</p>
                    <p className="text-sm text-muted-foreground">
                      Class {selectedTransaction.class}-{selectedTransaction.section}
                    </p>
                  </div>
                </div>
                <Badge
                  className={
                    selectedTransaction.status === 'completed'
                      ? 'bg-success/10 text-success'
                      : selectedTransaction.status === 'cancelled'
                        ? 'bg-destructive/10 text-destructive'
                        : 'bg-warning/10 text-warning'
                  }
                >
                  {selectedTransaction.status}
                </Badge>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 rounded-lg border">
                  <p className="text-sm text-muted-foreground">Amount</p>
                  <p className="text-2xl font-bold">
                    ₹{selectedTransaction.amount.toLocaleString()}
                  </p>
                </div>
                <div className="p-4 rounded-lg border">
                  <p className="text-sm text-muted-foreground">Payment Mode</p>
                  <p className="text-lg font-medium capitalize">
                    {selectedTransaction.paymentMode}
                  </p>
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex justify-between py-2 border-b">
                  <span className="text-muted-foreground">Fee Type</span>
                  <span className="font-medium">{selectedTransaction.feeType}</span>
                </div>
                <div className="flex justify-between py-2 border-b">
                  <span className="text-muted-foreground">Date & Time</span>
                  <span className="font-medium">
                    {new Date(selectedTransaction.date).toLocaleString('en-IN')}
                  </span>
                </div>
                <div className="flex justify-between py-2">
                  <span className="text-muted-foreground">Collected By</span>
                  <span className="font-medium">{selectedTransaction.collectedBy}</span>
                </div>
              </div>

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="flex-1 gap-2"
                  onClick={() => printReceipt(selectedTransaction._id)}
                >
                  <Printer className="h-4 w-4" />
                  Print Receipt
                </Button>
                {selectedTransaction.status === 'completed' && (
                  <Button
                    variant="destructive"
                    className="gap-2"
                    onClick={() => {
                      setTransactionDialogOpen(false);
                      setCancelDialogOpen(true);
                    }}
                  >
                    <XCircle className="h-4 w-4" />
                    Cancel
                  </Button>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Cancel Transaction Dialog */}
      <Dialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Cancel Transaction</DialogTitle>
            <DialogDescription>
              Are you sure you want to cancel this transaction? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="cancelReason">Reason for Cancellation</Label>
              <Textarea
                id="cancelReason"
                placeholder="Enter reason for cancellation..."
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                rows={3}
              />
            </div>

            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setCancelDialogOpen(false);
                  setCancelReason('');
                }}
                disabled={isProcessing}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={handleCancelTransaction}
                disabled={isProcessing || !cancelReason.trim()}
              >
                {isProcessing && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                Confirm Cancellation
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <FeeCollectedCelebration
        details={celebration}
        onClose={() => setCelebration(null)}
        onPrint={printReceipt}
      />
    </div>
  );
}
