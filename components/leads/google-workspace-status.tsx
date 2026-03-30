import { type GoogleWorkspaceStatusViewModel } from "@/lib/leads/view-models";

export function GoogleWorkspaceStatus({
  workspace,
  notice,
}: {
  workspace: GoogleWorkspaceStatusViewModel;
  notice?: {
    tone: "success" | "error";
    message: string;
  };
}) {
  return (
    <section className="dashboard-panel rounded-[2rem] p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="space-y-2">
          <p className="dashboard-eyebrow">
            Google Workspace
          </p>
          <h2 className="font-display text-3xl text-[#172033]">{workspace.title}</h2>
          <p className="dashboard-copy max-w-3xl text-sm leading-7">
            {workspace.description}
            {workspace.connectedEmail ? ` Connected as ${workspace.connectedEmail}.` : ""}
          </p>
          {notice ? (
            <p
              className={`max-w-3xl text-sm leading-6 ${
                notice.tone === "success"
                  ? "text-[rgba(67,129,107,0.92)]"
                  : "text-[rgba(186,92,82,0.92)]"
              }`}
            >
              {notice.message}
            </p>
          ) : null}
          {workspace.lastError ? (
            <p className="max-w-3xl text-sm leading-6 text-[rgba(186,92,82,0.92)]">
              {workspace.lastError}
            </p>
          ) : null}
          {workspace.gmailWatchStatus ? (
            <div className="text-xs uppercase tracking-[0.18em] text-[rgba(22,32,51,0.56)]">
              Gmail watch {workspace.gmailWatchStatus.toLowerCase().replace(/_/g, " ")}
              {workspace.gmailWatchExpiresAtLabel
                ? ` · renew by ${workspace.gmailWatchExpiresAtLabel}`
                : ""}
              {workspace.gmailWatchLastNotificationAtLabel
                ? ` · last notification ${workspace.gmailWatchLastNotificationAtLabel}`
                : ""}
            </div>
          ) : null}
          {workspace.gmailWatchLastError ? (
            <p className="max-w-3xl text-sm leading-6 text-[rgba(245,190,170,0.84)]">
              {workspace.gmailWatchLastError}
            </p>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {workspace.canStartOAuth ? (
            <a
              className="dashboard-primary-button inline-flex items-center justify-center rounded-full px-5 py-3 text-sm font-semibold transition hover:opacity-95"
              href="/api/google-workspace/connect"
            >
              {workspace.status === "CONNECTED" ? "Reconnect Google" : "Connect Google"}
            </a>
          ) : (
            <div className="dashboard-secondary-button rounded-full px-5 py-3 text-sm">
              Add env vars to enable connection
            </div>
          )}

          {workspace.canRegisterGmailWatch ? (
            <form action="/api/google-workspace/gmail-watch/register" method="post">
              <button
                className="dashboard-secondary-button inline-flex items-center justify-center rounded-full px-5 py-3 text-sm font-semibold transition hover:bg-white"
                type="submit"
              >
                {workspace.gmailWatchStatus === "SYNCED" ? "Renew Gmail watch" : "Start Gmail watch"}
              </button>
            </form>
          ) : null}
        </div>
      </div>
    </section>
  );
}
