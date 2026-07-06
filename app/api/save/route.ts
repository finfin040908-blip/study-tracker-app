import { NextRequest, NextResponse } from "next/server";
import { writeFile, FILE_NAMES } from "@/lib/github";

const ALLOWED = Object.values(FILE_NAMES);

export async function POST(request: NextRequest) {
  try {
    const { fileName, content } = await request.json();
    if (!ALLOWED.includes(fileName)) {
      return NextResponse.json({ error: "不允许的文件名" }, { status: 400 });
    }
    await writeFile(fileName, content);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: `保存失败：${error}` }, { status: 500 });
  }
}
