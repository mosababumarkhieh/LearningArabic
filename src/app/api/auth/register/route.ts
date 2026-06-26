import { NextResponse } from "next/server";
import { z } from "zod";
import { registerUser, createSession } from "@/lib/auth";

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(6, "Password must be at least 6 characters."),
  name: z.string().optional(),
});

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.errors[0]?.message ?? "Invalid input." },
      { status: 400 },
    );
  }
  try {
    const user = await registerUser(
      parsed.data.email,
      parsed.data.password,
      parsed.data.name,
    );
    await createSession(user.id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Registration failed.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
