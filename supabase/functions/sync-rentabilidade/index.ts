import "jsr:@supabase/functions-js/edge-runtime.d.ts";

type Cell = string | number | null;

type TreatedRow = {
  mes: string;
  acao: string;
  periodo: string | null;
  valor_base: number | null;
  investimento: number | null;
  resgate: number | null;
  recebimento_proventos: number | null;
  valor_final_mes: number | null;
  rentabilidade_mes: number | null;
  nao_mexer: number | null;
  ativo_pl: number | null;
};

type SyncRun = { id: string };

const GOOGLE_SHEETS_SPREADSHEET_ID = Deno.env.get("GOOGLE_SHEETS_SPREADSHEET_ID") ?? "";
const GOOGLE_SERVICE_ACCOUNT_EMAIL = Deno.env.get("GOOGLE_SERVICE_ACCOUNT_EMAIL") ?? "";
const GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY = (Deno.env.get("GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY") ?? "").replace(/\\n/g, "\n");
const SHEETS_RANGE_A1 = Deno.env.get("SHEETS_RANGE_A1") ?? "Planilha de Rentabilidade!A1:AL250";
const SHEETS_TAB_NAME = Deno.env.get("SHEETS_TAB_NAME") ?? (SHEETS_RANGE_A1.includes("!") ? SHEETS_RANGE_A1.split("!")[0] : "Planilha de Rentabilidade");
const SYNC_LOCK_KEY = Number.parseInt(Deno.env.get("SYNC_LOCK_KEY") ?? "20260221", 10);
const SYNC_ADMIN_SECRET = Deno.env.get("SYNC_ADMIN_SECRET") ?? "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

