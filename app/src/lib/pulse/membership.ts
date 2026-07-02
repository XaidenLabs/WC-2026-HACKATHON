// Wallet-free sweepstake identity. A participant's membership (their private member id +
// assigned team) lives in localStorage, keyed by group code — no login required.

export type Membership = {
  memberId: string;
  name: string;
  team: string;
  groupName: string;
};

const KEY = "pulse_sweeps";

export function getMemberships(): Record<string, Membership> {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(localStorage.getItem(KEY) || "{}") as Record<string, Membership>;
  } catch {
    return {};
  }
}

export function getMembership(code: string): Membership | null {
  return getMemberships()[code.toUpperCase()] ?? null;
}

export function saveMembership(code: string, m: Membership): void {
  if (typeof window === "undefined") return;
  const all = getMemberships();
  all[code.toUpperCase()] = m;
  localStorage.setItem(KEY, JSON.stringify(all));
}
