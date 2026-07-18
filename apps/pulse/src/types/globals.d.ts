// Cross-request caches attached to globalThis (survive HMR / warm serverless instances).
declare global {
  var goalCache: Record<number, { p1: number; p2: number; finishedSummarySent?: boolean }>;
  var pushSubscriptions: Set<string>;
}

export {};
