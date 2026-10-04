"use client";

import { useActionState, useMemo } from "react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { cmsFieldClass, cmsTextareaClass } from "@/components/workspace/property-cms/section";
import {
  CONTENT_VISIBILITY,
  HOUSE_RULE_KEYS,
  HOUSE_RULE_LABELS,
  HOUSE_RULE_STATE_LABELS,
  HOUSE_RULE_STATES,
} from "@/lib/property-cms/catalog";
import {
  updatePropertyHouseRulesAction,
  type WorkspaceMutationState,
} from "@/lib/workspace/property-cms-actions";

const initialState: WorkspaceMutationState = {};

type RuleValue = {
  ruleKey: string;
  state: string;
  details: string | null;
  visibility: string;
};

export function PropertyHouseRulesForm({
  propertyId,
  rules,
}: {
  propertyId: string;
  rules: RuleValue[];
}) {
  const action = useMemo(
    () => updatePropertyHouseRulesAction.bind(null, propertyId),
    [propertyId],
  );
  const [state, formAction, pending] = useActionState(action, initialState);
  const byKey = new Map(rules.map((rule) => [rule.ruleKey, rule]));

  return (
    <form action={formAction} className="space-y-5">
      {Object.values(HOUSE_RULE_KEYS).map((ruleKey) => {
        const current = byKey.get(ruleKey);
        return (
          <div key={ruleKey} className="rounded-xl bg-onwarda-cream/60 p-4">
            <p className="mb-3 font-medium">{HOUSE_RULE_LABELS[ruleKey]}</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor={`state_${ruleKey}`}>State</Label>
                <select
                  id={`state_${ruleKey}`}
                  name={`state_${ruleKey}`}
                  defaultValue={current?.state ?? HOUSE_RULE_STATES.UNSPECIFIED}
                  className={cmsFieldClass}
                >
                  {Object.values(HOUSE_RULE_STATES).map((stateValue) => (
                    <option key={stateValue} value={stateValue}>
                      {HOUSE_RULE_STATE_LABELS[stateValue]}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor={`visibility_${ruleKey}`}>Visibility</Label>
                <select
                  id={`visibility_${ruleKey}`}
                  name={`visibility_${ruleKey}`}
                  defaultValue={current?.visibility ?? CONTENT_VISIBILITY.PUBLIC}
                  className={cmsFieldClass}
                >
                  <option value="public">Public</option>
                  <option value="guest">Guest only</option>
                  <option value="private">Private</option>
                </select>
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor={`details_${ruleKey}`}>Details</Label>
                <textarea
                  id={`details_${ruleKey}`}
                  name={`details_${ruleKey}`}
                  rows={2}
                  maxLength={2000}
                  defaultValue={current?.details ?? ""}
                  className={cmsTextareaClass}
                />
              </div>
            </div>
          </div>
        );
      })}
      {state.error ? (
        <p className="text-sm text-destructive" role="alert">
          {state.error}
        </p>
      ) : null}
      <Button type="submit" disabled={pending}>
        {pending ? "Saving..." : "Save house rules"}
      </Button>
    </form>
  );
}
