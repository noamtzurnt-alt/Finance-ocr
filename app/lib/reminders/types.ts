export type Recurrence = {
  freq: "daily" | "weekly" | "monthly" | "yearly";
  interval: number;
  /** Weekly: 0=Sunday … 6=Saturday. */
  weekdays?: number[];
  /** Monthly: "the nth <weekday>" (nth 1-4, or -1 = last). */
  monthWeek?: { nth: number; weekday: number };
  until?: string | null;
  count?: number | null;
  /** Occurrences completed so far (for `count`). */
  done?: number;
};

export type ReminderDto = {
  id: string;
  listId: string;
  sectionId: string | null;
  parentId: string | null;
  title: string;
  notes: string;
  url: string;
  dueDate: string | null;
  dueTime: string | null;
  earlyMinutes: number | null;
  recurrence: Recurrence | null;
  priority: number;
  flagged: boolean;
  tags: string[];
  completed: boolean;
  completedAt: string | null;
  position: number;
  createdAt: string;
};

export type ReminderListDto = {
  id: string;
  name: string;
  color: string;
  icon: string;
  kind: "standard" | "groceries";
  sortMode: SortMode;
  showCompleted: boolean;
  viewMode: "list" | "columns";
  position: number;
};

export type ReminderSectionDto = { id: string; listId: string; name: string; position: number };

export type SortMode = "manual" | "due" | "priority" | "created" | "title";

export type RemindersData = {
  lists: ReminderListDto[];
  sections: ReminderSectionDto[];
  reminders: ReminderDto[];
};

export const LIST_COLORS: Record<string, string> = {
  red: "#ff453a",
  orange: "#ff9f0a",
  yellow: "#ffd60a",
  green: "#30d158",
  mint: "#63e6e2",
  teal: "#40c8e0",
  blue: "#0a84ff",
  indigo: "#5e5ce6",
  purple: "#bf5af2",
  pink: "#ff375f",
  brown: "#ac8e68",
  gray: "#8e8e93",
};

export const PRIORITY_LABELS = ["ללא", "נמוכה", "בינונית", "גבוהה"] as const;

export const EARLY_OPTIONS: Array<{ minutes: number; label: string }> = [
  { minutes: 5, label: "5 דקות לפני" },
  { minutes: 15, label: "15 דקות לפני" },
  { minutes: 30, label: "30 דקות לפני" },
  { minutes: 60, label: "שעה לפני" },
  { minutes: 120, label: "שעתיים לפני" },
  { minutes: 1440, label: "יום לפני" },
  { minutes: 2880, label: "יומיים לפני" },
  { minutes: 10080, label: "שבוע לפני" },
];

export const SORT_LABELS: Record<SortMode, string> = {
  manual: "ידני",
  due: "תאריך יעד",
  priority: "עדיפות",
  created: "תאריך יצירה",
  title: "שם",
};
