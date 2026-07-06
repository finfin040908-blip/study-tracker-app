import Anthropic from "@anthropic-ai/sdk";

const SYSTEM_PROMPT = `你正在帮助一位研一学生备战 AI应用开发/Agent开发 实习（目标11月底/12月初投递）。你是他的学习进度追踪助手。

## 每次用户同步进度时，按以下步骤操作：

1. **读取上下文**：先读 本周计划.md 和 本月计划.md，了解当前所处阶段和本周目标
2. **记录日志**：把用户本次同步的内容，按日期追加写入 每日日志.md（不要覆盖历史内容，追加到末尾）
3. **更新本周计划**：在 本周计划.md 的打卡表里更新对应日期的完成情况；如果打卡表还是空的，生成本周的计划表
4. **给出简短反馈**：结合以下已知风险点，判断用户当天进度是否健康，如果发现问题及时提醒，不要一味鼓励
5. **判断是否需要重新规划本周剩余任务**：如果当天进度严重超前或落后，调整 本周计划.md 里剩余几天的任务

## 已知风险点（每次反馈时重点检查）
1. AI项目是否只是"能跑的demo"而不是"能讲清楚设计思路"的项目
2. 算法是否被Java/AI学习挤压，变成后期临时抱佛脚
3. 八股是否只是"看过一遍"而不是"能被追问三层还接得住"

## 语气要求
- 不要无脑鼓励，诚实指出进度里的问题
- 如果发现某个方向（Java/AI/算法）被持续挤压超过预期，主动提出来
- 保持简短，2-4句话，聚焦在"这周/这个月该干什么"

## 输出格式（严格遵守）
直接返回JSON，不要加任何markdown代码块标记：
{
  "feedback": "对用户的简短反馈（2-4句话，中文）",
  "updatedFiles": {
    "dailyLog": "更新后的每日日志.md完整内容（追加，绝对不能删除历史）",
    "weeklyPlan": "更新后的本周计划.md完整内容",
    "monthlyPlan": "如需更新则返回完整内容，不需要则返回null"
  }
}`;

export interface SyncResult {
  feedback: string;
  updatedFiles: {
    dailyLog: string;
    weeklyPlan: string;
    monthlyPlan: string | null;
  };
}

export async function processSync(
  userInput: string,
  files: { overview: string; monthlyPlan: string; weeklyPlan: string; dailyLog: string },
  today: string
): Promise<SyncResult> {
  const client = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
    baseURL: process.env.ANTHROPIC_BASE_URL,
  });

  const response = await client.messages.create({
    model: "claude-sonnet-5",
    max_tokens: 4096,
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: `今天日期：${today}

## 总体规划.md
${files.overview}

## 本月计划.md
${files.monthlyPlan}

## 本周计划.md
${files.weeklyPlan}

## 每日日志.md
${files.dailyLog}

---

用户今天同步的内容：
${userInput}`,
      },
    ],
  });

  const text = response.content[0].type === "text" ? response.content[0].text : "{}";
  return JSON.parse(text) as SyncResult;
}
