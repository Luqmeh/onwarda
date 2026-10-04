"use client";

import { useEffect } from "react";

import { rememberSelectedPlan } from "@/lib/commercial/actions";

export function PersistSelectedPlan({ plan }: { plan: string }) {
  useEffect(() => {
    void rememberSelectedPlan(plan);
  }, [plan]);

  return null;
}
