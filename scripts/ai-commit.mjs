#!/usr/bin/env node

import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

import { GoogleGenAI } from '@google/genai';

const logPrefix = '[husky:ai-commit]';

function logInfo(message) {
  console.log(`${logPrefix} ${message}`);
}

function logError(message) {
  console.error(`${logPrefix} ${message}`);
}

loadDotEnv();

function runGit(args, options = {}) {
  return execFileSync('git', args, {
    encoding: 'utf8',
    maxBuffer: 10e6,
    ...options,
  });
}

function getLatestCommitMessage() {
  try {
    return runGit(['log', '-1', '--pretty=%B']).trim();
  } catch (error) {
    throw new Error(
      `Failed to read latest commit message: ${
        error?.message ?? String(error)
      }`
    );
  }
}

function hasParentCommit() {
  try {
    runGit(['rev-parse', '--verify', 'HEAD~1']);
    return true;
  } catch {
    return false;
  }
}

function getDiffAgainstParent() {
  try {
    return runGit(['diff', 'HEAD~1', 'HEAD', '--no-ext-diff', '--binary']);
  } catch (error) {
    throw new Error(
      `Failed to compute commit diff: ${error?.message ?? String(error)}`
    );
  }
}

async function getSystemInstructions() {
  const fallbackPath = path.join(
    process.cwd(),
    'src',
    'lib',
    'system_instructions.txt'
  );
  const instructionsPath =
    process.env.AI_COMMIT_INSTRUCTIONS_PATH ?? fallbackPath;

  if (!existsSync(instructionsPath)) {
    throw new Error(
      `System instructions file not found at ${instructionsPath}. Set AI_COMMIT_INSTRUCTIONS_PATH to override.`
    );
  }

  return readFile(instructionsPath, 'utf8');
}

function validateDiff(diffText) {
  if (!diffText.trim()) {
    throw new Error('Commit diff was empty; nothing to analyze.');
  }

  if (!/^diff --git /m.test(diffText)) {
    throw new Error(
      'Commit diff is not in unified format. Expected lines starting with "diff --git".'
    );
  }
}

async function callGemini(prompt) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY environment variable is not set.');
  }

  const ai = new GoogleGenAI({ apiKey, });

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: { responseMimeType: 'application/json', },
    });

    const text = response?.text;
    if (!text) {
      throw new Error('Gemini returned an empty response.');
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
    const subject = String(parsed?.subject ?? '').trim();
    const description = String(parsed?.description ?? '').trim();

    if (!subject || !description) {
      throw new Error('Parsed response missing subject or description.');
    }

    if (subject.includes('\n')) {
      throw new Error('Subject must be a single line.');
    }

    return {
      subject,
      description,
    };
  } catch (error) {
    throw new Error(
      `Failed to parse Gemini response as JSON: ${
        error?.message ?? String(error)
      }`
    );
  }
}

function amendLatestCommit(subject, description) {
  try {
    runGit(['commit', '--amend', '-m', subject, '-m', description]);
  } catch (error) {
    throw new Error(
      `Failed to amend commit message: ${error?.message ?? String(error)}`
    );
  }
}

async function main() {
  const latestMessage = getLatestCommitMessage();

  if (latestMessage !== '/ai') {
    return;
  }

  if (!hasParentCommit()) {
    throw new Error(
      'Cannot use /ai for the initial commit because no parent diff exists.'
    );
  }

  logInfo('Latest commit flagged for AI-generated message; analyzing diff...');

  const diffText = getDiffAgainstParent();
  validateDiff(diffText);

  const systemInstructions = await getSystemInstructions();
  const prompt = `${systemInstructions.trim()}\n\nDiff:\n${diffText}`;

  const rawResponse = await callGemini(prompt);
  const {
 subject, description, 
} = parseGeminiResponse(rawResponse);

  amendLatestCommit(subject, description);

  logInfo('Latest commit message updated using Gemini output.');
}

main().catch((error) => {
  logError(error?.message ?? String(error));
  process.exit(1);
});

function loadDotEnv() {
  const envPath = path.join(process.cwd(), '.env');
  if (!existsSync(envPath)) {
    return;
  }

  let content;
  try {
    content = readFileSync(envPath, 'utf8');
  } catch (error) {
    logError(
      `Failed to read .env file at ${envPath}: ${
        error?.message ?? String(error)
      }`
    );
    return;
  }

  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }

    const equalsIndex = trimmed.indexOf('=');
    if (equalsIndex === -1) {
      continue;
    }

    let key = trimmed.slice(0, equalsIndex).trim();
    if (key.startsWith('export ')) {
      key = key.slice(7).trim();
    }

    if (!key) {
      continue;
    }

    let value = trimmed.slice(equalsIndex + 1).trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    } else {
      const commentIndex = value.indexOf(' #');
      if (commentIndex !== -1) {
        value = value.slice(0, commentIndex).trim();
      }
    }

    value = value.replace(/\\n/g, '\n').replace(/\\r/g, '\r');

    if (process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}
