import { findPrTemplates, type BranchDiffDetail, type DiffHunk } from "@/lib/git";
import {
  PR_TEMPLATE_TYPES,
  PR_TEMPLATES_STORE_KEY,
  type PrTemplateSettings,
} from "@/lib/pr-templates";
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
  contextWindow: z.number().int().positive().default(8192),
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

const SYSTEM_PROMPT = `You are a strict, meticulous senior code reviewer performing a rigorous audit. You will be given a unified diff between two git branches, with each file introduced by a "FILE:" line and each hunk introduced by a "HUNK <id> <header>" line.

Review standards:
- Do not give the benefit of the doubt. If something could plausibly be a bug, security issue, race condition, edge case, missing error handling, missing input validation, missing test coverage, or a violation of best practices, flag it.
- Actively look for: unhandled errors/exceptions, null/undefined access, off-by-one errors, resource leaks, injection or XSS vectors, hardcoded secrets, missing authorization checks, race conditions, inefficient algorithms or unnecessary re-renders, dead code, unclear naming, and missing or inadequate tests for new logic.
- Prefer flagging borderline issues as "suggestion" or "info" rather than omitting them — this review should surface more, not fewer, findings than a casual pass. Only skip a finding if it is truly trivial and has no bearing on correctness, security, maintainability, or performance.
- Score conservatively: reserve scores above 90 for changes with no notable issues. Deduct meaningfully for each unresolved concern, even minor ones. A diff with several warnings or a missing test should not score above 70.

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
      "review": string (explain the issue or suggestion, and how to fix it)
    }
  ]
}

Findings should be specific and actionable. If there are truly no changes to comment on, return an empty findings array — but treat that as rare, not the default.`;

/**
 * Rough token estimate for arbitrary text, using the common ~4-characters-
 * per-token approximation for English text. Actual tokenizers vary by model,
 * so treat this as a ballpark figure rather than an exact count.
 */
export function estimateTokenCount(text: string): number {
  return Math.ceil(text.length / 4);
}

function estimatePromptTokens(systemPrompt: string, userContent: string) {
  return estimateTokenCount(systemPrompt) + estimateTokenCount(userContent);
}

/**
 * Estimates the input (prompt) tokens a review request will consume, using
 * the same system prompt and diff text `generateReview` sends to the model.
 */
export function estimateReviewPromptTokens(
  diffDetail: BranchDiffDetail,
): number {
  return estimatePromptTokens(
    SYSTEM_PROMPT,
    `Review the following branch diff:\n\n${buildDiffPromptText(diffDetail)}`,
  );
}

export interface ContextWindowCheck {
  ok: boolean;
  estimatedInputTokens: number;
  maxOutputTokens: number;
  contextWindow: number;
}

/**
 * Checks whether a request's estimated input tokens plus the configured
 * output cap (`maxTokens`) fit inside the model's context window, so
 * oversized requests can be rejected before making a network call.
 */
export function checkContextWindow(
  estimatedInputTokens: number,
  config: Pick<AiApiConfig, "maxTokens" | "contextWindow">,
): ContextWindowCheck {
  return {
    ok: estimatedInputTokens + config.maxTokens <= config.contextWindow,
    estimatedInputTokens,
    maxOutputTokens: config.maxTokens,
    contextWindow: config.contextWindow,
  };
}

export function contextWindowErrorMessage(check: ContextWindowCheck): string {
  const total = check.estimatedInputTokens + check.maxOutputTokens;
  return (
    `This request needs about ${total.toLocaleString()} tokens ` +
    `(${check.estimatedInputTokens.toLocaleString()} input + up to ${check.maxOutputTokens.toLocaleString()} output), ` +
    `which exceeds the ${check.contextWindow.toLocaleString()}-token context window set in Settings. ` +
    `Lower Max Tokens, review a smaller diff, or raise the context window if your model supports more.`
  );
}

interface ChatCompletionResponse {
  choices?: { message?: { content?: string }; finish_reason?: string }[];
  error?: { message?: string };
}

