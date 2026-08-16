import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const compounds = await prisma.compound.findMany({ orderBy: { createdAt: "asc" } });
  return NextResponse.json({ compounds });
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const name = body?.name?.trim();
  const aliases: string[] = Array.isArray(body?.aliases)
    ? body.aliases.map((a: string) => a.trim()).filter(Boolean)
    : [];
  if (!name) {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }
  const compound = await prisma.compound.upsert({
    where: { name },
    update: { aliases },
    create: { name, aliases, isDefault: false },
  });
  return NextResponse.json({ compound });
}

export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const name = searchParams.get("name");
  if (!name) return NextResponse.json({ error: "name is required" }, { status: 400 });
  await prisma.compound.deleteMany({ where: { name } });
  return NextResponse.json({ ok: true });
}
