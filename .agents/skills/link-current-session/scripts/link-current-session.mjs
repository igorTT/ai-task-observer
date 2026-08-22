#!/usr/bin/env node

const DEFAULT_OBSERVER_URL = "http://127.0.0.1:3000";
const RESULT_VERSION = 1;
const SESSION_ID_PATTERN = /^\S+$/u;
const ISSUE_PATTERN = /^[A-Z][A-Z0-9]*-[1-9][0-9]*$/u;
const SUCCESS_OUTCOMES = new Set(["ready_to_link", "already_linked", "linked", "relinked"]);
const USER_ACTION_OUTCOMES = new Set(["confirmation_required", "invalid_title", "stale_preflight"]);

const DEFAULT_TIMING = Object.freeze({
  initialWaitMs: 1_000,
  afterRescanWaitMs: 4_000,
  pollIntervalMs: 250,
  requestTimeoutMs: 2_000,
});

const GUIDANCE = Object.freeze({
  ready_to_link: "The session is ready to link from its current title.",
  already_linked: "The session is already linked to the issue in its current title.",
  linked: "The session was linked using its current title.",
  relinked: "The committed issue was replaced using the current title.",
  confirmation_required: "Confirm replacement of the committed issue before linking again.",
  invalid_title: "Rename the session using ISSUE-123: phase, then inspect again.",
  stale_preflight: "The session changed after inspection; inspect it again before linking.",
  session_not_imported: "The observer has not imported this session yet; verify its sessions mount and retry.",
  observer_unavailable: "Start the observer with npm run dev and verify the configured observer URL.",
  observer_protocol_error: "The observer returned an invalid API response; verify its version and URL.",
  invalid_arguments: "Provide an exact session ID and the required linking arguments.",
  invalid_observer_url: "Use an http or https observer URL without embedded credentials.",
  linear_unconfigured: "Configure Linear on the observer; credentials are not accepted by this workflow.",
  linear_not_found: "The observer could not find the exact issue named by the session title.",
  stale_title: "The title changed during Linear resolution; inspect the session again and retry.",
  linear_failure: "The observer could not resolve the issue through Linear; retry after checking observer health.",
  observer_rejected: "The observer rejected the request; inspect its health and API configuration.",
});

class ObserverHttpError extends Error {
  constructor(status, payload) {
    super("Observer request failed");
    this.name = "ObserverHttpError";
    this.status = status;
    this.payload = payload;
  }
}

class ObserverTransportError extends Error {
  constructor() {
    super("Observer request could not be completed");
    this.name = "ObserverTransportError";
  }
}

export function parseArgs(argv) {
  const [command, ...tokens] = argv;
  if (command !== "inspect" && command !== "link") {
    throw new CliError("invalid_arguments");
  }
  const options = { command };
  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index];
    if (!token?.startsWith("--")) throw new CliError("invalid_arguments");
    const name = token.slice(2);
    if (!["session-id", "observer-url", "expected-candidate", "confirm-replace-from"].includes(name)) {
      throw new CliError("invalid_arguments");
    }
    const value = tokens[index + 1];
    if (!value || value.startsWith("--")) throw new CliError("invalid_arguments");
    if (name in options) throw new CliError("invalid_arguments");
    options[name] = value;
    index += 1;
  }
  if (!options["session-id"] || !SESSION_ID_PATTERN.test(options["session-id"])) {
    throw new CliError("invalid_arguments");
  }
  if (command === "link" && !options["expected-candidate"]) {
    throw new CliError("invalid_arguments");
  }
  if (command === "inspect" && (options["expected-candidate"] || options["confirm-replace-from"])) {
    throw new CliError("invalid_arguments");
  }
  if (options["expected-candidate"] && !isIssueIdentifier(options["expected-candidate"])) {
    throw new CliError("invalid_arguments");
  }
  if (options["confirm-replace-from"] && !isIssueIdentifier(options["confirm-replace-from"])) {
    throw new CliError("invalid_arguments");
  }
  if (options["expected-candidate"]) options["expected-candidate"] = options["expected-candidate"].toUpperCase();
  if (options["confirm-replace-from"]) options["confirm-replace-from"] = options["confirm-replace-from"].toUpperCase();
  return options;
}

export function resolveObserverUrl(argument, environment = process.env) {
  const value = argument ?? environment.AI_TASK_OBSERVER_URL ?? DEFAULT_OBSERVER_URL;
  try {
    const parsed = new URL(value);
    if (!(["http:", "https:"].includes(parsed.protocol)) || parsed.username || parsed.password) {
      throw new Error("unsupported observer URL");
    }
    if (parsed.search || parsed.hash) throw new Error("observer URL must be an origin");
    return parsed.origin;
  } catch {
    throw new CliError("invalid_observer_url");
  }
}

