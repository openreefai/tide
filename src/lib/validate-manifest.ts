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
  } catch {
    // Fallback: inline the essential required fields check if schema file not found
    return null;
  }

  validateFn = ajv.compile(schema);
  return validateFn;
}

export async function validateManifest(
  data: unknown,
): Promise<ManifestValidationResult> {
  const validate = getValidator();

  if (!validate) {
    // Schema file not found — do basic structural validation
    const obj = data as Record<string, unknown>;
    const errors: string[] = [];
    const required = [
      'reef',
      'type',
      'name',
      'version',
      'description',
      'namespace',
      'agents',
    ];
    for (const field of required) {
      if (!(field in obj)) {
        errors.push(`/ missing required property '${field}'`);
      }
    }
    if (errors.length > 0) return { valid: false, errors };
    return { valid: true, errors: [] };
  }

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
