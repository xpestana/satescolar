/**
 * Sends many emails with limited concurrency and a time budget, so a long list never exceeds an
 * Edge Function's time limit. Items not started when the budget runs out are reported as pending.
 */
export interface BatchResult {
  sent: number;
  failed: { item: string; error: string }[];
  pending: number;
}

export async function sendInBatches<T extends { email: string }>(
  items: T[],
  send: (item: T) => Promise<{ sent: boolean; error?: string }>,
  opts: { concurrency: number; budgetMs: number; now?: () => number },
): Promise<BatchResult> {
  const now = opts.now ?? Date.now;
  const deadline = now() + opts.budgetMs;
  const result: BatchResult = { sent: 0, failed: [], pending: 0 };
  let next = 0;

  const worker = async () => {
    while (next < items.length) {
      if (now() >= deadline) return;
      const item = items[next++];
      try {
        const r = await send(item);
        if (r.sent) result.sent++;
        else result.failed.push({ item: item.email, error: r.error ?? "Error desconocido" });
      } catch (e) {
        result.failed.push({ item: item.email, error: e instanceof Error ? e.message : String(e) });
      }
    }
  };

  await Promise.all(Array.from({ length: Math.max(1, opts.concurrency) }, worker));
  result.pending = items.length - next;
  return result;
}