export function exitStatus(outcome) {
  if (SUCCESS_OUTCOMES.has(outcome)) return 0;
  if (USER_ACTION_OUTCOMES.has(outcome)) return 2;
  return 1;
}

export function makeResult(outcome, sessionId, fields = {}) {
  return {
    version: RESULT_VERSION,
    outcome,
    sessionId,
    ...(fields.title ? { title: fields.title } : {}),
    ...(fields.candidate ? { candidate: fields.candidate } : {}),
    ...(fields.phase ? { phase: fields.phase } : {}),
    ...(fields.committedIssue ? { committedIssue: fields.committedIssue } : {}),
    ...(fields.previousIssue ? { previousIssue: fields.previousIssue } : {}),
    ...(fields.issue ? { issue: fields.issue } : {}),
    ...(fields.failureCategory ? { failureCategory: fields.failureCategory } : {}),
    guidance: GUIDANCE[outcome] ?? "No further action is available from this workflow.",
  };
}

export function isIssueIdentifier(value) {
  return typeof value === "string" && ISSUE_PATTERN.test(value.toUpperCase());
}

export function parseTitle(title) {
  if (typeof title !== "string") return undefined;
  const match = /^([A-Za-z][A-Za-z0-9]*)-([1-9][0-9]*)(?::(.*))?$/u.exec(title.trim());
  if (!match?.[1] || !match[2]) return undefined;
  const phase = match[3]?.trim();
  return {
    candidate: `${match[1].toUpperCase()}-${match[2]}`,
    ...(phase ? { phase } : {}),
  };
}

export function validateSessionDetail(value, expectedSessionId) {
  if (!isRecord(value) || typeof value.sessionId !== "string" || value.sessionId !== expectedSessionId) {
    throw new ProtocolError();
  }
  if (value.currentTitle !== undefined && typeof value.currentTitle !== "string") throw new ProtocolError();
  const attribution = value.attribution;
  if (!isRecord(attribution) || !isAttributionStatus(attribution.status)) throw new ProtocolError();
  if (attribution.candidateIdentifier !== undefined && !isIssueIdentifier(attribution.candidateIdentifier)) {
    throw new ProtocolError();
  }
  if (attribution.phase !== undefined && typeof attribution.phase !== "string") throw new ProtocolError();
  if (attribution.issue !== undefined && !isIssueSummary(attribution.issue)) throw new ProtocolError();
  if (typeof attribution.relinkRequired !== "boolean" || typeof attribution.synchronizationState !== "string") {
    throw new ProtocolError();
  }
  return value;
}

export function validateRescanResponse(value) {
  if (
    !isRecord(value) ||
    typeof value.runId !== "string" ||
    !["queued", "running"].includes(value.state) ||
    typeof value.coalesced !== "boolean"
  ) throw new ProtocolError();
  return value;
}

export function validateRelinkResponse(value) {
  if (!isRecord(value) || !isRecord(value.attribution) || !isAttributionStatus(value.attribution.status)) {
    throw new ProtocolError();
  }
  const attribution = value.attribution;
  if (attribution.issue !== undefined && !isIssueSummary(attribution.issue)) throw new ProtocolError();
  if (attribution.candidateIdentifier !== undefined && !isIssueIdentifier(attribution.candidateIdentifier)) {
    throw new ProtocolError();
  }
  return value;
}

export function validateErrorPayload(value) {
  if (!isRecord(value) || !isRecord(value.error) || typeof value.error.code !== "string" || typeof value.error.message !== "string") {
    throw new ProtocolError();
  }
  if (value.error.failureCategory !== undefined && typeof value.error.failureCategory !== "string") {
    throw new ProtocolError();
  }
  return value;
}

export async function runWorkflow(options, dependencies = {}) {
  const sessionId = options["session-id"];
  try {
    const observerUrl = resolveObserverUrl(options["observer-url"], dependencies.environment ?? process.env);
    const timing = { ...DEFAULT_TIMING, ...(dependencies.timing ?? {}) };
    const fetchImplementation = dependencies.fetchImplementation ?? globalThis.fetch;
    if (typeof fetchImplementation !== "function") return makeResult("observer_unavailable", sessionId);
    const client = createClient(observerUrl, fetchImplementation, timing.requestTimeoutMs);
    const inspected = await inspectSession(sessionId, client, timing, dependencies.sleep);
    if (options.command === "inspect") return classifyInspection(inspected);
    return await linkSession(options, inspected, client, timing, dependencies.sleep);
  } catch (error) {
    return mapError(error, sessionId);
  }
}

