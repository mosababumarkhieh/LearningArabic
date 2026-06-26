import { redirect } from "next/navigation";
import { getSessionUserId } from "@/lib/auth";
import { AuthForm } from "@/components/auth-form";

export default async function LoginPage() {
  if (await getSessionUserId()) redirect("/");
  return <AuthForm mode="login" />;
}
