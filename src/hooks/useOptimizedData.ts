/**
 * Optimized Data Hook for handling 100,000+ records
 * 
 * Features:
 * 1. Centralized data fetching with caching
 * 2. AbortController for cleanup on unmount
 * 3. Progress tracking for large datasets
 * 4. Automatic retry with exponential backoff
 * 5. Memory-efficient processing
 */

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import {
  fetchTotalCount,
  fetchMetricValuesMinimal,
  fetchMetricValuesFull,
  fetchMetricValuesWithTimestamp,
  calculateStats,
  FETCH_CONFIG,
} from '@/lib/dataFetcher';

interface UseOptimizedDataOptions {
  fetchFullData?: boolean;
  fetchWithTimestamp?: boolean;
  autoFetch?: boolean;
  onError?: (error: Error) => void;
}

interface MetricValueMinimal {
  value_id: string;
  status: string;
  submitted_by: string | null;
}

interface MetricValueFull {
  value_id: string;
  metric_id: string;
  site_id: string;
  period_id: string;
  value: number;
  status: string;
  data_source: string | null;
  remark: string | null;
  submitted_by: string | null;
  created_at: string;
  updated_at?: string;
}

interface DataStats {
  totalDbRecords: number;
  visibleRecords: number;
  draftCount: number;
  submittedCount: number;
  myDrafts: number;
  mySubmitted: number;
}

// Global cache for shared data across components
const dataCache = {
  lastFetch: 0,
  data: null as MetricValueMinimal[] | null,
  fullData: null as MetricValueFull[] | null,
  totalCount: 0,
  cacheTimeout: 30000, // 30 seconds cache
};

export function useOptimizedMetricValues(
  userId?: string,
  options: UseOptimizedDataOptions = {}
) {
  const {
    fetchFullData = false,
    fetchWithTimestamp = false,
    autoFetch = true,
    onError,
  } = options;

  const [data, setData] = useState<MetricValueMinimal[] | MetricValueFull[]>([]);
  const [loading, setLoading] = useState(true);
  const [progress, setProgress] = useState({ loaded: 0, total: null as number | null });
  const [error, setError] = useState<Error | null>(null);
  const [stats, setStats] = useState<DataStats>({
    totalDbRecords: 0,
    visibleRecords: 0,
    draftCount: 0,
    submittedCount: 0,
    myDrafts: 0,
    mySubmitted: 0,
  });
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  const abortControllerRef = useRef<AbortController | null>(null);
  const isMountedRef = useRef(true);

  const fetchData = useCallback(async (forceRefresh = false) => {
    // Check cache validity
    const now = Date.now();
    const cacheValid = !forceRefresh && 
      dataCache.lastFetch > 0 && 
      (now - dataCache.lastFetch) < dataCache.cacheTimeout;

    if (cacheValid && !fetchFullData && dataCache.data) {
      // Use cached data
      setData(dataCache.data);
      const calcStats = calculateStats(dataCache.data, userId);
      setStats({
        totalDbRecords: dataCache.totalCount,
        visibleRecords: dataCache.data.length,
        draftCount: calcStats.draft,
        submittedCount: calcStats.submitted,
        myDrafts: calcStats.myDrafts,
        mySubmitted: calcStats.mySubmitted,
      });
      setLoading(false);
      setLastRefresh(new Date(dataCache.lastFetch));
      return;
    }

    // Abort previous request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();

    setLoading(true);
    setError(null);
    setProgress({ loaded: 0, total: null });

    try {
      // Get total count first
      const totalCount = await fetchTotalCount();
      if (!isMountedRef.current) return;
      
      setProgress(prev => ({ ...prev, total: totalCount }));

      // Fetch data based on requirements
      let fetchedData: MetricValueMinimal[] | MetricValueFull[];
      
      if (fetchFullData) {
        fetchedData = await fetchMetricValuesFull({
          signal: abortControllerRef.current.signal,
          onProgress: (loaded) => {
            if (isMountedRef.current) {
              setProgress({ loaded, total: totalCount });
            }
          },
        });
        dataCache.fullData = fetchedData as MetricValueFull[];
      } else if (fetchWithTimestamp) {
        fetchedData = await fetchMetricValuesWithTimestamp({
          signal: abortControllerRef.current.signal,
          onProgress: (loaded) => {
            if (isMountedRef.current) {
              setProgress({ loaded, total: totalCount });
            }
          },
        });
      } else {
        fetchedData = await fetchMetricValuesMinimal({
          signal: abortControllerRef.current.signal,
          onProgress: (loaded) => {
            if (isMountedRef.current) {
              setProgress({ loaded, total: totalCount });
            }
          },
        });
        // Update cache
        dataCache.data = fetchedData as MetricValueMinimal[];
        dataCache.totalCount = totalCount;
        dataCache.lastFetch = now;
      }

      if (!isMountedRef.current) return;

      setData(fetchedData);
      
      // Calculate stats
      const calcStats = calculateStats(
        fetchedData.map(d => ({
          value_id: d.value_id,
          status: d.status,
          submitted_by: d.submitted_by,
        })),
        userId
      );
      
      setStats({
        totalDbRecords: totalCount,
        visibleRecords: fetchedData.length,
        draftCount: calcStats.draft,
        submittedCount: calcStats.submitted,
        myDrafts: calcStats.myDrafts,
        mySubmitted: calcStats.mySubmitted,
      });
      setLastRefresh(new Date());

      // Log performance info
      if (FETCH_CONFIG.DEBUG_MODE) {
        console.log(`[useOptimizedData] Loaded ${fetchedData.length}/${totalCount} records`);
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        // Request was aborted, ignore
        return;
      }
      
      if (isMountedRef.current) {
        const error = err instanceof Error ? err : new Error('Unknown error');
        setError(error);
        onError?.(error);
      }
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
      }
    }
  }, [fetchFullData, fetchWithTimestamp, userId, onError]);

  // Auto-fetch on mount
  useEffect(() => {
    isMountedRef.current = true;
    
    if (autoFetch) {
      fetchData();
    }

    return () => {
      isMountedRef.current = false;
      abortControllerRef.current?.abort();
    };
  }, [autoFetch, fetchData]);

  // Refresh function
  const refresh = useCallback(() => {
    return fetchData(true);
  }, [fetchData]);

  // Clear cache function
  const clearCache = useCallback(() => {
    dataCache.data = null;
    dataCache.fullData = null;
    dataCache.lastFetch = 0;
  }, []);

  return {
    data,
    loading,
    error,
    stats,
    progress,
    lastRefresh,
    refresh,
    clearCache,
  };
}