export function classifyInspection(session) {
  const title = typeof session.currentTitle === "string" ? session.currentTitle : undefined;
  const parsed = parseTitle(title);
  const committedIssue = committedIssueFrom(session.attribution);
  const fields = {
    ...(title ? { title } : {}),
    ...(parsed ? { candidate: parsed.candidate, ...(parsed.phase ? { phase: parsed.phase } : {}) } : {}),
    ...(committedIssue ? { committedIssue } : {}),
  };
  if (!parsed) return makeResult("invalid_title", session.sessionId, fields);
  if (committedIssue?.identifier === parsed.candidate) return makeResult("already_linked", session.sessionId, fields);
  if (committedIssue) return makeResult("confirmation_required", session.sessionId, fields);
  return makeResult("ready_to_link", session.sessionId, fields);
}

async function linkSession(options, initialInspection, client, timing, sleep) {
  const expectedCandidate = options["expected-candidate"];
  const latest = await inspectSession(options["session-id"], client, timing, sleep);
  const latestResult = classifyInspection(latest);
  const latestCandidate = latestResult.candidate;
  const latestCommitted = latestResult.committedIssue;
  if (latestCandidate !== expectedCandidate) return makeResult("stale_preflight", options["session-id"], safeInspectionFields(latestResult));
  const previous = initialInspection.attribution ? committedIssueFrom(initialInspection.attribution) : undefined;
  const confirmedPrevious = options["confirm-replace-from"];
  if (latestCommitted?.identifier === expectedCandidate) return latestResult;
  if ((previous?.identifier ?? undefined) !== (latestCommitted?.identifier ?? undefined)) {
    return makeResult("stale_preflight", options["session-id"], safeInspectionFields(latestResult));
  }
  if (confirmedPrevious && (!latestCommitted || latestCommitted.identifier !== confirmedPrevious)) {
    return makeResult("stale_preflight", options["session-id"], safeInspectionFields(latestResult));
  }
  if (latestResult.outcome === "invalid_title") return latestResult;
  if (latestCommitted && latestCommitted.identifier !== expectedCandidate && !confirmedPrevious) {
    return makeResult("confirmation_required", options["session-id"], safeInspectionFields(latestResult));
  }
  if (confirmedPrevious && previous && previous.identifier !== confirmedPrevious) {
    return makeResult("stale_preflight", options["session-id"], safeInspectionFields(latestResult));
  }
  const relinked = await client.relink(options["session-id"]);
  const attribution = relinked.attribution;
  const issue = attribution.issue ? permittedIssue(attribution.issue) : undefined;
  if (!issue) throw new ProtocolError();
  const fields = {
    issue,
    ...(latestResult.title ? { title: latestResult.title } : {}),
    candidate: expectedCandidate,
    ...(latestResult.phase ? { phase: latestResult.phase } : {}),
    ...(latestCommitted ? { previousIssue: latestCommitted } : {}),
  };
  return makeResult(latestCommitted ? "relinked" : "linked", options["session-id"], fields);
}

async function inspectSession(sessionId, client, timing, injectedSleep) {
  const sleep = injectedSleep ?? ((milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds)));
  const first = await getSessionOrNotFound(client, sessionId);
  if (first) return first;
  const watched = await pollForSession(client, sessionId, timing.initialWaitMs, timing.pollIntervalMs, sleep);
  if (watched) return watched;
  await client.rescan();
  const recovered = await pollForSession(client, sessionId, timing.afterRescanWaitMs, timing.pollIntervalMs, sleep);
  if (recovered) return recovered;
  throw new SessionNotImportedError();
}

async function pollForSession(client, sessionId, duration, interval, sleep) {
  const deadline = Date.now() + Math.max(0, duration);
  while (true) {
    const session = await getSessionOrNotFound(client, sessionId);
    if (session) return session;
    if (Date.now() >= deadline) return undefined;
    await sleep(Math.min(Math.max(0, interval), Math.max(0, deadline - Date.now())));
  }
}

async function getSessionOrNotFound(client, sessionId) {
  try {
    return await client.detail(sessionId);
  } catch (error) {
    if (error instanceof ObserverHttpError && error.status === 404) return undefined;
    throw error;
  }
}

