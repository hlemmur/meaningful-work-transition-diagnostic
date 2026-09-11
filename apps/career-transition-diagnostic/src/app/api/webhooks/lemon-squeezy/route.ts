import { processLemonWebhook } from "@/server/access/webhook";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const rawBody = await request.text();
  const signature = request.headers.get("x-signature") ?? "";

  try {
    const result = await processLemonWebhook(rawBody, signature);
    return Response.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Webhook failed";
    const status = message === "Invalid webhook signature" ? 401 : 400;
    return Response.json({ error: message }, { status });
  }
}
