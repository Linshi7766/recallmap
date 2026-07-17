export function normalizeSourceText(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

export function assertEvidenceGrounded(
  source: string,
  excerpts: string[],
): void {
  const normalizedSource = normalizeSourceText(source);

  for (const excerpt of excerpts) {
    const normalizedExcerpt = normalizeSourceText(excerpt);
    if (!normalizedSource.includes(normalizedExcerpt)) {
      throw new Error(`Evidence not found in source: ${normalizedExcerpt}`);
    }
  }
}
