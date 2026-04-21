import { useState, useEffect } from "react";
import { Station, DbStation, dbToStation, fallbackStations } from "@/data/stations";
import { supabase } from "@/integrations/supabase/client";

let cachedStations: Station[] | null = null;

export function useStations() {
  const [stations, setStations] = useState<Station[]>(cachedStations || []);
  const [loading, setLoading] = useState(!cachedStations);

  useEffect(() => {
    if (cachedStations) return;
    let cancelled = false;

    async function load() {
      try {
        const { data, error } = await supabase
          .from("stations")
          .select("id, name, frequency, stream_url, logo_url, category, display_order, active")
          .eq("active", true)
          .order("display_order", { ascending: true });

        if (error || !data || data.length === 0) {
          if (!cancelled) {
            cachedStations = fallbackStations;
            setStations(fallbackStations);
          }
        } else {
          const loaded = (data as DbStation[]).map(dbToStation);
          if (!cancelled) {
            cachedStations = loaded;
            setStations(loaded);
          }
        }
      } catch {
        if (!cancelled) {
          cachedStations = fallbackStations;
          setStations(fallbackStations);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, []);

  return { stations, loading };
}

/** Invalidate cache so next useStations call re-fetches */
export function invalidateStationsCache() {
  cachedStations = null;
}
