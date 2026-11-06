import { SignIn } from "@clerk/nextjs";
import { Suspense } from "react";
import { AuthPage } from "@/components/auth-page";

export default function SignInPage() {
  return (
    <AuthPage>
      <Suspense>
        <SignIn />
      </Suspense>
    </AuthPage>
  );
}
