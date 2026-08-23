/** ABN helpers — checksum per the ATO weighting algorithm. No registry lookup is performed. */

const WEIGHTS = [10, 1, 3, 5, 7, 9, 11, 13, 15, 17, 19];

export function normaliseAbn(value: string | null | undefined): string {
  return (value ?? "").replace(/[^0-9]/g, "");
}

export function isValidAbn(value: string | null | undefined): boolean {
  const digits = normaliseAbn(value);
  if (digits.length !== 11) return false;
  const nums = digits.split("").map(Number);
  nums[0] -= 1;
  const sum = nums.reduce((acc, n, i) => acc + n * WEIGHTS[i], 0);
  return sum % 89 === 0;
}

export function formatAbn(value: string | null | undefined): string {
  const d = normaliseAbn(value);
  if (d.length !== 11) return value ?? "";
  return `${d.slice(0, 2)} ${d.slice(2, 5)} ${d.slice(5, 8)} ${d.slice(8)}`;
}

/** ACN is optional; when supplied it must be 9 digits. */
export function isValidAcn(value: string | null | undefined): boolean {
  const d = normaliseAbn(value);
  if (d.length === 0) return true;
  return d.length === 9;
}
