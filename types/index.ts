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

// "domain" separates the two independently-tracked entities the sidebar
// can show: clinical trials (matched against indications/compounds) and
// companies (SEC/FDA/press-release updates). Each domain has its own set
// of views; Dashboard renders TrialList/TrialDetail vs
// CompanyList/CompanyDetail depending on which is active.
export type TrialScope =
  | { domain: "trial"; type: "all" }
  | { domain: "trial"; type: "changed" }
  | { domain: "trial"; type: "today" }
  | { domain: "trial"; type: "week" }
  | { domain: "trial"; type: "indication"; value: string }
  | { domain: "trial"; type: "compound"; value: string };

export type CompanyScope =
  | { domain: "company"; type: "all" }
  | { domain: "company"; type: "today" }
  | { domain: "company"; type: "week" };

export type Scope = TrialScope | CompanyScope;

export interface CompanySummary {
  id: string;
  name: string;
  ticker: string | null;
  cik: string | null;
  isDefault: boolean;
  count: number;
}

// One row in the company center list — a single discovered SEC filing, FDA
// approval/label event, or press-release proxy.
export interface CompanyUpdateSummary {
  id: string;
  companyId: string;
  companyName: string;
  companyTicker: string | null;
  kind: "sec_filing" | "press_release" | "fda_approval" | "fda_label";
  title: string;
  summary: string | null;
  url: string | null;
  sourceDate: string;
  firstSeenAt: string;
}

export interface StockQuoteDTO {
  ticker: string;
  price: number | null;
  currency: string | null;
  fiftyTwoWeekAverage: number | null;
  fiftyTwoWeekHigh: number | null;
  fiftyTwoWeekLow: number | null;
  sparkline: number[];
  asOf: string;
}

export type CompanyUpdateDetailDTO = CompanyUpdateSummary;

export interface CompanyRefreshLogDTO {
  id: string;
  startedAt: string;
  finishedAt: string | null;
  status: string;
  companiesScanned: number;
  updatesFound: number;
  errorMessage: string | null;
}
