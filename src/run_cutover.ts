import { executeAppointmentCutover } from "./appointment_cutover.js";
import { cutoverRequestSchema } from "./cutover_contract.js";
import { InfraiDnsClient } from "./infrai_dns_client.js";

const apiKey = process.env.INFRAI_API_KEY;
if (!apiKey) throw new Error("Set INFRAI_API_KEY before running the cutover");

const request = cutoverRequestSchema.parse({
  domain: "clinic.example",
  hostname: "appointments",
  recordType: "CNAME",
  newContent: "appointments-green.example.net",
  rollbackContent: "appointments-blue.example.net",
  ttl: 120,
  changeId: "appt-cutover-2026-10-01",
  appointmentWindow: "2026-10-01T14:00:00.000Z",
  patientNotice: {
    scheduled: true,
    channel: "sms",
    message: "Appointment booking may refresh briefly during the scheduled change."
  }
});

const receipt = await executeAppointmentCutover(new InfraiDnsClient(apiKey), request);
console.log(JSON.stringify(receipt, null, 2));
