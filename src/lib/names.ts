const NAME_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const MAX_NAME_LENGTH = 128;

export interface NameValidationResult {
  valid: boolean;
  error?: string;
}

export function canonicalizeName(input: string): string {
  return input.trim().toLowerCase();
}

export function validateName(name: string): NameValidationResult {
  if (!name) return { valid: false, error: 'Name is required' };
  if (name.length > MAX_NAME_LENGTH) return { valid: false, error: `Name exceeds ${MAX_NAME_LENGTH} characters` };
  if (!NAME_PATTERN.test(name)) return { valid: false, error: 'Name must match ^[a-z0-9]+(?:-[a-z0-9]+)*$' };
  return { valid: true };
}

export function checkNearDuplicate(input: string): string {
  return input.replace(/[_.]/g, '-').toLowerCase();
}
