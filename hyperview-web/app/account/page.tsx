import { redirect } from "next/navigation";
import { LogoutButton } from "@/components/LogoutButton";
import { getCurrentUser } from "@/lib/authServer";

export const dynamic = "force-dynamic";

export default async function AccountPage() {
  const me = await getCurrentUser();
  if (!me) redirect("/login");

  const tierLabel: Record<string, string> = {
    free: "Free",
    premium: "Premium",
    team: "Team",
  };

  return (
    <main className="min-h-dvh flex flex-col gap-8 px-6 py-10 max-w-3xl mx-auto">
      <header className="flex items-baseline justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Account</h1>
          <p className="mt-1 text-sm text-neutral-400">
            Signed in as{" "}
            <span className="font-mono text-neutral-300">
              {me.user.displayName ?? shortAddress(me.user.primaryAddress)}
            </span>
          </p>
        </div>
        <LogoutButton />
      </header>

      <section className="rounded-lg border border-neutral-800 bg-neutral-950 p-5">
        <h2 className="text-sm font-medium uppercase tracking-wider text-neutral-400">
          Profile
        </h2>
        <dl className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Row label="User ID" value={me.user.userId} mono />
          <Row label="Primary address" value={me.user.primaryAddress} mono />
          <Row label="Display name" value={me.user.displayName ?? "—"} />
          <Row label="Tier" value={tierLabel[me.user.entitlementTier] ?? me.user.entitlementTier} />
        </dl>
      </section>

      <section className="rounded-lg border border-neutral-800 bg-neutral-950 p-5">
        <h2 className="text-sm font-medium uppercase tracking-wider text-neutral-400">
          Passkeys ({me.passkeys.length})
        </h2>
        <ul className="mt-3 flex flex-col gap-2">
          {me.passkeys.map((p) => (
            <li
              key={p.credentialId}
              className="flex flex-col gap-1 rounded-md border border-neutral-900 bg-neutral-950/60 p-3"
            >
              <div className="text-sm">{p.deviceLabel ?? "Unlabeled device"}</div>
              <div className="text-xs font-mono text-neutral-500 break-all">
                {shortCredId(p.credentialId)}
              </div>
              <div className="text-xs text-neutral-500">
                Added {p.createdAt} · Last used {p.lastUsedAt ?? "never"}
              </div>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-xs text-neutral-500">
          Adding additional passkeys for other devices lands in M2.
        </p>
      </section>
    </main>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wider text-neutral-500">{label}</dt>
      <dd className={`mt-1 text-sm ${mono ? "font-mono" : ""} text-neutral-200 break-all`}>
        {value}
      </dd>
    </div>
  );
}

function shortAddress(a: string): string {
  if (a.length < 14) return a;
  return `${a.slice(0, 6)}…${a.slice(-4)}`;
}

function shortCredId(id: string): string {
  if (id.length < 28) return id;
  return `${id.slice(0, 12)}…${id.slice(-8)}`;
}
