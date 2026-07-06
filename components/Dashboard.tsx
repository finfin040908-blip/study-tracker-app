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

type Tab = "dashboard" | "log";

function parseWeeklyTable(markdown: string): TableRow[] {
  const lines = markdown.split("\n");
  const tableLines = lines.filter(
    (line) => line.trim().startsWith("|") && !line.includes("---")
  );
  if (tableLines.length < 2) return [];
  return tableLines.slice(1).map((line) => {
    const cells = line.split("|").slice(1, -1).map((c) => c.trim());
    return { date: cells[0] || "", planned: cells[1] || "", completed: cells[2] || "", notes: cells[3] || "" };
  }).filter((r) => r.date);
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

// 把每日日志按日期分段
function parseLogEntries(markdown: string): { date: string; content: string }[] {
  const sections = markdown.split(/(?=^## \d{4}-\d{2}-\d{2})/m);
  return sections
    .map((s) => {
      const match = s.match(/^## (\d{4}-\d{2}-\d{2})/m);
      if (!match) return null;
      return { date: match[1], content: s.replace(/^## \d{4}-\d{2}-\d{2}.*\n?/m, "").trim() };
    })
    .filter(Boolean)
    .reverse() as { date: string; content: string }[];
}

export default function Dashboard() {
  const [files, setFiles] = useState<FileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("dashboard");

  // dashboard state
  const [input, setInput] = useState("");
  const [syncing, setSyncing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [lastSynced, setLastSynced] = useState<string | null>(null);

  // log edit state
  const [editing, setEditing] = useState(false);
  const [editContent, setEditContent] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);

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
      if (files) setFiles({
        ...files,
        weeklyPlan: data.updatedWeeklyPlan,
        dailyLog: data.updatedDailyLog,
        monthlyPlan: data.updatedMonthlyPlan ?? files.monthlyPlan,
      });
    } catch (e) {
      setSyncError(e instanceof Error ? e.message : "同步失败");
    } finally {
      setSyncing(false);
    }
  };

  const startEdit = () => {
    setEditContent(files?.dailyLog ?? "");
    setEditing(true);
    setSaveMsg(null);
  };

  const cancelEdit = () => { setEditing(false); setSaveMsg(null); };

  const handleSave = async () => {
    setSaving(true);
    setSaveMsg(null);
    try {
      const res = await fetch("/api/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileName: "每日日志.md", content: editContent }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      if (files) setFiles({ ...files, dailyLog: editContent });
      setEditing(false);
      setSaveMsg("保存成功");
    } catch (e) {
      setSaveMsg(e instanceof Error ? e.message : "保存失败");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center">
      <div className="text-center space-y-3">
        <div className="w-7 h-7 border-2 border-pink-300 border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="text-sm text-slate-400">加载中…</p>
      </div>
    </div>
  );

  if (fetchError) return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl border border-pink-100 p-8 max-w-sm w-full text-center shadow-sm">
        <div className="text-3xl mb-3">⚙️</div>
        <p className="text-sm font-medium text-slate-700 mb-1">配置错误</p>
        <p className="text-xs text-slate-400">{fetchError}</p>
      </div>
    </div>
  );

  const weeklyRows = files ? parseWeeklyTable(files.weeklyPlan) : [];
  const { done, total } = files ? getMonthlyProgress(files.monthlyPlan) : { done: 0, total: 0 };
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  const currentWeek = files ? extractSection(files.weeklyPlan, "## 第几周") : "";
  const currentStage = files ? extractSection(files.monthlyPlan, "## 当前所处阶段") : "";
  const today = new Date().toISOString().split("T")[0];
  const logEntries = files ? parseLogEntries(files.dailyLog) : [];

  return (
    <div className="min-h-screen bg-slate-50">

      {/* Header */}
      <header className="bg-white border-b border-pink-100 px-6 py-4">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-pink-100 flex items-center justify-center text-base">🌸</div>
            <div>
              <h1 className="text-base font-semibold text-slate-700">学习进度追踪</h1>
              <p className="text-xs text-slate-400">目标 11 月底投递实习</p>
            </div>
          </div>
          {lastSynced && (
            <span className="text-xs text-blue-400 bg-blue-50 px-3 py-1 rounded-full">
              ✓ {lastSynced} 已同步
            </span>
          )}
        </div>
      </header>

      {/* Tabs */}
      <div className="bg-white border-b border-slate-100">
        <div className="max-w-3xl mx-auto px-4 flex gap-1">
          {([["dashboard", "📊 仪表盘"], ["log", "📖 日志"]] as [Tab, string][]).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                tab === key
                  ? "border-pink-400 text-pink-500"
                  : "border-transparent text-slate-400 hover:text-slate-600"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <main className="max-w-3xl mx-auto px-4 py-6 space-y-4">

        {/* ── 仪表盘 ── */}
        {tab === "dashboard" && (
          <>
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-white rounded-2xl border border-pink-100 p-4 shadow-sm">
                <p className="text-xs text-slate-400 mb-1">本月完成率</p>
                <p className="text-2xl font-bold text-pink-400 leading-none mb-3">{pct}<span className="text-sm font-normal">%</span></p>
                <div className="w-full h-1.5 bg-pink-50 rounded-full">
                  <div className="h-1.5 bg-pink-300 rounded-full transition-all duration-700" style={{ width: `${pct}%` }} />
                </div>
                <p className="text-xs text-slate-300 mt-2">{done} / {total} 项</p>
              </div>
              <div className="col-span-2 grid grid-rows-2 gap-3">
                <div className="bg-white rounded-2xl border border-blue-100 px-4 py-3 shadow-sm flex items-center gap-3">
                  <span className="text-lg">📍</span>
                  <div>
                    <p className="text-xs text-slate-400">当前阶段</p>
                    <p className="text-sm font-medium text-slate-600 mt-0.5 leading-snug">{currentStage || "阶段一：暑期基础启动"}</p>
                  </div>
                </div>
                <div className="bg-white rounded-2xl border border-pink-100 px-4 py-3 shadow-sm flex items-center gap-3">
                  <span className="text-lg">📅</span>
                  <div>
                    <p className="text-xs text-slate-400">当前周次</p>
                    <p className="text-sm font-medium text-slate-600 mt-0.5">{currentWeek || "第 1 周（暑期启动周）"}</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-blue-100 shadow-sm overflow-hidden">
              <div className="px-5 py-3 border-b border-blue-50 flex items-center gap-2">
                <span className="text-sm">✅</span>
                <h2 className="text-sm font-semibold text-slate-600">本周打卡</h2>
              </div>
              {weeklyRows.length > 0 ? (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-blue-50/50">
                      {["日期", "计划内容", "完成情况", "备注"].map((h) => (
                        <th key={h} className="px-4 py-2.5 text-left text-xs font-medium text-slate-400">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {weeklyRows.map((row, i) => (
                      <tr key={i} className={`${row.date === today ? "bg-pink-50/60" : "hover:bg-slate-50/80"} transition-colors`}>
                        <td className="px-4 py-3 text-xs font-mono text-slate-400 whitespace-nowrap">
                          {row.date}
                          {row.date === today && <span className="ml-1.5 text-[10px] bg-pink-200 text-pink-600 px-1.5 py-0.5 rounded-full font-sans">今</span>}
                        </td>
                        <td className="px-4 py-3 text-slate-600 text-sm">{row.planned}</td>
                        <td className="px-4 py-3 text-slate-600 text-sm">{row.completed}</td>
                        <td className="px-4 py-3 text-slate-400 text-xs">{row.notes}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div className="py-10 text-center text-slate-300 text-sm">同步今天的进度后自动创建本周计划 🌱</div>
              )}
            </div>

            <div className="bg-white rounded-2xl border border-pink-100 shadow-sm p-5">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-sm">✏️</span>
                <h2 className="text-sm font-semibold text-slate-600">同步今天的进度</h2>
              </div>
              <textarea
                className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-sm text-slate-700 placeholder-slate-300 resize-none focus:outline-none focus:ring-2 focus:ring-pink-200 focus:bg-white transition-all"
                rows={4}
                placeholder="今天做了什么？学了哪些内容，大概花了多久？遇到什么问题？（尽量具体）"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                disabled={syncing}
                onKeyDown={(e) => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) handleSync(); }}
              />
              <div className="flex items-center justify-between mt-3">
                <p className="text-xs text-slate-300">Ctrl + Enter 快速提交</p>
                <button
                  onClick={handleSync}
                  disabled={!input.trim() || syncing}
                  className="px-5 py-2 bg-blue-400 hover:bg-blue-500 text-white text-sm font-medium rounded-xl disabled:opacity-30 disabled:cursor-not-allowed transition-colors shadow-sm"
                >
                  {syncing
                    ? <span className="flex items-center gap-2"><span className="w-3 h-3 border border-white border-t-transparent rounded-full animate-spin" />同步中…</span>
                    : "同步进度"}
                </button>
              </div>
              {syncError && <p className="text-xs text-red-400 mt-2">{syncError}</p>}
            </div>

            {feedback && (
              <div className="bg-pink-50 border border-pink-100 rounded-2xl p-5">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-sm">💬</span>
                  <p className="text-xs font-semibold text-pink-400">AI 反馈</p>
                </div>
                <p className="text-sm text-slate-600 leading-relaxed whitespace-pre-wrap">{feedback}</p>
              </div>
            )}
          </>
        )}

        {/* ── 日志 ── */}
        {tab === "log" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-slate-500">共 {logEntries.length} 条记录</p>
              {!editing ? (
                <button
                  onClick={startEdit}
                  className="px-4 py-1.5 text-xs font-medium text-blue-500 bg-blue-50 hover:bg-blue-100 rounded-xl transition-colors"
                >
                  编辑日志
                </button>
              ) : (
                <div className="flex gap-2">
                  <button onClick={cancelEdit} className="px-4 py-1.5 text-xs font-medium text-slate-400 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors">取消</button>
                  <button
                    onClick={handleSave}
                    disabled={saving}
                    className="px-4 py-1.5 text-xs font-medium text-white bg-pink-400 hover:bg-pink-500 rounded-xl transition-colors disabled:opacity-50"
                  >
                    {saving ? "保存中…" : "保存"}
                  </button>
                </div>
              )}
            </div>

            {saveMsg && (
              <p className={`text-xs px-3 py-2 rounded-xl ${saveMsg === "保存成功" ? "bg-green-50 text-green-500" : "bg-red-50 text-red-400"}`}>
                {saveMsg}
              </p>
            )}

            {editing ? (
              <div className="bg-white rounded-2xl border border-pink-100 shadow-sm p-4">
                <p className="text-xs text-slate-400 mb-2">直接编辑后点保存，内容会同步到 GitHub</p>
                <textarea
                  className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-sm text-slate-700 font-mono resize-none focus:outline-none focus:ring-2 focus:ring-pink-200 focus:bg-white transition-all"
                  rows={20}
                  value={editContent}
                  onChange={(e) => setEditContent(e.target.value)}
                />
              </div>
            ) : logEntries.length > 0 ? (
              logEntries.map((entry) => (
                <div key={entry.date} className="bg-white rounded-2xl border border-blue-100 shadow-sm overflow-hidden">
                  <div className="px-5 py-3 border-b border-blue-50 flex items-center gap-2">
                    <span className="text-xs font-mono font-medium text-blue-400">{entry.date}</span>
                    {entry.date === today && <span className="text-[10px] bg-pink-100 text-pink-500 px-2 py-0.5 rounded-full">今天</span>}
                  </div>
                  <div className="px-5 py-4">
                    <p className="text-sm text-slate-600 leading-relaxed whitespace-pre-wrap">{entry.content || "（无内容）"}</p>
                  </div>
                </div>
              ))
            ) : (
              <div className="py-16 text-center text-slate-300 text-sm">还没有日志记录，同步第一天的进度后会显示在这里 🌱</div>
            )}
          </div>
        )}

      </main>
    </div>
  );
}
