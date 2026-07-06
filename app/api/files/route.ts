import { NextResponse } from "next/server";
import { readAllFiles } from "@/lib/github";

export async function GET() {
  try {
    const files = await readAllFiles();
    return NextResponse.json({
      overview: files.overview.content,
      monthlyPlan: files.monthlyPlan.content,
      weeklyPlan: files.weeklyPlan.content,
      dailyLog: files.dailyLog.content,
    });
  } catch (error) {
    console.error("Failed to read files:", error);
    return NextResponse.json({ error: "无法读取文件，请检查 GitHub 配置" }, { status: 500 });
  }
}
