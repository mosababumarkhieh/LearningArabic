import { NextResponse } from "next/server";
import { requireUserId, UnauthorizedError } from "@/lib/auth";

/** Wrap an authenticated JSON route handler with consistent error handling. */
export function withUser<T>(
  handler: (userId: string, req: Request) => Promise<T>,
) {
  return async (req: Request) => {
    try {
      const userId = await requireUserId();
      const data = await handler(userId, req);
      return NextResponse.json(data ?? { ok: true });
    } catch (err) {
      if (err instanceof UnauthorizedError) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
      const message =
        err instanceof Error ? err.message : "Something went wrong.";
      console.error("[api]", message, err);
      return NextResponse.json({ error: message }, { status: 400 });
    }
  };
}

export class ApiError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}
