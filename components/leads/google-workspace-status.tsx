import Link from "next/link";

import { type GoogleWorkspaceStatusViewModel } from "@/lib/leads/view-models";

export function GoogleWorkspaceStatus({
  workspace,
}: {
  workspace: GoogleWorkspaceStatusViewModel;
}) {
  return (
    <section className="rounded-[2rem] border border-[rgba(210,180,140,0.12)] bg-[rgba(26,21,16,0.92)] p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="space-y-2">
          <p className="font-serif text-xs uppercase tracking-[0.22em] text-tan">
            Google Workspace
          </p>
          <h2 className="font-display text-3xl text-cream">{workspace.title}</h2>
          <p className="max-w-3xl text-sm leading-7 text-[rgba(245,235,212,0.72)]">
            {workspace.description}
            {workspace.connectedEmail ? ` Connected as ${workspace.connectedEmail}.` : ""}
          </p>
        </div>

        {workspace.canStartOAuth ? (
          <Link
            className="inline-flex items-center justify-center rounded-full bg-cream px-5 py-3 text-sm font-semibold text-[#120f0c] transition hover:bg-[#efe3ca]"
            href="/api/google-workspace/connect"
          >
            {workspace.status === "CONNECTED" ? "Reconnect Google" : "Connect Google"}
          </Link>
        ) : (
          <div className="rounded-full border border-[rgba(210,180,140,0.16)] px-5 py-3 text-sm text-[rgba(245,235,212,0.72)]">
            Add env vars to enable connection
          </div>
        )}
      </div>
    </section>
  );
}
