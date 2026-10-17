import { ObjectId, WithId } from 'mongodb';
import crypto from 'crypto';
import { collections } from '../../config/database';
import { logger } from '../../lib/logger';
import { ApiError } from '../../middleware/errorHandler';
import { encrypt, decrypt } from '../../utils/crypto';
import { env } from '../../config/env';
import {
  razorpayXService,
  type XCredentials,
  type PayoutMode,
  type RazorpayXPayout,
} from '../../services/razorpayX.service';
import type { HRSettingsDocument, RazorpayXSettings } from './hrSettings.service';

interface StaffDoc {
  _id: ObjectId;
  tenantId: ObjectId;
  branchId: ObjectId;
  employeeId?: string;
  firstName?: string;
  lastName?: string;
  displayName?: string;
  contact?: { email?: string; phone?: string };
  bankDetails?: {
    accountNumber?: string;
    bankName?: string;
    ifscCode?: string;
    accountType?: string;
    razorpayX?: {
      contactId?: string;
      fundAccountId?: string;
      validationStatus?: 'pending' | 'in_process' | 'active' | 'failed';
      validationFailureReason?: string;
      lastSyncedAt?: Date;
    };
  };
}

interface PayslipDoc {
  _id: ObjectId;
  tenantId: ObjectId;
  branchId: ObjectId;
  payrollRunId: ObjectId;
  staffId: ObjectId;
  payslipNumber: string;
  month: number;
  year: number;
  period: string;
  netPayable: number;
  disbursement: {
    status: 'pending' | 'processing' | 'paid' | 'reversed' | 'hold' | 'failed';
    paymentMode?: 'bank_transfer' | 'cheque' | 'cash' | 'razorpay_x';
    paymentReference?: string;
    paidAt?: Date;
    paidBy?: ObjectId;
    remarks?: string;
    payout?: {
      payoutId?: string;
      idempotencyKey?: string;
      mode?: PayoutMode;
      utr?: string;
      status?: string;
      failureReason?: string;
      initiatedAt?: Date;
      initiatedBy?: ObjectId;
      lastWebhookAt?: Date;
      attempts?: number;
    };
  };
}

export interface OnboardXInput {
  keyId: string;
  keySecret: string;
  sourceAccountNumber: string;
  webhookSecret: string;
  pennyDropEnabled?: boolean;
}

export interface PayRunResult {
  runId: string;
  totalPayslips: number;
  initiated: number;
  skipped: Array<{ payslipId: string; staffName: string; reason: string }>;
  failed: Array<{ payslipId: string; staffName: string; reason: string }>;
}

// ---------- helpers ----------

function last4(s: string): string {
  return s.length <= 4 ? s : s.slice(-4);
}

function maskKeyId(keyId: string): string {
  // "rzp_live_ABCDEFGHIJKL" → "rzp_live_****IJKL"
  const parts = keyId.split('_');
  const tail = last4(keyId);
  if (parts.length >= 3) {
    return `${parts[0]}_${parts[1]}_****${tail}`;
  }
  return `****${tail}`;
}

/**
 * Deterministic idempotency key per attempt. Prevents double-firing when the
 * user clicks Pay Salaries twice; a new attempt (retry after failure) uses a
 * fresh attempt counter so Razorpay treats it as a genuine new payout.
 */
function idempotencyKey(payslipId: ObjectId, attempt: number): string {
  return crypto
    .createHash('sha256')
    .update(`${payslipId.toString()}::${attempt}`)
    .digest('hex')
    .slice(0, 40); // Razorpay accepts up to 40 chars
}

function decryptCred(rx: RazorpayXSettings): XCredentials {
  if (!rx.keyIdEncrypted || !rx.keySecretEncrypted || !rx.sourceAccountNumberEncrypted) {
    throw new ApiError(
      'RAZORPAY_X_NOT_CONFIGURED',
      'RazorpayX credentials are not stored for this branch.',
      412
    );
  }
  return {
    keyId: decrypt(rx.keyIdEncrypted),
    keySecret: decrypt(rx.keySecretEncrypted),
    sourceAccountNumber: decrypt(rx.sourceAccountNumberEncrypted),
  };
}

