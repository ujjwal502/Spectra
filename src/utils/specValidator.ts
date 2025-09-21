import SwaggerParser from 'swagger-parser';

export interface SpecValidationResult {
	valid: boolean;
	errors?: string[];
}

/**
 * Validate an OpenAPI/Swagger specification object.
 * Returns { valid: true } when valid; otherwise returns errors.
 */
export async function validateOpenApiSpec(spec: any): Promise<SpecValidationResult> {
	try {
		await (SwaggerParser as any).validate(spec as any);
		return { valid: true };
	} catch (err: any) {
		const errors: string[] = [];
		if (err && err.message) errors.push(err.message);
		if (Array.isArray(err?.errors)) {
			for (const e of err.errors) {
				if (e && e.message) errors.push(e.message);
			}
		}
		return { valid: false, errors: errors.length ? errors : ['Unknown OpenAPI validation error'] };
	}
}
