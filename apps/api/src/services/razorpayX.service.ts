import { logger } from '../lib/logger';

/**
 * RazorpayX (payouts) client.
 *
 * Distinct from `razorpay.service.ts` (Payment Gateway / Route). This talks to
 * `api.razorpay.com/v1` but with the school's OWN X credentials rather than
 * the platform's PG credentials — money moves from the school's virtual
 * account into staff bank accounts, so the school must own the keys.
 *
 * All methods take an `XCredentials` object; the caller (razorpayXPayoutService)
 * is responsible for loading and decrypting them from hrSettings.
 */
export interface XCredentials {
  keyId: string;
  keySecret: string;
  sourceAccountNumber: string; // school's 32-digit RazorpayX source VA
}

export type PayoutMode = 'IMPS' | 'NEFT' | 'RTGS' | 'UPI';

export type RazorpayXPayoutStatus =
  | 'queued'
  | 'pending'
  | 'initiated'
  | 'processing'
  | 'processed'
  | 'reversed'
  | 'failed'
  | 'cancelled';

export interface RazorpayXContact {
  id: string;
  entity: 'contact';
  name: string;
  contact?: string;
  email?: string;
  type?: string;
  reference_id?: string;
  active: boolean;
  notes?: Record<string, string>;
}

export interface RazorpayXFundAccount {
  id: string;
  entity: 'fund_account';
  contact_id: string;
  account_type: 'bank_account' | 'vpa';
  bank_account?: {
    name: string;
    ifsc: string;
    account_number: string;
    bank_name?: string;
  };
  vpa?: { address: string };
  active: boolean;
}

export interface RazorpayXFundAccountValidation {
  id: string;
  entity: 'fund_account.validation';
  status: 'created' | 'in_process' | 'completed' | 'failed';
  results?: {
    account_status?: 'active' | 'invalid';
    registered_name?: string;
  };
  error?: { code?: string; description?: string; source?: string };
}

export interface RazorpayXPayout {
  id: string;
  entity: 'payout';
  fund_account_id: string;
  amount: number;
  currency: 'INR';
  status: RazorpayXPayoutStatus;
  utr?: string;
  mode: PayoutMode | string;
  reference_id?: string;
  narration?: string;
  status_details?: {
    reason?: string;
    description?: string;
    source?: string;
  };
  failure_reason?: string;
  created_at: number;
}

export interface RazorpayXBalance {
  balance: number; // in paise
  currency: 'INR';
}

/**
 * Raw error propagated up from the Razorpay X API. The controller layer
 * translates status + rzpCode into a user-facing ApiError.
 */
export interface RazorpayXError extends Error {
  status: number;
  rzpCode?: string;
  rzpBody?: unknown;
}

