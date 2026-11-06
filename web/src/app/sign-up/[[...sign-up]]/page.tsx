import { SignUp } from "@clerk/nextjs";
import { Suspense } from "react";
import { AuthPage } from "@/components/auth-page";

export default function SignUpPage() {
  return (
    <AuthPage>
      <Suspense>
        <SignUp />
      </Suspense>
    </AuthPage>
  );
}