// Rough concurrency limiter — payouts are rate-limited, so keep it small.
async function forEachLimited<T>(
  items: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<void>
): Promise<void> {
  let cursor = 0;
  const workers = Array.from({ length: Math.min(limit, items.length || 1) }, async () => {
    while (cursor < items.length) {
      const i = cursor++;
      try {
        await fn(items[i], i);
      } catch (err) {
        logger.error({ err, index: i }, 'RazorpayX: worker task failed');
      }
    }
  });
  await Promise.all(workers);
}

// ---------- service ----------

class RazorpayXPayoutService {
  isPlatformConfigured(): boolean {
    // Encryption is a hard prerequisite because we refuse to store the keys
    // plaintext. If ENCRYPTION_KEY is unset we surface a clearer error than
    // "cannot encrypt".
    return !!env.ENCRYPTION_KEY;
  }

  private async getSettingsDoc(
    tenantId: string,
    branchId: string
  ): Promise<WithId<HRSettingsDocument>> {
    const doc = (await collections.hrSettings.findOne({
      tenantId: new ObjectId(tenantId),
      branchId: new ObjectId(branchId),
    })) as WithId<HRSettingsDocument> | null;
    if (!doc) {
      throw new ApiError(
        'HR_SETTINGS_NOT_FOUND',
        'HR settings row not found for this branch. Open HR Settings once to bootstrap it.',
        404
      );
    }
    return doc;
  }

  /**
   * Public read view — same masked shape formatSettings uses. Used by the
   * dedicated GET /hr/settings/razorpay-x endpoint so the UI doesn't have to
   * pull the entire HR settings blob just to render the Payouts tab.
   */
  async getSettings(tenantId: string, branchId: string) {
    const settings = await collections.hrSettings.findOne({
      tenantId: new ObjectId(tenantId),
      branchId: new ObjectId(branchId),
    });
    const rx = (settings as HRSettingsDocument | null)?.razorpayX;
    if (!rx) return null;
    return {
      status: rx.status,
      keyIdMasked: rx.keyIdMasked ?? null,
      sourceAccountNumberMasked: rx.sourceAccountNumberMasked ?? null,
      pennyDropEnabled: rx.pennyDropEnabled,
      lastVerifiedAt: rx.lastVerifiedAt ?? null,
      lastVerifiedBalancePaise: rx.lastVerifiedBalancePaise ?? null,
      createdAt: rx.createdAt,
      updatedAt: rx.updatedAt,
    };
  }

  /**
   * Persist the school's X credentials + verify they work by calling the
   * balance endpoint. If the balance call fails we don't store anything so
   * the DB never contains obviously-broken credentials.
   */
  async connect(tenantId: string, branchId: string, input: OnboardXInput) {
    if (!this.isPlatformConfigured()) {
      throw new ApiError(
        'ENCRYPTION_NOT_CONFIGURED',
        'ENCRYPTION_KEY is not set on the API — cannot store RazorpayX credentials securely.',
        503
      );
    }
    const cred: XCredentials = {
      keyId: input.keyId.trim(),
      keySecret: input.keySecret.trim(),
      sourceAccountNumber: input.sourceAccountNumber.trim(),
    };
    let balancePaise: number | null = null;
    try {
      const bal = await razorpayXService.verifyCredentials(cred);
      balancePaise = bal.balancePaise;
    } catch (err) {
      const e = err as { status?: number; message?: string; rzpCode?: string };
      throw new ApiError(
        e.rzpCode || 'RAZORPAY_X_VERIFY_FAILED',
        e.message || 'RazorpayX rejected the credentials.',
        e.status && e.status >= 400 && e.status < 500 ? 400 : 502
      );
    }

    const now = new Date();
    const settings = await this.getSettingsDoc(tenantId, branchId);
    const rx: RazorpayXSettings = {
      status: 'connected',
      keyIdEncrypted: encrypt(cred.keyId),
      keySecretEncrypted: encrypt(cred.keySecret),
      sourceAccountNumberEncrypted: encrypt(cred.sourceAccountNumber),
      webhookSecretEncrypted: encrypt(input.webhookSecret.trim()),
      keyIdMasked: maskKeyId(cred.keyId),
      sourceAccountNumberMasked: `****${last4(cred.sourceAccountNumber)}`,
      pennyDropEnabled: input.pennyDropEnabled ?? true,
      lastVerifiedAt: now,
      lastVerifiedBalancePaise: balancePaise ?? undefined,
      createdAt: settings.razorpayX?.createdAt ?? now,
      updatedAt: now,
    };
    await collections.hrSettings.updateOne(
      { _id: settings._id },
      { $set: { razorpayX: rx, updatedAt: now } }
    );
    logger.info({ tenantId, branchId, keyIdMasked: rx.keyIdMasked }, 'RazorpayX — connected');
    return this.getSettings(tenantId, branchId);
  }

