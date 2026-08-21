"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Sidebar from "./Sidebar";
import TrialList from "./TrialList";
import TrialDetail from "./TrialDetail";
import CompanyList from "./CompanyList";
import CompanyDetail from "./CompanyDetail";
import type {
  CompanyRefreshLogDTO,
  CompanyScope,
  CompanySummary,
  CompanyUpdateDetailDTO,
  CompanyUpdateSummary,
  CompoundDTO,
  IndicationDTO,
  RefreshLogDTO,
  Scope,
  StockQuoteDTO,
  TrialDetailDTO,
  TrialScope,
  TrialSummary,
} from "@/types";
import { COMPANY_UPDATE_KINDS } from "@/types";

async function jsonFetch<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  if (!res.ok) throw new Error(`${url} -> ${res.status}`);
  return res.json();
}

// Midnight, local time, today — the start of the "New Today" window.
function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

// Midnight, local time, 6 days ago — a rolling 7-calendar-day window
// ("New this Week") that always includes today plus the preceding 6 days.
function startOfRollingWeek(): Date {
  const d = startOfToday();
  d.setDate(d.getDate() - 6);
  return d;
}

// Raw shape the API returns for a company update (company is a nested
// object); flattened below into CompanyUpdateSummary/DetailDTO's
// companyName/companyTicker fields for the components to consume directly.
interface RawCompanyUpdate {
  id: string;
  kind: CompanyUpdateSummary["kind"];
  title: string;
  summary: string | null;
  url: string | null;
  sourceDate: string;
  firstSeenAt: string;
  company: { id: string; name: string; ticker: string | null };
}

function flattenUpdate(u: RawCompanyUpdate): CompanyUpdateSummary {
  return {
    id: u.id,
    companyId: u.company.id,
    companyName: u.company.name,
    companyTicker: u.company.ticker,
    kind: u.kind,
    title: u.title,
    summary: u.summary,
    url: u.url,
    sourceDate: u.sourceDate,
    firstSeenAt: u.firstSeenAt,
  };
}

