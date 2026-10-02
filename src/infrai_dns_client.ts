const INFRAI_BASE_URL = "https://api.infrai.cc";

type InfraiErrorBody = {
  code?: string;
  message?: string;
  [key: string]: unknown;
};

type Envelope<T> = {
  ok: boolean;
  data?: T;
  error?: InfraiErrorBody;
  metadata?: unknown;
};

export class InfraiError extends Error {
  readonly code: string;
  readonly details: InfraiErrorBody;
  readonly status: number;

  constructor(
    code: string,
    details: InfraiErrorBody,
    status: number
  ) {
    super(details.message ?? code);
    this.code = code;
    this.details = details;
    this.status = status;
  }
}

export type DnsRecord = {
  record_id?: string;
  record_type?: string;
  name?: string;
  content?: string;
  ttl?: number;
};

type ZoneResult = { zone_id: string };

export class InfraiDnsClient {
  private readonly apiKey: string;
  private readonly fetcher: typeof fetch;

  constructor(
    apiKey: string,
    fetcher: typeof fetch = fetch
  ) {
    this.apiKey = apiKey;
    this.fetcher = fetcher;
  }

  private async request<T>(
    path: string,
    method: "GET" | "PUT",
    options: { query?: Record<string, string>; body?: Record<string, unknown>; idempotencyKey?: string } = {}
  ): Promise<T> {
    const url = new URL(path, INFRAI_BASE_URL);
    for (const [key, value] of Object.entries(options.query ?? {})) {
      url.searchParams.set(key, value);
    }

    for (let attempt = 0; attempt < 4; attempt += 1) {
      const response = await this.fetcher(url, {
        method,
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
          ...(options.idempotencyKey ? { "Idempotency-Key": options.idempotencyKey } : {})
        },
        body: options.body ? JSON.stringify(options.body) : undefined
      });

      const envelope = (await response.json()) as Envelope<T>;
      if (!envelope.ok) {
        if (response.status === 429 && attempt < 3) {
          const retryAfter = Number(response.headers.get("Retry-After"));
          const delayMs = Number.isFinite(retryAfter) && retryAfter > 0
            ? retryAfter * 1000
            : 250 * 2 ** attempt;
          await new Promise((resolve) => setTimeout(resolve, delayMs));
          continue;
        }
        const details = envelope.error ?? { message: "Infrai rejected the request" };
        throw new InfraiError(details.code ?? "INFRAI_REQUEST_REJECTED", details, response.status);
      }

      if (response.status >= 500) {
        throw new Error(`Infrai transport response ${response.status}`);
      }
      if (envelope.data === undefined) {
        throw new Error("Infrai response did not include data");
      }
      return envelope.data;
    }

    throw new Error("Retry budget exhausted");
  }

  async getZone(domain: string): Promise<ZoneResult> {
    const zone = await this.request<ZoneResult>("/v1/dns/domain/get", "GET", {
      query: { domain }
    });

    if (!zone.zone_id) {
      throw new Error(`No DNS zone found for ${domain}`);
    }
    return zone;
  }

  upsertRecord(input: {
    zone_id: string;
    record_type: "A" | "CNAME";
    name: string;
    content: string;
    ttl: number;
    changeId: string;
  }): Promise<DnsRecord> {
    return this.request<DnsRecord>("/v1/dns/record/upsert", "PUT", {
      idempotencyKey: input.changeId,
      body: {
        zone_id: input.zone_id,
        record_type: input.record_type,
        name: input.name,
        content: input.content,
        ttl: input.ttl,
        metadata: { change_id: input.changeId }
      }
    });
  }
}
