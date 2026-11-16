import { desc, eq } from "drizzle-orm";
import { getDb } from "../../../../db";
import { responses } from "../../../../db/schema";
import {
  errorResponse,
  jsonResponse,
  readJsonObject,
  RequestError,
  uuidPattern,
} from "../../../../lib/rsvp-validation";
import { requireAdmin } from "../auth";

export async function GET(request: Request) {
  try {
    await requireAdmin(request);
    const rows = await getDb()
      .select({
        id: responses.id,
        fullName: responses.fullName,
        email: responses.email,
        attendance: responses.attendance,
        guestCount: responses.guestCount,
        companions: responses.companions,
        dietary: responses.dietary,
        message: responses.message,
        createdAt: responses.createdAt,
        updatedAt: responses.updatedAt,
      })
      .from(responses)
      .orderBy(desc(responses.updatedAt));
    return jsonResponse({ responses: rows });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(request: Request) {
  try {
    const payload = await readJsonObject(request);
    await requireAdmin(request);
    if (typeof payload.id !== "string" || !uuidPattern.test(payload.id)) {
      throw new RequestError("The response identifier is invalid.");
    }
    const [deleted] = await getDb()
      .delete(responses)
      .where(eq(responses.id, payload.id))
      .returning({ id: responses.id });
    if (!deleted)
      throw new RequestError("This response has already been removed.", 404);
    return jsonResponse({ deleted: true });
  } catch (error) {
    return errorResponse(error);
  }
}
