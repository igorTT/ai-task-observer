export type ParsedSessionTitle =
  | { readonly kind: "candidate"; readonly candidateIdentifier: string; readonly phase?: string }
  | { readonly kind: "unlinked" };

const TITLE_PATTERN = /^([A-Za-z][A-Za-z0-9]*)-([1-9][0-9]*)(?::(.*))?$/u;

export function parseSessionTitle(title: string | undefined): ParsedSessionTitle {
  const normalizedTitle = title?.trim();
  if (!normalizedTitle) return { kind: "unlinked" };
  const match = TITLE_PATTERN.exec(normalizedTitle);
  if (!match?.[1] || !match[2]) return { kind: "unlinked" };
  const phase = match[3]?.trim();
  return {
    kind: "candidate",
    candidateIdentifier: `${match[1].toUpperCase()}-${match[2]}`,
    ...(phase ? { phase } : {}),
  };
}
