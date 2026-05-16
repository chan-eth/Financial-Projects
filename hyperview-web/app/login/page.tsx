import Link from "next/link";
import { redirect } from "next/navigation";
import { PasskeyLoginForm } from "@/components/PasskeyLoginForm";
import { getCurrentUser } from "@/lib/authServer";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  const me = await getCurrentUser();
  if (me) redirect("/account");

  return (
    <main className="min-h-dvh flex flex-col gap-6 px-6 py-10 max-w-2xl mx-auto">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Sign in</h1>
        <p className="mt-1 text-sm text-neutral-400">
          Use the passkey you registered with HyperView on this device.
        </p>
      </header>

      <PasskeyLoginForm />

      <footer className="text-xs text-neutral-500">
        New here?{" "}
        <Link href="/signup" className="underline hover:text-neutral-300">
          Create a passkey
        </Link>
        .
      </footer>
    </main>
  );
}
