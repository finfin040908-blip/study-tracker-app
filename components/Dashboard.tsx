"use client";

import { useState, useEffect, useCallback } from "react";

interface FileData {
  overview: string;
  monthlyPlan: string;
  weeklyPlan: string;
  dailyLog: string;
}

interface TableRow {
  date: string;
  planned: string;
  completed: string;
  notes: string;
}

function parseWeeklyTable(markdown: string): TableRow[] {
  const lines = markdown.split("\n");
  const tableLines = lines.filter(
    (line) => line.trim().startsWith("|") && !line.includes("---")
  );
  if (tableLines.length < 2) return [];

  return tableLines
    .slice(1)
    .map((line) => {
      const cells = line
        .split("|")
        .slice(1, -1)
        .map((c) => c.trim());
      return {
        date: cells[0] || "",
        planned: cells[1] || "",
        completed: cells[2] || "",
        notes: cells[3] || "",
      };
    })
    .filter((row) => row.date);
}

function getMonthlyProgress(markdown: string): { done: number; total: number } {
  const checked = (markdown.match(/\[x\]/gi) || []).length;
  const unchecked = (markdown.match(/\[ \]/g) || []).length;
  return { done: checked, total: checked + unchecked };
}

function extractSectionContent(markdown: string, heading: string): string {
  const lines = markdown.split("\n");
  const idx = lines.findIndex((l) => l.trim() === heading);
  if (idx === -1) return "";
  const nextIdx = lines.findIndex((l, i) => i > idx && l.startsWith("##"));
  const end = nextIdx === -1 ? lines.length : nextIdx;
  return lines
    .slice(idx + 1, end)
    .join("\n")
    .trim();
}