interface ChatCompletionResult {
  content: string;
  truncated: boolean;
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
 * Sends a system/user prompt pair to the configured OpenAI-compatible chat
 * completion endpoint and returns the raw message content. Throws a
 * descriptive error for network, HTTP, or empty-response failures.
 */
async function callChatCompletion(
  config: AiApiConfig,
  systemPrompt: string,
  userContent: string,
): Promise<ChatCompletionResult> {
  let response: Response;
  try {
    response = await fetch(config.apiUrl, {
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
          { role: "system", content: systemPrompt },
          { role: "user", content: userContent },
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
  const choice = body.choices?.[0];
  const content = choice?.message?.content;
  if (!content) {
    throw new Error("The AI response didn't include any content.");
  }

  return { content, truncated: choice?.finish_reason === "length" };
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
  const windowCheck = checkContextWindow(
    estimateReviewPromptTokens(diffDetail),
    config,
  );
  if (!windowCheck.ok) {
    throw new Error(contextWindowErrorMessage(windowCheck));
  }

  const { content, truncated } = await callChatCompletion(
    config,
    SYSTEM_PROMPT,
    `Review the following branch diff:\n\n${buildDiffPromptText(diffDetail)}`,
  );

  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(extractJsonPayload(content));
  } catch {
    if (truncated) {
      throw new Error(
        "The AI response was cut off before it finished (max tokens reached). Increase Max Tokens in Settings or review a smaller diff, then try again.",
      );
    }
    throw new Error("The AI response wasn't valid JSON.");
  }

  const result = aiReviewResponseSchema.safeParse(parsedJson);
  if (!result.success) {
    console.error("AI review response failed validation:", result.error.issues);
    throw new Error("The AI response didn't match the expected review format.");
  }

  return result.data;
}

const prMetadataSchema = z.object({
  title: z.string().min(1),
  description: z.string().min(1),
  templateUsed: z.string().nullable().optional(),
});

export type PrMetadata = z.infer<typeof prMetadataSchema>;

/** A named PR template the AI can be asked to fill in. */
export interface PrTemplateOption {
  name: string;
  content: string;
}

/**
 * Finds the PR template(s) that should guide description generation for
 * `folder`: the repo's own GitHub/GitLab template(s) take priority, falling
 * back to the user's per-type templates saved in Settings when the repo
 * doesn't define one. Returns an empty array if neither exists, in which
 * case generation falls back to a freeform description.
 */
export async function resolvePrTemplates(
  folder: string,
): Promise<PrTemplateOption[]> {
  const repoTemplates = await findPrTemplates(folder);
  if (repoTemplates.length > 0) {
    return repoTemplates.map((t) => ({ name: t.name, content: t.content }));
  }

  const settings = await getStoreValue<PrTemplateSettings>(
    PR_TEMPLATES_STORE_KEY,
  );
  if (!settings) return [];

  return PR_TEMPLATE_TYPES.filter((type) => settings[type.key]?.trim()).map(
    (type) => ({ name: type.label, content: settings[type.key]!.trim() }),
  );
}

function buildPrSystemPrompt(templates: PrTemplateOption[]): string {
  const base = `You are a senior engineer writing a pull request title and description for the given branch diff, provided in the same FILE:/HUNK: format used for code review.`;

  if (templates.length === 0) {
    return `${base}

Respond with a single JSON object only, no prose outside the JSON, matching exactly this shape:
{
  "title": string (a short, imperative summary of the change, under 72 characters, no trailing period),
  "description": string (a concise markdown summary of what changed and why, based only on the diff; use short paragraphs and/or a bullet list)
}`;
  }

  const templateBlocks = templates
    .map((t) => `--- TEMPLATE "${t.name}" ---\n${t.content}`)
    .join("\n\n");
  const pickInstruction =
    templates.length > 1
      ? "Pick the single template above that best fits the nature of this change (e.g. a bug fix vs a new feature vs a docs-only change vs a refactor), then fill it in completely."
      : "Fill in the template completely.";

  return `${base}

This project provides ${templates.length > 1 ? "the following PR templates" : "a PR template"} that the description must follow:

${templateBlocks}

${pickInstruction} Keep the template's section headers, structure, and any checkboxes intact; replace placeholder/instructional text with real content based on the diff, and check off checkboxes where the diff supports it. Do not invent new sections and do not include the unused templates in your answer.

Respond with a single JSON object only, no prose outside the JSON, matching exactly this shape:
{
  "title": string (a short, imperative summary of the change, under 72 characters, no trailing period),
  "description": string (the filled-in template as markdown, based only on the diff),
  "templateUsed": string (the exact name of the template you filled in, from the list above)
}`;
}

/**
 * Sends the diff to the configured OpenAI-compatible endpoint and returns a
 * generated PR title and description. When `templates` is non-empty, the AI
 * is instructed to fill in the best-matching template (auto-selecting when
 * more than one is given) instead of writing a freeform description. Throws
 * a descriptive error for network, HTTP, parse, or schema-validation
 * failures.
 */
export async function generatePrMetadata(
  diffDetail: BranchDiffDetail,
  config: AiApiConfig,
  templates: PrTemplateOption[] = [],
): Promise<PrMetadata> {
  const systemPrompt = buildPrSystemPrompt(templates);
  const userContent = `Write a PR title and description for the following branch diff:\n\n${buildDiffPromptText(diffDetail)}`;
  const windowCheck = checkContextWindow(
    estimatePromptTokens(systemPrompt, userContent),
    config,
  );
  if (!windowCheck.ok) {
    throw new Error(contextWindowErrorMessage(windowCheck));
  }

  const { content, truncated } = await callChatCompletion(
    config,
    systemPrompt,
    userContent,
  );

  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(extractJsonPayload(content));
  } catch {
    if (truncated) {
      throw new Error(
        "The AI response was cut off before it finished (max tokens reached). Increase Max Tokens in Settings or review a smaller diff, then try again.",
      );
    }
    throw new Error("The AI response wasn't valid JSON.");
  }

  const result = prMetadataSchema.safeParse(parsedJson);
  if (!result.success) {
    console.error(
      "AI PR metadata response failed validation:",
      result.error.issues,
    );
    throw new Error("The AI response didn't match the expected PR format.");
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
