import { describe, expect, it } from "vitest";
import request from "supertest";
import jwt from "jsonwebtoken";
import { createApp } from "../src/app.js";
import { makeTestContainer } from "./fakeContainer.js";

// A listed tenant should pass the allowlist gate (proven by getting a
// *different* error further down the stack, not a 403) — the counterpart to
// mainnetGateBlocked.test.ts's "not listed" case.
process.env.STELLAR_NETWORK = "mainnet";
process.env.MAINNET_ALLOWLIST_TENANT_IDS = "t1";

const app = createApp(makeTestContainer());

function userToken(): string {
  return jwt.sign({ sub: "u1", email: "u@test" }, process.env.SUPABASE_JWT_SECRET!, {
    algorithm: "HS256",
    expiresIn: "1h",
  });
}

describe("mainnet allowlist gate — tenant listed", () => {
  it("lets treasury/prepare through the gate (fails later for an unrelated reason)", async () => {
    const res = await request(app)
      .post("/api/v1/treasury/prepare")
      .set("authorization", `Bearer ${userToken()}`)
      .set("x-tenant-id", "t1")
      .send({
        venue: "blend",
        direction: "supply",
        asset: "XLM",
        amountBaseUnits: "100",
        address: "G" + "A".repeat(55),
      });
    expect(res.status).not.toBe(403);
  });
});
