import Link from "next/link";
import { SignIn } from "@clerk/nextjs";

export default function SignInPage() {
  return (
    <main
      className="min-h-screen flex flex-col items-center justify-center px-6 py-12"
      style={{ background: "var(--bg-base)" }}
    >
      <Link href="/" className="mb-10 flex items-center gap-3">
        <div
          className="w-9 h-9 rounded-xl flex items-center justify-center"
          style={{ background: "var(--black)" }}
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="white"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M3 21h18M5 21V7l8-4v18M19 21V11l-6-4" />
          </svg>
        </div>
        <span className="text-[18px] font-semibold">Architask</span>
      </Link>
      <SignIn signUpUrl="/sign-up" forceRedirectUrl="/annuaire" />
    </main>
  );
}
