import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const indications = await prisma.indication.findMany({ orderBy: { createdAt: "asc" } });
  return NextResponse.json({ indications });
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const name = body?.name?.trim();
  const searchTerm = body?.searchTerm?.trim() || name;
  if (!name) {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }
  const indication = await prisma.indication.upsert({
    where: { name },
    update: { searchTerm },
    create: { name, searchTerm, isDefault: false },
  });
  return NextResponse.json({ indication });
}

export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const name = searchParams.get("name");
  if (!name) return NextResponse.json({ error: "name is required" }, { status: 400 });
  await prisma.indication.deleteMany({ where: { name } });
  return NextResponse.json({ ok: true });
}
