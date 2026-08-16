export interface TrialSummary {
  nctId: string;
  briefTitle: string;
  overallStatus: string;
  studyType: string | null;
  phases: string[];
  enrollmentCount: number | null;
  sponsorName: string | null;
  matchedIndications: string[];
  matchedCompounds: string[];
  lastUpdatePosted: string | null;
  firstSeenAt: string;
  lastChangedAt: string | null;
  isNewSinceLastRefresh: boolean;
  changedInLastRefresh: boolean;
  changeSummary: string | null;
}

export interface ChangeEventDTO {
  id: string;
  field: string;
  oldValue: string | null;
  newValue: string | null;
  detectedAt: string;
}

export interface InterventionDTO {
  type: string | null;
  name: string;
  otherNames: string[];
}

export interface TrialDetailDTO extends TrialSummary {
  officialTitle: string | null;
  interventions: InterventionDTO[] | null;
  locationsSummary: string | null;
  briefSummary: string | null;
  conditions: string[];
  startDate: string | null;
  primaryCompletionDate: string | null;
  completionDate: string | null;
  enrollmentType: string | null;
  changes: ChangeEventDTO[];
}

export interface IndicationDTO {
  id: string;
  name: string;
  searchTerm: string;
  isDefault: boolean;
  count: number;
  newCount: number;
}

export interface CompoundDTO {
  id: string;
  name: string;
  aliases: string[];
  isDefault: boolean;
  count: number;
  newCount: number;
}

export interface RefreshLogDTO {
  id: string;
  startedAt: string;
  finishedAt: string | null;
  status: string;
  trialsScanned: number;
  changesFound: number;
  newTrials: number;
  errorMessage: string | null;
}

export type Scope =
  | { type: "all" }
  | { type: "new" }
  | { type: "changed" }
  | { type: "indication"; value: string }
  | { type: "compound"; value: string };
