"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { useTraderWallet } from "@/hooks/useTraderWallet";

type LandingAppButtonProps = {
  children?: React.ReactNode;
  className?: string;
  showArrow?: boolean;
  signedOutLabel?: React.ReactNode;
};

export default function LandingAppButton({ children = "Open app", className = "", showArrow = true, signedOutLabel }: LandingAppButtonProps) {
  const { ready, authenticated, login } = useTraderWallet();

  const signedInContent = (
    <>
      {children} {showArrow && <ArrowRight className="size-4" />}
    </>
  );
  const signedOutContent = (
    <>
      {signedOutLabel ?? children} {showArrow && <ArrowRight className="size-4" />}
    </>
  );

  if (ready && authenticated) {
    return (
      <Link href="/dashboard" className={className}>
        {signedInContent}
      </Link>
    );
  }

  return (
    <button type="button" onClick={ready ? login : undefined} className={className}>
      {signedOutContent}
    </button>
  );
}
