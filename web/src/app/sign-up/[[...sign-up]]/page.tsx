import type { Metadata } from "next";
import { SignUp } from "@clerk/nextjs";
import { Suspense } from "react";
import { AuthPage } from "@/components/auth-page";

export const metadata: Metadata = { title: "Create account" };

export default function SignUpPage() {
  return (
    <AuthPage>
      <Suspense>
        <SignUp />
      </Suspense>
    </AuthPage>
  );
}
