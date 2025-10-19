#!/usr/bin/env node

import { GoogleGenAI } from "@google/genai";
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { lstat, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const logPrefix = "[husky:ai-commit]";

function logInfo(message) {
  console.log(`${logPrefix} ${message}`);
}

function logError(message) {
  console.error(`${logPrefix} ${message}`);
}

function runGit(args, options = {}) {
  return execFileSync("git", args, {
    encoding: "utf8",
    maxBuffer: 10e6,
    ...options,
  });
}

async function resolveGitDir() {
  const envGitDir = process.env.GIT_DIR;
  if (envGitDir) {
    return path.isAbsolute(envGitDir)
      ? envGitDir
      : path.resolve(process.cwd(), envGitDir);
  }

  const gitEntry = path.join(process.cwd(), ".git");
  if (!existsSync(gitEntry)) {
    throw new Error("Unable to locate .git directory.");
  }

  const stats = await lstat(gitEntry);
  if (stats.isDirectory()) {
    return gitEntry;
  }

  if (!stats.isFile()) {
    throw new Error("Unsupported .git reference type.");
  }

  const dotGitContents = await readFile(gitEntry, "utf8");
  const match = dotGitContents.match(/gitdir:\s*(.+)/i);
  if (!match) {
    throw new Error("Malformed .git file: missing gitdir directive.");
  }

  const gitDirPath = match[1].trim();
  return path.isAbsolute(gitDirPath)
    ? gitDirPath
    : path.resolve(path.dirname(gitEntry), gitDirPath);
}

async function getCommitMessagePath() {
  const gitDir = await resolveGitDir();
  return path.join(gitDir, "COMMIT_EDITMSG");
}

async function readCommitMessage(commitMessagePath) {
  try {
    return await readFile(commitMessagePath, "utf8");
  } catch {
    // If the commit message file does not exist yet, bail out quietly.
    return null;
  }
}

async function getSystemInstructions() {
  const fallbackPath = path.join(
    process.cwd(),
    "src",
    "lib",
    "system_instructions.txt"
  );
  const instructionsPath =
    process.env.AI_COMMIT_INSTRUCTIONS_PATH ?? fallbackPath;

  if (!existsSync(instructionsPath)) {
    throw new Error(
      `System instructions file not found at ${instructionsPath}. Set AI_COMMIT_INSTRUCTIONS_PATH to override.`
    );
  }

  return readFile(instructionsPath, "utf8");
}

function getStagedDiff() {
  try {
    return runGit(["diff", "--cached", "--no-ext-diff", "--binary"]);
  } catch (error) {
    throw new Error(
      `Failed to compute staged diff: ${error?.message ?? String(error)}`
    );
  }
}

function hasParentCommit() {
  try {
    execFileSync("git", ["rev-parse", "--verify", "--quiet", "HEAD^"], {
      stdio: "ignore",
    });
    return true;
  } catch {
    return false;
  }
}

function getHeadDiff() {
  try {
    return runGit(["diff", "HEAD^", "HEAD", "--no-ext-diff", "--binary"]);
  } catch (error) {
    throw new Error(
      `Failed to compute existing commit diff: ${
        error?.message ?? String(error)
      }`
    );
  }
}

function collectDiff() {
  const stagedDiff = getStagedDiff();
  if (stagedDiff.trim()) {
    return { diffText: stagedDiff, source: "staged" };
  }

  if (hasParentCommit()) {
    const headDiff = getHeadDiff();
    if (headDiff.trim()) {
      return { diffText: headDiff, source: "head" };
    }
  }

  return { diffText: "", source: "none" };
}

function validateDiff(diffText, source) {
  if (!diffText.trim()) {
    if (source === "head") {
      throw new Error(
        "Detected --amend with unchanged content. Unable to derive diff."
      );
    }

    throw new Error(
      "No staged changes found. Stage your changes before using /ai."
    );
  }

  if (!/^diff --git /m.test(diffText)) {
    throw new Error(
      'Diff is not in unified format. Ensure the computed diff starts with "diff --git".'
    );
  }
}

async function callGemini(prompt) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY environment variable is not set.");
  }

  const ai = new GoogleGenAI({ apiKey });

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
      },
    });

    const text = response?.text;
    if (!text) {
      throw new Error("Gemini returned an empty response.");
    }

    return text;
  } catch (error) {
    throw new Error(
      `Gemini request failed: ${error?.message ?? String(error)}`
    );
  }
}

function parseGeminiResponse(rawText) {
  try {
    const parsed = JSON.parse(rawText);
    const subject = String(parsed?.subject ?? "").trim();
    const description = String(parsed?.description ?? "").trim();

    if (!subject || !description) {
      throw new Error("Parsed response missing subject or description.");
    }

    return { subject, description };
  } catch (error) {
    throw new Error(
      `Failed to parse Gemini response as JSON: ${
        error?.message ?? String(error)
      }`
    );
  }
}

async function writeCommitMessage(commitMessagePath, subject, description) {
  const finalMessage = `${subject}\n\n${description}\n`;
  await writeFile(commitMessagePath, finalMessage, "utf8");
}

async function main() {
  const commitMessagePath = await getCommitMessagePath();
  const commitMessage = await readCommitMessage(commitMessagePath);

  if (!commitMessage) {
    return;
  }

  if (commitMessage.trim() !== "/ai") {
    return;
  }

  logInfo("Generating commit message via Gemini...");

  const { diffText, source } = collectDiff();
  if (source === "head") {
    logInfo(
      "No staged changes detected; using previous commit diff (amend scenario)."
    );
  }

  const systemInstructions = await getSystemInstructions();

  validateDiff(diffText, source);

  const prompt = `${systemInstructions.trim()}\n\nDiff:\n${diffText}`;
  const rawResponse = await callGemini(prompt);

  const { subject, description } = parseGeminiResponse(rawResponse);
  await writeCommitMessage(commitMessagePath, subject, description);

  logInfo("Commit message updated using Gemini output.");
}

main().catch((error) => {
  logError(error?.message ?? String(error));
  process.exit(1);
});