export default function Dashboard() {
  const [indications, setIndications] = useState<IndicationDTO[]>([]);
  const [compounds, setCompounds] = useState<CompoundDTO[]>([]);
  const [lastRefresh, setLastRefresh] = useState<RefreshLogDTO | null>(null);
  const [totalTrials, setTotalTrials] = useState(0);
  const [newTodayTrialsCount, setNewTodayTrialsCount] = useState(0);
  const [newWeekTrialsCount, setNewWeekTrialsCount] = useState(0);

  const [scope, setScope] = useState<Scope>({ domain: "trial", type: "all" });
  const [search, setSearch] = useState("");
  const [trials, setTrials] = useState<TrialSummary[]>([]);
  const [trialsLoading, setTrialsLoading] = useState(true);
  const [selectedIndicationNames, setSelectedIndicationNames] = useState<string[]>([]);
  const [selectedCompoundNames, setSelectedCompoundNames] = useState<string[]>([]);
  const indicationsInitialized = useRef(false);
  const compoundsInitialized = useRef(false);
  // Guards the trial-reload effect until the first /api/meta response has
  // populated the indication/compound selections — without this, the effect
  // would fire once with empty selections (before loadMeta resolves), which
  // the trials API reads as "exclude everything tagged in that dimension".
  const [trialFiltersReady, setTrialFiltersReady] = useState(false);

  const [selectedNctId, setSelectedNctId] = useState<string | null>(null);
  const [selectedTrial, setSelectedTrial] = useState<TrialDetailDTO | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const [refreshing, setRefreshing] = useState(false);
  const bootstrapped = useRef(false);

  // --- Tracked Companies state -------------------------------------------
  const [companies, setCompanies] = useState<CompanySummary[]>([]);
  const [selectedCompanyNames, setSelectedCompanyNames] = useState<string[]>([]);
  const [selectedKinds, setSelectedKinds] = useState<CompanyUpdateSummary["kind"][]>(COMPANY_UPDATE_KINDS);
  const companiesInitialized = useRef(false);
  const [lastCompanyRefresh, setLastCompanyRefresh] = useState<CompanyRefreshLogDTO | null>(null);
  const [totalUpdates, setTotalUpdates] = useState(0);
  const [newTodayUpdatesCount, setNewTodayUpdatesCount] = useState(0);
  const [newWeekUpdatesCount, setNewWeekUpdatesCount] = useState(0);
  const [refreshingCompanies, setRefreshingCompanies] = useState(false);
  const companyBootstrapped = useRef(false);

  const [companyUpdates, setCompanyUpdates] = useState<CompanyUpdateSummary[]>([]);
  const [companyUpdatesLoading, setCompanyUpdatesLoading] = useState(false);
  const [selectedUpdateId, setSelectedUpdateId] = useState<string | null>(null);
  const [selectedUpdate, setSelectedUpdate] = useState<CompanyUpdateDetailDTO | null>(null);
  const [selectedQuote, setSelectedQuote] = useState<StockQuoteDTO | null>(null);
  const [companyDetailLoading, setCompanyDetailLoading] = useState(false);

  const loadMeta = useCallback(async () => {
    // Same local-midnight boundaries loadTrials sends for scope=today|week,
    // so the sidebar's counts always match what that nav row would show.
    const params = new URLSearchParams();
    params.set("todaySince", startOfToday().toISOString());
    params.set("weekSince", startOfRollingWeek().toISOString());
    const data = await jsonFetch<{
      indications: IndicationDTO[];
      compounds: CompoundDTO[];
      lastRefresh: RefreshLogDTO | null;
      totalTrials: number;
      newTodayCount: number;
      newWeekCount: number;
    }>(`/api/meta?${params.toString()}`);
    setIndications(data.indications);
    setCompounds(data.compounds);
    setLastRefresh(data.lastRefresh);
    setTotalTrials(data.totalTrials);
    setNewTodayTrialsCount(data.newTodayCount);
    setNewWeekTrialsCount(data.newWeekCount);
    // Default to "everything selected" the first time each roster loads, so
    // the trial views show everything out of the box; later reloads (after
    // add/remove) must not stomp on the user's own filter.
    if (!indicationsInitialized.current) {
      indicationsInitialized.current = true;
      setSelectedIndicationNames(data.indications.map((i) => i.name));
    }
    if (!compoundsInitialized.current) {
      compoundsInitialized.current = true;
      setSelectedCompoundNames(data.compounds.map((c) => c.name));
    }
    setTrialFiltersReady(true);
    return data;
  }, []);

  const loadTrials = useCallback(
    async (s: TrialScope, indicationNames: string[], compoundNames: string[], q: string) => {
      setTrialsLoading(true);
      try {
        const params = new URLSearchParams();
        params.set("scope", s.type);
        params.set("indications", indicationNames.join(","));
        params.set("compounds", compoundNames.join(","));
        if (s.type === "today") params.set("since", startOfToday().toISOString());
        else if (s.type === "week") params.set("since", startOfRollingWeek().toISOString());
        if (q) params.set("q", q);
        const data = await jsonFetch<{ trials: TrialSummary[] }>(`/api/trials?${params.toString()}`);
        setTrials(data.trials);
      } finally {
        setTrialsLoading(false);
      }
    },
    []
  );

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await jsonFetch("/api/refresh", { method: "POST" });
    } catch {
      // surfaced via lastRefresh.status after reload below
    } finally {
      await loadMeta();
      if (scope.domain === "trial") await loadTrials(scope, selectedIndicationNames, selectedCompoundNames, search);
      setRefreshing(false);
    }
  }, [loadMeta, loadTrials, scope, selectedIndicationNames, selectedCompoundNames, search]);

  // --- Tracked Companies data loading -------------------------------------

  const loadCompaniesMeta = useCallback(async () => {
    // Same local-midnight boundaries loadCompanyUpdates sends for
    // scope=today|week, so these counts always match what that nav row
    // would show.
    const params = new URLSearchParams();
    params.set("todaySince", startOfToday().toISOString());
    params.set("weekSince", startOfRollingWeek().toISOString());
    const data = await jsonFetch<{
      companies: (CompanySummary & { fdaSponsorNames: string[]; createdAt: string })[];
      lastRefresh: CompanyRefreshLogDTO | null;
      totalUpdates: number;
      newTodayCount: number;
      newWeekCount: number;
    }>(`/api/companies?${params.toString()}`);
    setCompanies(data.companies);
    setLastCompanyRefresh(data.lastRefresh);
    setTotalUpdates(data.totalUpdates);
    setNewTodayUpdatesCount(data.newTodayCount);
    setNewWeekUpdatesCount(data.newWeekCount);
    // Default to "everything selected" the first time the roster loads, so
    // the three company views show all companies out of the box; later
    // reloads (after add/remove) must not stomp on the user's own filter.
    if (!companiesInitialized.current) {
      companiesInitialized.current = true;
      setSelectedCompanyNames(data.companies.map((c) => c.name));
    }
    return data;
  }, []);

  const loadCompanyUpdates = useCallback(
    async (s: CompanyScope, companyNames: string[], kinds: CompanyUpdateSummary["kind"][], q: string) => {
      setCompanyUpdatesLoading(true);
      try {
        const params = new URLSearchParams();
        params.set("scope", s.type);
        if (companyNames.length > 0) params.set("companies", companyNames.join(","));
        if (kinds.length < COMPANY_UPDATE_KINDS.length) params.set("kinds", kinds.join(","));
        if (s.type === "today") params.set("since", startOfToday().toISOString());
        else if (s.type === "week") params.set("since", startOfRollingWeek().toISOString());
        if (q) params.set("q", q);
        const data = await jsonFetch<{ updates: RawCompanyUpdate[] }>(`/api/company-updates?${params.toString()}`);
        setCompanyUpdates(data.updates.map(flattenUpdate));
      } finally {
        setCompanyUpdatesLoading(false);
      }
    },
    []
  );

  const handleRefreshCompanies = useCallback(async () => {
    setRefreshingCompanies(true);
    try {
      await jsonFetch("/api/companies/refresh", { method: "POST" });
    } catch {
      // surfaced via lastCompanyRefresh.status after reload below
    } finally {
      await loadCompaniesMeta();
      if (scope.domain === "company") await loadCompanyUpdates(scope, selectedCompanyNames, selectedKinds, search);
      setRefreshingCompanies(false);
    }
  }, [loadCompaniesMeta, loadCompanyUpdates, scope, selectedCompanyNames, selectedKinds, search]);

  // Single "Refresh now" button in the sidebar drives both refreshes at
  // once — trials and tracked-company updates are independent backend jobs
  // (separate API routes, separate refresh logs), so they run concurrently
  // rather than one waiting on the other.
  const handleRefreshAll = useCallback(async () => {
    await Promise.all([handleRefresh(), handleRefreshCompanies()]);
  }, [handleRefresh, handleRefreshCompanies]);

  // Initial load: show whatever's already in the DB immediately (fast), then
  // always kick off a real refresh in the background — every page load/
  // reload pulls fresh data, not just the first time the DB is empty. The
  // bootstrapped ref only guards against React StrictMode's double-invoke
  // of effects in dev; it's not a "was there data already" check anymore.
  useEffect(() => {
    (async () => {
      await loadMeta();
      if (!bootstrapped.current) {
        bootstrapped.current = true;
        await handleRefresh();
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    (async () => {
      await loadCompaniesMeta();
      if (!companyBootstrapped.current) {
        companyBootstrapped.current = true;
        await handleRefreshCompanies();
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Reload the trial list whenever its scope, search, indication filter, or
  // compound filter changes. Gated on trialFiltersReady so this doesn't fire
  // with empty (not-yet-loaded) selections — see the flag's declaration.
  useEffect(() => {
    if (scope.domain !== "trial" || !trialFiltersReady) return;
    loadTrials(scope, selectedIndicationNames, selectedCompoundNames, search);
  }, [scope, search, selectedIndicationNames, selectedCompoundNames, trialFiltersReady, loadTrials]);

  // Reload the company list whenever its scope, search, company filter, or
  // update-type filter changes. An explicit "zero companies selected" (or
  // "zero types selected") is treated as "show nothing" rather than "no
  // filter" — the API's unfiltered default is only meant for before the
  // roster has loaded.
  useEffect(() => {
    if (scope.domain !== "company") return;
    if ((companies.length > 0 && selectedCompanyNames.length === 0) || selectedKinds.length === 0) {
      setCompanyUpdates([]);
      return;
    }
    loadCompanyUpdates(scope, selectedCompanyNames, selectedKinds, search);
  }, [scope, search, selectedCompanyNames, selectedKinds, companies.length, loadCompanyUpdates]);

  // Debounce search typing.
  const [rawSearch, setRawSearch] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setSearch(rawSearch), 300);
    return () => clearTimeout(t);
  }, [rawSearch]);

  // Load trial detail on selection.
  useEffect(() => {
    if (!selectedNctId) {
      setSelectedTrial(null);
      return;
    }
    setDetailLoading(true);
    jsonFetch<{ trial: TrialDetailDTO }>(`/api/trials/${selectedNctId}`)
      .then((d) => setSelectedTrial(d.trial))
      .finally(() => setDetailLoading(false));
  }, [selectedNctId]);

  // Load company-update detail (+ live stock quote) on selection.
  useEffect(() => {
    if (!selectedUpdateId) {
      setSelectedUpdate(null);
      setSelectedQuote(null);
      return;
    }
    setCompanyDetailLoading(true);
    jsonFetch<{ update: RawCompanyUpdate; quote: StockQuoteDTO | null }>(`/api/company-updates/${selectedUpdateId}`)
      .then((d) => {
        setSelectedUpdate(flattenUpdate(d.update));
        setSelectedQuote(d.quote);
      })
      .finally(() => setCompanyDetailLoading(false));
  }, [selectedUpdateId]);

  const handleScopeChange = (s: Scope) => {
    setScope(s);
    setSelectedNctId(null);
    setSelectedUpdateId(null);
  };

  const handleAddIndication = async (name: string) => {
    await jsonFetch("/api/indications", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    setSelectedIndicationNames((prev) => (prev.includes(name) ? prev : [...prev, name]));
    await loadMeta();
    await handleRefresh();
  };

  const handleRemoveIndication = async (name: string) => {
    await jsonFetch(`/api/indications?name=${encodeURIComponent(name)}`, { method: "DELETE" });
    setSelectedIndicationNames((prev) => prev.filter((n) => n !== name));
    await loadMeta();
  };

  const handleAddCompound = async (name: string, aliases: string[]) => {
    await jsonFetch("/api/compounds", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, aliases }),
    });
    setSelectedCompoundNames((prev) => (prev.includes(name) ? prev : [...prev, name]));
    await loadMeta();
    await handleRefresh();
  };

  const handleRemoveCompound = async (name: string) => {
    await jsonFetch(`/api/compounds?name=${encodeURIComponent(name)}`, { method: "DELETE" });
    setSelectedCompoundNames((prev) => prev.filter((n) => n !== name));
    await loadMeta();
  };

  // --- Tracked Trials filter handlers -------------------------------------

  const handleToggleIndication = (name: string) => {
    setSelectedIndicationNames((prev) => (prev.includes(name) ? prev.filter((n) => n !== name) : [...prev, name]));
  };
  const handleSelectAllIndications = () => setSelectedIndicationNames(indications.map((i) => i.name));
  const handleClearIndications = () => setSelectedIndicationNames([]);

  const handleToggleCompound = (name: string) => {
    setSelectedCompoundNames((prev) => (prev.includes(name) ? prev.filter((n) => n !== name) : [...prev, name]));
  };
  const handleSelectAllCompounds = () => setSelectedCompoundNames(compounds.map((c) => c.name));
  const handleClearCompounds = () => setSelectedCompoundNames([]);

  // --- Tracked Companies handlers -----------------------------------------

  const handleToggleCompany = (name: string) => {
    setSelectedCompanyNames((prev) => (prev.includes(name) ? prev.filter((n) => n !== name) : [...prev, name]));
  };

  const handleSelectAllCompanies = () => setSelectedCompanyNames(companies.map((c) => c.name));
  const handleClearCompanies = () => setSelectedCompanyNames([]);

  const handleToggleKind = (kind: CompanyUpdateSummary["kind"]) => {
    setSelectedKinds((prev) => (prev.includes(kind) ? prev.filter((k) => k !== kind) : [...prev, kind]));
  };
  const handleSelectAllKinds = () => setSelectedKinds(COMPANY_UPDATE_KINDS);
  const handleClearKinds = () => setSelectedKinds([]);

  const handleAddCompany = async (name: string, ticker: string | null) => {
    await jsonFetch("/api/companies", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, ticker }),
    });
    setSelectedCompanyNames((prev) => (prev.includes(name) ? prev : [...prev, name]));
    await loadCompaniesMeta();
    await handleRefreshCompanies();
  };

  const handleRemoveCompany = async (name: string) => {
    await jsonFetch(`/api/companies?name=${encodeURIComponent(name)}`, { method: "DELETE" });
    setSelectedCompanyNames((prev) => prev.filter((n) => n !== name));
    await loadCompaniesMeta();
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden">
      <Sidebar
        companies={companies}
        scope={scope}
        onScopeChange={handleScopeChange}
        onRefresh={handleRefreshAll}
        refreshing={refreshing || refreshingCompanies}
        lastRefresh={lastRefresh}
        totalTrials={totalTrials}
        newTodayTrialsCount={newTodayTrialsCount}
        newWeekTrialsCount={newWeekTrialsCount}
        selectedCompanyNames={selectedCompanyNames}
        lastCompanyRefresh={lastCompanyRefresh}
        totalUpdates={totalUpdates}
        newTodayUpdatesCount={newTodayUpdatesCount}
        newWeekUpdatesCount={newWeekUpdatesCount}
      />
      {scope.domain === "trial" ? (
        <>
          <TrialList
            scope={scope}
            trials={trials}
            loading={trialsLoading}
            selectedNctId={selectedNctId}
            onSelect={setSelectedNctId}
            search={rawSearch}
            onSearchChange={setRawSearch}
            indications={indications}
            selectedIndicationNames={selectedIndicationNames}
            onToggleIndication={handleToggleIndication}
            onSelectAllIndications={handleSelectAllIndications}
            onClearIndications={handleClearIndications}
            onAddIndication={handleAddIndication}
            onRemoveIndication={handleRemoveIndication}
            compounds={compounds}
            selectedCompoundNames={selectedCompoundNames}
            onToggleCompound={handleToggleCompound}
            onSelectAllCompounds={handleSelectAllCompounds}
            onClearCompounds={handleClearCompounds}
            onAddCompound={handleAddCompound}
            onRemoveCompound={handleRemoveCompound}
          />
          <TrialDetail trial={selectedTrial} loading={detailLoading} />
        </>
      ) : (
        <>
          <CompanyList
            scope={scope}
            updates={companyUpdates}
            loading={companyUpdatesLoading}
            selectedId={selectedUpdateId}
            onSelect={setSelectedUpdateId}
            search={rawSearch}
            onSearchChange={setRawSearch}
            companies={companies}
            selectedCompanyNames={selectedCompanyNames}
            onToggleCompany={handleToggleCompany}
            onSelectAllCompanies={handleSelectAllCompanies}
            onClearCompanies={handleClearCompanies}
            onAddCompany={handleAddCompany}
            onRemoveCompany={handleRemoveCompany}
            selectedKinds={selectedKinds}
            onToggleKind={handleToggleKind}
            onSelectAllKinds={handleSelectAllKinds}
            onClearKinds={handleClearKinds}
          />
          <CompanyDetail update={selectedUpdate} quote={selectedQuote} loading={companyDetailLoading} />
        </>
      )}
    </div>
  );
}
