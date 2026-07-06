import { NextRequest, NextResponse } from "next/server";
import { readAllFiles, writeFile, FILE_NAMES } from "@/lib/github";
import { processSync } from "@/lib/claude";

export const maxDuration = 60;

export async function POST(request: NextRequest) {
  try {
    const { userInput, today } = await request.json();

    if (!userInput?.trim()) {
      return NextResponse.json({ error: "输入内容不能为空" }, { status: 400 });
    }

    const files = await readAllFiles();

    const result = await processSync(
      userInput,
      {
        overview: files.overview.content,
        monthlyPlan: files.monthlyPlan.content,
        weeklyPlan: files.weeklyPlan.content,
        dailyLog: files.dailyLog.content,
      },
      today
    );

    console.log("Parsed result:", JSON.stringify(result, null, 2));

    if (!result.updatedFiles) {
      console.error("Missing updatedFiles in result:", result);
      return NextResponse.json({ error: `模型返回格式错误: ${JSON.stringify(result)}` }, { status: 500 });
    }

    const writePromises: Promise<void>[] = [
      writeFile(FILE_NAMES.dailyLog, result.updatedFiles.dailyLog, files.dailyLog.sha),
      writeFile(FILE_NAMES.weeklyPlan, result.updatedFiles.weeklyPlan, files.weeklyPlan.sha),
    ];

    if (result.updatedFiles.monthlyPlan) {
      writePromises.push(
        writeFile(FILE_NAMES.monthlyPlan, result.updatedFiles.monthlyPlan, files.monthlyPlan.sha)
      );
    }

    await Promise.all(writePromises);

    return NextResponse.json({
      feedback: result.feedback,
      updatedWeeklyPlan: result.updatedFiles.weeklyPlan,
      updatedMonthlyPlan: result.updatedFiles.monthlyPlan,
      updatedDailyLog: result.updatedFiles.dailyLog,
    });
  } catch (error) {
    console.error("Sync failed:", error);
    return NextResponse.json({ error: "同步失败，请重试" }, { status: 500 });
  }
}
