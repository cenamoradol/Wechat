import { LoginForm } from "@/components/auth/login-form";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import Link from "next/link";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; reset?: string }>;
}) {
  const { next, reset } = await searchParams;
  const nextParam = next ? `?next=${encodeURIComponent(next)}` : "";
  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle>Inicia sesión</CardTitle>
        <CardDescription>Entra a tu workspace de Wechat</CardDescription>
      </CardHeader>
      <CardContent>
        {reset === "ok" && (
          <div className="mb-4 rounded-md border border-green-200 bg-green-50 p-3 text-sm text-green-900">
            Contraseña cambiada con éxito. Inicia sesión con tu nueva contraseña.
          </div>
        )}
        <LoginForm next={next} />
        <p className="mt-4 text-center text-sm text-muted-foreground">
          ¿No tienes cuenta?{" "}
          <Link href={`/signup${nextParam}`} className="font-medium text-foreground underline">
            Regístrate
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}