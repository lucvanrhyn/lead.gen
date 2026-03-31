import { NextResponse } from "next/server";
import { CompanyStatus } from "@prisma/client";
import { db } from "@/lib/db";

export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;

  const company = await db.company.findUnique({ where: { id }, select: { id: true } });
  if (!company) {
    return NextResponse.json({ error: "Lead not found." }, { status: 404 });
  }

  await db.company.update({
    where: { id },
    data: { status: CompanyStatus.ARCHIVED },
  });

  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;

  const company = await db.company.findUnique({ where: { id }, select: { id: true } });
  if (!company) {
    return NextResponse.json({ error: "Lead not found." }, { status: 404 });
  }

  await db.company.delete({ where: { id } });

  return NextResponse.json({ ok: true });
}
