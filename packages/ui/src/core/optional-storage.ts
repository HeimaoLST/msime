/** Browser storage is optional: private modes and embedded webviews may reject access. */
export function readOptionalStorage(key: string): string | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function writeOptionalStorage(key: string, value: string): void {
  try {
    if (typeof window !== "undefined") window.localStorage.setItem(key, value);
  } catch {
    // Remembering this preference is optional.
  }
}

export function readOptionalJson(key: string): unknown {
  try {
    return JSON.parse(readOptionalStorage(key) ?? "null");
  } catch {
    return null;
  }
}

export function writeOptionalJson(key: string, value: unknown): void {
  try {
    const encoded = JSON.stringify(value);
    if (encoded !== undefined) writeOptionalStorage(key, encoded);
  } catch {
    // Unserializable values cannot be remembered.
  }
}
