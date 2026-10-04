export const CLEANING_CHECKLIST = [
  { key: "beds_linens", category: "bedrooms", label: "Beds made / linens changed", sortOrder: 10, required: true },
  { key: "bedroom_surfaces", category: "bedrooms", label: "Surfaces cleaned", sortOrder: 20, required: true },
  { key: "bedroom_floors", category: "bedrooms", label: "Floors cleaned", sortOrder: 30, required: true },
  { key: "toilet", category: "bathrooms", label: "Toilet cleaned", sortOrder: 40, required: true },
  { key: "shower", category: "bathrooms", label: "Shower / bath cleaned", sortOrder: 50, required: true },
  { key: "sink_mirror", category: "bathrooms", label: "Sink / mirror cleaned", sortOrder: 60, required: true },
  { key: "towels", category: "bathrooms", label: "Towels replaced", sortOrder: 70, required: true },
  { key: "counters", category: "kitchen", label: "Counters cleaned", sortOrder: 80, required: true },
  { key: "kitchen_sink", category: "kitchen", label: "Sink cleaned", sortOrder: 90, required: true },
  { key: "appliances", category: "kitchen", label: "Appliances checked", sortOrder: 100, required: true },
  { key: "kitchen_reset", category: "kitchen", label: "Kitchen items reset", sortOrder: 110, required: true },
  { key: "living_surfaces", category: "living", label: "Surfaces cleaned", sortOrder: 120, required: true },
  { key: "living_floors", category: "living", label: "Floors cleaned", sortOrder: 130, required: true },
  { key: "furniture_reset", category: "living", label: "Furniture reset", sortOrder: 140, required: true },
  { key: "trash", category: "general", label: "Trash removed", sortOrder: 150, required: true },
  { key: "supplies", category: "general", label: "Supplies/restocking checked", sortOrder: 160, required: true },
  { key: "final_inspection", category: "general", label: "Final property inspection", sortOrder: 170, required: true },
] as const;

export const CLEANING_CHECKLIST_CATEGORIES = [
  { key: "bedrooms", label: "Bedrooms" },
  { key: "bathrooms", label: "Bathrooms" },
  { key: "kitchen", label: "Kitchen" },
  { key: "living", label: "Living areas" },
  { key: "general", label: "General" },
] as const;

export const PROPERTY_READINESS_LABELS = {
  ready: "Ready",
  cleaning_required: "Cleaning required",
  cleaning_in_progress: "Cleaning in progress",
} as const;

export const CLEANING_TRIGGER_LABELS = {
  guest_checkout: "Guest checkout",
  manual: "Manual",
} as const;

export const CLEANING_TASK_STATUS_LABELS = {
  queued: "Waiting for cleaner",
  in_progress: "Cleaning in progress",
  completed: "Cleaning complete",
  cancelled: "Cancelled",
} as const;

export type PropertyReadiness = keyof typeof PROPERTY_READINESS_LABELS;
export type CleaningTaskStatus = keyof typeof CLEANING_TASK_STATUS_LABELS;
