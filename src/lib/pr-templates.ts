/** Fixed set of PR types users can save a fallback template for in Settings. */
export const PR_TEMPLATE_TYPES = [
  { key: "feature", label: "Feature" },
  { key: "bugfix", label: "Bug Fix" },
  { key: "refactor", label: "Refactor" },
  { key: "docs", label: "Docs" },
  { key: "chore", label: "Chore" },
] as const;

export type PrTemplateTypeKey = (typeof PR_TEMPLATE_TYPES)[number]["key"];

/** Store shape for user-defined fallback templates, keyed by PR type. */
export type PrTemplateSettings = Partial<Record<PrTemplateTypeKey, string>>;

export const PR_TEMPLATES_STORE_KEY = "prTemplates";
