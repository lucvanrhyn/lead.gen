import { DiagnosticFormResponseStatus, WorkspaceConnectionStatus } from "@prisma/client";

import type { DiagnosticFormBlueprint } from "@/lib/domain/diagnostic-forms";
import { createGoogleWorkspaceDiagnosticForm } from "@/lib/providers/google-workspace/forms";
import { createAuthorizedGoogleClient } from "@/lib/providers/google-workspace/oauth";

export async function createLiveDiagnosticFormLink(input: {
  blueprintId: string;
  blueprint: DiagnosticFormBlueprint;
}) {
  const { db } = await import("@/lib/db");

  const connection = await db.googleWorkspaceConnection.findUnique({
    where: { provider: "google_workspace" },
  });

  if (!connection || connection.status !== WorkspaceConnectionStatus.CONNECTED) {
    return null;
  }

  const auth = await createAuthorizedGoogleClient(connection);
  const liveForm = await createGoogleWorkspaceDiagnosticForm({
    auth,
    blueprint: input.blueprint,
  });

  const existingLink = await db.diagnosticFormLink.findUnique({
    where: { blueprintId: input.blueprintId },
    select: {
      id: true,
      responseStatus: true,
    },
  });

  const formLink = existingLink
    ? await db.diagnosticFormLink.update({
        where: { blueprintId: input.blueprintId },
        data: {
          url: liveForm.responderUrl,
          responseStatus:
            existingLink.responseStatus === DiagnosticFormResponseStatus.NOT_SHARED
              ? DiagnosticFormResponseStatus.LINK_ATTACHED
              : existingLink.responseStatus,
        },
      })
    : await db.diagnosticFormLink.create({
        data: {
          blueprintId: input.blueprintId,
          url: liveForm.responderUrl,
          responseStatus: DiagnosticFormResponseStatus.LINK_ATTACHED,
        },
      });

  return {
    ...liveForm,
    formLink,
  };
}
