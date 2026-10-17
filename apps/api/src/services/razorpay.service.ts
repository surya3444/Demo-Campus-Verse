import Razorpay from 'razorpay';
import crypto from 'crypto';
import { env } from '../config/env';
import { logger } from '../lib/logger';

interface RazorpayOrder {
  id: string;
  entity: string;
  amount: number;
  amount_paid: number;
  amount_due: number;
  currency: string;
  receipt: string;
  status: 'created' | 'attempted' | 'paid';
  notes: Record<string, string>;
  created_at: number;
}

interface CreateOrderInput {
  amount: number; // Amount in smallest currency unit (paise for INR)
  currency?: string;
  receipt: string;
  notes?: Record<string, string>;
  // Optional Razorpay Route transfers — when set, the captured payment is
  // automatically split into the listed linked accounts. Used by the fee
  // payment flow to push the full amount to the school's linked account.
  transfers?: Array<{
    account: string; // acc_xxxxxxxxxxxxx
    amount: number; // paise
    currency: string; // 'INR'
    notes?: Record<string, string>;
    on_hold?: 0 | 1;
  }>;
}

interface VerifyPaymentInput {
  orderId: string;
  paymentId: string;
  signature: string;
}

export interface RazorpaySubscriptionInfo {
  id: string;
  entity: string;
  plan_id: string;
  status: string;
  current_start: number;
  current_end: number;
  ended_at: number | null;
  quantity: number;
  notes: Record<string, string>;
  charge_at: number;
  short_url: string;
  created_at: number;
  total_count: number;
  paid_count: number;
  customer_id?: string;
}

interface CreateSubscriptionInput {
  planId: string;
  customerId?: string;
  quantity?: number;
  totalCount?: number;
  customerNotify?: boolean;
  startAt?: number;
  expireBy?: number;
  notes?: Record<string, string>;
}

interface RazorpayCustomerInfo {
  id: string;
  name: string;
  email: string;
  contact?: string;
  notes: Record<string, string>;
}

// ============================================================================
// Razorpay Route — Linked Account onboarding (v2 Accounts API)
// ============================================================================

export type LinkedAccountStatus =
  | 'created'
  | 'under_review'
  | 'needs_clarification'
  | 'activated'
  | 'suspended'
  | 'rejected';

export type RazorpayBusinessType =
  | 'individual'
  | 'partnership'
  | 'private_limited'
  | 'public_limited'
  | 'proprietorship'
  | 'trust'
  | 'ngo'
  | 'society'
  | 'educational_institutes';

export interface CreateLinkedAccountInput {
  // Contact
  email: string;
  phone: string;
  // Legal
  legalBusinessName: string;
  businessType: RazorpayBusinessType;
  // Profile
  category?: string;
  subcategory?: string;
  addresses?: {
    registered?: {
      street1: string;
      street2?: string;
      city: string;
      state: string;
      postalCode: string;
      country?: 'IN';
    };
  };
  // Identity
  panNumber: string;
  gstNumber?: string;
  // Bank
  bankAccount: {
    accountNumber: string;
    ifsc: string;
    beneficiaryName: string;
  };
  // Optional notes back to us
  referenceId?: string;
  notes?: Record<string, string>;
}

export interface RazorpayLinkedAccount {
  id: string;
  status: LinkedAccountStatus;
  email: string;
  phone?: string;
  type: 'route';
  reference_id?: string;
  legal_business_name?: string;
  business_type?: string;
  contact_name?: string;
  notes?: Record<string, string>;
  hold_funds?: boolean;
  created_at?: number;
  activated_at?: number;
  // Razorpay returns rich shapes for needs_clarification. We accept the raw
  // payload here and surface a string[] of field codes upstream.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any;
}

class RazorpayService {
  private razorpay: Razorpay | null = null;

  private getInstance(): Razorpay {
    if (!this.razorpay) {
      const keyId = env.RAZORPAY_KEY_ID;
      const keySecret = env.RAZORPAY_KEY_SECRET;

      if (!keyId || !keySecret) {
        throw new Error('Razorpay credentials not configured');
      }

      this.razorpay = new Razorpay({
        key_id: keyId,
        key_secret: keySecret,
      });
    }
    return this.razorpay;
  }

