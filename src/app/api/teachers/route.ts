import { NextResponse } from "next/server";
import { getAllTeachers, getRecentGradings } from "@/lib/teacher";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const [teachers, recentGradings] = await Promise.all([
      getAllTeachers(),
      getRecentGradings(30),
    ]);

    const principal = teachers.find((t) => t.role === "principal") ?? null;
    const heads = teachers.filter((t) => t.role === "head");
    const proctors = teachers.filter((t) => t.role === "proctor");

    return NextResponse.json({
      principal,
      heads,
      proctors,
      totals: {
        principal: principal ? 1 : 0,
        heads: heads.length,
        proctors: proctors.length,
      },
      recentGradings,
    });
  } catch (err) {
    return NextResponse.json(
      { principal: null, heads: [], proctors: [], totals: { principal: 0, heads: 0, proctors: 0 }, recentGradings: [], error: String(err) },
      { status: 500 }
    );
  }
}
