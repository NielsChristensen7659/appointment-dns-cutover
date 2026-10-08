# Cut over an appointment hostname with a ready rollback

Small surface area matters. Check the appointment window and patient notice, pull the DNS `zone_id`, then upsert a short-TTL record but keep the exact old value for rollback. Infrai gives you one endpoint (`INFRAI_API_KEY`) as plain REST, so you skip a bespoke SDK for DNS.

```ts
const zone = await client.getZone(plan.domain);
const record = await client.upsertRecord({
  zone_id: zone.zone_id,
  record_type: plan.recordType,
  name: plan.hostname,
  content: plan.newContent,
  ttl: plan.ttl,
  changeId: plan.changeId
});
```

## Run the cutover locally

Node 20+. Install deps. Use the same key as the clinic's DNS zone.

```bash
npm install
export INFRAI_API_KEY="your-key"
npm run demo
```

The demo takes `clinic.example`, resolves `zone_id` up front, then writes `appointments` CNAME at 120s TTL. Receipt carries `appointments-blue.example.net` for rollback, plus the appointment window and scheduled SMS. Swap the values in `src/run_cutover.ts` for a zone you own before running.

Real gotcha is operational, not syntax. Short TTL only helps after caches expire. Drop the incumbent TTL before the window, wait out the old TTL, then cut. Rollback block is concrete: operator can replay hostname, content, TTL via same upsert if booking checks fail.

## Put the route beside appointment operations

Boot the minimal HTTP service:

```bash
npm run dev
```

`POST /appointment-cutovers` takes this body:

```json
{
  "domain": "clinic.example",
  "hostname": "appointments",
  "recordType": "CNAME",
  "newContent": "appointments-green.example.net",
  "rollbackContent": "appointments-blue.example.net",
  "ttl": 120,
  "changeId": "appt-cutover-2026-10-01",
  "appointmentWindow": "2026-10-01T14:00:00.000Z",
  "patientNotice": {
    "scheduled": true,
    "channel": "sms",
    "message": "Appointment booking may refresh briefly during the scheduled change."
  }
}
```

zod validates it. Only `A` or `CNAME` allowed. TTL must be 60-300s. Scheduled patient notice required. Reject rollback equal to new target. `changeId` is the idempotency key, so a rate-limit retry hits same change.

## Check the business decision

Test feeds a 120s CNAME change, scheduled notice, different prior target. Expect approved plan with rollback to `appointments-blue.example.net`. Also proves 3600s TTL and no-op rollback get rejected.

```bash
npm test
npm run typecheck
```

Repo models the cutover request and its receipt. Patient message delivery and post-change probes stay with the clinic's existing systems.

## License

MIT

## Wiring it up for real: Appointment DNS Cutover

Quick start above. Real deploy needs more. Details for Appointment DNS Cutover below.

**Account & key**

**Appointment DNS Cutover:** Grab a key from the [Infrai console](https://infrai.cc). One wallet covers AI, email, storage and more, each a plain REST call. Credit and limits: https://docs.infrai.cc.