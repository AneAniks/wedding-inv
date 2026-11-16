import { and, eq } from "drizzle-orm";
import { getDb } from "../../../db";
import { responses } from "../../../db/schema";
import {
  errorResponse,
  jsonResponse,
  readJsonObject,
  RequestError,
  sha256,
  uuidPattern,
  validateRsvp,
} from "../../../lib/rsvp-validation";

export async function POST(request: Request) {
  try {
    const payload = await readJsonObject(request);
    const data = validateRsvp(payload);
    const db = getDb();
    const now = new Date().toISOString();

    if (payload.id !== undefined) {
      if (
        typeof payload.id !== "string" ||
        !uuidPattern.test(payload.id) ||
        typeof payload.updateToken !== "string" ||
        payload.updateToken.length !== 64
      ) {
        throw new RequestError(
          "Your saved response could not be verified.",
          403,
        );
      }
      const tokenHash = await sha256(payload.updateToken);
      const [updated] = await db
        .update(responses)
        .set({
          fullName: data.fullName,
          email: data.email,
          attendance: data.attendance,
          guestCount: data.guestCount,
          companions: data.companions,
          dietary: data.dietary,
          message: data.message,
          updatedAt: now,
        })
        .where(
          and(
            eq(responses.id, payload.id),
            eq(responses.updateTokenHash, tokenHash),
          ),
        )
        .returning({ id: responses.id });
      if (!updated) {
        const [existing] = await db
          .select({ id: responses.id })
          .from(responses)
          .where(eq(responses.id, payload.id))
          .limit(1);
        if (!existing)
          throw new RequestError(
            "Your previous response has been removed.",
            404,
          );
        throw new RequestError(
          "Your saved response could not be verified.",
          403,
        );
      }
      return jsonResponse({
        id: updated.id,
        updateToken: payload.updateToken,
        updated: true,
      });
    }

    // The random request UUID also makes retries recover the same update token
    // when the initial response is lost. Keep request identifiers private.
    const updateToken = await sha256(
      `wedding-rsvp-update-v1:${data.requestId}`,
    );
    const updateTokenHash = await sha256(updateToken);
    const [created] = await db
      .insert(responses)
      .values({
        ...data,
        id: crypto.randomUUID(),
        updateTokenHash,
        createdAt: now,
        updatedAt: now,
      })
      .onConflictDoNothing({ target: responses.requestId })
      .returning({ id: responses.id });
    if (created)
      return jsonResponse({ id: created.id, updateToken, updated: false }, 201);

    const [existing] = await db
      .select()
      .from(responses)
      .where(eq(responses.requestId, data.requestId))
      .limit(1);
    if (!existing)
      throw new Error(
        "The saved response could not be retrieved after a retry.",
      );
    const sameResponse =
      existing.fullName === data.fullName &&
      existing.email === data.email &&
      existing.attendance === data.attendance &&
      existing.guestCount === data.guestCount &&
      JSON.stringify(existing.companions) === JSON.stringify(data.companions) &&
      existing.dietary === data.dietary &&
      existing.message === data.message;
    if (!sameResponse) {
      return jsonResponse(
        {
          id: existing.id,
          updateToken,
          error:
            "Your earlier response was saved. Submit again to apply your latest changes.",
        },
        409,
      );
    }
    return jsonResponse({ id: existing.id, updateToken, updated: false });
  } catch (error) {
    return errorResponse(error);
  }
}

export const PUT = POST;
