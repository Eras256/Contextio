import { describe, expect, it } from "vitest";
import request from "supertest";
import jwt from "jsonwebtoken";
import { createApp } from "../src/app.js";
import { makeTestContainer } from "./fakeContainer.js";

// "Por invitación": on mainnet with an empty allowlist, nobody should be able
// to reach the self-custody money-moving endpoints — verified end-to-end
// through the real middleware chain, not just by reading the code.
process.env.STELLAR_NETWORK = "mainnet";
process.env.MAINNET_ALLOWLIST_TENANT_IDS = "";

const app = createApp(makeTestContainer());

function userToken(): string {
  return jwt.sign({ sub: "u1", email: "u@test" }, process.env.SUPABASE_JWT_SECRET!, {
    algorithm: "HS256",
    expiresIn: "1h",
  });
}

describe("mainnet allowlist gate — tenant not listed", () => {
  it("blocks treasury/prepare with 403 before touching Blend/DeFindex", async () => {
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
    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/invitation-only/i);
  });

  it("blocks payroll/runs/prepare with 403", async () => {
    const res = await request(app)
      .post("/api/v1/payroll/runs/prepare")
      .set("authorization", `Bearer ${userToken()}`)
      .set("x-tenant-id", "t1")
      .send({
        scheduleId: "11111111-1111-4111-8111-111111111111",
        address: "G" + "A".repeat(55),
        contractorAttestation: true,
        acknowledgeTerms: true,
      });
    expect(res.status).toBe(403);
  });
});
