import { JobStatus } from "@prisma/client";

import { db } from "@/lib/db";
import { deriveBatchStatusSummary } from "@/lib/domain/batches";
import { runCompanyFullPipeline } from "@/lib/orchestration/full-pipeline";
import {
  type GooglePlacesSearchInput,
  searchGooglePlaces,
} from "@/lib/providers/google-places/client";

type PipelineItem = {
  companyId: string;
};

export async function runDiscoveryBatchPipeline(
  items: PipelineItem[],
  options?: {
    runCompanyPipeline?: (item: PipelineItem) => Promise<{ status: JobStatus; error?: string }>;
  },
) {
  const runCompanyPipeline =
    options?.runCompanyPipeline ??
    (async (item: PipelineItem) => runCompanyFullPipeline(item.companyId));

  const statuses: Array<{ companyId: string; status: JobStatus; error?: string }> = [];

  for (const item of items) {
    const result = await runCompanyPipeline(item);
    statuses.push({
      companyId: item.companyId,
      status: result.status,
      error: result.error,
    });
  }

  return {
    ...deriveBatchStatusSummary(statuses),
    items: statuses,
  };
}

export async function createDiscoveryBatch(input: GooglePlacesSearchInput & { autoRunPipeline?: boolean }) {
  const batch = await db.leadBatch.create({
    data: {
      industry: input.industry,
      region: input.region,
      requestedLeadCount: input.maxResults ?? 10,
      autoRunPipeline: input.autoRunPipeline ?? true,
      status: JobStatus.PENDING,
    },
  });

  const discoveryResult = await searchGooglePlaces(input, { persist: true });

  const companies = await db.company.findMany({
    where: {
      googlePlaceId: {
        in: discoveryResult.candidates.map((candidate) => candidate.externalId),
      },
    },
    select: {
      id: true,
      googlePlaceId: true,
    },
  });

  const companyIdsByPlaceId = new Map(
    companies
      .filter((company) => company.googlePlaceId)
      .map((company) => [company.googlePlaceId as string, company.id]),
  );

  const batchLeadRows = discoveryResult.candidates
    .map((candidate) => ({
      batchId: batch.id,
      companyId: companyIdsByPlaceId.get(candidate.externalId),
    }))
    .filter((row): row is { batchId: string; companyId: string } => Boolean(row.companyId));

  if (batchLeadRows.length > 0) {
    await db.batchLead.createMany({
      data: batchLeadRows,
      skipDuplicates: true,
    });
  }

  let summary: {
    status: JobStatus;
    completedCompanies: number;
    failedCompanies: number;
    totalCompanies: number;
    items: Array<{ companyId: string; status: JobStatus; error?: string }>;
  } = {
    status: JobStatus.PENDING,
    completedCompanies: 0,
    failedCompanies: 0,
    totalCompanies: batchLeadRows.length,
    items: batchLeadRows.map((row) => ({
      companyId: row.companyId,
      status: JobStatus.PENDING,
    })),
  };

  if (input.autoRunPipeline ?? true) {
    await db.leadBatch.update({
      where: { id: batch.id },
      data: { status: JobStatus.RUNNING },
    });

    summary = await runDiscoveryBatchPipeline(
      batchLeadRows.map((row) => ({ companyId: row.companyId })),
    );

    for (const item of summary.items) {
      await db.batchLead.update({
        where: {
          batchId_companyId: {
            batchId: batch.id,
            companyId: item.companyId,
          },
        },
        data: {
          status: item.status,
          lastError: item.error,
        },
      });
    }

    await db.leadBatch.update({
      where: { id: batch.id },
      data: {
        status: summary.status,
        completedCompanies: summary.completedCompanies,
        failedCompanies: summary.failedCompanies,
      },
    });
  }

  return {
    batch: await db.leadBatch.findUnique({
      where: { id: batch.id },
    }),
    candidates: discoveryResult.candidates,
    summary,
  };
}