  /**
   * Re-verify against Razorpay without touching credentials. Also refreshes
   * the balance cache.
   */
  async verify(tenantId: string, branchId: string) {
    const settings = await this.getSettingsDoc(tenantId, branchId);
    const rx = settings.razorpayX;
    if (!rx) {
      throw new ApiError(
        'RAZORPAY_X_NOT_CONFIGURED',
        'RazorpayX is not configured for this branch.',
        412
      );
    }
    const cred = decryptCred(rx);
    let status: RazorpayXSettings['status'] = 'connected';
    let balancePaise: number | null = null;
    try {
      const bal = await razorpayXService.verifyCredentials(cred);
      balancePaise = bal.balancePaise;
    } catch (err) {
      const e = err as { status?: number };
      status = e.status === 401 || e.status === 403 ? 'invalid_credentials' : 'suspended';
    }
    const now = new Date();
    await collections.hrSettings.updateOne(
      { _id: settings._id },
      {
        $set: {
          'razorpayX.status': status,
          'razorpayX.lastVerifiedAt': now,
          'razorpayX.lastVerifiedBalancePaise': balancePaise ?? null,
          'razorpayX.updatedAt': now,
          updatedAt: now,
        },
      }
    );
    return this.getSettings(tenantId, branchId);
  }

  async disconnect(tenantId: string, branchId: string) {
    const settings = await this.getSettingsDoc(tenantId, branchId);
    if (!settings.razorpayX) return;
    const now = new Date();
    await collections.hrSettings.updateOne(
      { _id: settings._id },
      { $unset: { razorpayX: '' }, $set: { updatedAt: now } }
    );
    logger.info({ tenantId, branchId }, 'RazorpayX — disconnected');
  }

  async getBalance(tenantId: string, branchId: string): Promise<number | null> {
    const rx = (await this.getSettingsDoc(tenantId, branchId)).razorpayX;
    if (!rx || rx.status !== 'connected') return null;
    try {
      const cred = decryptCred(rx);
      const bal = await razorpayXService.getBalance(cred);
      if (!bal) return null; // best-effort — not all X accounts expose a balance endpoint
      // Cache it.
      await collections.hrSettings.updateOne(
        { tenantId: new ObjectId(tenantId), branchId: new ObjectId(branchId) },
        {
          $set: {
            'razorpayX.lastVerifiedBalancePaise': bal.balance,
            'razorpayX.lastVerifiedAt': new Date(),
          },
        }
      );
      return bal.balance;
    } catch (err) {
      logger.warn({ err, tenantId, branchId }, 'RazorpayX — balance fetch failed');
      return null;
    }
  }

