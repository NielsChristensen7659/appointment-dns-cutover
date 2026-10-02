import { createServer } from "node:http";
import { ZodError } from "zod";
import { executeAppointmentCutover } from "./appointment_cutover.js";
import { cutoverRequestSchema } from "./cutover_contract.js";
import { InfraiDnsClient, InfraiError } from "./infrai_dns_client.js";

const apiKey = process.env.INFRAI_API_KEY;
if (!apiKey) throw new Error("Set INFRAI_API_KEY before starting the service");

const client = new InfraiDnsClient(apiKey);
const port = Number(process.env.PORT ?? 3000);

function send(response: import("node:http").ServerResponse, status: number, body: unknown): void {
  response.writeHead(status, { "Content-Type": "application/json" });
  response.end(JSON.stringify(body));
}

createServer(async (request, response) => {
  if (request.method !== "POST" || request.url !== "/appointment-cutovers") {
    send(response, 404, { error: "Route not found" });
    return;
  }

  try {
    const chunks: Buffer[] = [];
    for await (const chunk of request) chunks.push(Buffer.from(chunk));
    const parsed = cutoverRequestSchema.parse(JSON.parse(Buffer.concat(chunks).toString("utf8")));
    const receipt = await executeAppointmentCutover(client, parsed);
    send(response, 201, receipt);
  } catch (error) {
    if (error instanceof ZodError || error instanceof SyntaxError) {
      send(response, 400, { error: "Invalid cutover request" });
      return;
    }
    if (error instanceof InfraiError) {
      const status = error.status >= 400 && error.status < 500 ? error.status : 502;
      send(response, status, { error: error.code, message: error.message });
      return;
    }
    send(response, 500, { error: "Cutover could not be completed" });
  }
}).listen(port, () => {
  console.log(`Appointment cutover service listening on http://localhost:${port}`);
});
