import { createHmac, timingSafeEqual } from "node:crypto";
import { isMockMode } from "@/config/app-mode";
import { completePaidOrder } from "../tracer/service";

function webhookSecret() {
  if (process.env.LEMON_SQUEEZY_WEBHOOK_SECRET) {
    return process.env.LEMON_SQUEEZY_WEBHOOK_SECRET;
  }
  if (isMockMode()) {
    return "mock-webhook-secret";
  }
  return "";
}

export function signLemonWebhook(rawBody: string) {
  return createHmac("sha256", webhookSecret()).update(rawBody).digest("hex");
}

export function verifyLemonWebhookSignature(rawBody: string, signature: string) {
  const secret = webhookSecret();
  if (!secret || !signature) {
    return false;
  }
  const expected = Buffer.from(signLemonWebhook(rawBody), "hex");
  const actual = Buffer.from(signature, "hex");
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

type LemonWebhook = {
  meta?: { event_name?: string; webhook_id?: string };
  data?: { id?: string; attributes?: { user_email?: string; status?: string } };
};

export async function processLemonWebhook(rawBody: string, signature: string) {
  if (!verifyLemonWebhookSignature(rawBody, signature)) {
    throw new Error("Invalid webhook signature");
  }

  const payload = JSON.parse(rawBody) as LemonWebhook;
  const orderId = payload.data?.id;
  const email = payload.data?.attributes?.user_email;
  const eventName = payload.meta?.event_name ?? "";

  if (!orderId || !email || !["order_created", "order_paid"].includes(eventName)) {
    throw new Error("Unsupported webhook payload");
  }

  const result = await completePaidOrder({
    email,
    lemonOrderId: orderId,
    lemonWebhookId: payload.meta?.webhook_id ?? orderId,
  });

  return {
    assessmentId: result.assessmentId,
    created: result.created,
  };
}
