// Thin client for the public ClinicalTrials.gov v2 API
// (https://clinicaltrials.gov/data-api/api). No API key required.

export const CTGOV_API_BASE = "https://clinicaltrials.gov/api/v2/studies";
export const CTGOV_STUDY_URL = (nctId: string) => `https://clinicaltrials.gov/study/${nctId}`;

export interface RawStudy {
  protocolSection?: {
    identificationModule?: {
      nctId?: string;
      briefTitle?: string;
      officialTitle?: string;
    };
    statusModule?: {
      overallStatus?: string;
      startDateStruct?: { date?: string; type?: string };
      primaryCompletionDateStruct?: { date?: string; type?: string };
      completionDateStruct?: { date?: string; type?: string };
      lastUpdatePostDateStruct?: { date?: string; type?: string };
      studyFirstPostDateStruct?: { date?: string; type?: string };
    };
    designModule?: {
      studyType?: string;
      phases?: string[];
      enrollmentInfo?: { count?: number; type?: string };
    };
    conditionsModule?: { conditions?: string[] };
    armsInterventionsModule?: {
      interventions?: {
        type?: string;
        name?: string;
        description?: string;
        otherNames?: string[];
      }[];
    };
    sponsorCollaboratorsModule?: {
      leadSponsor?: { name?: string; class?: string };
    };
    contactsLocationsModule?: {
      locations?: { city?: string; state?: string; country?: string }[];
    };
    descriptionModule?: { briefSummary?: string };
  };
  hasResults?: boolean;
}

interface StudiesResponse {
  studies?: RawStudy[];
  nextPageToken?: string;
}

async function fetchPage(
  baseParams: Record<string, string>,
  pageToken?: string
): Promise<StudiesResponse> {
  const url = new URL(CTGOV_API_BASE);
  Object.entries(baseParams).forEach(([k, v]) => url.searchParams.set(k, v));
  url.searchParams.set("pageSize", "100");
  url.searchParams.set("format", "json");
  if (pageToken) url.searchParams.set("pageToken", pageToken);

  const res = await fetch(url.toString(), {
    headers: { Accept: "application/json" },
    cache: "no-store",
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(
      `ClinicalTrials.gov API returned ${res.status} for ${url.toString()}: ${text.slice(0, 300)}`
    );
  }
  return res.json();
}

// Pulls every page of results for a given query. maxPages is a safety cap
// (100 results/page) so a runaway query can't stall the refresh job.
export async function fetchAllStudies(
  baseParams: Record<string, string>,
  maxPages = 30
): Promise<RawStudy[]> {
  const all: RawStudy[] = [];
  let pageToken: string | undefined;
  let pages = 0;
  do {
    const page = await fetchPage(baseParams, pageToken);
    all.push(...(page.studies ?? []));
    pageToken = page.nextPageToken;
    pages += 1;
  } while (pageToken && pages < maxPages);
  return all;
}

export function fetchStudiesByCondition(condition: string): Promise<RawStudy[]> {
  return fetchAllStudies({ "query.cond": condition });
}

export function fetchStudiesByIntervention(term: string): Promise<RawStudy[]> {
  return fetchAllStudies({ "query.intr": term });
}

export interface ParsedIntervention {
  type: string | null;
  name: string;
  otherNames: string[];
}

export interface ParsedTrial {
  nctId: string;
  briefTitle: string;
  officialTitle: string | null;
  overallStatus: string;
  studyType: string | null;
  phases: string[];
  enrollmentCount: number | null;
  enrollmentType: string | null;
  startDate: string | null;
  primaryCompletionDate: string | null;
  completionDate: string | null;
  lastUpdatePosted: string | null;
  sponsorName: string | null;
  conditions: string[];
  interventions: ParsedIntervention[];
  locationsSummary: string | null;
  briefSummary: string | null;
  url: string;
}

// Normalizes a raw CT.gov study record into the flat shape the rest of the
// app works with. Every access is optional-chained: CT.gov study records
// vary a lot in which modules are present (e.g. observational studies lack
// armsInterventionsModule), so this must never throw on a "sparse" record.
export function parseStudy(raw: RawStudy): ParsedTrial | null {
  const ps = raw.protocolSection;
  const nctId = ps?.identificationModule?.nctId;
  if (!nctId) return null;

  const id = ps?.identificationModule;
  const status = ps?.statusModule;
  const design = ps?.designModule;
  const conditions = ps?.conditionsModule;
  const arms = ps?.armsInterventionsModule;
  const sponsor = ps?.sponsorCollaboratorsModule;
  const locations = ps?.contactsLocationsModule;
  const description = ps?.descriptionModule;

  const countries = Array.from(
    new Set(
      (locations?.locations ?? [])
        .map((l) => l.country)
        .filter((c): c is string => Boolean(c))
    )
  );
  const siteCount = locations?.locations?.length ?? 0;
  const locationsSummary =
    countries.length > 0
      ? `${countries.slice(0, 4).join(", ")}${
          countries.length > 4 ? ` +${countries.length - 4} more` : ""
        }${siteCount ? ` · ${siteCount} site${siteCount === 1 ? "" : "s"}` : ""}`
      : siteCount
        ? `${siteCount} site${siteCount === 1 ? "" : "s"}`
        : null;

  return {
    nctId,
    briefTitle: id?.briefTitle ?? nctId,
    officialTitle: id?.officialTitle ?? null,
    overallStatus: status?.overallStatus ?? "UNKNOWN",
    studyType: design?.studyType ?? null,
    phases: (design?.phases ?? []).filter((p) => p && p !== "NA"),
    enrollmentCount: design?.enrollmentInfo?.count ?? null,
    enrollmentType: design?.enrollmentInfo?.type ?? null,
    startDate: status?.startDateStruct?.date ?? null,
    primaryCompletionDate: status?.primaryCompletionDateStruct?.date ?? null,
    completionDate: status?.completionDateStruct?.date ?? null,
    lastUpdatePosted: status?.lastUpdatePostDateStruct?.date ?? null,
    sponsorName: sponsor?.leadSponsor?.name ?? null,
    conditions: conditions?.conditions ?? [],
    interventions: (arms?.interventions ?? []).map((iv) => ({
      type: iv.type ?? null,
      name: iv.name ?? "",
      otherNames: iv.otherNames ?? [],
    })),
    locationsSummary,
    briefSummary: description?.briefSummary ?? null,
    url: CTGOV_STUDY_URL(nctId),
  };
}
