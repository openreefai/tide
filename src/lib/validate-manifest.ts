import Ajv2020 from 'ajv/dist/2020';
import addFormats from 'ajv-formats';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

export interface ManifestValidationResult {
  valid: boolean;
  errors: string[];
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let validateFn: any = null;

function getValidator() {
  if (validateFn) return validateFn;

  const ajv = new Ajv2020({ allErrors: true, strict: false });
  addFormats(ajv);

  // Load the reef.schema.json bundled alongside this file
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = dirname(__filename);
  const schemaPath = resolve(__dirname, 'reef.schema.json');

  let schema: Record<string, unknown>;
  try {
    schema = JSON.parse(readFileSync(schemaPath, 'utf-8'));
  } catch (err) {
    throw new Error(`Failed to load reef.schema.json at ${schemaPath}: ${err instanceof Error ? err.message : String(err)}`);
  }

  validateFn = ajv.compile(schema);
  return validateFn;
}

export async function validateManifest(
  data: unknown,
): Promise<ManifestValidationResult> {
  const validate = getValidator();
  const valid = validate(data) as boolean;
  if (valid) return { valid: true, errors: [] };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const errors = (validate.errors ?? []).map(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (err: any) =>
      `${err.instancePath || '/'} ${err.message ?? 'unknown error'}`,
  );
  return { valid: false, errors };
}
