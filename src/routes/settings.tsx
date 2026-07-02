import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
import { Slider } from "@/components/ui/slider";
import { getStoreValue, setStoreValue } from "@/lib/store";
import { zodResolver } from "@hookform/resolvers/zod";
import { Eye, EyeOff } from "lucide-react";
import { useEffect, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import toast from "react-hot-toast";
import { z } from "zod";

const STORE_KEY = "aiApiConfig";

const formSchema = z.object({
  apiUrl: z.string().url("Enter a valid URL"),
  apiKey: z.string().min(1, "API key is required"),
  model: z.string().min(1, "Model is required"),
  temperature: z.number().min(0).max(1),
  maxTokens: z
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
};

function SettingsScreen() {
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

  return (
    <div className="flex items-center justify-center">
      <div className="w-full max-w-lg space-y-6 px-4">
        <div className="space-y-1 text-center">
          <h1 className="text-2xl font-medium">Settings</h1>
          <p className="text-muted-foreground text-sm">
            Configure the AI provider used to generate code reviews.
          </p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)}>
          <Card>
            <CardHeader>
              <CardTitle>AI API</CardTitle>
              <CardDescription>
                Connect an LLM provider to power AI code review.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <FieldGroup>
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
              </FieldGroup>
            </CardContent>
            <CardFooter className="justify-end">
              <Button type="submit" disabled={isSubmitting}>
                Save
              </Button>
            </CardFooter>
          </Card>
        </form>
      </div>
    </div>
  );
}

export default SettingsScreen;