  /**
   * Create a one-time payment order
   */
  async createOrder(input: CreateOrderInput): Promise<RazorpayOrder> {
    try {
      const razorpay = this.getInstance();

      const orderPayload: Record<string, unknown> = {
        amount: input.amount,
        currency: input.currency || 'INR',
        receipt: input.receipt,
        notes: input.notes || {},
      };
      // Pass-through Route splits if any. Razorpay accepts a `transfers` array
      // on order creation that's applied at capture-time, atomically.
      if (input.transfers && input.transfers.length > 0) {
        orderPayload.transfers = input.transfers;
      }
      const order = await razorpay.orders.create(orderPayload as never);

      logger.info(
        { orderId: order.id, amount: input.amount, receipt: input.receipt },
        'Razorpay order created'
      );

      return order as RazorpayOrder;
    } catch (error) {
      logger.error({ error, input }, 'Failed to create Razorpay order');
      throw error;
    }
  }

  /**
   * Verify payment signature
   */
  verifyPayment(input: VerifyPaymentInput): boolean {
    try {
      const keySecret = env.RAZORPAY_KEY_SECRET;
      if (!keySecret) {
        throw new Error('Razorpay key secret not configured');
      }

      const body = input.orderId + '|' + input.paymentId;
      const expectedSignature = crypto.createHmac('sha256', keySecret).update(body).digest('hex');

      const isValid = expectedSignature === input.signature;

      logger.info(
        { orderId: input.orderId, paymentId: input.paymentId, isValid },
        'Payment verification result'
      );

      return isValid;
    } catch (error) {
      logger.error({ error, input }, 'Failed to verify payment');
      return false;
    }
  }

  /**
   * Fetch payment details
   */
  async getPayment(paymentId: string) {
    try {
      const razorpay = this.getInstance();
      const payment = await razorpay.payments.fetch(paymentId);
      return payment;
    } catch (error) {
      logger.error({ error, paymentId }, 'Failed to fetch payment');
      throw error;
    }
  }

  /**
   * Create a customer for subscriptions
   */
  async createCustomer(
    name: string,
    email: string,
    phone?: string,
    notes?: Record<string, string>
  ): Promise<RazorpayCustomerInfo> {
    try {
      const razorpay = this.getInstance();
      const customer = await razorpay.customers.create({
        name,
        email,
        contact: phone,
        notes: notes || {},
        fail_existing: 0,
      });

      const customerData = customer as unknown as RazorpayCustomerInfo;
      logger.info({ customerId: customerData.id, email }, 'Razorpay customer created');
      return customerData;
    } catch (error) {
      logger.error({ error, email }, 'Failed to create Razorpay customer');
      throw error;
    }
  }

  /**
   * Get customer by email
   */
  async getCustomerByEmail(email: string): Promise<RazorpayCustomerInfo | null> {
    try {
      const razorpay = this.getInstance();
      // Using all() and filtering manually since the SDK types don't support email filter directly
      const customersResult = await razorpay.customers.all({});
      const customers = customersResult as unknown as { items: RazorpayCustomerInfo[] };
      return customers.items?.find((c) => c.email === email) || null;
    } catch (error) {
      logger.error({ error, email }, 'Failed to fetch customer by email');
      return null;
    }
  }

  /**
   * Create a subscription
   */
  async createSubscription(input: CreateSubscriptionInput): Promise<RazorpaySubscriptionInfo> {
    try {
      const razorpay = this.getInstance();

      const subscriptionData: Record<string, unknown> = {
        plan_id: input.planId,
        quantity: input.quantity || 1,
        notes: input.notes || {},
      };

      if (input.customerId) subscriptionData.customer_id = input.customerId;
      if (input.totalCount !== undefined) subscriptionData.total_count = input.totalCount;
      if (input.customerNotify !== undefined)
        subscriptionData.customer_notify = input.customerNotify ? 1 : 0;
      if (input.startAt !== undefined) subscriptionData.start_at = input.startAt;
      if (input.expireBy !== undefined) subscriptionData.expire_by = input.expireBy;

      const subscription = await razorpay.subscriptions.create(subscriptionData as never);
      const subscriptionInfo = subscription as unknown as RazorpaySubscriptionInfo;

      logger.info(
        { subscriptionId: subscriptionInfo.id, planId: input.planId },
        'Razorpay subscription created'
      );

      return subscriptionInfo;
    } catch (error) {
      logger.error({ error, input }, 'Failed to create Razorpay subscription');
      throw error;
    }
  }

