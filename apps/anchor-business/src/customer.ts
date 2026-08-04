import { randomUUID } from "node:crypto";
import type { Request, Response } from "express";

/**
 * GET/PUT/DELETE /customer — the SEP-12 KYC callback contract. Shapes
 * verified against api-schema/src/main/java/org/stellar/anchor/api/callback/
 * {Get,Put}CustomerRequest.java and GetCustomerResponse.java (tag 4.6.2), not
 * guessed.
 *
 * Testnet demo scope: any submitted KYC is accepted immediately, no manual
 * review — same as every other reference/demo anchor (this is explicitly
 * NOT a real KYC vetting process; the value being demonstrated is the
 * protocol wiring, not a compliance pipeline). In-memory store only.
 */
interface StoredCustomer {
  id: string;
  account?: string;
  memo?: string;
  type?: string;
  fields: Record<string, unknown>;
  status: "ACCEPTED";
}

const byId = new Map<string, StoredCustomer>();
const byAccount = new Map<string, string>(); // `${account}:${memo ?? ""}:${type ?? ""}` -> id

const REQUIRED_FIELDS = {
  first_name: { type: "string", description: "Given name or first name", optional: false },
  last_name: { type: "string", description: "Family name or last name", optional: false },
  email_address: { type: "string", description: "Email address", optional: false },
} as const;

function accountKey(account?: string, memo?: string, type?: string) {
  return `${account ?? ""}:${memo ?? ""}:${type ?? ""}`;
}

export function getCustomerHandler() {
  return (req: Request, res: Response) => {
    const id = typeof req.query.id === "string" ? req.query.id : undefined;
    const account = typeof req.query.account === "string" ? req.query.account : undefined;
    const memo = typeof req.query.memo === "string" ? req.query.memo : undefined;
    const type = typeof req.query.type === "string" ? req.query.type : undefined;

    const resolvedId = id ?? byAccount.get(accountKey(account, memo, type));
    const existing = resolvedId ? byId.get(resolvedId) : undefined;

    if (!existing) {
      // No record yet — SEP-12 expects the required-fields list back, no id.
      res.json({ status: "NEEDS_INFO", fields: REQUIRED_FIELDS });
      return;
    }
    res.json({
      id: existing.id,
      status: existing.status,
      provided_fields: Object.fromEntries(
        Object.keys(REQUIRED_FIELDS).map((k) => [k, { type: "string", status: "ACCEPTED" }]),
      ),
    });
  };
}

export function putCustomerHandler() {
  return (req: Request, res: Response) => {
    const body = req.body as Record<string, unknown>;
    const account = typeof body.account === "string" ? body.account : undefined;
    const memo = typeof body.memo === "string" ? body.memo : undefined;
    const type = typeof body.type === "string" ? body.type : undefined;
    const existingId = typeof body.id === "string" ? body.id : byAccount.get(accountKey(account, memo, type));

    const id = existingId ?? randomUUID();
    const record: StoredCustomer = {
      id,
      account,
      memo,
      type,
      fields: body,
      status: "ACCEPTED",
    };
    byId.set(id, record);
    byAccount.set(accountKey(account, memo, type), id);
    res.json({ id, status: "ACCEPTED" });
  };
}

export function deleteCustomerHandler() {
  return (req: Request, res: Response) => {
    const id = typeof req.query.id === "string" ? req.query.id : undefined;
    const account = typeof req.query.account === "string" ? req.query.account : undefined;
    const memo = typeof req.query.memo === "string" ? req.query.memo : undefined;
    const type = typeof req.query.type === "string" ? req.query.type : undefined;
    const resolvedId = id ?? byAccount.get(accountKey(account, memo, type));
    if (resolvedId) {
      const rec = byId.get(resolvedId);
      byId.delete(resolvedId);
      if (rec) byAccount.delete(accountKey(rec.account, rec.memo, rec.type));
    }
    res.status(204).end();
  };
}