async function callX<T>(
  cred: XCredentials,
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
  path: string,
  body?: unknown,
  extraHeaders?: Record<string, string>
): Promise<T> {
  if (!cred.keyId || !cred.keySecret) {
    throw new Error('RazorpayX credentials incomplete');
  }
  const auth = 'Basic ' + Buffer.from(`${cred.keyId}:${cred.keySecret}`).toString('base64');
  const res = await fetch(`https://api.razorpay.com${path}`, {
    method,
    headers: {
      Authorization: auth,
      'Content-Type': 'application/json',
      ...(extraHeaders ?? {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let parsed: unknown;
  try {
    parsed = text ? JSON.parse(text) : {};
  } catch {
    parsed = { raw: text };
  }
  if (!res.ok) {
    const errBody = parsed as { error?: { code?: string; description?: string } };
    logger.error({ method, path, status: res.status, body: errBody }, 'RazorpayX API call failed');
    const err = new Error(
      errBody.error?.description ?? `RazorpayX ${method} ${path} failed with ${res.status}`
    ) as RazorpayXError;
    err.status = res.status;
    err.rzpCode = errBody.error?.code;
    err.rzpBody = parsed;
    throw err;
  }
  return parsed as T;
}

class RazorpayXService {
  /**
   * Cheap auth ping — hit the contacts list with count=1. Any 2xx confirms
   * the Key ID + Secret + source account combination are valid. We
   * deliberately avoid using a balance endpoint here because RazorpayX's
   * balance API is not consistently documented across account types and
   * would risk failing valid credentials during onboarding. Balance is
   * loaded separately, best-effort.
   */
  async verifyCredentials(
    cred: XCredentials
  ): Promise<{ valid: true; balancePaise: number | null }> {
    await callX<{ items?: unknown[] }>(
      cred,
      'GET',
      `/v1/contacts?count=1&account_number=${encodeURIComponent(cred.sourceAccountNumber)}`
    );
    const balancePaise = await this.tryGetBalance(cred);
    return { valid: true, balancePaise };
  }

  /**
   * Return the source-VA balance in paise if we can determine it, otherwise
   * null. Used for the "insufficient funds" warning in the confirm modal —
   * NOT a hard prerequisite for firing payouts (we rely on
   * queue_if_low_balance=true so payouts queue rather than fail).
   */
  async getBalance(cred: XCredentials): Promise<RazorpayXBalance | null> {
    const balance = await this.tryGetBalance(cred);
    return balance === null ? null : { balance, currency: 'INR' };
  }

  /**
   * Try a couple of balance endpoints (RazorpayX exposes different ones
   * for Lite VA vs Current Account plans) and return null if neither works.
   */
  private async tryGetBalance(cred: XCredentials): Promise<number | null> {
    // Primary endpoint used by most Lite / RazorpayX VAs — returns
    // { balance, currency, ... } for the source account.
    try {
      const r = await callX<{ balance?: number }>(
        cred,
        'GET',
        `/v1/accounts/${encodeURIComponent(cred.sourceAccountNumber)}`
      );
      if (typeof r.balance === 'number') return r.balance;
    } catch {
      /* fall through */
    }
    // Fallback: transactions list, use latest txn's balance_after.
    try {
      const r = await callX<{ items?: Array<{ balance?: number }> }>(
        cred,
        'GET',
        `/v1/transactions?account_number=${encodeURIComponent(cred.sourceAccountNumber)}&count=1`
      );
      if (r.items?.[0]?.balance !== undefined) return r.items[0].balance;
    } catch {
      /* fall through */
    }
    return null;
  }

  async createContact(
    cred: XCredentials,
    input: {
      name: string;
      email?: string;
      phone?: string;
      referenceId?: string;
      notes?: Record<string, string>;
    }
  ): Promise<RazorpayXContact> {
    return callX<RazorpayXContact>(cred, 'POST', '/v1/contacts', {
      name: input.name,
      email: input.email,
      contact: input.phone,
      type: 'employee',
      reference_id: input.referenceId,
      notes: input.notes ?? {},
    });
  }

  async createFundAccount(
    cred: XCredentials,
    input: {
      contactId: string;
      bankAccount: { name: string; ifsc: string; accountNumber: string };
    }
  ): Promise<RazorpayXFundAccount> {
    return callX<RazorpayXFundAccount>(cred, 'POST', '/v1/fund_accounts', {
      contact_id: input.contactId,
      account_type: 'bank_account',
      bank_account: {
        name: input.bankAccount.name,
        ifsc: input.bankAccount.ifsc.toUpperCase(),
        account_number: input.bankAccount.accountNumber,
      },
    });
  }

  /**
   * Kick off a penny-drop validation of a fund account. Costs ~₹3-5. Returns
   * quickly with status `created`; final status arrives via the
   * `fund_account.validation.completed` webhook.
   */
  async validateFundAccount(
    cred: XCredentials,
    fundAccountId: string
  ): Promise<RazorpayXFundAccountValidation> {
    return callX<RazorpayXFundAccountValidation>(cred, 'POST', '/v1/fund_accounts/validations', {
      account_number: cred.sourceAccountNumber, // funded from source VA
      fund_account: { id: fundAccountId },
      amount: 100, // ₹1 in paise
      currency: 'INR',
      notes: {},
    });
  }

  /**
   * Fire a payout. `idempotencyKey` MUST be unique per logical attempt —
   * retrying the same key with the same body dedupes to the original payout.
   */
  async createPayout(
    cred: XCredentials,
    input: {
      fundAccountId: string;
      amountPaise: number;
      mode: PayoutMode;
      purpose?: string;
      referenceId?: string;
      narration?: string;
      queueIfLowBalance?: boolean;
      notes?: Record<string, string>;
    },
    idempotencyKey: string
  ): Promise<RazorpayXPayout> {
    return callX<RazorpayXPayout>(
      cred,
      'POST',
      '/v1/payouts',
      {
        account_number: cred.sourceAccountNumber,
        fund_account_id: input.fundAccountId,
        amount: input.amountPaise,
        currency: 'INR',
        mode: input.mode,
        purpose: input.purpose ?? 'salary',
        queue_if_low_balance: input.queueIfLowBalance ?? true,
        reference_id: input.referenceId,
        narration: input.narration,
        notes: input.notes ?? {},
      },
      { 'X-Payout-Idempotency': idempotencyKey }
    );
  }

  async getPayout(cred: XCredentials, payoutId: string): Promise<RazorpayXPayout> {
    return callX<RazorpayXPayout>(cred, 'GET', `/v1/payouts/${payoutId}`);
  }

  /**
   * HMAC-SHA256 verification of a webhook body against the per-branch secret
   * the school stored in hrSettings.razorpayX.webhookSecret. We can't reuse
   * `razorpayService.verifyWebhookSignature` because that one reads the
   * platform-wide env secret; X webhooks come from different Razorpay
   * accounts per school.
   */
  verifyWebhookSignature(rawBody: string, signature: string, webhookSecret: string): boolean {
    if (!signature || !webhookSecret) return false;
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const crypto = require('crypto') as typeof import('crypto');
    const expected = crypto.createHmac('sha256', webhookSecret).update(rawBody).digest('hex');
    // Constant-time compare
    if (expected.length !== signature.length) return false;
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
  }
}

export const razorpayXService = new RazorpayXService();
