/**
 * Schema utilities for resolving references in OpenAPI specifications
 */

import * as fs from 'fs';
import * as path from 'path';
import $RefParser from '@apidevtools/json-schema-ref-parser';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';

// Define basic file object interface based on json-schema-ref-parser
interface FileObject {
  url: string;
  extension: string;
  data: string | Buffer | undefined;
}

/**
 * Resolves all references in an OpenAPI schema
 *
 * @param schema The OpenAPI schema object
 * @param schemaPath The file path of the schema for resolving relative references
 * @returns A Promise containing the fully resolved schema
 */
export async function resolveReferences(schema: any, schemaPath: string): Promise<any> {
  console.log('🔍 Starting schema reference resolution');

  try {
    // Get the directory containing the schema file
    const schemaDir = path.dirname(schemaPath);

    // Clone the schema to avoid modifying the original
    const schemaCopy = JSON.parse(JSON.stringify(schema));

    // Create a parser instance
    const parser = new $RefParser();

    // Resolve all references in the schema
    console.log('🔄 Dereferencing schema...');
    const resolvedSchema = await parser.dereference(schemaCopy, {
      resolve: {
        file: {
          canRead: /^file:/,
          read: (file: FileObject) => {
            const filePath = file.url.replace(/^file:\/\//, '');
            console.log(`📄 Reading referenced file: ${filePath}`);
            return fs.readFileSync(filePath, 'utf8');
          },
        },
      },
      dereference: {
        circular: 'ignore',
      },
    });

    console.log('✅ Schema successfully dereferenced');

    return resolvedSchema;
  } catch (error) {
    console.error(`❌ Error resolving schema references: ${error}`);
    console.error('⚠️ Falling back to original schema');
    return schema; // Return the original schema if resolution fails
  }
}

/**
 * Bundles all referenced files into a single schema
 *
 * @param schema The OpenAPI schema object
 * @param schemaPath The file path of the schema for resolving relative references
 * @returns A Promise containing the bundled schema
 */
export async function bundleSchema(schema: any, schemaPath: string): Promise<any> {
  console.log('📦 Starting schema bundling');

  try {
    // Get the directory containing the schema file
    const schemaDir = path.dirname(schemaPath);

    // Clone the schema to avoid modifying the original
    const schemaCopy = JSON.parse(JSON.stringify(schema));

    // Create a parser instance
    const parser = new $RefParser();

    // Bundle all references in the schema
    console.log('🔄 Bundling schema...');
    const bundledSchema = await parser.bundle(schemaCopy, {
      resolve: {
        file: true,
        http: false,
      },
    });

    console.log('✅ Schema successfully bundled');

    return bundledSchema;
  } catch (error) {
    console.error(`❌ Error bundling schema: ${error}`);
    console.error('⚠️ Falling back to original schema');
    return schema; // Return the original schema if bundling fails
  }
}

/**
 * Creates a validator function for JSON schemas with support for OpenAPI formats
 *
 * @returns A validator function that supports OpenAPI formats
 */
export function createSchemaValidator(): Ajv {
  // Create a new Ajv instance with options
  const ajv = new Ajv({
    allErrors: true, // Return all errors, not just the first one
    verbose: true, // Include schema path in errors
    validateFormats: true, // Validate formats like date-time, email, etc.
  });

  // Add the standard formats that come with ajv-formats
  addFormats(ajv);

  // Add custom format validators for OpenAPI formats

  // Float format (used for decimal numbers)
  ajv.addFormat('float', {
    type: 'number',
    validate: (data: any) => {
      return typeof data === 'number';
    },
  });

  // Double format (used for higher precision decimals)
  ajv.addFormat('double', {
    type: 'number',
    validate: (data: any) => {
      return typeof data === 'number';
    },
  });

  // Int32 format
  ajv.addFormat('int32', {
    type: 'number',
    validate: (data: any) => {
      return Number.isInteger(data) && data >= -2147483648 && data <= 2147483647;
    },
  });

  // Int64 format
  ajv.addFormat('int64', {
    type: 'number',
    validate: (data: any) => {
      return Number.isInteger(data);
    },
  });

  // Byte format (base64 encoded)
  ajv.addFormat('byte', {
    type: 'string',
    validate: (data: any) => {
      try {
        return Buffer.from(data, 'base64').toString('base64') === data;
      } catch {
        return false;
      }
    },
  });

  // Binary format
  ajv.addFormat('binary', {
    type: 'string',
    validate: () => true, // In JSON, we can only represent binary data as strings
  });

  // Password format (always valid in testing context)
  ajv.addFormat('password', {
    type: 'string',
    validate: () => true,
  });

  return ajv;
}

/**
 * Validates data against a JSON schema with OpenAPI format support
 *
 * @param schema The JSON schema to validate against
 * @param data The data to validate
 * @returns Validation result object with success flag and any errors
 */
export function validateSchema(schema: any, data: any): { valid: boolean; errors: any[] | null } {
  try {
    // Create validator with OpenAPI format support
    const ajv = createSchemaValidator();

    // Compile the schema
    const validate = ajv.compile(schema);

    // Validate the data
    const valid = validate(data);

    return {
      valid: !!valid,
      errors: validate.errors || null,
    };
  } catch (error) {
    console.error('❌ Schema validation error:', error);
    return {
      valid: false,
      errors: [{ message: `Schema validation failed: ${error}` }],
    };
  }
}
