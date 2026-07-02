import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { setStoreValue } from "@/lib/store";
import { zodResolver } from "@hookform/resolvers/zod";
import { useNavigate } from "@tanstack/react-router";
import { useForm } from "react-hook-form";
import { z } from "zod";

const STORE_KEY = "name";

const formSchema = z.object({
  name: z.string().min(1, "Name is required"),
});

type FormValues = z.infer<typeof formSchema>;

function NameScreen() {
  const navigate = useNavigate();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { name: "" },
  });

  const onSubmit = async (values: FormValues) => {
    await setStoreValue(STORE_KEY, values.name);
    navigate({ to: "/folder" });
  };

  return (
    <div className="flex flex-1 items-center justify-center">
      <form
        onSubmit={handleSubmit(onSubmit)}
        className="w-full max-w-sm space-y-2"
      >
        <h1 className="mb-4 text-2xl font-medium">Name</h1>
        <Label htmlFor="name">Your name</Label>
        <Input
          id="name"
          placeholder="Enter your name"
          aria-invalid={!!errors.name}
          {...register("name")}
        />
        {errors.name && (
          <p className="text-destructive text-sm">{errors.name.message}</p>
        )}
        <Button type="submit" className="w-full">
          Submit
        </Button>
      </form>
    </div>
  );
}

export default NameScreen;