function createClient(baseUrl, fetchImplementation, requestTimeoutMs) {
  return {
    async detail(sessionId) {
      return requestJson(`${baseUrl}/api/sessions/${encodeURIComponent(sessionId)}`, fetchImplementation, requestTimeoutMs, (value) => validateSessionDetail(value, sessionId));
    },
    async rescan() {
      return requestJson(`${baseUrl}/api/imports/rescan`, fetchImplementation, requestTimeoutMs, validateRescanResponse, { method: "POST" });
    },
    async relink(sessionId) {
      return requestJson(`${baseUrl}/api/sessions/${encodeURIComponent(sessionId)}/relink`, fetchImplementation, requestTimeoutMs, validateRelinkResponse, { method: "POST" });
    },
  };
}

async function requestJson(url, fetchImplementation, timeoutMs, validator, init = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), Math.max(1, timeoutMs));
  try {
    let response;
    try {
      response = await fetchImplementation(url, { ...init, redirect: "manual", signal: controller.signal });
    } catch {
      throw new ObserverTransportError();
    }
    if (response.url && new URL(response.url).origin !== new URL(url).origin) throw new ProtocolError();
    if (response.status >= 300 && response.status < 400) throw new ProtocolError();
    let body;
    try {
      body = await response.json();
    } catch {
      throw new ProtocolError();
    }
    if (!response.ok) throw new ObserverHttpError(response.status, validateErrorPayload(body));
    return validator(body);
  } finally {
    clearTimeout(timeout);
  }
}

function mapError(error, sessionId) {
  if (error instanceof CliError) return makeResult(error.outcome, sessionId);
  if (error instanceof SessionNotImportedError) return makeResult("session_not_imported", sessionId);
  if (error instanceof ObserverTransportError) return makeResult("observer_unavailable", sessionId);
  if (error instanceof ProtocolError) return makeResult("observer_protocol_error", sessionId);
  if (error instanceof ObserverHttpError) {
    const code = error.payload.error.code;
    const category = error.payload.error.failureCategory;
    if (code === "linear_unconfigured") return makeResult("linear_unconfigured", sessionId);
    if (code === "linear_relink_not_found") return makeResult("linear_not_found", sessionId);
    if (code === "linear_relink_stale_title") return makeResult("stale_title", sessionId);
    if (code === "linear_relink_candidate_missing") return makeResult("invalid_title", sessionId);
    if (code === "session_not_found") return makeResult("session_not_imported", sessionId);
    if (category || code.startsWith("linear_relink_")) {
      return makeResult("linear_failure", sessionId, category ? { failureCategory: category } : {});
    }
    return makeResult("observer_rejected", sessionId);
  }
  return makeResult("observer_unavailable", sessionId);
}

function safeInspectionFields(result) {
  return {
    ...(result.title ? { title: result.title } : {}),
    ...(result.candidate ? { candidate: result.candidate } : {}),
    ...(result.phase ? { phase: result.phase } : {}),
    ...(result.committedIssue ? { committedIssue: result.committedIssue } : {}),
  };
}

function committedIssueFrom(attribution) {
  if (!attribution || attribution.status !== "linked" || !attribution.issue) return undefined;
  return permittedIssue(attribution.issue);
}

function permittedIssue(issue) {
  return {
    identifier: issue.identifier,
    ...(typeof issue.title === "string" ? { title: issue.title } : {}),
  };
}

function isAttributionStatus(value) {
  return typeof value === "string" && ["unlinked", "unconfigured", "pending", "linked", "not_found", "error"].includes(value);
}

function isIssueSummary(value) {
  return isRecord(value) && typeof value.identifier === "string" && isIssueIdentifier(value.identifier);
}

function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

class CliError extends Error {
  constructor(outcome) {
    super("Invalid command");
    this.name = "CliError";
    this.outcome = outcome;
  }
}

class ProtocolError extends Error {}
class SessionNotImportedError extends Error {}

async function main() {
  const sessionId = process.argv[3] === "--session-id" ? process.argv[4] : "unknown";
  let result;
  try {
    const options = parseArgs(process.argv.slice(2));
    result = await runWorkflow(options);
  } catch (error) {
    result = mapError(error, sessionId);
  }
  process.stdout.write(`${JSON.stringify(result)}\n`);
  process.exitCode = exitStatus(result.outcome);
}

if (import.meta.url === `file://${process.argv[1]}`) await main();

export { DEFAULT_OBSERVER_URL, DEFAULT_TIMING, GUIDANCE };
