"use client";

import { useActionState, useState } from "react";

import { CopyLinkButton } from "@/components/admin/copy-link-button";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cleaningTaskPath } from "@/config/client";
import {
  addPropertyCleanerAction,
  assignCleaningPropertyAction,
  assignCleaningTaskAction,
  createCleaningAgentAction,
  createManualCleaningAction,
  issueCleaningLinkAction,
  removePropertyCleanerAction,
  type CleaningMutationState,
} from "@/lib/cleaning/actions";

const initialState: CleaningMutationState = {};

export function CreateCleanerForm() {
  const [state, action, pending] = useActionState(createCleaningAgentAction, initialState);

  return (
    <form action={action} className="space-y-3">
      <div className="space-y-1">
        <Label htmlFor="displayName">Cleaner name</Label>
        <Input id="displayName" name="displayName" required maxLength={80} placeholder="Fatima" />
      </div>
      <div className="space-y-1">
        <Label htmlFor="notes">Notes</Label>
        <Input id="notes" name="notes" maxLength={500} placeholder="Optional" />
      </div>
      {state.error ? (
        <p className="text-sm text-destructive" role="alert">
          {state.error}
        </p>
      ) : null}
      <Button type="submit" disabled={pending}>
        {pending ? "Saving..." : "Add cleaner"}
      </Button>
    </form>
  );
}

export function AssignPropertyForm({
  agentId,
  properties,
}: {
  agentId: string;
  properties: Array<{ id: string; name: string }>;
}) {
  const action = assignCleaningPropertyAction.bind(null, agentId);
  const [state, formAction, pending] = useActionState(action, initialState);

  if (properties.length === 0) {
    return <p className="text-sm text-onwarda-muted">Every property is already assigned.</p>;
  }

  return (
    <form action={formAction} className="space-y-3">
      <label className="block space-y-1 text-sm">
        <span className="font-medium">Assign property</span>
        <select
          name="propertyId"
          required
          className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm"
          defaultValue={properties[0]?.id}
        >
          {properties.map((property) => (
            <option key={property.id} value={property.id}>
              {property.name}
            </option>
          ))}
        </select>
      </label>
      {state.error ? (
        <p className="text-sm text-destructive" role="alert">
          {state.error}
        </p>
      ) : null}
      <Button type="submit" disabled={pending}>
        {pending ? "Saving..." : "Assign property"}
      </Button>
    </form>
  );
}

export function CleaningLinkForm({ agentId }: { agentId: string }) {
  const action = issueCleaningLinkAction.bind(null, agentId);
  const [state, formAction, pending] = useActionState(action, initialState);

  return (
    <form action={formAction} className="space-y-3">
      <p className="text-sm text-onwarda-muted">
        This cleaner keeps one link. Generating a new one revokes the previous link. The address
        is shown only now.
      </p>
      {state.link ? (
        <div className="space-y-2" role="status">
          <a href={state.link} className="block break-all text-sm font-medium underline underline-offset-4">
            {state.link}
          </a>
          <CopyLinkButton value={state.link} label="Copy link" />
        </div>
      ) : null}
      {state.error ? (
        <p className="text-sm text-destructive" role="alert">
          {state.error}
        </p>
      ) : null}
      <Button type="submit" disabled={pending}>
        {pending ? "Creating..." : "Generate permanent link"}
      </Button>
    </form>
  );
}