  /**
   * Get subscription details
   */
  async getSubscription(subscriptionId: string): Promise<RazorpaySubscriptionInfo> {
    try {
      const razorpay = this.getInstance();
      const subscription = await razorpay.subscriptions.fetch(subscriptionId);
      return subscription as unknown as RazorpaySubscriptionInfo;
    } catch (error) {
      logger.error({ error, subscriptionId }, 'Failed to fetch subscription');
      throw error;
    }
  }

  /**
   * Cancel a subscription
   */
  async cancelSubscription(subscriptionId: string, cancelAtCycleEnd = true) {
    try {
      const razorpay = this.getInstance();
      const subscription = await razorpay.subscriptions.cancel(subscriptionId, cancelAtCycleEnd);

      logger.info({ subscriptionId, cancelAtCycleEnd }, 'Razorpay subscription cancelled');

      return subscription;
    } catch (error) {
      logger.error({ error, subscriptionId }, 'Failed to cancel subscription');
      throw error;
    }
  }

  /**
   * Pause a subscription
   */
  async pauseSubscription(subscriptionId: string) {
    try {
      const razorpay = this.getInstance();
      const subscription = await razorpay.subscriptions.pause(subscriptionId);

      logger.info({ subscriptionId }, 'Razorpay subscription paused');
      return subscription;
    } catch (error) {
      logger.error({ error, subscriptionId }, 'Failed to pause subscription');
      throw error;
    }
  }

  /**
   * Resume a paused subscription
   */
  async resumeSubscription(subscriptionId: string) {
    try {
      const razorpay = this.getInstance();
      const subscription = await razorpay.subscriptions.resume(subscriptionId);

      logger.info({ subscriptionId }, 'Razorpay subscription resumed');
      return subscription;
    } catch (error) {
      logger.error({ error, subscriptionId }, 'Failed to resume subscription');
      throw error;
    }
  }

  /**
   * Verify webhook signature
   */
  verifyWebhookSignature(body: string, signature: string): boolean {
    try {
      const webhookSecret = env.RAZORPAY_WEBHOOK_SECRET;
      if (!webhookSecret) {
        logger.warn('Razorpay webhook secret not configured');
        return false;
      }

      const expectedSignature = crypto
        .createHmac('sha256', webhookSecret)
        .update(body)
        .digest('hex');

      return expectedSignature === signature;
    } catch (error) {
      logger.error({ error }, 'Failed to verify webhook signature');
      return false;
    }
  }

  /**
   * Get all available plans
   */
  async getPlans() {
    try {
      const razorpay = this.getInstance();
      const plans = await razorpay.plans.all();
      return plans.items || [];
    } catch (error) {
      logger.error({ error }, 'Failed to fetch plans');
      throw error;
    }
  }

  /**
   * Create a plan in Razorpay
   */
  async createPlan(
    name: string,
    description: string,
    amount: number,
    period: 'daily' | 'weekly' | 'monthly' | 'yearly',
    interval: number = 1,
    currency: string = 'INR',
    notes?: Record<string, string>
  ) {
    try {
      const razorpay = this.getInstance();
      const plan = await razorpay.plans.create({
        period,
        interval,
        item: {
          name,
          description,
          amount,
          currency,
        },
        notes: notes || {},
      });

      logger.info({ planId: plan.id, name, amount }, 'Razorpay plan created');

      return plan;
    } catch (error) {
      logger.error({ error, name }, 'Failed to create Razorpay plan');
      throw error;
    }
  }

  // ==========================================================================
  // Linked Account / Route helpers
  // ==========================================================================

