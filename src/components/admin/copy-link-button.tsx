"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";

type CopyLinkButtonProps = {
  value: string;
  label?: string;
};

export function CopyLinkButton({ value, label = "Copy link" }: CopyLinkButtonProps) {
  const [copied, setCopied] = useState(false);

  async function onCopy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  return (
    <Button type="button" variant="outline" onClick={onCopy}>
      {copied ? "Copied" : label}
      <span className="sr-only" aria-live="polite">
        {copied ? "Client access link copied to clipboard" : ""}
      </span>
    </Button>
  );
}
