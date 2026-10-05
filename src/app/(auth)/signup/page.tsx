import { SignupForm } from "@/components/auth/signup-form";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import Link from "next/link";

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  const nextParam = next ? `?next=${encodeURIComponent(next)}` : "";

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle>Crea tu cuenta</CardTitle>
        <CardDescription>
          {next
            ? "Crea tu cuenta para aceptar la invitación."
            : "Empieza a centralizar tus conversaciones"}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <SignupForm next={next} />
        <p className="mt-4 text-center text-sm text-muted-foreground">
          ¿Ya tienes cuenta?{" "}
          <Link href={`/login${nextParam}`} className="font-medium text-foreground underline">
            Inicia sesión
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}