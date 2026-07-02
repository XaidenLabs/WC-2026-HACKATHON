import type { PushSubscription } from "web-push";

// In-memory store for Push Subscriptions
export const pushSubscriptions: Set<string> = globalThis.pushSubscriptions || new Set();
globalThis.pushSubscriptions = pushSubscriptions;

export function addSubscription(sub: PushSubscription) {
  pushSubscriptions.add(JSON.stringify(sub));
}

export function getAllSubscriptions(): PushSubscription[] {
  return Array.from(pushSubscriptions).map(s => JSON.parse(s));
}
