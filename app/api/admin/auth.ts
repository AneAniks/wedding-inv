import { env } from "cloudflare:workers";
import { RequestError } from "../../../lib/rsvp-validation";

const cookieName = "wedding_admin";
const sessionSeconds = 12 * 60 * 60;

export function adminPassword() {
  if (!env.ADMIN_PASSWORD || env.ADMIN_PASSWORD.length < 12) {
    throw new RequestError(
      "Guest management needs an ADMIN_PASSWORD of at least 12 characters in the server environment.",
      503,
    );
  }
  return env.ADMIN_PASSWORD;
}

function base64url(bytes: Uint8Array) {
  return btoa(String.fromCharCode(...bytes))
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replaceAll("=", "");
}

function decodeBase64url(text: string) {
  return Uint8Array.from(
    atob(text.replaceAll("-", "+").replaceAll("_", "/")),
    (character) => character.charCodeAt(0),
  );
}

async function signingKey() {
  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(adminPassword()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

export async function passwordMatches(value: string) {
  const encoder = new TextEncoder();
  const expected = new Uint8Array(
    await crypto.subtle.digest("SHA-256", encoder.encode(adminPassword())),
  );
  const supplied = new Uint8Array(
    await crypto.subtle.digest("SHA-256", encoder.encode(value)),
  );
  let difference = 0;
  for (let index = 0; index < expected.length; index++)
    difference |= expected[index] ^ supplied[index];
  return difference === 0;
}

export async function sessionCookie(request: Request) {
  const ticket = `${Date.now() + sessionSeconds * 1000}.${crypto.randomUUID()}`;
  const signature = await crypto.subtle.sign(
    "HMAC",
    await signingKey(),
    new TextEncoder().encode(ticket),
  );
  return cookieHeader(
    request,
    `${ticket}.${base64url(new Uint8Array(signature))}`,
    sessionSeconds,
  );
}

export function cookieHeader(request: Request, value = "", maxAge = 0) {
  const secure = new URL(request.url).protocol === "https:" ? "; Secure" : "";
  return `${cookieName}=${value}; Path=/api/admin; HttpOnly; SameSite=Strict; Max-Age=${maxAge}${secure}`;
}

export async function authenticated(request: Request) {
  adminPassword();
  const cookie = request.headers
    .get("Cookie")
    ?.split(";")
    .map((value) => value.trim())
    .find((value) => value.startsWith(`${cookieName}=`))
    ?.slice(cookieName.length + 1);
  if (!cookie || cookie.length > 200) return false;
  const parts = cookie.split(".");
  if (parts.length !== 3) return false;
  const expiresAt = Number(parts[0]);
  if (
    !Number.isFinite(expiresAt) ||
    expiresAt <= Date.now() ||
    expiresAt > Date.now() + sessionSeconds * 1000
  )
    return false;
  try {
    return await crypto.subtle.verify(
      "HMAC",
      await signingKey(),
      decodeBase64url(parts[2]),
      new TextEncoder().encode(`${parts[0]}.${parts[1]}`),
    );
  } catch {
    return false;
  }
}

export async function requireAdmin(request: Request) {
  if (!(await authenticated(request)))
    throw new RequestError("Please sign in to manage your guests.", 401);
}
