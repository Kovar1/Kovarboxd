// Retries for catalog reads that can time out when the free database has gone
// cold. The anon role has a 3-second statement limit, and a cold full-table
// scan can pass it once and then run well under it on the next try.

export function isStatementTimeout(message: string | undefined): boolean {
  return !!message && /statement timeout/i.test(message);
}

/**
 * Runs a Data API read again while it fails with a statement timeout, waiting
 * a little longer each time. Any other error comes back straight away.
 */
export async function retryOnTimeout<T extends { error: { message: string } | null }>(
  read: () => PromiseLike<T>,
  tries = 3,
  waitMs = 1500,
): Promise<T> {
  let result = await read();
  for (let attempt = 1; attempt < tries && isStatementTimeout(result.error?.message); attempt++) {
    await new Promise((resolve) => setTimeout(resolve, waitMs * attempt));
    result = await read();
  }
  return result;
}
