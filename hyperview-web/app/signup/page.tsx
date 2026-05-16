import Link from "next/link";
import { redirect } from "next/navigation";
import { PasskeyRegisterForm } from "@/components/PasskeyRegisterForm";
import { getCurrentUser } from "@/lib/authServer";

export const dynamic = "force-dynamic";

export default async function SignupPage() {
  const me = await getCurrentUser();
  if (me) redirect("/account");

  return (
    <main className="min-h-dvh flex flex-col gap-6 px-6 py-10 max-w-2xl mx-auto">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Create a passkey</h1>
        <p className="mt-1 text-sm text-neutral-400">
          HyperView uses passkeys instead of passwords. Your browser or password
          manager will create one, store it on this device, and unlock it with
          your biometric.
        </p>
      </header>

      <PasskeyRegisterForm />

      <footer className="text-xs text-neutral-500">
        Already have a passkey?{" "}
        <Link href="/login" className="underline hover:text-neutral-300">
          Sign in
        </Link>
        .
      </footer>
    </main>
  );
}
