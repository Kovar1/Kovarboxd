import { describe, expect, it } from "vitest";
import { isStatementTimeout, retryOnTimeout } from "@/lib/retry";

const timeout = { data: null, error: { message: "canceling statement due to statement timeout" } };
const ok = { data: [1], error: null };

describe("retryOnTimeout", () => {
  it("retries a timeout and returns the first success", async () => {
    const answers = [timeout, ok];
    let calls = 0;
    const result = await retryOnTimeout(async () => answers[calls++], 3, 1);
    expect(result).toBe(ok);
    expect(calls).toBe(2);
  });

  it("gives up after the last try and returns the timeout", async () => {
    let calls = 0;
    const result = await retryOnTimeout(async () => (calls++, timeout), 3, 1);
    expect(result).toBe(timeout);
    expect(calls).toBe(3);
  });

  it("doesn't retry other errors", async () => {
    let calls = 0;
    const other = { data: null, error: { message: "permission denied" } };
    expect(await retryOnTimeout(async () => (calls++, other), 3, 1)).toBe(other);
    expect(calls).toBe(1);
  });

  it("spots a timeout message", () => {
    expect(isStatementTimeout(timeout.error.message)).toBe(true);
    expect(isStatementTimeout("permission denied")).toBe(false);
    expect(isStatementTimeout(undefined)).toBe(false);
  });
});
