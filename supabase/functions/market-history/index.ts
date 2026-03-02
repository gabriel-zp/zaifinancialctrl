import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.49.8";

type MarketPoint = {
  date: string;
  close: number;
};

type CachedPayload = {
  ok: true;
  source: "yahoo";
  symbol: string;
  currency: string;
  points: MarketPoint[];
};

type RequestPayload = {
  ticker?: string;
  range?: string;
  interval?: string;
};

const CACHE_TABLE = "market_history_cache";
const CACHE_TTL_MINUTES = 30;

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(status: number, body: Record<string, unknown>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      ...corsHeaders,
    },
  });
}

function normalizeTicker(rawTicker: string): string {
  return rawTicker.toUpperCase().trim();
}

function toYahooSymbol(ticker: string): string {
  return ticker.includes(".") ? ticker : `${ticker}.SA`;
}

function buildCacheKey(ticker: string, range: string, interval: string): string {
  return `${ticker}:${range}:${interval}:yahoo`;
}

function toIsoDate(timestamp: number): string {
  return new Date(timestamp * 1000).toISOString().slice(0, 10);
}

function parseYahooResponse(payload: unknown): MarketPoint[] {
  if (
    !payload ||
    typeof payload !== "object" ||
    !("chart" in payload) ||
    typeof payload.chart !== "object" ||
    !payload.chart ||
    !("result" in payload.chart) ||
    !Array.isArray(payload.chart.result) ||
    payload.chart.result.length === 0
  ) {
    return [];
  }

  const result = payload.chart.result[0] as {
    timestamp?: number[];
    indicators?: { quote?: Array<{ close?: Array<number | null> }> };
  };

  const timestamps = result.timestamp ?? [];
  const closes = result.indicators?.quote?.[0]?.close ?? [];

  const points: MarketPoint[] = [];
  const total = Math.min(timestamps.length, closes.length);

  for (let index = 0; index < total; index += 1) {
    const timestamp = timestamps[index];
    const close = closes[index];
    if (!timestamp || typeof close !== "number" || !Number.isFinite(close)) {
      continue;
    }
    points.push({ date: toIsoDate(timestamp), close });
  }

  return points;
}

function getSupabaseAdminClient() {
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) {
    return null;
  }

  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function readCache(cacheKey: string): Promise<{ payload: CachedPayload; fetchedAt: string } | null> {
  const admin = getSupabaseAdminClient();
  if (!admin) {
    return null;
  }

  const { data, error } = await admin
    .from(CACHE_TABLE)
    .select("payload, fetched_at, expires_at")
    .eq("cache_key", cacheKey)
    .maybeSingle();

  if (error || !data || !data.expires_at) {
    return null;
  }

  const expiresAt = new Date(data.expires_at as string).getTime();
  if (!Number.isFinite(expiresAt) || expiresAt <= Date.now()) {
    return null;
  }

  return {
    payload: data.payload as CachedPayload,
    fetchedAt: data.fetched_at as string,
  };
}

async function writeCache(cacheKey: string, ticker: string, symbol: string, range: string, interval: string, payload: CachedPayload) {
  const admin = getSupabaseAdminClient();
  if (!admin) {
    return;
  }

  const fetchedAt = new Date();
  const expiresAt = new Date(fetchedAt.getTime() + CACHE_TTL_MINUTES * 60 * 1000);

  await admin.from(CACHE_TABLE).upsert({
    cache_key: cacheKey,
    ticker,
    symbol,
    range_name: range,
    interval_name: interval,
    source: "yahoo",
    payload,
    fetched_at: fetchedAt.toISOString(),
    expires_at: expiresAt.toISOString(),
  });
}

async function fetchYahooHistory(symbol: string, range: string, interval: string): Promise<MarketPoint[]> {
  const url = new URL(`https://query1.finance.yahoo.com/v8/finance/chart/${symbol}`);
  url.searchParams.set("range", range);
  url.searchParams.set("interval", interval);
  url.searchParams.set("events", "history");
  url.searchParams.set("includeAdjustedClose", "true");

  const response = await fetch(url.toString(), {
    method: "GET",
    headers: {
      "User-Agent": "Mozilla/5.0",
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(`Yahoo request failed with status ${response.status}`);
  }

  const payload = await response.json();
  return parseYahooResponse(payload);
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return json(405, { ok: false, message: "Method not allowed" });
  }

  try {
    const body = (await req.json().catch(() => ({}))) as RequestPayload;
    const rawTicker = body.ticker?.trim();
    const range = body.range?.trim() || "2y";
    const interval = body.interval?.trim() || "1d";

    if (!rawTicker) {
      return json(400, { ok: false, message: "ticker is required" });
    }

    const ticker = normalizeTicker(rawTicker);
    const symbol = toYahooSymbol(ticker);
    const cacheKey = buildCacheKey(ticker, range, interval);

    const cached = await readCache(cacheKey);
    if (cached) {
      return json(200, {
        ...cached.payload,
        cached: true,
        cachedAt: cached.fetchedAt,
      });
    }

    const points = await fetchYahooHistory(symbol, range, interval);
    if (!points.length) {
      return json(404, { ok: false, message: "No market history found for ticker" });
    }

    const payload: CachedPayload = {
      ok: true,
      source: "yahoo",
      symbol,
      currency: "BRL",
      points,
    };

    await writeCache(cacheKey, ticker, symbol, range, interval, payload);

    return json(200, {
      ...payload,
      cached: false,
      cachedAt: null,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected market-history error";
    return json(500, { ok: false, message });
  }
});
