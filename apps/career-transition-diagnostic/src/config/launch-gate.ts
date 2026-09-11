import { isMockMode } from "./app-mode";

export function paymentsEnabled() {
  if (isMockMode()) {
    return true;
  }
  return process.env.PAYMENTS_ENABLED === "true";
}

export function retentionMs() {
  if (process.env.RETENTION_MS) {
    return Number(process.env.RETENTION_MS);
  }
  const days = Number(process.env.RETENTION_DAYS ?? 90);
  return days * 24 * 60 * 60 * 1000;
}
