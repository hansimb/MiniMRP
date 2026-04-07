import test from "node:test";
import assert from "node:assert/strict";
import {
  createDemoAccessToken,
  isValidDemoAccessToken
} from "../lib/demo-security/auth.ts";
import {
  createRateLimitStore,
  consumeRateLimit
} from "../lib/demo-security/rate-limit.ts";

test("createDemoAccessToken creates a stable token for the same password", () => {
  const first = createDemoAccessToken("demo-secret");
  const second = createDemoAccessToken("demo-secret");

  assert.equal(first, second);
});

test("isValidDemoAccessToken accepts the expected token and rejects wrong ones", () => {
  const password = "demo-secret";
  const token = createDemoAccessToken(password);

  assert.equal(isValidDemoAccessToken(token, password), true);
  assert.equal(isValidDemoAccessToken("wrong-token", password), false);
  assert.equal(isValidDemoAccessToken(token, "different-secret"), false);
});

test("consumeRateLimit allows requests until the configured limit is reached", () => {
  const store = createRateLimitStore();

  const first = consumeRateLimit({
    store,
    key: "ip:write",
    now: 0,
    maxRequests: 2,
    windowMs: 60_000
  });
  const second = consumeRateLimit({
    store,
    key: "ip:write",
    now: 1,
    maxRequests: 2,
    windowMs: 60_000
  });
  const third = consumeRateLimit({
    store,
    key: "ip:write",
    now: 2,
    maxRequests: 2,
    windowMs: 60_000
  });

  assert.equal(first.allowed, true);
  assert.equal(second.allowed, true);
  assert.equal(third.allowed, false);
  assert.equal(third.remaining, 0);
});

test("consumeRateLimit resets after the time window has elapsed", () => {
  const store = createRateLimitStore();

  consumeRateLimit({
    store,
    key: "ip:export",
    now: 0,
    maxRequests: 1,
    windowMs: 1_000
  });

  const blocked = consumeRateLimit({
    store,
    key: "ip:export",
    now: 500,
    maxRequests: 1,
    windowMs: 1_000
  });
  const reset = consumeRateLimit({
    store,
    key: "ip:export",
    now: 1_500,
    maxRequests: 1,
    windowMs: 1_000
  });

  assert.equal(blocked.allowed, false);
  assert.equal(reset.allowed, true);
  assert.equal(reset.remaining, 0);
});
