"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Sidebar from "./Sidebar";
import TrialList from "./TrialList";
import TrialDetail from "./TrialDetail";
import type {
  CompoundDTO,
  IndicationDTO,
  RefreshLogDTO,
  Scope,
  TrialDetailDTO,
  TrialSummary,
} from "@/types";

async function jsonFetch<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  if (!res.ok) throw new Error(`${url} -> ${res.status}`);
  return res.json();
}

export default function Dashboard() {
  const [indications, setIndications] = useState<IndicationDTO[]>([]);
  const [compounds, setCompounds] = useState<CompoundDTO[]>([]);
  const [lastRefresh, setLastRefresh] = useState<RefreshLogDTO | null>(null);
  const [totalTrials, setTotalTrials] = useState(0);

  const [scope, setScope] = useState<Scope>({ type: "all" });
  const [search, setSearch] = useState("");
  const [trials, setTrials] = useState<TrialSummary[]>([]);
  const [trialsLoading, setTrialsLoading] = useState(true);

  const [selectedNctId, setSelectedNctId] = useState<string | null>(null);
  const [selectedTrial, setSelectedTrial] = useState<TrialDetailDTO | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const [refreshing, setRefreshing] = useState(false);
  const bootstrapped = useRef(false);

  const loadMeta = useCallback(async () => {
    const data = await jsonFetch<{
      indications: IndicationDTO[];
      compounds: CompoundDTO[];
      lastRefresh: RefreshLogDTO | null;
      totalTrials: number;
    }>("/api/meta");
    setIndications(data.indications);
    setCompounds(data.compounds);
    setLastRefresh(data.lastRefresh);
    setTotalTrials(data.totalTrials);
    return data;
  }, []);

  const loadTrials = useCallback(async (s: Scope, q: string) => {
    setTrialsLoading(true);
    try {
      const params = new URLSearchParams();
      if (s.type === "indication" || s.type === "compound") {
        params.set("scope", s.type);
        params.set("value", s.value);
      } else {
        params.set("scope", s.type);
      }
      if (q) params.set("q", q);
      const data = await jsonFetch<{ trials: TrialSummary[] }>(`/api/trials?${params.toString()}`);
      setTrials(data.trials);
    } finally {
      setTrialsLoading(false);
    }
  }, []);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await jsonFetch("/api/refresh", { method: "POST" });
    } catch {
      // surfaced via lastRefresh.status after reload below
    } finally {
      await loadMeta();
      await loadTrials(scope, search);
      setRefreshing(false);
    }
  }, [loadMeta, loadTrials, scope, search]);

  // Initial load; auto-bootstrap with a first refresh if the DB is empty.
  useEffect(() => {
    (async () => {
      const meta = await loadMeta();
      if (!bootstrapped.current && meta.totalTrials === 0) {
        bootstrapped.current = true;
        await handleRefresh();
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Reload center list whenever scope or search changes.
  useEffect(() => {
    loadTrials(scope, search);
  }, [scope, search, loadTrials]);

  // Debounce search typing.
  const [rawSearch, setRawSearch] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setSearch(rawSearch), 300);
    return () => clearTimeout(t);
  }, [rawSearch]);

  // Load detail on selection.
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

  const handleScopeChange = (s: Scope) => {
    setScope(s);
    setSelectedNctId(null);
  };

  const handleAddIndication = async (name: string) => {
    await jsonFetch("/api/indications", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    await loadMeta();
    await handleRefresh();
  };

  const handleRemoveIndication = async (name: string) => {
    await jsonFetch(`/api/indications?name=${encodeURIComponent(name)}`, { method: "DELETE" });
    if (scope.type === "indication" && scope.value === name) setScope({ type: "all" });
    await loadMeta();
  };

  const handleAddCompound = async (name: string, aliases: string[]) => {
    await jsonFetch("/api/compounds", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, aliases }),
    });
    await loadMeta();
    await handleRefresh();
  };

  const handleRemoveCompound = async (name: string) => {
    await jsonFetch(`/api/compounds?name=${encodeURIComponent(name)}`, { method: "DELETE" });
    if (scope.type === "compound" && scope.value === name) setScope({ type: "all" });
    await loadMeta();
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden">
      <Sidebar
        indications={indications}
        compounds={compounds}
        scope={scope}
        onScopeChange={handleScopeChange}
        onAddIndication={handleAddIndication}
        onRemoveIndication={handleRemoveIndication}
        onAddCompound={handleAddCompound}
        onRemoveCompound={handleRemoveCompound}
        onRefresh={handleRefresh}
        refreshing={refreshing}
        lastRefresh={lastRefresh}
        totalTrials={totalTrials}
      />
      <TrialList
        scope={scope}
        trials={trials}
        loading={trialsLoading}
        selectedNctId={selectedNctId}
        onSelect={setSelectedNctId}
        search={rawSearch}
        onSearchChange={setRawSearch}
      />
      <TrialDetail trial={selectedTrial} loading={detailLoading} />
    </div>
  );
}
