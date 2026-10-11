export type DeletionCounts = {
  organizations: number;
  onboarding: number;
  branding: number;
  members: number;
  properties: number;
  reservations: number;
  guests: number;
  guestPortalTokens: number;
  guestRuleAcceptances: number;
  propertyLanguages: number;
  propertyAmenities: number;
  propertyHouseRules: number;
  propertyContent: number;
  propertyKnowledge: number;
  propertyMedia: number;
  issues: number;
  events: number;
  cleaningAgents: number;
  cleaningAgentLinks: number;
  propertyCleaningAgents: number;
  cleaningTasks: number;
  cleaningTaskItems: number;
  subscriptions: number;
  subscriptionEvents: number;
  supportSessions: number;
  auditLogs: number;
  storageObjects: number;
};

export type DeletionAuthSummary = {
  eligible: number;
  shared: number;
  platformAdmins: number;
  review: number;
};

export type OrganizationDeletionPreview = {
  counts: DeletionCounts;
  auth: DeletionAuthSummary;
  preservedShared: string[];
};

export type DeletionCleanupState = {
  jobId: string;
  storageRemoved: boolean;
  databaseRemoved: boolean;
  authRemoved: boolean;
  detail: string;
};

export type DeletionActionState = {
  error?: string;
  incomplete?: DeletionCleanupState;
};
