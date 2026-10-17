import { ObjectId, WithId } from 'mongodb';
import { collections } from '../../config/database';
import { logger } from '../../lib/logger';
import { ApiError } from '../../middleware/errorHandler';
import { env } from '../../config/env';
import {
  razorpayService,
  type RazorpayBusinessType,
  type RazorpayLinkedAccount,
  type LinkedAccountStatus,
} from '../../services/razorpay.service';
import type {
  FinanceSettingsDocument,
  RazorpayRouteSettings,
  RazorpayRouteStatus,
} from './financeSettings.service';

export interface OnboardRazorpayRouteInput {
  legal: {
    entityName: string;
    businessType: RazorpayBusinessType;
    panNumber: string;
    gstNumber?: string;
  };
  contact: { email: string; phone: string };
  address: {
    line1: string;
    city: string;
    state: string;
    pincode: string;
    country?: 'IN';
  };
  bank: { accountNumber: string; ifsc: string; beneficiaryName: string };
}

/**
 * Translate the raw Razorpay account status into our internal status. Razorpay
 * keeps it short (created / under_review / activated / suspended / rejected /
 * needs_clarification) — we map identically with a tiny safety net.
 */
function mapStatus(s: LinkedAccountStatus | string | undefined): RazorpayRouteStatus {
  switch (s) {
    case 'created':
    case 'under_review':
    case 'needs_clarification':
    case 'activated':
    case 'suspended':
    case 'rejected':
      return s;
    default:
      return 'under_review';
  }
}

/**
 * Extract a flat list of field codes if Razorpay returned a needs_clarification
 * block. Razorpay's shape varies between API versions; we tolerate either a
 * direct array of strings or an object of `{ field: { message } }`.
 */
function extractClarificationFields(
  account: RazorpayLinkedAccount
): { message: string; fields: string[] } | undefined {
  const blockA = account?.requirements as
    | Array<{ field_reference?: string; description?: string }>
    | undefined;
  if (Array.isArray(blockA) && blockA.length > 0) {
    return {
      message:
        blockA
          .map((r) => r.description)
          .filter(Boolean)
          .join(' • ') || 'Razorpay needs more info.',
      fields: blockA.map((r) => r.field_reference || '').filter(Boolean),
    };
  }
  const blockB = account?.needs_clarification as
    | { fields?: string[]; message?: string }
    | undefined;
  if (blockB?.fields?.length) {
    return { message: blockB.message ?? 'Razorpay needs more info.', fields: blockB.fields };
  }
  return undefined;
}

class RazorpayRouteService {
  isConfigured(): boolean {
    return !!(env.RAZORPAY_KEY_ID && env.RAZORPAY_KEY_SECRET);
  }

  private assertConfigured() {
    if (!this.isConfigured()) {
      throw new ApiError(
        'RAZORPAY_NOT_CONFIGURED',
        'Razorpay credentials are not configured on the server.',
        503
      );
    }
  }

  /**
   * Ensure the finance settings row exists for this branch. We rely on
   * `financeSettingsService.getSettings` for the bootstrap insert, but read
   * the raw doc here so we can write to it directly without going through
   * the public formatter.
   */
  private async getSettingsDoc(
    tenantId: string,
    branchId: string
  ): Promise<WithId<FinanceSettingsDocument>> {
    const existing = (await collections.financeSettings.findOne({
      tenantId: new ObjectId(tenantId),
      branchId: new ObjectId(branchId),
    })) as WithId<FinanceSettingsDocument> | null;
    if (existing) return existing;
    // Bootstrap an empty settings row — same defaults the public getSettings
    // would use, kept minimal here.
    const now = new Date();
    const inserted: FinanceSettingsDocument = {
      _id: new ObjectId(),
      tenantId: new ObjectId(tenantId),
      branchId: new ObjectId(branchId),
      bankAccounts: [],
      paymentMethods: [],
      receiptSettings: {
        prefix: 'RCP',
        padding: 6,
        includeYear: true,
        yearFormat: '2',
        showQRCode: false,
        footerText: '',
        duplicateCopies: 1,
      },
      concessionSettings: {
        maxPercentage: 100,
        maxAmount: 0,
        requiresApproval: false,
        approvalThreshold: 0,
        eligibleCategories: [],
        allowMultipleConcessions: false,
        allowedReasons: [],
      },
      cancellationSettings: {
        allowedWithinDays: 30,
        requiresApproval: false,
        approvalRoles: [],
        allowPartialCancellation: false,
        refundDeductionPercentage: 0,
        refundDeductionFixed: 0,
      },
      orgFeeSettings: {
        defaultDueDay: 5,
        penaltyStartAfterDays: 7,
        penaltyType: 'fixed',
        penaltyValue: 0,
        maxPenaltyCap: 0,
        reminderBeforeDays: [],
        autoLockAfterDueDays: 0,
      },
      walletCategories: [],
      mandatoryFields: {},
      applicationFeeSettings: {
        isEnabled: false,
        amount: 0,
        feeType: 'fixed',
        isRefundable: false,
        refundPercentage: 0,
        paymentModes: [],
        adjustInFee: false,
      },
      walletSequenceSettings: {
        isEnabled: false,
        deductionOrder: [],
        autoDeductOnPayment: false,
        minBalanceRequired: 0,
        maxDeductionPercentage: 0,
      },
      createdAt: now,
      updatedAt: now,
    };
    await collections.financeSettings.insertOne(inserted);
    return inserted as WithId<FinanceSettingsDocument>;
  }

