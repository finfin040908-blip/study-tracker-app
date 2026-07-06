import { Octokit } from "@octokit/rest";

export const FILE_NAMES = {
  overview: "总体规划.md",
  monthlyPlan: "本月计划.md",
  weeklyPlan: "本周计划.md",
  dailyLog: "每日日志.md",
};

export interface GitHubFile {
  content: string;
  sha: string;
}

function getClient() {
  return new Octokit({ auth: process.env.GITHUB_TOKEN });
}

function getRepo() {
  return {
    owner: process.env.GITHUB_OWNER!,
    repo: process.env.GITHUB_REPO!,
  };
}

export async function readFile(path: string): Promise<GitHubFile> {
  const octokit = getClient();
  const response = await octokit.rest.repos.getContent({
    ...getRepo(),
    path,
  });
  const data = response.data as { content: string; sha: string };
  const content = Buffer.from(data.content.replace(/\n/g, ""), "base64").toString("utf-8");
  return { content, sha: data.sha };
}

export async function writeFile(path: string, content: string, sha: string): Promise<void> {
  const octokit = getClient();
  await octokit.rest.repos.createOrUpdateFileContents({
    ...getRepo(),
    path,
    message: `update ${path}`,
    content: Buffer.from(content, "utf-8").toString("base64"),
    sha,
  });
}

export async function readAllFiles() {
  const [overview, monthlyPlan, weeklyPlan, dailyLog] = await Promise.all([
    readFile(FILE_NAMES.overview),
    readFile(FILE_NAMES.monthlyPlan),
    readFile(FILE_NAMES.weeklyPlan),
    readFile(FILE_NAMES.dailyLog),
  ]);
  return { overview, monthlyPlan, weeklyPlan, dailyLog };
}