  /**
   * Make an authenticated call to a Razorpay REST endpoint. The Node SDK only
   * surfaces a subset of the v2 Accounts API, so we hit it directly with the
   * same Basic-Auth (key:secret) the SDK uses internally.
   */
  private async apiCall<T>(
    method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE',
    path: string,
    body?: unknown
  ): Promise<T> {
    const keyId = env.RAZORPAY_KEY_ID;
    const keySecret = env.RAZORPAY_KEY_SECRET;
    if (!keyId || !keySecret) {
      throw new Error('Razorpay credentials not configured');
    }
    const url = `https://api.razorpay.com${path}`;
    const authHeader = 'Basic ' + Buffer.from(`${keyId}:${keySecret}`).toString('base64');
    const response = await fetch(url, {
      method,
      headers: {
        Authorization: authHeader,
        'Content-Type': 'application/json',
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    const text = await response.text();
    let parsed: unknown;
    try {
      parsed = text ? JSON.parse(text) : {};
    } catch {
      parsed = { raw: text };
    }
    if (!response.ok) {
      const errBody = parsed as { error?: { description?: string; code?: string } };
      logger.error(
        { method, path, status: response.status, body: parsed },
        'Razorpay API call failed'
      );
      const description = errBody.error?.description ?? `Razorpay ${method} ${path} failed`;
      const apiErr = new Error(description) as Error & {
        status: number;
        rzpCode?: string;
        rzpBody?: unknown;
      };
      apiErr.status = response.status;
      apiErr.rzpCode = errBody.error?.code;
      apiErr.rzpBody = parsed;
      throw apiErr;
    }
    return parsed as T;
  }

  /**
   * Create a Linked Account ("route") via the v2 Accounts API. Bank details are
   * accepted inline; Razorpay does a penny test as part of activation.
   */
  async createLinkedAccount(input: CreateLinkedAccountInput): Promise<RazorpayLinkedAccount> {
    const payload: Record<string, unknown> = {
      email: input.email,
      phone: input.phone,
      type: 'route',
      legal_business_name: input.legalBusinessName,
      business_type: input.businessType,
      reference_id: input.referenceId,
      profile: {
        category: input.category ?? 'education',
        subcategory: input.subcategory ?? 'others',
        addresses: input.addresses
          ? {
              registered: input.addresses.registered
                ? {
                    street1: input.addresses.registered.street1,
                    street2: input.addresses.registered.street2 ?? '',
                    city: input.addresses.registered.city,
                    state: input.addresses.registered.state,
                    postal_code: input.addresses.registered.postalCode,
                    country: input.addresses.registered.country ?? 'IN',
                  }
                : undefined,
            }
          : undefined,
      },
      legal_info: {
        pan: input.panNumber,
        ...(input.gstNumber ? { gst: input.gstNumber } : {}),
      },
      bank_account: {
        ifsc_code: input.bankAccount.ifsc,
        beneficiary_name: input.bankAccount.beneficiaryName,
        account_type: 'current',
        account_number: input.bankAccount.accountNumber,
      },
      notes: input.notes ?? {},
    };
    const account = await this.apiCall<RazorpayLinkedAccount>('POST', '/v2/accounts', payload);
    logger.info(
      { accountId: account.id, status: account.status, email: input.email },
      'Razorpay Linked Account created'
    );
    return account;
  }

  /**
   * Pull the current state of a Linked Account. Used by the "Refresh status"
   * button and as a fallback if a webhook is missed.
   */
  async getLinkedAccount(accountId: string): Promise<RazorpayLinkedAccount> {
    return this.apiCall<RazorpayLinkedAccount>('GET', `/v2/accounts/${accountId}`);
  }

  /**
   * Issue a refund
   */
  async createRefund(paymentId: string, amount?: number, notes?: Record<string, string>) {
    try {
      const razorpay = this.getInstance();
      const refund = await razorpay.payments.refund(paymentId, {
        amount,
        notes: notes || {},
      });

      logger.info({ refundId: refund.id, paymentId, amount }, 'Razorpay refund created');

      return refund;
    } catch (error) {
      logger.error({ error, paymentId }, 'Failed to create refund');
      throw error;
    }
  }
}

export const razorpayService = new RazorpayService();
