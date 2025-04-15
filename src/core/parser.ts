import * as SwaggerParser from 'swagger-parser';
import { ApiSchema, Operation, PathItem } from '../types';

export class ApiSchemaParser {
  /**
   * Parse an OpenAPI/Swagger schema from a file or URL
   * @param schemaPath Path or URL to the schema file
   * @returns Parsed API schema
   */
  async parseFromFile(schemaPath: string): Promise<ApiSchema> {
    try {
      // @ts-ignore - SwaggerParser API issue
      const api = await SwaggerParser.default.bundle(schemaPath);
      return api as unknown as ApiSchema;
    } catch (error) {
      throw new Error(`Failed to parse API schema: ${error}`);
    }
  }

  /**
   * Parse an OpenAPI/Swagger schema from a JSON object
   * @param schemaObject Schema object
   * @returns Parsed API schema
   */
  async parseFromObject(schemaObject: any): Promise<ApiSchema> {
    try {
      // @ts-ignore - SwaggerParser API issue
      const api = await SwaggerParser.default.bundle(schemaObject);
      return api as unknown as ApiSchema;
    } catch (error) {
      throw new Error(`Failed to parse API schema: ${error}`);
    }
  }

  /**
   * Extract all endpoints from the API schema
   * @param schema API schema
   * @returns Array of endpoint objects
   */
  extractEndpoints(schema: ApiSchema): Array<{
    path: string;
    method: string;
    operation: Operation;
    pathItem: PathItem;
  }> {
    const endpoints: Array<{
      path: string;
      method: string;
      operation: Operation;
      pathItem: PathItem;
    }> = [];

    for (const path in schema.paths) {
      const pathItem = schema.paths[path];

      const methods = [
        { name: 'get', operation: pathItem.get },
        { name: 'post', operation: pathItem.post },
        { name: 'put', operation: pathItem.put },
        { name: 'delete', operation: pathItem.delete },
        { name: 'patch', operation: pathItem.patch },
        { name: 'options', operation: pathItem.options },
        { name: 'head', operation: pathItem.head },
      ];

      for (const { name, operation } of methods) {
        if (operation) {
          endpoints.push({
            path,
            method: name,
            operation,
            pathItem,
          });
        }
      }
    }

    return endpoints;
  }

  /**
   * Extract schema information for a specific response
   * @param operation API operation
   * @param statusCode HTTP status code
   * @returns Response schema if available
   */
  extractResponseSchema(operation: Operation, statusCode: string = '200'): any {
    if (!operation.responses || !operation.responses[statusCode]) {
      return null;
    }

    const response = operation.responses[statusCode];
    if (!response.content) {
      return null;
    }

    // Try to get JSON schema first
    const jsonContent = response.content['application/json'];
    if (jsonContent && jsonContent.schema) {
      return jsonContent.schema;
    }

    // Fall back to the first available content type
    const firstContentType = Object.keys(response.content)[0];
    if (firstContentType && response.content[firstContentType].schema) {
      return response.content[firstContentType].schema;
    }

    return null;
  }

  /**
   * Extract schema information for the request body
   * @param operation API operation
   * @returns Request body schema if available
   */
  extractRequestBodySchema(operation: Operation): any {
    if (!operation.requestBody || !operation.requestBody.content) {
      return null;
    }

    // Try to get JSON schema first
    const jsonContent = operation.requestBody.content['application/json'];
    if (jsonContent && jsonContent.schema) {
      return jsonContent.schema;
    }

    // Fall back to the first available content type
    const firstContentType = Object.keys(operation.requestBody.content)[0];
    if (firstContentType && operation.requestBody.content[firstContentType].schema) {
      return operation.requestBody.content[firstContentType].schema;
    }

    return null;
  }
}