  /**
   * Read-only view of the route settings for this branch. Returns null if the
   * admin hasn't started onboarding yet.
   */
  async getStatus(tenantId: string, branchId: string): Promise<RazorpayRouteSettings | null> {
    const settings = await collections.financeSettings.findOne({
      tenantId: new ObjectId(tenantId),
      branchId: new ObjectId(branchId),
    });
    return ((settings as FinanceSettingsDocument | null)?.razorpayRoute ??
      null) as RazorpayRouteSettings | null;
  }

  /**
   * Create a Linked Account for this branch and persist the snapshot. Fails
   * fast if a previous onboarding already exists for the branch — the admin
   * should use refresh/disconnect instead so we never create duplicates.
   */
  async onboard(
    tenantId: string,
    branchId: string,
    input: OnboardRazorpayRouteInput
  ): Promise<RazorpayRouteSettings> {
    this.assertConfigured();

    const settings = await this.getSettingsDoc(tenantId, branchId);
    const existing = settings.razorpayRoute;
    if (existing && existing.status !== 'not_configured' && existing.status !== 'rejected') {
      throw new ApiError(
        'ROUTE_ALREADY_ONBOARDED',
        'A linked account already exists for this branch. Use refresh or disconnect first.',
        409
      );
    }

    let account: RazorpayLinkedAccount;
    try {
      account = await razorpayService.createLinkedAccount({
        email: input.contact.email,
        phone: input.contact.phone,
        legalBusinessName: input.legal.entityName,
        businessType: input.legal.businessType,
        panNumber: input.legal.panNumber,
        gstNumber: input.legal.gstNumber,
        category: 'education',
        subcategory: 'others',
        addresses: {
          registered: {
            street1: input.address.line1,
            city: input.address.city,
            state: input.address.state,
            postalCode: input.address.pincode,
            country: input.address.country ?? 'IN',
          },
        },
        bankAccount: {
          accountNumber: input.bank.accountNumber,
          ifsc: input.bank.ifsc,
          beneficiaryName: input.bank.beneficiaryName,
        },
        referenceId: `cv_branch_${branchId}`,
        notes: { tenantId, branchId },
      });
    } catch (err) {
      const e = err as { status?: number; rzpCode?: string; message?: string };
      // Surface Razorpay's own validation error as-is so the UI can show it.
      throw new ApiError(
        e.rzpCode || 'RAZORPAY_ONBOARDING_FAILED',
        e.message || 'Razorpay rejected the linked-account request.',
        e.status && e.status >= 400 && e.status < 500 ? 400 : 502
      );
    }

    const now = new Date();
    const route: RazorpayRouteSettings = {
      status: mapStatus(account.status),
      linkedAccountId: account.id,
      legal: { ...input.legal },
      contact: { ...input.contact },
      address: {
        line1: input.address.line1,
        city: input.address.city,
        state: input.address.state,
        pincode: input.address.pincode,
        country: 'IN',
      },
      bank: { ...input.bank },
      needsClarification: extractClarificationFields(account),
      lastSyncedAt: now,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };

    await collections.financeSettings.updateOne(
      { _id: settings._id },
      { $set: { razorpayRoute: route, updatedAt: now } }
    );

    logger.info(
      { tenantId, branchId, linkedAccountId: account.id, status: route.status },
      'Razorpay Route — onboarded'
    );
    return route;
  }