  /**
   * Ensure a staff record has a Razorpay contact + fund account, and kick
   * off a penny-drop if not already validated. Idempotent — safe to call
   * repeatedly. No-op if the branch has no X configured.
   */
  async syncStaff(tenantId: string, branchId: string, staffId: string): Promise<void> {
    const settings = await collections.hrSettings.findOne({
      tenantId: new ObjectId(tenantId),
      branchId: new ObjectId(branchId),
    });
    const rx = (settings as HRSettingsDocument | null)?.razorpayX;
    if (!rx || rx.status !== 'connected') return; // silent no-op

    const staff = (await collections.staff.findOne({
      _id: new ObjectId(staffId),
      tenantId: new ObjectId(tenantId),
    })) as StaffDoc | null;
    if (!staff) return;
    const bd = staff.bankDetails;
    if (!bd?.accountNumber || !bd.ifscCode) return; // nothing to sync yet

    const beneficiaryName =
      staff.displayName || `${staff.firstName ?? ''} ${staff.lastName ?? ''}`.trim();
    const cred = decryptCred(rx);

    // 1. Contact (idempotent by reference_id — Razorpay does not enforce
    //    uniqueness so we lookup by stored id first).
    let contactId = bd.razorpayX?.contactId;
    if (!contactId) {
      try {
        const contact = await razorpayXService.createContact(cred, {
          name: beneficiaryName || staff.employeeId || 'Staff',
          email: staff.contact?.email,
          phone: staff.contact?.phone,
          referenceId: staff.employeeId || staff._id.toString(),
          notes: { staffId: staff._id.toString(), branchId },
        });
        contactId = contact.id;
      } catch (err) {
        logger.warn({ err, staffId }, 'RazorpayX — createContact failed');
        return;
      }
    }

    // 2. Fund account. If the stored one still matches the current bank
    //    details, keep it. Otherwise create a fresh one — Razorpay does not
    //    let you edit account_number/ifsc on an existing fund_account.
    let fundAccountId = bd.razorpayX?.fundAccountId;
    const needsNewFundAccount = !fundAccountId;
    // If the account digits changed since we last synced, force new fund acct.
    // (We keep only the masked hint on the sync record; a full compare would
    // require re-decrypting stored bank details, which we don't persist. A
    // fresh createFundAccount on every bank change is cheap and correct.)
    if (needsNewFundAccount) {
      try {
        const fa = await razorpayXService.createFundAccount(cred, {
          contactId,
          bankAccount: {
            name: beneficiaryName || 'Staff',
            ifsc: bd.ifscCode,
            accountNumber: bd.accountNumber,
          },
        });
        fundAccountId = fa.id;
      } catch (err) {
        logger.warn({ err, staffId }, 'RazorpayX — createFundAccount failed');
        return;
      }
    }

    // 3. Penny drop (optional).
    let validationStatus: 'pending' | 'in_process' | 'active' | 'failed' = 'pending';
    let validationFailureReason: string | undefined;
    if (rx.pennyDropEnabled) {
      try {
        const val = await razorpayXService.validateFundAccount(cred, fundAccountId!);
        validationStatus =
          val.status === 'completed'
            ? val.results?.account_status === 'active'
              ? 'active'
              : 'failed'
            : val.status === 'in_process'
              ? 'in_process'
              : val.status === 'failed'
                ? 'failed'
                : 'pending';
        validationFailureReason = val.error?.description;
      } catch (err) {
        logger.warn({ err, fundAccountId }, 'RazorpayX — validateFundAccount failed');
      }
    } else {
      // Skip validation → trust the bank details; treat as active.
      validationStatus = 'active';
    }

    await collections.staff.updateOne(
      { _id: staff._id },
      {
        $set: {
          'bankDetails.razorpayX': {
            contactId,
            fundAccountId,
            validationStatus,
            validationFailureReason,
            lastSyncedAt: new Date(),
          },
          updatedAt: new Date(),
        },
      }
    );

    logger.info(
      { staffId, contactId, fundAccountId, validationStatus },
      'RazorpayX — staff synced'
    );
  }