export function CreateCleaningForm({
  requestKey,
  properties,
  agents,
}: {
  requestKey: string;
  properties: Array<{ id: string; name: string; defaultAgentId: string | null }>;
  agents: Array<{ id: string; name: string }>;
}) {
  const [state, action, pending] = useActionState(createManualCleaningAction, initialState);
  const [propertyId, setPropertyId] = useState(properties[0]?.id ?? "");
  const [assignee, setAssignee] = useState(properties[0]?.defaultAgentId ?? "unassigned");

  if (properties.length === 0) {
    return <p className="text-sm text-onwarda-muted">Add a property before creating a cleaning.</p>;
  }

  return (
    <form action={action} className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
      <input type="hidden" name="requestKey" value={requestKey} />
      <label className="block space-y-1 text-sm">
        <span className="font-medium">Property</span>
        <select
          name="propertyId"
          required
          value={propertyId}
          className="h-10 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm"
          onChange={(event) => {
            const next = event.target.value;
            const property = properties.find((item) => item.id === next);
            setPropertyId(next);
            setAssignee(property?.defaultAgentId ?? "unassigned");
          }}
        >
          {properties.map((property) => (
            <option key={property.id} value={property.id}>
              {property.name}
            </option>
          ))}
        </select>
      </label>
      <label className="block space-y-1 text-sm">
        <span className="font-medium">Cleaner</span>
        <select
          name="assignee"
          required
          value={assignee}
          className="h-10 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm"
          onChange={(event) => setAssignee(event.target.value)}
        >
          <option value="unassigned">Unassigned</option>
          {agents.map((agent) => (
            <option key={agent.id} value={agent.id}>
              {agent.name}
            </option>
          ))}
        </select>
      </label>
      <Button type="submit" disabled={pending} className="h-10">
        {pending ? "Creating..." : "Create cleaning"}
      </Button>
      {state.conflictTaskId ? (
        <div className="space-y-2 sm:col-span-3" role="status">
          <p className="text-sm">This property already has an active cleaning task.</p>
          <div className="flex flex-wrap gap-3">
            <a href={cleaningTaskPath(state.conflictTaskId)} className="text-sm font-medium underline underline-offset-4">
              View existing task
            </a>
            <Button type="submit" name="confirmExtra" value="true" variant="outline" disabled={pending}>
              Create another cleaning
            </Button>
          </div>
        </div>
      ) : null}
      {state.error ? (
        <p className="text-sm text-destructive sm:col-span-3" role="alert">
          {state.error}
        </p>
      ) : null}
    </form>
  );
}

export function PropertyCleanerForms({
  propertyId,
  assigned,
  available,
}: {
  propertyId: string;
  assigned: Array<{ id: string; name: string }>;
  available: Array<{ id: string; name: string }>;
}) {
  const action = addPropertyCleanerAction.bind(null, propertyId);
  const [state, formAction, pending] = useActionState(action, initialState);

  return (
    <div className="space-y-3">
      {assigned.length === 0 ? (
        <p className="text-sm text-onwarda-muted">No default cleaners yet.</p>
      ) : (
        <ul className="space-y-2">
          {assigned.map((cleaner) => (
            <li key={cleaner.id} className="flex items-center justify-between gap-3 text-sm">
              <span className="font-medium">{cleaner.name}</span>
              <form action={removePropertyCleanerAction.bind(null, propertyId, cleaner.id)}>
                <Button type="submit" variant="outline" size="sm">
                  Remove
                </Button>
              </form>
            </li>
          ))}
        </ul>
      )}
      {available.length > 0 ? (
        <form action={formAction} className="flex flex-wrap items-end gap-2">
          <label className="min-w-40 flex-1 space-y-1 text-sm">
            <span className="font-medium">Add cleaner</span>
            <select
              name="cleaningAgentId"
              required
              defaultValue={available[0]?.id}
              className="h-10 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm"
            >
              {available.map((cleaner) => (
                <option key={cleaner.id} value={cleaner.id}>
                  {cleaner.name}
                </option>
              ))}
            </select>
          </label>
          <Button type="submit" variant="outline" disabled={pending}>
            {pending ? "Adding..." : "Add"}
          </Button>
        </form>
      ) : null}
      {state.error ? (
        <p className="text-sm text-destructive" role="alert">
          {state.error}
        </p>
      ) : null}
    </div>
  );
}

export function AssignCleaningTaskForm({
  taskId,
  assigneeId,
  unavailable,
  agents,
}: {
  taskId: string;
  assigneeId: string | null;
  unavailable: boolean;
  agents: Array<{ id: string; name: string }>;
}) {
  const action = assignCleaningTaskAction.bind(null, taskId);
  const [state, formAction, pending] = useActionState(action, initialState);

  return (
    <form action={formAction} className="mt-4 flex flex-wrap items-end gap-2">
      <label className="min-w-48 flex-1 space-y-1 text-sm">
        <span className="font-medium">{unavailable ? "Reassign" : assigneeId ? "Change cleaner" : "Assign cleaner"}</span>
        <select
          name="assignee"
          required
          defaultValue={unavailable ? "" : assigneeId ?? "unassigned"}
          className="h-10 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm"
        >
          {unavailable ? <option value="" disabled>Select cleaner</option> : null}
          <option value="unassigned">Unassigned</option>
          {agents.map((agent) => (
            <option key={agent.id} value={agent.id}>
              {agent.name}
            </option>
          ))}
        </select>
      </label>
      <Button type="submit" disabled={pending}>
        {pending ? "Saving..." : unavailable ? "Reassign" : "Assign"}
      </Button>
      {state.error ? (
        <p className="w-full text-sm text-destructive" role="alert">
          {state.error}
        </p>
      ) : null}
    </form>
  );
}
