import { NextRequest, NextResponse } from 'next/server';
import { verifyWebhookSecret } from '@/lib/thrivecart/config';
import { processWebhookEvent } from '@/lib/thrivecart/webhook-handler';
import type { ThriveCartWebhookPayload } from '@/lib/thrivecart/types';

/**
 * HEAD /api/webhooks/thrivecart
 * ThriveCart pings this to verify the endpoint exists.
 */
export async function HEAD() {
  return new NextResponse(null, { status: 200 });
}

/**
 * POST /api/webhooks/thrivecart
 * Receives all ThriveCart webhook events.
 */
export async function POST(req: NextRequest) {
  try {
    let payload: ThriveCartWebhookPayload;

    const contentType = req.headers.get('content-type') || '';

    if (contentType.includes('application/json')) {
      payload = await req.json();
    } else {
      // ThriveCart standard webhooks send form-encoded data
      const formData = await req.formData();
      payload = Object.fromEntries(formData.entries()) as unknown as ThriveCartWebhookPayload;

      // Parse nested JSON fields that ThriveCart sends as strings
      const raw = payload as unknown as Record<string, unknown>;
      for (const key of ['customer', 'order', 'purchases', 'purchase_map']) {
        if (typeof raw[key] === 'string') {
          try {
            raw[key] = JSON.parse(raw[key] as string);
          } catch {
            // Leave as string if not valid JSON
          }
        }
      }

      // Parse numeric fields
      if (typeof payload.order_id === 'string') {
        payload.order_id = Number(payload.order_id);
      }
      if (typeof payload.customer_id === 'string') {
        payload.customer_id = Number(payload.customer_id);
      }
      if (typeof payload.base_product === 'string') {
        payload.base_product = Number(payload.base_product);
      }
    }

    // Verify webhook authenticity
    if (!payload.thrivecart_secret || !verifyWebhookSecret(payload.thrivecart_secret)) {
      console.warn('[ThriveCart Webhook] Invalid secret');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log(`[ThriveCart Webhook] ${payload.event} for ${payload.customer?.email}`);

    // Process the event
    const result = await processWebhookEvent(payload);

    console.log(`[ThriveCart Webhook] Result:`, result.action, result.success ? 'OK' : 'FAILED');

    return NextResponse.json(result, { status: result.success ? 200 : 500 });
  } catch (error) {
    console.error('[ThriveCart Webhook] Unhandled error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