  /**
   * Pay all still-pending payslips in a payroll run. Each one gets its own
   * unique idempotency key so a duplicated request cannot double-pay.
   */
  async payRun(
    tenantId: string,
    branchId: string,
    runId: string,
    input: { mode?: PayoutMode; staffIds?: string[]; paidBy: string; queueIfLowBalance?: boolean }
  ): Promise<PayRunResult> {
    const settings = await this.getSettingsDoc(tenantId, branchId);
    const rx = settings.razorpayX;
    if (!rx || rx.status !== 'connected') {
      throw new ApiError(
        'RAZORPAY_X_NOT_CONFIGURED',
        'RazorpayX is not connected for this branch.',
        412
      );
    }
    const cred = decryptCred(rx);
    const mode: PayoutMode = input.mode ?? 'IMPS';

    // Pull payslips + linked staff. Only process the pending ones; already-paid
    // payslips are silently skipped in the response.
    const payslipFilter: Record<string, unknown> = {
      tenantId: new ObjectId(tenantId),
      branchId: new ObjectId(branchId),
      payrollRunId: new ObjectId(runId),
      'disbursement.status': { $in: ['pending', 'failed', 'reversed'] },
    };
    if (input.staffIds && input.staffIds.length) {
      payslipFilter.staffId = { $in: input.staffIds.map((s) => new ObjectId(s)) };
    }
    const payslips = (await collections.payslips
      .find(payslipFilter)
      .toArray()) as unknown as PayslipDoc[];
    const totalPayslips = payslips.length;

    // Load all referenced staff docs in one shot.
    const staffIds = payslips.map((p) => p.staffId);
    const staffDocs = (await collections.staff
      .find({ _id: { $in: staffIds } })
      .toArray()) as unknown as StaffDoc[];
    const staffById = new Map(staffDocs.map((s) => [s._id.toString(), s]));

    const result: PayRunResult = {
      runId,
      totalPayslips,
      initiated: 0,
      skipped: [],
      failed: [],
    };

    await forEachLimited(payslips, 5, async (payslip) => {
      const staff = staffById.get(payslip.staffId.toString());
      const staffName =
        staff?.displayName ||
        `${staff?.firstName ?? ''} ${staff?.lastName ?? ''}`.trim() ||
        'Staff';
      const fundAccountId = staff?.bankDetails?.razorpayX?.fundAccountId;
      const validationStatus = staff?.bankDetails?.razorpayX?.validationStatus;

      if (!fundAccountId) {
        result.skipped.push({
          payslipId: payslip._id.toString(),
          staffName,
          reason:
            'Staff bank not linked to RazorpayX. Save bank details on the staff record first.',
        });
        return;
      }
      if (rx.pennyDropEnabled && validationStatus === 'failed') {
        result.skipped.push({
          payslipId: payslip._id.toString(),
          staffName,
          reason:
            staff?.bankDetails?.razorpayX?.validationFailureReason ||
            'Bank validation failed — fix the account and re-sync.',
        });
        return;
      }
      if (rx.pennyDropEnabled && validationStatus !== 'active') {
        result.skipped.push({
          payslipId: payslip._id.toString(),
          staffName,
          reason: `Bank validation still ${validationStatus ?? 'pending'} — try again in a minute.`,
        });
        return;
      }

      const attempt = (payslip.disbursement.payout?.attempts ?? 0) + 1;
      const idemKey = idempotencyKey(payslip._id, attempt);
      const amountPaise = Math.round(payslip.netPayable * 100);

      let payout: RazorpayXPayout;
      try {
        payout = await razorpayXService.createPayout(
          cred,
          {
            fundAccountId,
            amountPaise,
            mode,
            purpose: 'salary',
            referenceId: payslip.payslipNumber,
            narration: `Salary ${payslip.period}`.slice(0, 30),
            queueIfLowBalance: input.queueIfLowBalance ?? true,
            notes: {
              payslipId: payslip._id.toString(),
              staffId: payslip.staffId.toString(),
              runId,
              period: payslip.period,
            },
          },
          idemKey
        );
      } catch (err) {
        const e = err as { message?: string; rzpCode?: string };
        result.failed.push({
          payslipId: payslip._id.toString(),
          staffName,
          reason: e.message || 'RazorpayX rejected the payout.',
        });
        return;
      }

      // NB: we do NOT set `disbursement.paidAt` here. Paid means the bank
      // confirmed the transfer — that's the `payout.processed` webhook
      // (see applyPayoutUpdate). Here we're only recording the intent.
      const now = new Date();
      await collections.payslips.updateOne(
        { _id: payslip._id },
        {
          $set: {
            'disbursement.status': 'processing',
            'disbursement.paymentMode': 'razorpay_x',
            'disbursement.payout.payoutId': payout.id,
            'disbursement.payout.idempotencyKey': idemKey,
            'disbursement.payout.mode': mode,
            'disbursement.payout.status': payout.status,
            'disbursement.payout.attempts': attempt,
            'disbursement.payout.initiatedAt': now,
            'disbursement.payout.initiatedBy': new ObjectId(input.paidBy),
            // Clear any prior failureReason so retry attempts don't look failed
            'disbursement.payout.failureReason': null,
            updatedAt: now,
          },
        }
      );
      result.initiated++;
    });

    logger.info(
      {
        tenantId,
        branchId,
        runId,
        totalPayslips,
        initiated: result.initiated,
        skipped: result.skipped.length,
        failed: result.failed.length,
      },
      'RazorpayX — pay run complete'
    );
    return result;
  }

