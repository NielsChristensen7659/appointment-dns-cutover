import { prepareCutover, type CutoverRequest } from "./cutover_contract.js";
import { InfraiDnsClient, type DnsRecord } from "./infrai_dns_client.js";

export type CutoverReceipt = {
  status: "cutover-written";
  zoneId: string;
  record: DnsRecord;
  appointmentWindow: string;
  patientNotice: CutoverRequest["patientNotice"];
  rollback: { hostname: string; content: string; ttl: number };
};

export async function executeAppointmentCutover(
  client: InfraiDnsClient,
  request: CutoverRequest
): Promise<CutoverReceipt> {
  const plan = prepareCutover(request);
  const zone = await client.getZone(plan.domain);
  const record = await client.upsertRecord({
    zone_id: zone.zone_id,
    record_type: plan.recordType,
    name: plan.hostname,
    content: plan.newContent,
    ttl: plan.ttl,
    changeId: plan.changeId
  });

  return {
    status: "cutover-written",
    zoneId: zone.zone_id,
    record,
    appointmentWindow: plan.appointmentWindow,
    patientNotice: plan.patientNotice,
    rollback: {
      hostname: plan.rollback.name,
      content: plan.rollback.content,
      ttl: plan.rollback.ttl
    }
  };
}
