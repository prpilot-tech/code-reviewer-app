import { Button } from "@/components/ui/button";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
} from "@/components/ui/sidebar";
import { Slider } from "@/components/ui/slider";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  PR_TEMPLATE_TYPES,
  PR_TEMPLATES_STORE_KEY,
  type PrTemplateSettings,
} from "@/lib/pr-templates";
import { getStoreValue, setStoreValue } from "@/lib/store";
import { zodResolver } from "@hookform/resolvers/zod";
import { Eye, EyeOff, FileText, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import toast from "react-hot-toast";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { z } from "zod";

const SETTINGS_SECTIONS = [
  { key: "ai-api", label: "AI API", icon: Sparkles },
  { key: "pr-templates", label: "PR Templates", icon: FileText },
] as const;

type SettingsSection = (typeof SETTINGS_SECTIONS)[number]["key"];

const STORE_KEY = "aiApiConfig";

const PR_TEMPLATE_DEFAULTS: PrTemplateSettings = Object.fromEntries(
  PR_TEMPLATE_TYPES.map((type) => [type.key, ""]),
);

const MARKDOWN_PREVIEW_CLASSNAME =
  "min-h-72 flex-1 overflow-y-auto rounded-md border border-input px-3 py-2 text-sm [&>*:first-child]:mt-0 [&_h1]:mt-4 [&_h1]:text-lg [&_h1]:font-semibold [&_h2]:mt-4 [&_h2]:text-base [&_h2]:font-semibold [&_h3]:mt-3 [&_h3]:text-sm [&_h3]:font-semibold [&_p]:mt-2 [&_ul]:mt-2 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:mt-2 [&_ol]:list-decimal [&_ol]:pl-5 [&_li]:mt-1 [&_code]:rounded [&_code]:bg-muted [&_code]:px-1 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-xs [&_pre]:mt-2 [&_pre]:overflow-x-auto [&_pre]:rounded-md [&_pre]:bg-muted [&_pre]:p-3 [&_a]:text-primary [&_a]:underline";

const formSchema = z.object({
  apiUrl: z.url({
    message: "Enter a valid URL, e.g. http://127.0.0.1:1234/v1/chat/completions",
  }),
  apiKey: z.string().min(1, "API key is required"),
  model: z.string().min(1, "Model is required"),
  temperature: z.number().min(0).max(1),
  maxTokens: z
    .number()
    .int("Must be a whole number")
    .positive("Must be a positive number"),
  contextWindow: z
    .number()
    .int("Must be a whole number")
    .positive("Must be a positive number"),
});

type FormValues = z.infer<typeof formSchema>;

const DEFAULT_VALUES: FormValues = {
  apiUrl: "",
  apiKey: "",
  model: "",
  temperature: 0.3,
  maxTokens: 4096,
  contextWindow: 8192,
};

function SettingsScreen() {
  const [section, setSection] = useState<SettingsSection>("ai-api");
  const [showApiKey, setShowApiKey] = useState(false);

  const {
    register,
    handleSubmit,
    control,
    reset,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: DEFAULT_VALUES,
  });

  useEffect(() => {
    getStoreValue<FormValues>(STORE_KEY).then((value) => {
      if (value) reset(value);
    });
  }, [reset]);

  const onSubmit = async (values: FormValues) => {
    await setStoreValue(STORE_KEY, values);
    toast.success("AI API settings saved");
  };

  const temperature = watch("temperature");

  const {
    register: registerTemplate,
    handleSubmit: handleTemplatesSubmit,
    reset: resetTemplates,
    watch: watchTemplates,
    formState: { isSubmitting: isSubmittingTemplates },
  } = useForm<PrTemplateSettings>({
    defaultValues: PR_TEMPLATE_DEFAULTS,
  });

  useEffect(() => {
    getStoreValue<PrTemplateSettings>(PR_TEMPLATES_STORE_KEY).then((value) => {
      if (value) resetTemplates({ ...PR_TEMPLATE_DEFAULTS, ...value });
    });
  }, [resetTemplates]);

  const onSubmitTemplates = async (values: PrTemplateSettings) => {
    await setStoreValue(PR_TEMPLATES_STORE_KEY, values);
    toast.success("PR templates saved");
  };

  const templateValues = watchTemplates();

  return (
    <SidebarProvider className="min-h-0 flex-1 items-stretch overflow-hidden">
      <Sidebar collapsible="none" className="w-56 shrink-0 bg-transparent">
        <SidebarHeader>
          <h1 className="px-2 text-lg font-medium">Settings</h1>
        </SidebarHeader>
        <SidebarContent>
          <SidebarGroup>
            <SidebarMenu className="gap-1">
              {SETTINGS_SECTIONS.map(({ key, label, icon: Icon }) => (
                <SidebarMenuItem key={key}>
                  <SidebarMenuButton
                    isActive={section === key}
                    onClick={() => setSection(key)}
                    className="data-active:bg-primary data-active:font-medium data-active:text-primary-foreground data-active:hover:bg-primary/80"
                  >
                    <Icon />
                    {label}
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroup>
        </SidebarContent>
      </Sidebar>

      <div className="min-h-0 flex-1 overflow-y-auto border-l border-foreground/10">
        <div className="px-8 py-6">
          {section === "ai-api" && (
            <form onSubmit={handleSubmit(onSubmit)} className="max-w-2xl">
              <div className="space-y-1">
                <h2 className="text-lg font-medium">AI API</h2>
                <p className="text-muted-foreground text-sm">
                  Connect an LLM provider to power AI code review.
                </p>
              </div>

              <FieldGroup className="mt-6">
                <Field data-invalid={!!errors.apiUrl}>
                  <FieldLabel htmlFor="apiUrl">API URL</FieldLabel>
                  <Input
                    id="apiUrl"
                    placeholder="https://api.openai.com/v1"
                    aria-invalid={!!errors.apiUrl}
                    {...register("apiUrl")}
                  />
                  <FieldDescription>
                    Base URL of your OpenAI-compatible endpoint.
                  </FieldDescription>
                  {errors.apiUrl && (
                    <FieldError>{errors.apiUrl.message}</FieldError>
                  )}
                </Field>

                <Field data-invalid={!!errors.apiKey}>
                  <FieldLabel htmlFor="apiKey">API key</FieldLabel>
                  <InputGroup>
                    <InputGroupInput
                      id="apiKey"
                      type={showApiKey ? "text" : "password"}
                      placeholder="sk-..."
                      autoComplete="off"
                      aria-invalid={!!errors.apiKey}
                      {...register("apiKey")}
                    />
                    <InputGroupAddon align="inline-end">
                      <InputGroupButton
                        type="button"
                        size="icon-xs"
                        aria-label={
                          showApiKey ? "Hide API key" : "Show API key"
                        }
                        onClick={() => setShowApiKey((prev) => !prev)}
                      >
                        {showApiKey ? <EyeOff /> : <Eye />}
                      </InputGroupButton>
                    </InputGroupAddon>
                  </InputGroup>
                  <FieldDescription>
                    Stored locally on this device only.
                  </FieldDescription>
                  {errors.apiKey && (
                    <FieldError>{errors.apiKey.message}</FieldError>
                  )}
                </Field>

                <Field data-invalid={!!errors.model}>
                  <FieldLabel htmlFor="model">Model</FieldLabel>
                  <Input
                    id="model"
                    placeholder="e.g. gpt-4o, claude-opus-4-8"
                    aria-invalid={!!errors.model}
                    {...register("model")}
                  />
                  <FieldDescription>
                    Model identifier sent with every review request.
                  </FieldDescription>
                  {errors.model && (
                    <FieldError>{errors.model.message}</FieldError>
                  )}
                </Field>

                <Field>
                  <FieldLabel htmlFor="temperature">
                    Temperature — {temperature.toFixed(1)}
                  </FieldLabel>
                  <Controller
                    control={control}
                    name="temperature"
                    render={({ field }) => (
                      <Slider
                        id="temperature"
                        min={0}
                        max={1}
                        step={0.1}
                        value={[field.value]}
                        onValueChange={([value]) => field.onChange(value)}
                      />
                    )}
                  />
                  <FieldDescription>
                    Lower is stricter and more deterministic; higher is more
                    exploratory feedback.
                  </FieldDescription>
                </Field>

                <Field data-invalid={!!errors.maxTokens}>
                  <FieldLabel htmlFor="maxTokens">Max output tokens</FieldLabel>
                  <Input
                    id="maxTokens"
                    type="number"
                    min={1}
                    aria-invalid={!!errors.maxTokens}
                    {...register("maxTokens", { valueAsNumber: true })}
                  />
                  <FieldDescription>
                    Caps response length so a review can&apos;t be cut off
                    mid-way.
                  </FieldDescription>
                  {errors.maxTokens && (
                    <FieldError>{errors.maxTokens.message}</FieldError>
                  )}
                </Field>

                <Field data-invalid={!!errors.contextWindow}>
                  <FieldLabel htmlFor="contextWindow">
                    Context window (tokens)
                  </FieldLabel>
                  <Input
                    id="contextWindow"
                    type="number"
                    min={1}
                    aria-invalid={!!errors.contextWindow}
                    {...register("contextWindow", { valueAsNumber: true })}
                  />
                  <FieldDescription>
                    Your model&apos;s total token limit (input + output).
                    Requests that would exceed it are blocked before sending.
                  </FieldDescription>
                  {errors.contextWindow && (
                    <FieldError>{errors.contextWindow.message}</FieldError>
                  )}
                </Field>
              </FieldGroup>

              <div className="mt-6 flex justify-end">
                <Button type="submit" disabled={isSubmitting}>
                  Save
                </Button>
              </div>
            </form>
          )}

          {section === "pr-templates" && (
            <form
              onSubmit={handleTemplatesSubmit(onSubmitTemplates)}
              className="max-w-4xl"
            >
              <div className="space-y-1">
                <h2 className="text-lg font-medium">PR Templates</h2>
                <p className="text-muted-foreground text-sm">
                  Fallback templates used to generate the PR description when
                  the repo doesn&apos;t have its own (checked in{" "}
                  <span className="font-mono">.github/</span> or{" "}
                  <span className="font-mono">.gitlab/</span>). The AI picks
                  whichever type best matches the change.
                </p>
              </div>

              <Tabs
                defaultValue={PR_TEMPLATE_TYPES[0].key}
                className="mt-6"
              >
                <TabsList>
                  {PR_TEMPLATE_TYPES.map((type) => (
                    <TabsTrigger key={type.key} value={type.key}>
                      {type.label}
                    </TabsTrigger>
                  ))}
                </TabsList>
                {PR_TEMPLATE_TYPES.map((type) => (
                  <TabsContent
                    key={type.key}
                    value={type.key}
                    className="grid grid-cols-1 gap-4 lg:grid-cols-2"
                  >
                    <Field>
                      <FieldLabel htmlFor={`pr-template-${type.key}`}>
                        Template
                      </FieldLabel>
                      <Textarea
                        id={`pr-template-${type.key}`}
                        className="min-h-72 font-mono text-sm"
                        placeholder={`Paste your ${type.label.toLowerCase()} PR template here…`}
                        {...registerTemplate(type.key)}
                      />
                    </Field>

                    <Field>
                      <FieldLabel>Preview</FieldLabel>
                      <div className={MARKDOWN_PREVIEW_CLASSNAME}>
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>
                          {templateValues[type.key] ||
                            "*Nothing to preview yet.*"}
                        </ReactMarkdown>
                      </div>
                    </Field>
                  </TabsContent>
                ))}
              </Tabs>

              <div className="mt-6 flex justify-end">
                <Button type="submit" disabled={isSubmittingTemplates}>
                  Save
                </Button>
              </div>
            </form>
          )}
        </div>
      </div>
    </SidebarProvider>
  );
}

export default SettingsScreen;