export default function Dashboard() {
  const [files, setFiles] = useState<FileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [syncing, setSyncing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [lastSynced, setLastSynced] = useState<string | null>(null);

  const fetchFiles = useCallback(async () => {
    try {
      setFetchError(null);
      const res = await fetch("/api/files");
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "加载失败");
      }
      const data: FileData = await res.json();
      setFiles(data);
    } catch (e) {
      setFetchError(e instanceof Error ? e.message : "无法加载文件");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchFiles();
  }, [fetchFiles]);

  const handleSync = async () => {
    if (!input.trim() || syncing) return;
    setSyncing(true);
    setSyncError(null);

    try {
      const today = new Date().toISOString().split("T")[0];
      const res = await fetch("/api/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userInput: input, today }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "同步失败");
      }

      const data = await res.json();
      setFeedback(data.feedback);
      setLastSynced(new Date().toLocaleString("zh-CN"));
      setInput("");

      if (files) {
        setFiles({
          ...files,
          weeklyPlan: data.updatedWeeklyPlan,
          dailyLog: data.updatedDailyLog,
          monthlyPlan: data.updatedMonthlyPlan ?? files.monthlyPlan,
        });
      }
    } catch (e) {
      setSyncError(e instanceof Error ? e.message : "同步失败");
    } finally {
      setSyncing(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm text-gray-500">加载中...</p>
        </div>
      </div>
    );
  }

  if (fetchError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="bg-white rounded-xl shadow-sm border border-red-100 p-6 max-w-md w-full text-center">
          <p className="text-red-600 font-medium mb-2">配置错误</p>
          <p className="text-sm text-gray-500 mb-4">{fetchError}</p>
          <p className="text-xs text-gray-400">
            请检查 Vercel 环境变量：GITHUB_TOKEN、GITHUB_OWNER、GITHUB_REPO、ANTHROPIC_API_KEY
          </p>
        </div>
      </div>
    );
  }

  const weeklyRows = files ? parseWeeklyTable(files.weeklyPlan) : [];
  const progress = files ? getMonthlyProgress(files.monthlyPlan) : { done: 0, total: 0 };
  const progressPct = progress.total > 0 ? Math.round((progress.done / progress.total) * 100) : 0;
  const currentWeek = files ? extractSectionContent(files.weeklyPlan, "## 第几周") : "";
  const currentStage = files ? extractSectionContent(files.monthlyPlan, "## 当前所处阶段") : "";

  const today = new Date().toISOString().split("T")[0];
  const todayRow = weeklyRows.find((r) => r.date === today);

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold text-gray-900">学习进度追踪</h1>
            <p className="text-xs text-gray-400 mt-0.5">AI应用开发实习备战 · 目标11月底投递</p>
          </div>
          {lastSynced && (
            <span className="text-xs text-green-600 bg-green-50 px-2 py-1 rounded-full">
              已同步 {lastSynced}
            </span>
          )}
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6 space-y-5">
        {/* Stats row */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
            <p className="text-xs text-gray-400 mb-2">本月任务完成率</p>
            <p className="text-2xl font-bold text-gray-900 mb-2">{progressPct}%</p>
            <div className="w-full bg-gray-100 rounded-full h-1.5">
              <div
                className="bg-blue-500 h-1.5 rounded-full transition-all duration-500"
                style={{ width: `${progressPct}%` }}
              />
            </div>
            <p className="text-xs text-gray-400 mt-2">
              {progress.done} / {progress.total} 项
            </p>
          </div>

          <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
            <p className="text-xs text-gray-400 mb-2">当前阶段</p>
            <p className="text-sm font-medium text-gray-800 leading-relaxed">
              {currentStage || "阶段一：暑期基础启动"}
            </p>
          </div>

          <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
            <p className="text-xs text-gray-400 mb-2">当前周次</p>
            <p className="text-sm font-medium text-gray-800 leading-relaxed">
              {currentWeek || "第1周（暑期启动周）"}
            </p>
            {todayRow && (
              <p className="text-xs text-gray-400 mt-2">
                今日：{todayRow.completed || "待完成"}
              </p>
            )}
          </div>
        </div>

        {/* Weekly plan table */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100">
            <h2 className="text-sm font-semibold text-gray-700">本周打卡表</h2>
          </div>
          {weeklyRows.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50">
                    {["日期", "计划内容", "完成情况", "备注"].map((h) => (
                      <th
                        key={h}
                        className="px-4 py-2 text-left text-xs font-medium text-gray-400"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {weeklyRows.map((row, i) => (
                    <tr
                      key={i}
                      className={`hover:bg-gray-50 transition-colors ${
                        row.date === today ? "bg-blue-50" : ""
                      }`}
                    >
                      <td className="px-4 py-3 text-gray-600 whitespace-nowrap text-xs font-mono">
                        {row.date}
                        {row.date === today && (
                          <span className="ml-1 text-blue-500">今</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-gray-700">{row.planned}</td>
                      <td className="px-4 py-3 text-gray-700">{row.completed}</td>
                      <td className="px-4 py-3 text-gray-400 text-xs">{row.notes}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="px-4 py-8 text-center text-gray-400 text-sm">
              本周计划尚未生成，同步今天的进度后自动创建
            </div>
          )}
        </div>

        {/* Sync input */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
          <h2 className="text-sm font-semibold text-gray-700 mb-3">同步今天的进度</h2>
          <textarea
            className="w-full border border-gray-200 rounded-lg p-3 text-sm text-gray-900 placeholder-gray-300 resize-none focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent transition-shadow"
            rows={4}
            placeholder="今天做了什么？学了哪些内容，大概花了多久？遇到什么问题？（尽量具体，方便 Claude 给出准确反馈）"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={syncing}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) handleSync();
            }}
          />
          <div className="flex items-center justify-between mt-3">
            <p className="text-xs text-gray-300">Ctrl+Enter 快速提交</p>
            <button
              onClick={handleSync}
              disabled={!input.trim() || syncing}
              className="px-4 py-2 bg-blue-500 text-white text-sm font-medium rounded-lg hover:bg-blue-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {syncing ? (
                <span className="flex items-center gap-2">
                  <span className="w-3 h-3 border border-white border-t-transparent rounded-full animate-spin" />
                  同步中...
                </span>
              ) : (
                "同步进度"
              )}
            </button>
          </div>
          {syncError && (
            <p className="text-xs text-red-500 mt-2">{syncError}</p>
          )}
        </div>

        {/* Feedback */}
        {feedback && (
          <div className="bg-blue-50 border border-blue-100 rounded-xl p-4">
            <p className="text-xs font-medium text-blue-500 mb-2">Claude 反馈</p>
            <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">
              {feedback}
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
