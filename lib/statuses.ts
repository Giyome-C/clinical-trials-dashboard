// Appendix 1 — the official CT.gov "overall status" values, their
// definitions, and a semantic color role for the badge. Colors are reserved
// (good/warning/critical/neutral) and always paired with the label text, per
// the dashboard's accessibility rules — never color alone.

export type StatusRole = "good" | "warning" | "critical" | "neutral";

export interface StatusMeta {
  code: string;
  label: string;
  description: string;
  role: StatusRole;
}

export const STATUS_META: Record<string, StatusMeta> = {
  NOT_YET_RECRUITING: {
    code: "NOT_YET_RECRUITING",
    label: "Not yet recruiting",
    description: "The study has not started recruiting participants.",
    role: "neutral",
  },
  RECRUITING: {
    code: "RECRUITING",
    label: "Recruiting",
    description: "The study is currently recruiting participants.",
    role: "good",
  },
  ENROLLING_BY_INVITATION: {
    code: "ENROLLING_BY_INVITATION",
    label: "Enrolling by invitation",
    description:
      "Participants are being selected from a pre-decided population and specifically invited to participate.",
    role: "good",
  },
  ACTIVE_NOT_RECRUITING: {
    code: "ACTIVE_NOT_RECRUITING",
    label: "Active, not recruiting",
    description:
      "The study is ongoing, and participants are receiving an intervention or being examined, but new participants are not currently being recruited.",
    role: "neutral",
  },
  SUSPENDED: {
    code: "SUSPENDED",
    label: "Suspended",
    description: "The study has stopped early but may start again.",
    role: "warning",
  },
  TERMINATED: {
    code: "TERMINATED",
    label: "Terminated",
    description: "The study has stopped early and will not start again.",
    role: "critical",
  },
  COMPLETED: {
    code: "COMPLETED",
    label: "Completed",
    description:
      "The study has ended normally; participants are no longer being examined or treated.",
    role: "good",
  },
  WITHDRAWN: {
    code: "WITHDRAWN",
    label: "Withdrawn",
    description: "The study stopped early, before enrolling its first participant.",
    role: "critical",
  },
  UNKNOWN: {
    code: "UNKNOWN",
    label: "Unknown",
    description:
      "Last known status was recruiting / not yet recruiting / active, not recruiting, but the study is past its completion date and hasn't been verified in the past 2 years.",
    role: "warning",
  },
};

export function getStatusMeta(code: string | null | undefined): StatusMeta {
  if (!code) return STATUS_META.UNKNOWN;
  return (
    STATUS_META[code] ?? {
      code,
      label: code,
      description: "",
      role: "neutral",
    }
  );
}

export const FIELD_LABELS: Record<string, string> = {
  overallStatus: "Status",
  studyType: "Study type",
  startDate: "Study start",
  primaryCompletionDate: "Primary completion",
  completionDate: "Study completion",
  enrollmentCount: "Enrollment (N=)",
  phases: "Phase",
};

// Change events store raw values (e.g. overallStatus as the CT.gov code
// "ACTIVE_NOT_RECRUITING"). This maps a stored old/new value to what should
// actually be shown to a person.
export function formatChangeValue(field: string, value: string | null): string {
  if (value == null) return "—";
  if (field === "overallStatus") return getStatusMeta(value).label;
  return value;
}
