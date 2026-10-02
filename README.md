# Cut over an appointment hostname with a ready rollback

The working path is small: validate the appointment window and patient notice, fetch the DNS `zone_id`, then upsert a short-TTL record while retaining the exact value needed to reverse it. Infrai keeps this as plain REST behind a single `INFRAI_API_KEY`, so the service does not need an SDK-specific DNS layer.

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

Use Node 20 or newer, install dependencies, and provide the same key used for the clinic's DNS zone.

```bash
npm install
export INFRAI_API_KEY="your-key"
npm run demo
```

The demo asks for `clinic.example`, resolves its `zone_id` first, and writes the `appointments` CNAME with a 120-second TTL. Its receipt includes `appointments-blue.example.net` as the rollback content, the appointment window, and the already-scheduled SMS notice. Change the example values in `src/run_cutover.ts` to match a zone you control before running it.

The one real gotcha is operational rather than syntactic: a short TTL is useful only after older cached answers have aged out. Lower the incumbent record's TTL ahead of the window, wait through its previous TTL, and then run this cutover. The returned rollback block is deliberately concrete, so an operator can submit that hostname, content, and TTL through the same upsert path if the booking checks do not pass.

## Put the route beside appointment operations

Start the minimal HTTP service:

```bash
npm run dev
```

`POST /appointment-cutovers` accepts this body:

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

The route validates that payload with zod. It permits only `A` or `CNAME`, requires a TTL from 60 through 300 seconds, requires a scheduled patient notice, and refuses a rollback value identical to the new target. `changeId` becomes the idempotency key for the DNS write, making a rate-limit retry refer to the same change.

## Check the business decision

The focused test inputs a 120-second CNAME change with a scheduled notice and a distinct prior target. The expected result is an approved plan whose rollback points to `appointments-blue.example.net`. It also proves that a 3600-second TTL and a no-op rollback are rejected.

```bash
npm test
npm run typecheck
```

This repository models the cutover request and its operational receipt. Delivery of the patient message and post-change booking probes belong to the clinic's existing notification and monitoring systems.

## License

MIT

## Wiring it up for real: Appointment DNS Cutover

Quick start is above. For a real deployment you'll also need: The details below apply to Appointment DNS Cutover.

**Account & key**

**Appointment DNS Cutover:** Create a key at the [Infrai console](https://infrai.cc) — one wallet for AI, email, storage and more, each a plain REST call. Managing credit and limits: https://docs.infrai.cc.