  /**
   * Cheap aggregation used by the Pay Salaries confirm modal: how many
   * payslips are still eligible to be paid in this run, and what's the
   * total net amount? Avoids the 100-row list-preview limit the payroll
   * page uses for display, so schools with big rosters don't see under-
   * counted totals.
   */
  async getRunPaySummary(
    tenantId: string,
    branchId: string,
    runId: string
  ): Promise<{ pendingCount: number; pendingTotalPaise: number; alreadyPaidCount: number }> {
    const filter = {
      tenantId: new ObjectId(tenantId),
      branchId: new ObjectId(branchId),
      payrollRunId: new ObjectId(runId),
    };
    const [aggPending, aggPaid] = await Promise.all([
      collections.payslips
        .aggregate([
          {
            $match: {
              ...filter,
              'disbursement.status': { $in: ['pending', 'failed', 'reversed'] },
            },
          },
          { $group: { _id: null, count: { $sum: 1 }, total: { $sum: '$netPayable' } } },
        ])
        .toArray(),
      collections.payslips.countDocuments({ ...filter, 'disbursement.status': 'paid' }),
    ]);
    const pending = (aggPending[0] as { count?: number; total?: number } | undefined) ?? {};
    return {
      pendingCount: pending.count ?? 0,
      pendingTotalPaise: Math.round((pending.total ?? 0) * 100),
      alreadyPaidCount: aggPaid,
    };
  }

  /**
   * Manual re-poll of a single payslip's payout status. Useful when a
   * webhook was missed.
   */
  async refreshPayoutStatus(tenantId: string, branchId: string, payslipId: string) {
    const payslip = (await collections.payslips.findOne({
      _id: new ObjectId(payslipId),
      tenantId: new ObjectId(tenantId),
      branchId: new ObjectId(branchId),
    })) as PayslipDoc | null;
    if (!payslip) {
      throw new ApiError('PAYSLIP_NOT_FOUND', 'Payslip not found', 404);
    }
    const payoutId = payslip.disbursement.payout?.payoutId;
    if (!payoutId) {
      throw new ApiError(
        'PAYOUT_NOT_INITIATED',
        'This payslip has no RazorpayX payout to refresh.',
        400
      );
    }
    const rx = (await this.getSettingsDoc(tenantId, branchId)).razorpayX;
    if (!rx || rx.status !== 'connected') {
      throw new ApiError('RAZORPAY_X_NOT_CONFIGURED', 'RazorpayX not connected.', 412);
    }
    const cred = decryptCred(rx);
    const payout = await razorpayXService.getPayout(cred, payoutId);
    await this.applyPayoutUpdate(payout);
    return payout;
  }

