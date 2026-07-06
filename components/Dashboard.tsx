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
      const cells = line.split("|").slice(1, -1).map((c) => c.trim());
      return { date: cells[0] || "", planned: cells[1] || "", completed: cells[2] || "", notes: cells[3] || "" };
    })
    .filter((r) => r.date);
}

function getMonthlyProgress(markdown: string) {
  const done = (markdown.match(/\[x\]/gi) || []).length;
  const total = done + (markdown.match(/\[ \]/g) || []).length;
  return { done, total };
}

function extractSection(markdown: string, heading: string): string {
  const lines = markdown.split("\n");
  const idx = lines.findIndex((l) => l.trim() === heading);
  if (idx === -1) return "";
  const end = lines.findIndex((l, i) => i > idx && l.startsWith("##"));
  return lines.slice(idx + 1, end === -1 ? undefined : end).join("\n").trim();
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
      if (!res.ok) throw new Error((await res.json()).error || "加载失败");
      setFiles(await res.json());
    } catch (e) {
      setFetchError(e instanceof Error ? e.message : "无法加载文件");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchFiles(); }, [fetchFiles]);

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
      if (!res.ok) throw new Error((await res.json()).error || "同步失败");
      const data = await res.json();
      setFeedback(data.feedback);
      setLastSynced(new Date().toLocaleString("zh-CN"));
      setInput("");
      if (files) setFiles({ ...files, weeklyPlan: data.updatedWeeklyPlan, dailyLog: data.updatedDailyLog, monthlyPlan: data.updatedMonthlyPlan ?? files.monthlyPlan });
    } catch (e) {
      setSyncError(e instanceof Error ? e.message : "同步失败");
    } finally {
      setSyncing(false);
    }
  };

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: "linear-gradient(135deg, #fdf2f8 0%, #eff6ff 100%)" }}>
      <div className="text-center">
        <div className="w-8 h-8 border-2 border-pink-400 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
        <p className="text-sm text-slate-400">加载中...</p>
      </div>
    </div>
  );

  if (fetchError) return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: "linear-gradient(135deg, #fdf2f8 0%, #eff6ff 100%)" }}>
      <div className="bg-white rounded-2xl shadow-sm border border-pink-100 p-6 max-w-md w-full text-center">
        <p className="text-pink-500 font-medium mb-2">配置错误</p>
        <p className="text-sm text-slate-400">{fetchError}</p>
      </div>
    </div>
  );

  const weeklyRows = files ? parseWeeklyTable(files.weeklyPlan) : [];
  const { done, total } = files ? getMonthlyProgress(files.monthlyPlan) : { done: 0, total: 0 };
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  const currentWeek = files ? extractSection(files.weeklyPlan, "## 第几周") : "";
  const currentStage = files ? extractSection(files.monthlyPlan, "## 当前所处阶段") : "";
  const today = new Date().toISOString().split("T")[0];

  return (
    <div className="min-h-screen" style={{ background: "linear-gradient(135deg, #fdf2f8 0%, #eff6ff 100%)" }}>
      {/* Header */}
      <header style={{ background: "linear-gradient(90deg, #ec4899 0%, #60a5fa 100%)" }} className="px-6 py-5 shadow-sm">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-white tracking-tight">学习进度追踪</h1>
            <p className="text-pink-100 text-xs mt-0.5">AI应用开发实习备战 · 目标11月底投递</p>
          </div>
          {lastSynced && (
            <span className="text-xs bg-white/20 text-white px-3 py-1 rounded-full backdrop-blur-sm">
              已同步 {lastSynced}
            </span>
          )}
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6 space-y-5">
        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-pink-100">
            <p className="text-xs text-slate-400 mb-1">本月任务完成率</p>
            <p className="text-3xl font-bold text-pink-500 mb-3">{pct}%</p>
            <div className="w-full bg-pink-50 rounded-full h-2">
              <div className="h-2 rounded-full transition-all duration-500" style={{ width: `${pct}%`, background: "linear-gradient(90deg, #f472b6, #60a5fa)" }} />
            </div>
            <p className="text-xs text-slate-400 mt-2">{done} / {total} 项</p>
          </div>

          <div className="bg-white rounded-2xl p-5 shadow-sm border border-blue-100">
            <p className="text-xs text-slate-400 mb-1">当前阶段</p>
            <p className="text-sm font-semibold text-blue-600 leading-relaxed mt-2">
              {currentStage || "阶段一：暑期基础启动"}
            </p>
          </div>

          <div className="bg-white rounded-2xl p-5 shadow-sm border border-pink-100">
            <p className="text-xs text-slate-400 mb-1">当前周次</p>
            <p className="text-sm font-semibold text-pink-500 leading-relaxed mt-2">
              {currentWeek || "第1周（暑期启动周）"}
            </p>
          </div>
        </div>

        {/* Weekly table */}
        <div className="bg-white rounded-2xl shadow-sm border border-blue-100 overflow-hidden">
          <div className="px-5 py-4 border-b border-blue-50" style={{ background: "linear-gradient(90deg, #fdf2f8, #eff6ff)" }}>
            <h2 className="text-sm font-semibold text-slate-600">本周打卡表</h2>
          </div>
          {weeklyRows.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50">
                    {["日期", "计划内容", "完成情况", "备注"].map((h) => (
                      <th key={h} className="px-4 py-2 text-left text-xs font-medium text-slate-400">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {weeklyRows.map((row, i) => (
                    <tr key={i} className={`transition-colors ${row.date === today ? "bg-pink-50" : "hover:bg-slate-50"}`}>
                      <td className="px-4 py-3 text-xs font-mono text-slate-500 whitespace-nowrap">
                        {row.date}
                        {row.date === today && <span className="ml-1 text-pink-400 font-sans font-medium">今</span>}
                      </td>
                      <td className="px-4 py-3 text-slate-700">{row.planned}</td>
                      <td className="px-4 py-3 text-slate-700">{row.completed}</td>
                      <td className="px-4 py-3 text-slate-400 text-xs">{row.notes}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="px-4 py-8 text-center text-slate-400 text-sm">
              本周计划尚未生成，同步今天的进度后自动创建
            </div>
          )}
        </div>

        {/* Input */}
        <div className="bg-white rounded-2xl shadow-sm border border-pink-100 p-5">
          <h2 className="text-sm font-semibold text-slate-600 mb-3">同步今天的进度</h2>
          <textarea
            className="w-full border border-slate-200 rounded-xl p-3 text-sm text-slate-800 placeholder-slate-300 resize-none focus:outline-none focus:ring-2 focus:ring-pink-300 focus:border-transparent transition-shadow"
            rows={4}
            placeholder="今天做了什么？学了哪些内容，大概花了多久？遇到什么问题？（尽量具体）"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={syncing}
            onKeyDown={(e) => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) handleSync(); }}
          />
          <div className="flex items-center justify-between mt-3">
            <p className="text-xs text-slate-300">Ctrl+Enter 快速提交</p>
            <button
              onClick={handleSync}
              disabled={!input.trim() || syncing}
              className="px-5 py-2 text-white text-sm font-medium rounded-xl disabled:opacity-40 disabled:cursor-not-allowed transition-all hover:shadow-md"
              style={{ background: "linear-gradient(90deg, #ec4899, #60a5fa)" }}
            >
              {syncing ? (
                <span className="flex items-center gap-2">
                  <span className="w-3 h-3 border border-white border-t-transparent rounded-full animate-spin" />
                  同步中...
                </span>
              ) : "同步进度"}
            </button>
          </div>
          {syncError && <p className="text-xs text-red-400 mt-2">{syncError}</p>}
        </div>

        {/* Feedback */}
        {feedback && (
          <div className="rounded-2xl p-5 border border-pink-200" style={{ background: "linear-gradient(135deg, #fdf2f8, #eff6ff)" }}>
            <p className="text-xs font-semibold text-pink-400 mb-2">Claude 反馈</p>
            <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">{feedback}</p>
          </div>
        )}
      </main>
    </div>
  );
}
