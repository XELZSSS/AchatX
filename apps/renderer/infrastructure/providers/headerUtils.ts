type HeaderInput = { key?: string | null; value?: string | null };

export const normalizeCustomHeaders = (
  headers?: HeaderInput[]
): Array<{ key: string; value: string }> => {
  if (!headers) return [];
  return headers
    .map((header) => ({
      key: header.key?.trim(),
      value: header.value?.trim(),
    }))
    .filter((header) => header.key && header.value) as Array<{ key: string; value: string }>;
};
