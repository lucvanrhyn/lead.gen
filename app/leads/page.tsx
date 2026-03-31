import { headers } from "next/headers";
import Link from "next/link";
import { after } from "next/server";

import { ApprovalQueue } from "@/components/leads/approval-queue";
import { DiscoveryForm } from "@/components/leads/discovery-form";
import { GoogleWorkspaceStatus } from "@/components/leads/google-workspace-status";
import { IndustryList } from "@/components/leads/industry-list";
import { dispatchDiscoveryProcessing } from "@/lib/jobs/dispatch";
import {
  getApprovalQueue,
  getGoogleWorkspaceStatus,
  getIndustrySummaries,
} from "@/lib/repositories/leads";

export const dynamic = "force-dynamic";

export default async function LeadsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; workspace?: string; reason?: string }>;
}) {
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host");
  const protocol = requestHeaders.get("x-forwarded-proto") ?? "https";
  const origin = host ? `${protocol}://${host}` : undefined;
  const params = await searchParams;
  const workspaceNotice =
    params.workspace === "connected"
      ? {
          tone: "success" as const,
          message: "Google Workspace connected successfully.",
        }
      : params.workspace === "error"
        ? {
            tone: "error" as const,
            message: getWorkspaceErrorMessage(params.reason),
          }
        : undefined;
  const [industries, approvalQueue, workspace] = await Promise.all([
    getIndustrySummaries(),
    getApprovalQueue(),
    getGoogleWorkspaceStatus(),
  ]);

  after(async () => {
    await dispatchDiscoveryProcessing({ origin });
  });

  return (
    <main className="page-frame min-h-screen px-6 py-8 sm:px-10 lg:px-12">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-8">
        <div className="dashboard-panel flex flex-col gap-4 rounded-[3rem] p-8">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="dashboard-eyebrow">
                Lead dashboard
              </p>
              <h1 className="mt-3 font-display text-5xl text-[#172033]">Lead table</h1>
            </div>
          </div>
          <p className="dashboard-copy max-w-3xl text-base leading-8">
            Choose an industry and region, generate a focused lead batch, then open any lead to enrich, score, create a lead magnet, and draft personalized outreach.
          </p>
        </div>

        <DiscoveryForm />
        <GoogleWorkspaceStatus workspace={workspace} notice={workspaceNotice} />
        <ApprovalQueue
          items={approvalQueue.items}
          summary={approvalQueue.summary}
          workspaceConnected={workspace.status === "CONNECTED"}
          campaignAnalytics={approvalQueue.campaignAnalytics}
        />
        <IndustryList industries={industries} />
      </div>
    </main>
  );
}

function getWorkspaceErrorMessage(reason?: string) {
  switch (reason) {
    case "access_denied":
      return "Google sign-in was cancelled before access was granted.";
    case "missing_code":
      return "Google sign-in finished without returning an authorization code. Please try again.";
    case "invalid_state":
      return "Google sign-in could not be verified. Start the connection again from the dashboard.";
    case "token_exchange_failed":
      return "Google sign-in completed, but token exchange failed. Please reconnect and try again.";
    default:
      return "Google Workspace could not be connected. Please try again.";
  }
}
