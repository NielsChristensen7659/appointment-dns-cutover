import assert from "node:assert/strict";
import test from "node:test";
import { cutoverRequestSchema, prepareCutover } from "../src/cutover_contract.js";

const validRequest = {
  domain: "clinic.example",
  hostname: "appointments",
  recordType: "CNAME" as const,
  newContent: "appointments-green.example.net",
  rollbackContent: "appointments-blue.example.net",
  ttl: 120,
  changeId: "change-2026-10-01",
  appointmentWindow: "2026-10-01T14:00:00.000Z",
  patientNotice: {
    scheduled: true as const,
    channel: "sms" as const,
    message: "Appointment booking may refresh briefly during the scheduled change."
  }
};

test("approves a short-TTL cutover and preserves the rollback target", () => {
  const plan = prepareCutover(cutoverRequestSchema.parse(validRequest));
  assert.deepEqual(plan.rollback, {
    name: "appointments",
    content: "appointments-blue.example.net",
    ttl: 120
  });
});

test("rejects a TTL outside the short cutover window", () => {
  const result = cutoverRequestSchema.safeParse({ ...validRequest, ttl: 3600 });
  assert.equal(result.success, false);
});

test("rejects a rollback target that cannot reverse the change", () => {
  const parsed = cutoverRequestSchema.parse({
    ...validRequest,
    rollbackContent: validRequest.newContent
  });
  assert.throws(() => prepareCutover(parsed), /rollback target must differ/);
});