function b64uBytes(bytes: Uint8Array): string {
  let s = "";
  for (let i = 0; i < bytes.length; i += 1) s += String.fromCharCode(bytes[i]);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function b64uText(text: string): string {
  return b64uBytes(new TextEncoder().encode(text));
}

function pemToPkcs8(pem: string): ArrayBuffer {
  const cleaned = pem
    .replace(/-----BEGIN PRIVATE KEY-----/g, "")
    .replace(/-----END PRIVATE KEY-----/g, "")
    .replace(/\s+/g, "");
  const binary = atob(cleaned);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

function normalizeText(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
}

function parseExcelDate(serial: number): Date {
  const ms = Math.round((serial - 25569) * 86400 * 1000);
  const date = new Date(ms);
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function parseSheetDate(value: Cell): Date | null {
  if (typeof value === "number" && Number.isFinite(value) && value > 20000) {
    const d = parseExcelDate(value);
    return Number.isNaN(d.getTime()) ? null : new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
  }
  if (typeof value === "string" && value.trim()) {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) return new Date(Date.UTC(parsed.getUTCFullYear(), parsed.getUTCMonth(), 1));
  }
  return null;
}

function toIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function parseNumber(value: Cell): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  const raw = value.trim();
  if (!raw || raw === "-") return null;
  const neg = raw.startsWith("(") && raw.endsWith(")");
  let s = neg ? raw.slice(1, -1) : raw;
  s = s.replace(/R\$/g, "").replace(/\s+/g, "");
  if (s.includes(",") && s.includes(".")) s = s.replace(/\./g, "").replace(/,/g, ".");
  else if (s.includes(",")) s = s.replace(/,/g, ".");
  const n = Number.parseFloat(s);
  if (!Number.isFinite(n)) return null;
  return neg ? -n : n;
}

function getActionColumns(header: Cell[]): Array<{ index: number; acao: string }> {
  const cols: Array<{ index: number; acao: string }> = [];
  for (let i = 2; i < header.length; i += 1) {
    const v = header[i];
    if (typeof v !== "string") continue;
    const raw = v.trim();
    if (!raw) continue;
    if (raw === "@") break;
    cols.push({ index: i, acao: raw.replace(/\s+/g, " ").trimEnd() });
  }
  return cols;
}

function transformRows(rows: Cell[][]): TreatedRow[] {
  if (rows.length < 2) return [];
  const descMap: Record<string, keyof TreatedRow> = {
    [normalizeText("Valor em 31/12/2024")]: "valor_base",
    [normalizeText("Valor-base")]: "valor_base",
    [normalizeText("Investimento (+)")]: "investimento",
    [normalizeText("Resgate (-)")]: "resgate",
    [normalizeText("Rebecimento de proventos (-)")]: "recebimento_proventos",
    [normalizeText("Recebimento de proventos (-)")]: "recebimento_proventos",
    [normalizeText("Valor final no mes")]: "valor_final_mes",
    [normalizeText("Rentabilidade (ao mes)")]: "rentabilidade_mes",
    [normalizeText("Nao mexer")]: "nao_mexer",
    [normalizeText("Ativo/PL")]: "ativo_pl",
  };

  const actions = getActionColumns(rows[0] ?? []);
  if (!actions.length) return [];

  const blocks: Array<{ month: Date; lines: Cell[][] }> = [];
  let current: { month: Date; lines: Cell[][] } | null = null;
  for (let i = 1; i < rows.length; i += 1) {
    const row = rows[i] ?? [];
    const m = parseSheetDate(row[0] ?? null);
    if (m) {
      if (current) blocks.push(current);
      current = { month: m, lines: [] };
    }
    if (current) current.lines.push(row);
  }
  if (current) blocks.push(current);

  const now = new Date();
  const currentMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const out: TreatedRow[] = [];

  for (const block of blocks) {
    if (block.month.getTime() > currentMonth.getTime()) continue;

    const byAction: Record<string, TreatedRow> = {};
    for (const a of actions) {
      byAction[a.acao] = {
        mes: toIsoDate(block.month),
        acao: a.acao,
        periodo: null,
        valor_base: null,
        investimento: null,
        resgate: null,
        recebimento_proventos: null,
        valor_final_mes: null,
        rentabilidade_mes: null,
        nao_mexer: null,
        ativo_pl: null,
      };
    }

    for (const line of block.lines) {
      const d = line[1];
      if (typeof d !== "string") continue;
      const metric = descMap[normalizeText(d)];
      if (!metric) continue;
      for (const a of actions) byAction[a.acao][metric] = parseNumber(line[a.index] ?? null);
    }

    const monthRows = actions.map((a) => byAction[a.acao]);
    const started = monthRows.some((r) => r.valor_final_mes !== null && r.valor_final_mes !== 0);
    if (!started) continue;

    const periodo = new Date(block.month);
    periodo.setUTCDate(periodo.getUTCDate() + 1);
    monthRows[0].periodo = toIsoDate(periodo);
    out.push(...monthRows);
  }

  return out;
}

async function getGoogleAccessToken(): Promise<string> {
  const header = b64uText(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const now = Math.floor(Date.now() / 1000);
  const payload = b64uText(JSON.stringify({
    iss: GOOGLE_SERVICE_ACCOUNT_EMAIL,
    scope: "https://www.googleapis.com/auth/spreadsheets.readonly",
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
  }));
  const signingInput = `${header}.${payload}`;

  const key = await crypto.subtle.importKey(
    "pkcs8",
    pemToPkcs8(GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, new TextEncoder().encode(signingInput));
  const jwt = `${signingInput}.${b64uBytes(new Uint8Array(sig))}`;

  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });
  if (!tokenRes.ok) throw new Error(`OAuth token error: ${tokenRes.status} ${await tokenRes.text()}`);
  const token = await tokenRes.json();
  return token.access_token as string;
}

async function readSheetRows(): Promise<Cell[][]> {
  const accessToken = await getGoogleAccessToken();
  const url = new URL(`https://sheets.googleapis.com/v4/spreadsheets/${GOOGLE_SHEETS_SPREADSHEET_ID}/values/${encodeURIComponent(SHEETS_RANGE_A1)}`);
  url.searchParams.set("valueRenderOption", "UNFORMATTED_VALUE");
  const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
  if (!res.ok) throw new Error(`Sheets read error: ${res.status} ${await res.text()}`);
  const data = await res.json();
  return (data.values ?? []) as Cell[][];
}

async function rpc(name: string, payload: Record<string, unknown>): Promise<unknown> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${name}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`RPC ${name} failed: ${res.status} ${await res.text()}`);
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

