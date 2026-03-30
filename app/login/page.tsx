import { redirect } from "next/navigation";

import { getOperatorSession } from "@/lib/auth/guards";

export const dynamic = "force-dynamic";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const [session, params] = await Promise.all([getOperatorSession(), searchParams]);

  if (session) {
    redirect("/leads");
  }

  const hasError = params.error === "invalid";

  return (
    <main className="flex min-h-screen items-center justify-center px-6 py-10">
      <section className="dashboard-panel w-full max-w-md rounded-[2rem] p-8">
        <p className="dashboard-eyebrow">
          Operator access
        </p>
        <h1 className="mt-4 font-display text-4xl text-[#172033]">Sign in</h1>
        <p className="mt-3 text-sm leading-7 text-[rgba(22,32,51,0.72)]">
          This dashboard is now restricted to the configured operator account.
        </p>

        <form action="/api/auth/login" className="mt-8 grid gap-4" method="post">
          <label className="grid gap-2 text-sm text-[rgba(22,32,51,0.72)]">
            Email
            <input
              className="rounded-[1rem] border border-[rgba(101,122,179,0.16)] bg-[rgba(248,250,255,0.94)] px-4 py-3 text-[#172033] outline-none transition focus:border-[rgba(101,122,179,0.32)]"
              name="email"
              placeholder="owner@example.com"
              type="email"
              required
            />
          </label>

          <label className="grid gap-2 text-sm text-[rgba(22,32,51,0.72)]">
            Password
            <input
              className="rounded-[1rem] border border-[rgba(101,122,179,0.16)] bg-[rgba(248,250,255,0.94)] px-4 py-3 text-[#172033] outline-none transition focus:border-[rgba(101,122,179,0.32)]"
              name="password"
              type="password"
              required
            />
          </label>

          {hasError ? (
            <p className="text-sm text-[#f1b08f]">
              The email or password did not match the configured operator account.
            </p>
          ) : null}

          <button
            className="dashboard-primary-button mt-2 rounded-full px-5 py-3 text-sm font-semibold transition hover:opacity-95"
            type="submit"
          >
            Sign in
          </button>
        </form>
      </section>
    </main>
  );
}