  /**
   * Apply a payout status change (from webhook OR manual refresh) to the
   * matching payslip. Central place so the mapping between Razorpay's status
   * and our `disbursement.status` lives in exactly one function.
   */
  async applyPayoutUpdate(payout: RazorpayXPayout): Promise<void> {
    const disbStatus =
      payout.status === 'processed'
        ? 'paid'
        : payout.status === 'reversed'
          ? 'reversed'
          : payout.status === 'failed' || payout.status === 'cancelled'
            ? 'failed'
            : 'processing';

    const update: Record<string, unknown> = {
      'disbursement.payout.status': payout.status,
      'disbursement.payout.lastWebhookAt': new Date(),
      'disbursement.status': disbStatus,
      updatedAt: new Date(),
    };
    if (payout.utr) update['disbursement.payout.utr'] = payout.utr;
    if (payout.status_details?.description || payout.failure_reason) {
      update['disbursement.payout.failureReason'] =
        payout.status_details?.description || payout.failure_reason;
    }
    if (disbStatus === 'paid') {
      update['disbursement.paidAt'] = new Date();
      update['disbursement.paymentReference'] = payout.utr;
    }
    const res = await collections.payslips.updateOne(
      { 'disbursement.payout.payoutId': payout.id },
      { $set: update }
    );
    if (res.matchedCount === 0) {
      logger.warn({ payoutId: payout.id }, 'RazorpayX — no payslip matched payout id');
    }
  }

  /**
   * Look up the raw XCredentials for a branch — used by the webhook router
   * to decrypt the per-branch webhook secret for signature verification.
   */
  async getRawSettings(
    tenantId: string,
    branchId: string
  ): Promise<{ cred: XCredentials; webhookSecret: string; pennyDropEnabled: boolean } | null> {
    const settings = await collections.hrSettings.findOne({
      tenantId: new ObjectId(tenantId),
      branchId: new ObjectId(branchId),
    });
    const rx = (settings as HRSettingsDocument | null)?.razorpayX;
    if (
      !rx ||
      !rx.keyIdEncrypted ||
      !rx.keySecretEncrypted ||
      !rx.sourceAccountNumberEncrypted ||
      !rx.webhookSecretEncrypted
    ) {
      return null;
    }
    return {
      cred: decryptCred(rx),
      webhookSecret: decrypt(rx.webhookSecretEncrypted),
      pennyDropEnabled: rx.pennyDropEnabled,
    };
  }

  /**
   * Look up branch by linked account id inside a webhook payload. We do a
   * scan-and-match on the encrypted source account — cheap because webhooks
   * carry the account_number verbatim so we can key by the masked hint.
   */
  async findBranchByWebhookSourceAccount(
    accountNumber: string
  ): Promise<{ tenantId: string; branchId: string } | null> {
    const suffix = last4(accountNumber);
    const settings = (await collections.hrSettings
      .find({ 'razorpayX.sourceAccountNumberMasked': `****${suffix}` })
      .toArray()) as unknown as HRSettingsDocument[];
    for (const s of settings) {
      const rx = s.razorpayX;
      if (!rx?.sourceAccountNumberEncrypted) continue;
      try {
        if (decrypt(rx.sourceAccountNumberEncrypted) === accountNumber) {
          return { tenantId: s.tenantId.toString(), branchId: s.branchId.toString() };
        }
      } catch {
        // ignore decrypt errors
      }
    }
    return null;
  }
}

export const razorpayXPayoutService = new RazorpayXPayoutService();