async function createSyncRun(trigger: "manual" | "cron", sourceHash: string): Promise<string> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/sync_runs`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      Prefer: "return=representation",
    },
    body: JSON.stringify({ status: "running", trigger, source_hash: sourceHash }),
  });
  if (!res.ok) throw new Error(`create sync_run failed: ${res.status} ${await res.text()}`);
  const rows = (await res.json()) as SyncRun[];
  return rows[0].id;
}

async function updateSyncRun(runId: string, status: "success" | "error" | "skipped", message: string | null, rowsWritten: number | null): Promise<void> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/sync_runs?id=eq.${runId}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
    },
    body: JSON.stringify({ status, message, rows_written: rowsWritten, finished_at: new Date().toISOString() }),
  });
  if (!res.ok) throw new Error(`update sync_run failed: ${res.status} ${await res.text()}`);
}

async function insertStaging(runId: string, rows: TreatedRow[]): Promise<void> {
  for (let i = 0; i < rows.length; i += 500) {
    const chunk = rows.slice(i, i + 500).map((r) => ({ ...r, run_id: runId }));
    const res = await fetch(`${SUPABASE_URL}/rest/v1/rentabilidade_staging`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      },
      body: JSON.stringify(chunk),
    });
    if (!res.ok) throw new Error(`insert staging failed: ${res.status} ${await res.text()}`);
  }
}

async function cleanupStaging(runId: string): Promise<void> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rentabilidade_staging?run_id=eq.${runId}`, {
    method: "DELETE",
    headers: {
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
    },
  });
  if (!res.ok) throw new Error(`cleanup staging failed: ${res.status} ${await res.text()}`);
}

async function insertRawSnapshot(sourceHash: string, rows: Cell[][]): Promise<void> {
  const payload = {
    sheet_id: GOOGLE_SHEETS_SPREADSHEET_ID,
    tab_name: SHEETS_TAB_NAME,
    range_a1: SHEETS_RANGE_A1,
    raw: { values: rows },
    hash: sourceHash,
  };

  const res = await fetch(`${SUPABASE_URL}/rest/v1/raw_snapshots`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) throw new Error(`insert raw_snapshot failed: ${res.status} ${await res.text()}`);
}

function json(status: number, body: Record<string, unknown>): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

Deno.serve(async (req: Request) => {
  if (!req.headers.get("authorization") && req.headers.get("x-admin-secret") !== SYNC_ADMIN_SECRET) {
    return json(401, { ok: false, status: "error", message: "Unauthorized" });
  }

  const trigger: "manual" | "cron" = (req.headers.get("x-trigger") ?? "manual").toLowerCase() === "cron" ? "cron" : "manual";
  const forceError = req.headers.get("x-force-error") ?? "";

  let runId = "";
  let lockHeld = false;

  try {
    const rawRows = await readSheetRows();
    const hashBuffer = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(JSON.stringify(rawRows)));
    const sourceHash = Array.from(new Uint8Array(hashBuffer)).map((b) => b.toString(16).padStart(2, "0")).join("");

    runId = await createSyncRun(trigger, sourceHash);

    try {
      await insertRawSnapshot(sourceHash, rawRows);
    } catch (snapshotError) {
      const snapshotMessage = snapshotError instanceof Error ? snapshotError.message : String(snapshotError);
      console.error("raw_snapshots insert failed", { runId, snapshotMessage });
    }

    const lockOk = await rpc("acquire_sync_lock", { lock_key: SYNC_LOCK_KEY });
    if (!lockOk) {
      await updateSyncRun(runId, "skipped", "Another sync is already running", 0);
      return json(409, { ok: false, status: "skipped", run_id: runId, message: "Another sync is already running" });
    }
    lockHeld = true;

    const treated = transformRows(rawRows);
    if (!treated.length) {
      await updateSyncRun(runId, "success", "No rows to publish", 0);
      return json(200, { ok: true, status: "success", run_id: runId, months_published: 0, rows_written: 0 });
    }

    const months = Array.from(new Set(treated.map((r) => r.mes))).sort();
    await insertStaging(runId, treated);
    if (forceError === "after_staging") {
      throw new Error("Forced error after staging");
    }
    await rpc("apply_rentabilidade_run", { p_run_id: runId, p_months: months });

    await updateSyncRun(runId, "success", null, treated.length);
    return json(200, {
      ok: true,
      status: "success",
      run_id: runId,
      months_published: months.length,
      rows_written: treated.length,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    if (runId) {
      try {
        await cleanupStaging(runId);
      } catch (_) {
        // noop
      }
      try {
        await updateSyncRun(runId, "error", message, null);
      } catch (_) {
        // noop
      }
    }
    return json(500, { ok: false, status: "error", run_id: runId || null, message });
  } finally {
    if (lockHeld) {
      try {
        await rpc("release_sync_lock", { lock_key: SYNC_LOCK_KEY });
      } catch (_) {
        // noop
      }
    }
  }
});
