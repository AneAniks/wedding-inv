import { env } from "cloudflare:workers";
import {
  errorResponse,
  jsonResponse,
  readJsonObject,
  RequestError,
  verifySameOrigin,
} from "../../../../lib/rsvp-validation";
import {
  authenticated,
  cookieHeader,
  passwordMatches,
  sessionCookie,
} from "../auth";

export async function GET(request: Request) {
  try {
    const configured = Boolean(
      env.ADMIN_PASSWORD && env.ADMIN_PASSWORD.length >= 12,
    );
    return jsonResponse({
      configured,
      authenticated: configured && (await authenticated(request)),
    });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const payload = await readJsonObject(request);
    if (
      typeof payload.password !== "string" ||
      payload.password.length > 500 ||
      !(await passwordMatches(payload.password))
    ) {
      throw new RequestError("The password is incorrect.", 401);
    }
    return jsonResponse({ authenticated: true }, 200, {
      "Set-Cookie": await sessionCookie(request),
    });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(request: Request) {
  try {
    if (request.body) await readJsonObject(request);
    else verifySameOrigin(request);
    return jsonResponse({ authenticated: false }, 200, {
      "Set-Cookie": cookieHeader(request),
    });
  } catch (error) {
    return errorResponse(error);
  }
}