/**
 * Hook for master data (companies, sites, periods, etc.)
 * These are small datasets that can be loaded fully
 */
export function useMasterData() {
  const [companies, setCompanies] = useState<Array<{ company_id: string; company_name: string }>>([]);
  const [sites, setSites] = useState<Array<{ site_id: string; site_name: string; company_id: string; location: string | null }>>([]);
  const [periods, setPeriods] = useState<Array<{ period_id: string; year: number; month: number; month_name: string }>>([]);
  const [dimensions, setDimensions] = useState<Array<{ dimension_id: string; dimension_name: string }>>([]);
  const [themes, setThemes] = useState<Array<{ theme_id: string; theme_name: string; dimension_id: string }>>([]);
  const [metrics, setMetrics] = useState<Array<{ metric_id: string; metric_name: string; theme_id: string; unit: string | null }>>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchMasterData = async () => {
      try {
        const [
          { data: companiesData },
          { data: sitesData },
          { data: periodsData },
          { data: dimensionsData },
          { data: themesData },
          { data: metricsData },
        ] = await Promise.all([
          supabase.from('company').select('*').order('company_name'),
          supabase.from('site').select('*').order('site_name'),
          supabase.from('reporting_period').select('*').order('year', { ascending: false }).order('month', { ascending: false }),
          supabase.from('esg_dimension').select('*').order('dimension_name'),
          supabase.from('esg_theme').select('*').order('theme_name'),
          supabase.from('esg_metric').select('*').order('metric_name'),
        ]);

        setCompanies(companiesData || []);
        setSites(sitesData || []);
        setPeriods(periodsData || []);
        setDimensions(dimensionsData || []);
        setThemes(themesData || []);
        setMetrics(metricsData || []);
      } catch (error) {
        console.error('Error fetching master data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchMasterData();
  }, []);

  // Create lookup maps for O(1) access
  const lookupMaps = useMemo(() => ({
    companies: new Map(companies.map(c => [c.company_id, c])),
    sites: new Map(sites.map(s => [s.site_id, s])),
    periods: new Map(periods.map(p => [p.period_id, p])),
    dimensions: new Map(dimensions.map(d => [d.dimension_id, d])),
    themes: new Map(themes.map(t => [t.theme_id, t])),
    metrics: new Map(metrics.map(m => [m.metric_id, m])),
  }), [companies, sites, periods, dimensions, themes, metrics]);

  return {
    companies,
    sites,
    periods,
    dimensions,
    themes,
    metrics,
    loading,
    lookupMaps,
  };
}

/**
 * Invalidate cache when data changes
 */
export function invalidateMetricValueCache() {
  dataCache.data = null;
  dataCache.fullData = null;
  dataCache.lastFetch = 0;
}