  /**
   * Pull the latest status from Razorpay and update the local snapshot. Safe
   * to call repeatedly; this is what the "Refresh status" button hits.
   */
  async refresh(tenantId: string, branchId: string): Promise<RazorpayRouteSettings> {
    this.assertConfigured();
    const settings = await this.getSettingsDoc(tenantId, branchId);
    const existing = settings.razorpayRoute;
    if (!existing?.linkedAccountId) {
      throw new ApiError(
        'ROUTE_NOT_ONBOARDED',
        'There is no Razorpay linked account to refresh for this branch.',
        404
      );
    }

    let account: RazorpayLinkedAccount;
    try {
      account = await razorpayService.getLinkedAccount(existing.linkedAccountId);
    } catch (err) {
      const e = err as { status?: number; message?: string };
      throw new ApiError(
        'RAZORPAY_FETCH_FAILED',
        e.message || 'Could not reach Razorpay to refresh status.',
        502
      );
    }

    const now = new Date();
    const updated: RazorpayRouteSettings = {
      ...existing,
      status: mapStatus(account.status),
      needsClarification: extractClarificationFields(account),
      lastSyncedAt: now,
      updatedAt: now,
    };
    await collections.financeSettings.updateOne(
      { _id: settings._id },
      { $set: { razorpayRoute: updated, updatedAt: now } }
    );
    logger.info(
      { tenantId, branchId, linkedAccountId: existing.linkedAccountId, status: updated.status },
      'Razorpay Route — refreshed'
    );
    return updated;
  }

  /**
   * Mark the linked account as disconnected locally so subsequent fee orders
   * stop routing. We do NOT call Razorpay to delete — they don't support that
   * for linked accounts; the admin can re-enable later by re-onboarding.
   */
  async disconnect(tenantId: string, branchId: string): Promise<void> {
    const settings = await this.getSettingsDoc(tenantId, branchId);
    if (!settings.razorpayRoute) return;
    const now = new Date();
    await collections.financeSettings.updateOne(
      { _id: settings._id },
      {
        $set: {
          'razorpayRoute.status': 'not_configured' as RazorpayRouteStatus,
          'razorpayRoute.updatedAt': now,
          updatedAt: now,
        },
      }
    );
    logger.info({ tenantId, branchId }, 'Razorpay Route — disconnected');
  }

  /**
   * Look up the linked account id for a branch IF it's currently activated.
   * Returns null otherwise so the order builder can skip the transfers[] block
   * (gracefully degrades to the existing no-Route flow).
   */
  async getActiveLinkedAccountId(tenantId: string, branchId: string): Promise<string | null> {
    const rr = await this.getStatus(tenantId, branchId);
    if (rr?.status === 'activated' && rr.linkedAccountId) {
      return rr.linkedAccountId;
    }
    return null;
  }

  /**
   * Webhook entrypoint — given a Razorpay account event payload, find the
   * branch whose linkedAccountId matches and update the cached status.
   */
  async syncFromWebhook(linkedAccountId: string, status: string, payload?: unknown): Promise<void> {
    const settings = (await collections.financeSettings.findOne({
      'razorpayRoute.linkedAccountId': linkedAccountId,
    })) as WithId<FinanceSettingsDocument> | null;
    if (!settings || !settings.razorpayRoute) {
      logger.warn({ linkedAccountId }, 'Razorpay account webhook: no matching branch');
      return;
    }
    const now = new Date();
    const next: RazorpayRouteSettings = {
      ...settings.razorpayRoute,
      status: mapStatus(status),
      needsClarification: extractClarificationFields(
        (payload as RazorpayLinkedAccount) ?? ({} as RazorpayLinkedAccount)
      ),
      lastSyncedAt: now,
      updatedAt: now,
    };
    await collections.financeSettings.updateOne(
      { _id: settings._id },
      { $set: { razorpayRoute: next, updatedAt: now } }
    );
    logger.info(
      {
        tenantId: settings.tenantId.toString(),
        branchId: settings.branchId.toString(),
        linkedAccountId,
        status: next.status,
      },
      'Razorpay Route — synced from webhook'
    );
  }
}

export const razorpayRouteService = new RazorpayRouteService();
