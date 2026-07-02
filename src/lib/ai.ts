import type { BranchDiffDetail, DiffHunk } from "@/lib/git";
import { getStoreValue } from "@/lib/store";
import { fetch } from "@tauri-apps/plugin-http";
import { z } from "zod";

const AI_CONFIG_STORE_KEY = "aiApiConfig";

const aiApiConfigSchema = z.object({
  apiUrl: z.string().url(),
  apiKey: z.string().min(1),
  model: z.string().min(1),
  temperature: z.number().min(0).max(1),
  maxTokens: z.number().int().positive(),
});

export type AiApiConfig = z.infer<typeof aiApiConfigSchema>;

/**
 * Loads the AI provider settings from the store. Returns `null` if the
 * settings were never saved or no longer match the expected shape.
 */
export async function loadAiApiConfig(): Promise<AiApiConfig | null> {
  const raw = await getStoreValue<unknown>(AI_CONFIG_STORE_KEY);
  if (!raw) return null;
  const parsed = aiApiConfigSchema.safeParse(raw);
  return parsed.success ? parsed.data : null;
}

const METRIC_KEYS = [
  "overall",
  "codeQuality",
  "security",
  "maintainability",
  "performance",
  "testCoverage",
] as const;

export type MetricKey = (typeof METRIC_KEYS)[number];

const severitySchema = z.enum(["critical", "warning", "suggestion", "info"]);

export type Severity = z.infer<typeof severitySchema>;

const metricSchema = z.object({
  score: z.number().min(0).max(100),
  summary: z.string().min(1),
});

const findingSchema = z.object({
  file: z.string().min(1),
  hunkId: z.string().nullable(),
  severity: severitySchema,
  title: z.string().min(1),
  review: z.string().min(1),
});

const aiReviewResponseSchema = z.object({
  summary: z.string(),
  metrics: z.object({
    overall: metricSchema,
    codeQuality: metricSchema,
    security: metricSchema,
    maintainability: metricSchema,
    performance: metricSchema,
    testCoverage: metricSchema,
  }),
  findings: z.array(findingSchema),
});

export type AiReviewResponse = z.infer<typeof aiReviewResponseSchema>;
export type AiMetric = z.infer<typeof metricSchema>;
export type AiFinding = z.infer<typeof findingSchema>;

/**
 * Renders a diff into plain text for the AI prompt, with each hunk tagged by
 * a stable id so the model can reference exactly which snippet a finding
 * applies to.
 */
export function buildDiffPromptText(detail: BranchDiffDetail): string {
  const lines: string[] = [];
  if (detail.truncated) {
    lines.push(
      "NOTE: This diff was truncated due to size; review only what is shown below.",
      "",
    );
  }

  for (const file of detail.files) {
    lines.push(`FILE: ${file.path} (${file.status})`);
    if (file.isBinary) {
      lines.push("  [binary file, contents omitted]", "");
      continue;
    }
    for (const hunk of file.hunks) {
      lines.push(`  HUNK ${hunk.id} ${hunk.header}`);
      for (const line of hunk.content.split("\n")) {
        if (line.length === 0) continue;
        lines.push(`  ${line}`);
      }
    }
    lines.push("");
  }

  return lines.join("\n");
}

const SYSTEM_PROMPT = `You are a senior code reviewer. You will be given a unified diff between two git branches, with each file introduced by a "FILE:" line and each hunk introduced by a "HUNK <id> <header>" line.

Respond with a single JSON object only, no prose outside the JSON, matching exactly this shape:
{
  "summary": string,
  "metrics": {
    "overall": { "score": number (0-100), "summary": string },
    "codeQuality": { "score": number (0-100), "summary": string },
    "security": { "score": number (0-100), "summary": string },
    "maintainability": { "score": number (0-100), "summary": string },
    "performance": { "score": number (0-100), "summary": string },
    "testCoverage": { "score": number (0-100), "summary": string }
  },
  "findings": [
    {
      "file": string (must exactly match a "FILE:" path from the diff),
      "hunkId": string | null (must exactly match a "HUNK <id>" from the diff, or null for a file-level comment),
      "severity": "critical" | "warning" | "suggestion" | "info",
      "title": string (short),
      "review": string (explain the issue or suggestion)
    }
  ]
}

Each metric score reflects the whole diff. Findings should call out the most important, specific issues — do not create a finding for every line, only for things worth a reviewer's attention. If there are no changes to comment on, return an empty findings array.`;

interface ChatCompletionResponse {
  choices?: { message?: { content?: string } }[];
  error?: { message?: string };
}

/**
 * Some models ignore "JSON only" instructions and wrap their answer in a
 * markdown code fence (or add stray prose around it). Strip that wrapping
 * so well-formed JSON inside still parses.
 */
function extractJsonPayload(content: string): string {
  const trimmed = content.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (fenced) return fenced[1];

  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start !== -1 && end !== -1 && end > start) {
    return trimmed.slice(start, end + 1);
  }

  return trimmed;
}

/**
 * Sends the diff to the configured OpenAI-compatible endpoint and returns a
 * validated structured review. Throws a descriptive error for network,
 * HTTP, parse, or schema-validation failures.
 */
export async function generateReview(
  diffDetail: BranchDiffDetail,
  config: AiApiConfig,
): Promise<AiReviewResponse> {
  const url = `${config.apiUrl}`;

  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify({
        model: config.model,
        temperature: config.temperature,
        max_tokens: config.maxTokens,
        stream: false,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          {
            role: "user",
            content: `Review the following branch diff:\n\n${buildDiffPromptText(diffDetail)}`,
          },
        ],
      }),
    });
  } catch {
    throw new Error(
      "Could not reach the AI endpoint. Check the API URL in Settings and your network connection.",
    );
  }

  if (!response.ok) {
    let message = response.statusText;
    try {
      const body = (await response.json()) as ChatCompletionResponse;
      if (body.error?.message) message = body.error.message;
    } catch {
      // response body wasn't JSON; fall back to statusText
    }
    throw new Error(`AI request failed (${response.status}): ${message}`);
  }

  const body = (await response.json()) as ChatCompletionResponse;
  const content = body.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error("The AI response didn't include any content.");
  }

  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(extractJsonPayload(content));
  } catch {
    throw new Error("The AI response wasn't valid JSON.");
  }

  const result = aiReviewResponseSchema.safeParse(parsedJson);
  if (!result.success) {
    console.error("AI review response failed validation:", result.error.issues);
    throw new Error("The AI response didn't match the expected review format.");
  }

  return result.data;
}

export interface ReviewItem {
  file: string;
  severity: Severity;
  title: string;
  review: string;
  snippet: { header: string; content: string } | null;
}

/**
 * Joins AI findings back to the exact original diff hunk text they
 * reference, so the UI can render real code rather than AI-echoed text.
 */
export function buildReviewItems(
  findings: AiFinding[],
  diffDetail: BranchDiffDetail,
): ReviewItem[] {
  const hunksById = new Map<string, DiffHunk>();
  for (const file of diffDetail.files) {
    for (const hunk of file.hunks) {
      hunksById.set(hunk.id, hunk);
    }
  }

  return findings.map((finding) => {
    const hunk = finding.hunkId ? hunksById.get(finding.hunkId) : undefined;
    return {
      file: finding.file,
      severity: finding.severity,
      title: finding.title,
      review: finding.review,
      snippet: hunk ? { header: hunk.header, content: hunk.content } : null,
    };
  });
}
