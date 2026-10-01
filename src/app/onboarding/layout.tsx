import Link from "next/link";
import { env } from "@/lib/env";

export default function OnboardingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-muted/30 px-4">
      <Link href="/" className="mb-8 flex items-center gap-2">
        <div className="bg-primary text-primary-foreground grid h-10 w-10 place-items-center rounded-lg font-bold">
          W
        </div>
        <span className="text-xl font-semibold">{env.NEXT_PUBLIC_APP_NAME}</span>
      </Link>
      {children}
    </div>
  );
}