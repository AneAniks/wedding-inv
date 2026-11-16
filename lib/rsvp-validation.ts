import type { Companion } from "../db/schema";

export class RequestError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}

export const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function jsonResponse(
  body: unknown,
  status = 200,
  headers?: HeadersInit,
) {
  const responseHeaders = new Headers(headers);
  responseHeaders.set("Cache-Control", "no-store");
  return Response.json(body, { status, headers: responseHeaders });
}

export function errorResponse(error: unknown) {
  if (error instanceof RequestError) {
    return jsonResponse({ error: error.message }, error.status);
  }
  console.error("Wedding invitation request failed", error);
  return jsonResponse(
    { error: "We could not save your response. Please try again." },
    503,
  );
}

export function verifySameOrigin(request: Request) {
  const origin = request.headers.get("Origin");
  if (
    (origin && origin !== new URL(request.url).origin) ||
    request.headers.get("Sec-Fetch-Site") === "cross-site"
  ) {
    throw new RequestError(
      "This request must come from the invitation website.",
      403,
    );
  }
}

export async function readJsonObject(
  request: Request,
): Promise<Record<string, unknown>> {
  const limit = 32_768;
  const chunks: Uint8Array[] = [];
  let size = 0;
  if (request.body) {
    const reader = request.body.getReader();
    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > limit) {
          await reader.cancel();
          throw new RequestError("The request is too large.", 413);
        }
        chunks.push(value);
      }
    } finally {
      reader.releaseLock();
    }
  }
  verifySameOrigin(request);
  if (
    !request.headers
      .get("Content-Type")
      ?.toLowerCase()
      .startsWith("application/json")
  ) {
    throw new RequestError("Please send a JSON request.", 415);
  }
  if (!size) throw new RequestError("The request is empty.");
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  let payload: unknown;
  try {
    payload = JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    throw new RequestError("The request contains invalid JSON.");
  }
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new RequestError("The request must contain an object.");
  }
  return payload as Record<string, unknown>;
}

function textField(
  value: unknown,
  label: string,
  limit: number,
  required = false,
) {
  if (value === undefined || value === null) value = "";
  if (typeof value !== "string")
    throw new RequestError(`${label} must be text.`);
  const text = value.trim();
  if (required && !text) throw new RequestError(`${label} is required.`);
  if (text.length > limit) throw new RequestError(`${label} is too long.`);
  return text;
}

export function validateRsvp(payload: Record<string, unknown>) {
  const requestId = textField(
    payload.requestId,
    "Request identifier",
    36,
    true,
  );
  if (!uuidPattern.test(requestId))
    throw new RequestError("The request identifier is invalid.");
  const fullName = textField(payload.fullName, "Your name", 140, true);
  const email = textField(payload.email, "Email", 254);
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new RequestError("Please enter a valid email address.");
  }
  if (payload.attendance !== "yes" && payload.attendance !== "no") {
    throw new RequestError("Please select whether you can attend.");
  }
  const attendance: "yes" | "no" = payload.attendance;
  if (
    typeof payload.guestCount !== "number" ||
    !Number.isInteger(payload.guestCount)
  ) {
    throw new RequestError("The number of guests must be a whole number.");
  }
  const guestCount = attendance === "yes" ? payload.guestCount : 0;
  if (attendance === "yes" && (guestCount < 1 || guestCount > 10)) {
    throw new RequestError("Please select between 1 and 10 guests.");
  }
  const companionValues = payload.companions ?? [];
  if (!Array.isArray(companionValues) || companionValues.length > 9) {
    throw new RequestError("The companion list is invalid.");
  }
  const companions: Companion[] =
    attendance === "yes"
      ? companionValues.map((value, index) => {
          if (!value || typeof value !== "object" || Array.isArray(value)) {
            throw new RequestError("The companion list is invalid.");
          }
          return {
            name: textField(value.name, `Guest ${index + 2} name`, 140, true),
            dietary: textField(
              value.dietary,
              `Guest ${index + 2} dietary requirements`,
              500,
            ),
          };
        })
      : [];
  if (companions.length !== Math.max(0, guestCount - 1)) {
    throw new RequestError("Please enter the name of each guest.");
  }
  return {
    requestId,
    fullName,
    email,
    attendance,
    guestCount,
    companions,
    dietary:
      attendance === "yes"
        ? textField(payload.dietary, "Dietary requirements", 500)
        : "",
    message: textField(payload.message, "Your message", 2000),
  };
}

export async function sha256(value: string) {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(value),
  );
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}
