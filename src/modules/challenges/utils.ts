export const generateCode = (): string => {
  const letters = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const alnum = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const buf = new Uint32Array(8);
  crypto.getRandomValues(buf);
  const part1 = Array.from(buf.slice(0, 4)).map((n) => letters[n % letters.length]).join("");
  const part2 = Array.from(buf.slice(4)).map((n) => alnum[n % alnum.length]).join("");
  return `${part1}-${part2}`;
};

export const buildShareUrl = (code: string) =>
  `${typeof window !== "undefined" ? window.location.origin : "https://flameer.app"}/c/${code}`;

export const extractCode = (input: string): string | null => {
  const trimmed = input.trim().toUpperCase();
  if (!trimmed) return null;
  // Try URL pattern /c/CODE
  const urlMatch = trimmed.match(/\/C\/([A-Z0-9-]{4,20})/);
  if (urlMatch) return urlMatch[1];
  // Bare code pattern XXXX-XXXX
  const codeMatch = trimmed.match(/^[A-Z0-9]{3,8}-?[A-Z0-9]{0,8}$/);
  if (codeMatch) return trimmed;
  return null;
};

export const copyToClipboard = async (text: string): Promise<boolean> => {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
};

export const shareLink = async (title: string, url: string): Promise<boolean> => {
  if (typeof navigator !== "undefined" && (navigator as any).share) {
    try {
      await (navigator as any).share({ title, url });
      return true;
    } catch {
      return false;
    }
  }
  return copyToClipboard(url);
};