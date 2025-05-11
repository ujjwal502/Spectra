import fs from 'fs';
import path from 'path';
import * as glob from 'glob';
import {
  ApiStructure,
  EndpointInfo,
  ParameterInfo,
  ResponseInfo,
  ModelInfo,
  PropertyInfo,
} from '../types';
import { Parser } from './parser';

/**
 * Parser for Java-based APIs
 * Focuses on Spring Boot and similar frameworks
 */
export class JavaParser implements Parser {
  name = 'Java Parser';

  /**
   * Check if this parser can handle the given codebase
   *
   * @param rootDir Root directory of the source code
   * @returns True if this parser can handle the codebase
   */
  async canHandle(rootDir: string): Promise<boolean> {
    // Check for pom.xml (Maven) or build.gradle (Gradle)
    const pomXmlPath = path.join(rootDir, 'pom.xml');
    const buildGradlePath = path.join(rootDir, 'build.gradle');

    if (fs.existsSync(pomXmlPath) || fs.existsSync(buildGradlePath)) {
      // Look for Java source files in common locations
      const pattern = path.join(rootDir, 'src', 'main', 'java', '**', '*.java');
      const javaFiles = glob.sync(pattern);

      return javaFiles.length > 0;
    }

    // If no build files found, check if there are any Java files in the project
    const pattern = path.join(rootDir, '**', '*.java');
    const javaFiles = glob.sync(pattern, {
      ignore: ['**/node_modules/**', '**/build/**', '**/target/**'],
    });

    return javaFiles.length > 0;
  }

  /**
   * Parse the codebase and extract API information from Java files
   *
   * @param rootDir Root directory of the codebase
   * @returns Structured API information
   */
  async parse(rootDir: string): Promise<ApiStructure> {
    console.log('Parsing Java files for API endpoints...');

    // Find all Java files in the project
    const javaFiles = this.findJavaFiles(rootDir);
    console.log(`Found ${javaFiles.length} Java files`);

    if (javaFiles.length === 0) {
      throw new Error('No Java files found in the project');
    }

    // Find controller files - these typically define API endpoints
    const controllerFiles = this.filterControllerFiles(javaFiles);
    console.log(`Found ${controllerFiles.length} potential controller files`);

    // Parse controller files to extract API info
    const apiInfo = await this.parseControllerFiles(controllerFiles);

    // Extract data models from all Java files
    const models = await this.extractDataModels(javaFiles);
    console.log(`Found ${models.length} data models`);

    // Look for application.properties or application.yml to find base path
    const basePath = await this.findBasePath(rootDir);

    // Create API structure
    const apiStructure: ApiStructure = {
      name: this.determineApiName(rootDir, controllerFiles),
      description: 'API extracted from Java codebase',
      version: '1.0.0', // Default version, would be better to extract from build files
      basePath: basePath,
      endpoints: apiInfo.endpoints,
      models: models,
    };

    return apiStructure;
  }

  /**
   * Find all Java files in the codebase
   *
   * @param rootDir Root directory of the codebase
   * @returns Array of paths to Java files
   */
  private findJavaFiles(rootDir: string): string[] {
    const pattern = path.join(rootDir, '**', '*.java');
    const options = { nocase: true, ignore: ['**/build/**', '**/target/**', '**/test/**'] };
    return glob.sync(pattern, options);
  }

  /**
   * Filter files to find likely controller files
   *
   * @param allFiles All Java files in the codebase
   * @returns Array of controller file paths
   */
  private filterControllerFiles(allFiles: string[]): string[] {
    return allFiles.filter((file) => {
      // Read file content
      try {
        const content = fs.readFileSync(file, 'utf-8');

        // Check if file has controller annotations or naming
        const hasControllerAnnotations =
          content.includes('@RestController') ||
          content.includes('@Controller') ||
          content.includes('@RequestMapping') ||
          content.includes('@GetMapping') ||
          content.includes('@PostMapping') ||
          content.includes('@PutMapping') ||
          content.includes('@DeleteMapping') ||
          path.basename(file).toLowerCase().includes('controller');

        return hasControllerAnnotations;
      } catch (error) {
        console.warn(`Error reading file ${file}:`, error);
        return false;
      }
    });
  }

  /**
   * Parse controller files to extract API information
   *
   * @param controllerFiles Array of controller file paths
   * @returns API info containing endpoints and models
   */
  private async parseControllerFiles(controllerFiles: string[]): Promise<{
    endpoints: EndpointInfo[];
    models: any[];
  }> {
    const endpoints: EndpointInfo[] = [];
    const models: any[] = [];

    for (const file of controllerFiles) {
      try {
        const content = fs.readFileSync(file, 'utf-8');
        const lines = content.split('\n');

        // Extract class-level path
        const classPath = this.extractClassRequestMapping(lines);

        // Extract endpoints from method-level annotations
        const fileEndpoints = this.extractEndpoints(lines, classPath, file);
        endpoints.push(...fileEndpoints);
      } catch (error) {
        console.warn(`Error parsing controller file ${file}:`, error);
      }
    }

    return { endpoints, models };
  }

  /**
   * Extract class-level RequestMapping annotation
   *
   * @param lines File content lines
   * @returns Base path from class-level annotation
   */
  private extractClassRequestMapping(lines: string[]): string {
    for (const line of lines) {
      if (line.includes('@RequestMapping')) {
        // Extract path from annotation, handling different formats
        const pathMatch =
          line.match(/value\s*=\s*["']([^"']+)["']/) ||
          line.match(/path\s*=\s*["']([^"']+)["']/) ||
          line.match(/@RequestMapping\s*\(["']([^"']+)["']/);

        if (pathMatch && pathMatch[1]) {
          return pathMatch[1];
        }
      }
    }

    return '';
  }

  /**
   * Extract endpoints from method-level annotations
   *
   * @param lines File content lines
   * @param classPath Base path from class-level annotation
   * @param filePath Source file path for reference
   * @returns Array of endpoints
   */
  private extractEndpoints(lines: string[], classPath: string, filePath: string): EndpointInfo[] {
    const endpoints: EndpointInfo[] = [];

    // Process the file line by line to find mapping annotations
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Check for various HTTP method annotations
      if (
        line.includes('@GetMapping') ||
        line.includes('@PostMapping') ||
        line.includes('@PutMapping') ||
        line.includes('@DeleteMapping') ||
        line.includes('@PatchMapping') ||
        line.includes('@RequestMapping')
      ) {
        // Determine the HTTP method
        let method = 'get'; // Default
        if (line.includes('@PostMapping')) method = 'post';
        else if (line.includes('@PutMapping')) method = 'put';
        else if (line.includes('@DeleteMapping')) method = 'delete';
        else if (line.includes('@PatchMapping')) method = 'patch';
        else if (line.includes('@RequestMapping')) {
          // For RequestMapping, extract method from parameters
          if (
            line.includes('method = RequestMethod.POST') ||
            line.includes('method=RequestMethod.POST')
          )
            method = 'post';
          else if (
            line.includes('method = RequestMethod.PUT') ||
            line.includes('method=RequestMethod.PUT')
          )
            method = 'put';
          else if (
            line.includes('method = RequestMethod.DELETE') ||
            line.includes('method=RequestMethod.DELETE')
          )
            method = 'delete';
          else if (
            line.includes('method = RequestMethod.PATCH') ||
            line.includes('method=RequestMethod.PATCH')
          )
            method = 'patch';
        }

        // Extract path from annotation
        let path = '';
        const pathMatch =
          line.match(/value\s*=\s*["']([^"']+)["']/) ||
          line.match(/path\s*=\s*["']([^"']+)["']/) ||
          line.match(/@\w+Mapping\s*\(["']([^"']+)["']/);

        if (pathMatch && pathMatch[1]) {
          path = pathMatch[1];
        }

        // Combine with class path
        const fullPath = classPath ? classPath + (path.startsWith('/') ? path : '/' + path) : path;

        // Get the next line to find the method name and return type
        let methodLine = '';
        let j = i + 1;
        while (
          j < lines.length &&
          !methodLine.includes('public') &&
          !methodLine.includes('private') &&
          !methodLine.includes('protected')
        ) {
          methodLine = lines[j].trim();
          j++;
        }

        // Create a description from method name
        const methodNameMatch = methodLine.match(/(\w+)\s*\(/);
        const methodName = methodNameMatch ? methodNameMatch[1] : '';

        // Try to determine return type
        let producesType = 'application/json'; // Default
        if (line.includes('produces = MediaType.') || line.includes('produces=MediaType.')) {
          if (line.includes('APPLICATION_XML') || line.includes('TEXT_XML'))
            producesType = 'application/xml';
          else if (line.includes('TEXT_PLAIN')) producesType = 'text/plain';
          else if (line.includes('TEXT_HTML')) producesType = 'text/html';
        }

        // Extract parameters
        const parameters = this.extractParameters(lines, i);

        // Create endpoint info
        const endpoint: EndpointInfo = {
          path: fullPath,
          method: method,
          summary: `${methodName} endpoint`,
          description: `${methodName} endpoint`,
          parameters: parameters,
          responses: [
            {
              statusCode: 200,
              description: 'Successful operation',
              contentType: producesType,
            },
            {
              statusCode: 400,
              description: 'Bad request',
              contentType: 'application/json',
            },
            {
              statusCode: 404,
              description: 'Not found',
              contentType: 'application/json',
            },
          ],
        };

        endpoints.push(endpoint);
      }
    }

    return endpoints;
  }

  /**
   * Extract parameters from method signature and annotations
   *
   * @param lines File content lines
   * @param mappingLineIndex Index of the mapping annotation line
   * @returns Array of parameters
   */
  private extractParameters(lines: string[], mappingLineIndex: number): ParameterInfo[] {
    const parameters: ParameterInfo[] = [];

    // Search for method signature after the mapping annotation
    let methodSignatureIndex = mappingLineIndex + 1;
    while (methodSignatureIndex < lines.length && !lines[methodSignatureIndex].includes('(')) {
      methodSignatureIndex++;
    }

    if (methodSignatureIndex >= lines.length) {
      return parameters;
    }

    // Process parameter annotations before method signature
    for (let i = mappingLineIndex + 1; i < methodSignatureIndex; i++) {
      const line = lines[i].trim();

      // Look for parameter annotations
      if (
        line.includes('@PathVariable') ||
        line.includes('@RequestParam') ||
        line.includes('@RequestBody')
      ) {
        const isPathVar = line.includes('@PathVariable');
        const isRequestParam = line.includes('@RequestParam');
        const isRequestBody = line.includes('@RequestBody');

        // Extract parameter name
        let name = '';
        const nameMatch =
          line.match(/value\s*=\s*["']([^"']+)["']/) || line.match(/name\s*=\s*["']([^"']+)["']/);

        if (nameMatch && nameMatch[1]) {
          name = nameMatch[1];
        }

        // If no explicit name, look for variable name in the annotation or next lines
        if (!name && (isPathVar || isRequestParam)) {
          const varMatch = line.match(/@\w+\s+(\w+)/);
          if (varMatch && varMatch[1]) {
            name = varMatch[1];
          }
        }

        // Determine parameter type
        let type = 'string'; // Default
        const typeMatch = line.match(/(\w+)\s+\w+\s*$/);
        if (typeMatch && typeMatch[1]) {
          type = this.mapJavaTypeToJsonType(typeMatch[1]);
        }

        // Add the parameter
        const param: ParameterInfo = {
          name: name || 'param' + parameters.length, // Fallback name if not found
          schema: { type: type },
          required: isPathVar || line.includes('required = true') || line.includes('required=true'),
          location: 'query', // Default location, will be overridden below if needed
        };

        if (isPathVar) {
          param.location = 'path';
        } else if (isRequestParam) {
          param.location = 'query';
        } else if (isRequestBody) {
          param.location = 'query'; // Changed from 'body' as it's not a valid location
        }

        parameters.push(param);
      }
    }

    // Try to extract parameters from method signature if none found from annotations
    if (parameters.length === 0) {
      const methodLine = lines[methodSignatureIndex];
      const paramsMatch = methodLine.match(/\(([^)]+)\)/);

      if (paramsMatch && paramsMatch[1]) {
        const paramsList = paramsMatch[1].split(',');

        paramsList.forEach((param, index) => {
          param = param.trim();
          const parts = param.split(' ');

          if (parts.length >= 2) {
            const type = this.mapJavaTypeToJsonType(parts[0]);
            const name = parts[1].replace(/[^a-zA-Z0-9_]/g, '');

            parameters.push({
              name: name,
              schema: { type: type },
              location: 'query', // Default assumption
              required: false,
            });
          }
        });
      }
    }

    return parameters;
  }

  /**
   * Extract data models from Java files
   *
   * @param javaFiles All Java files
   * @returns Array of models
   */
  private async extractDataModels(javaFiles: string[]): Promise<ModelInfo[]> {
    const models: ModelInfo[] = [];

    // Look for entity classes, data classes (with @Data annotation), and POJOs
    for (const file of javaFiles) {
      try {
        // Skip controller files as they are usually not data models
        if (file.toLowerCase().includes('controller')) continue;

        const content = fs.readFileSync(file, 'utf-8');
        const lines = content.split('\n');

        // Check for class definition and related annotations
        let isEntity = false;
        let isModel = false;

        for (let i = 0; i < Math.min(20, lines.length); i++) {
          const line = lines[i];

          if (line.includes('@Entity') || line.includes('@Table') || line.includes('@Document')) {
            isEntity = true;
          }

          if (
            line.includes('@Data') ||
            line.includes('@Value') ||
            (line.includes('@Getter') && line.includes('@Setter')) ||
            line.includes('implements Serializable')
          ) {
            isModel = true;
          }

          // Check for class definition
          if (line.includes('public class') || line.includes('public final class')) {
            if (
              isEntity ||
              isModel ||
              path.basename(file).includes('dto') ||
              path.basename(file).includes('model')
            ) {
              this.extractClassModel(lines, i, file, models);
              break;
            }
          }
        }
      } catch (error) {
        console.warn(`Error extracting model from file ${file}:`, error);
      }
    }

    return models;
  }

  /**
   * Extract class model information
   *
   * @param lines File content lines
   * @param classLineIndex Index of the class definition line
   * @param filePath Source file path
   * @param models Array to add extracted models to
   */
  private extractClassModel(
    lines: string[],
    classLineIndex: number,
    filePath: string,
    models: ModelInfo[],
  ): void {
    const classLine = lines[classLineIndex];

    // Extract class name
    const classNameMatch = classLine.match(/public(?:\s+final)?\s+class\s+(\w+)/);
    if (!classNameMatch || !classNameMatch[1]) return;

    const className = classNameMatch[1];

    // Get class description from JavaDoc comments before the class declaration
    let classDescription = `Model class for ${className}`;
    for (let i = Math.max(0, classLineIndex - 5); i < classLineIndex; i++) {
      const line = lines[i].trim();
      if (line.startsWith('/**') || line.startsWith('/*')) {
        // Look for description in the JavaDoc comment
        const description = lines
          .slice(i, classLineIndex)
          .filter((l) => l.trim().startsWith('*') && !l.trim().startsWith('*/'))
          .map((l) => l.trim().replace(/^\*\s*/, ''))
          .filter((l) => l.length > 0 && !l.startsWith('@'))
          .join(' ');

        if (description) {
          classDescription = description;
          break;
        }
      }
    }

    // Create model
    const model: ModelInfo = {
      name: className,
      description: classDescription,
      properties: [],
    };

    // Check if we're dealing with a @Data annotated class
    const isDataClass = lines
      .slice(Math.max(0, classLineIndex - 5), classLineIndex)
      .some(
        (line) => line.includes('@Data') || line.includes('@Getter') || line.includes('@Setter'),
      );

    // Extract properties from class fields
    for (let i = classLineIndex + 1; i < lines.length && !lines[i].includes('}'); i++) {
      const line = lines[i].trim();

      // Skip empty lines, methods, constructors, inner classes
      if (
        !line ||
        line.startsWith('//') ||
        line.startsWith('/*') ||
        line.startsWith('*') ||
        (line.startsWith('public') && (line.includes('(') || line.includes('class'))) ||
        (line.startsWith('private') && line.includes('(')) ||
        (line.startsWith('@') &&
          !line.includes('@Column') &&
          !line.includes('@JsonProperty') &&
          !line.includes('@NotNull'))
      ) {
        continue;
      }

      // Look for field definitions
      if (
        (line.startsWith('private') || line.startsWith('protected') || line.startsWith('public')) &&
        line.includes(';')
      ) {
        const fieldMatch = line.match(
          /(?:private|protected|public)\s+(?:final\s+)?(\w+(?:<\w+(?:,\s*\w+)*>)?)\s+(\w+)\s*;/,
        );

        if (fieldMatch && fieldMatch[1] && fieldMatch[2]) {
          const fieldType = fieldMatch[1];
          const fieldName = fieldMatch[2];
          const jsonType = this.mapJavaTypeToJsonType(fieldType);

          // Look for field description and annotations in previous lines
          let required = false;
          let description = '';
          let format: string | undefined = undefined;

          // Check for annotations and JavaDoc in previous 5 lines
          for (let j = Math.max(classLineIndex, i - 10); j < i; j++) {
            const annotLine = lines[j].trim();

            // Check for validation annotations
            if (
              annotLine.includes('@NotNull') ||
              annotLine.includes('@NonNull') ||
              annotLine.includes('@NotEmpty') ||
              annotLine.includes('@NotBlank')
            ) {
              required = true;
            }

            // Check for format annotations
            if (annotLine.includes('@Pattern')) {
              // Extract regex pattern
              const patternMatch = annotLine.match(/@Pattern\(.*?regexp\s*=\s*"([^"]+)"/);
              if (patternMatch && patternMatch[1]) {
                // Infer format from pattern if possible
                if (patternMatch[1].includes('email')) {
                  format = 'email';
                } else if (patternMatch[1].includes('date')) {
                  format = 'date-time';
                }
              }
            }

            // Look for format in field type
            if (jsonType === 'string') {
              if (
                fieldType.toLowerCase().includes('date') ||
                fieldType.toLowerCase().includes('time')
              ) {
                format = 'date-time';
              } else if (fieldName.toLowerCase().includes('email')) {
                format = 'email';
              } else if (
                fieldName.toLowerCase().includes('uri') ||
                fieldName.toLowerCase().includes('url')
              ) {
                format = 'uri';
              }
            }

            // Look for JavaDoc comment
            if (annotLine.includes('/**') || annotLine.includes('/*')) {
              // Extract description from JavaDoc
              for (let k = j; k < i; k++) {
                const commentLine = lines[k].trim();
                if (commentLine.startsWith('*') && !commentLine.startsWith('*/')) {
                  const content = commentLine.substring(1).trim();
                  if (content && !content.startsWith('@')) {
                    description = content;
                    break;
                  }
                }
              }
            }
          }

          // Infer a description if none was found
          if (!description) {
            // Convert camelCase to words
            description = fieldName.replace(/([A-Z])/g, ' $1').toLowerCase();
            description = description.charAt(0).toUpperCase() + description.slice(1);
            description += ` of the ${className}`;
          }

          // Add property
          const property: PropertyInfo = {
            name: fieldName,
            type: jsonType,
            description: description,
            required: required,
          };

          // Add format if available
          if (format) {
            property.format = format;
          }

          // Handle collections - extract item type for arrays
          if (jsonType === 'array' && fieldType.includes('<')) {
            const itemTypeMatch = fieldType.match(/<\s*(\w+)\s*>/);
            if (itemTypeMatch && itemTypeMatch[1]) {
              const itemType = this.mapJavaTypeToJsonType(itemTypeMatch[1]);
              property.items = {
                type: itemType,
              };
            } else {
              property.items = {
                type: 'object',
              };
            }
          }

          model.properties.push(property);
        }
      }
    }

    // Only add model if it has properties
    if (model.properties.length > 0) {
      models.push(model);
    }
  }

  /**
   * Find the base path from application.properties or application.yml
   *
   * @param rootDir Root directory of the codebase
   * @returns Base path
   */
  private async findBasePath(rootDir: string): Promise<string> {
    // Check application.properties
    const propertiesPath = path.join(rootDir, 'src', 'main', 'resources', 'application.properties');

    try {
      if (fs.existsSync(propertiesPath)) {
        const properties = fs.readFileSync(propertiesPath, 'utf-8');

        // Look for server.servlet.context-path or similar properties
        const pathMatch = properties.match(/server\.servlet\.context-path\s*=\s*([^\r\n]+)/);
        if (pathMatch && pathMatch[1]) {
          return pathMatch[1].trim();
        }
      }
    } catch (error) {
      console.warn('Error reading application.properties:', error);
    }

    // Check application.yml
    const ymlPath = path.join(rootDir, 'src', 'main', 'resources', 'application.yml');

    try {
      if (fs.existsSync(ymlPath)) {
        const yml = fs.readFileSync(ymlPath, 'utf-8');

        // Simple pattern matching for YAML (not a full parser)
        const serverSection = yml.match(/server:\s*([^]*?)\n\w+:/s);
        if (serverSection && serverSection[1]) {
          const pathMatch = serverSection[1].match(/context-path:\s*([^\r\n]+)/);
          if (pathMatch && pathMatch[1]) {
            return pathMatch[1].trim();
          }
        }
      }
    } catch (error) {
      console.warn('Error reading application.yml:', error);
    }

    return '';
  }

  /**
   * Determine API name from project structure or controller files
   *
   * @param rootDir Root directory of the codebase
   * @param controllerFiles Array of controller file paths
   * @returns API name
   */
  private determineApiName(rootDir: string, controllerFiles: string[]): string {
    // Try to find name from build files
    const buildGradlePath = path.join(rootDir, 'build.gradle');
    const pomXmlPath = path.join(rootDir, 'pom.xml');

    try {
      if (fs.existsSync(buildGradlePath)) {
        const buildGradle = fs.readFileSync(buildGradlePath, 'utf-8');
        const nameMatch = buildGradle.match(/rootProject\.name\s*=\s*['"]([^'"]+)['"]/);
        if (nameMatch && nameMatch[1]) {
          return nameMatch[1] + ' API';
        }
      }

      if (fs.existsSync(pomXmlPath)) {
        const pomXml = fs.readFileSync(pomXmlPath, 'utf-8');
        const nameMatch = pomXml.match(/<artifactId>([^<]+)<\/artifactId>/);
        if (nameMatch && nameMatch[1]) {
          return nameMatch[1] + ' API';
        }
      }
    } catch (error) {
      console.warn('Error reading build files:', error);
    }

    // Fallback: use directory name
    return path.basename(rootDir) + ' API';
  }

  /**
   * Map Java types to JSON schema types
   *
   * @param javaType Java type name
   * @returns JSON schema type
   */
  private mapJavaTypeToJsonType(javaType: string): string {
    const typeMap: { [key: string]: string } = {
      String: 'string',
      Integer: 'integer',
      int: 'integer',
      Long: 'integer',
      long: 'integer',
      Double: 'number',
      double: 'number',
      Float: 'number',
      float: 'number',
      Boolean: 'boolean',
      boolean: 'boolean',
      Date: 'string',
      LocalDate: 'string',
      LocalDateTime: 'string',
      Instant: 'string',
      ZonedDateTime: 'string',
      BigDecimal: 'number',
      BigInteger: 'integer',
      Object: 'object',
      Map: 'object',
      HashMap: 'object',
      List: 'array',
      ArrayList: 'array',
      Set: 'array',
      HashSet: 'array',
    };

    // Handle generic types
    if (javaType.includes('<')) {
      const baseType = javaType.substring(0, javaType.indexOf('<'));

      if (
        baseType === 'List' ||
        baseType === 'ArrayList' ||
        baseType === 'Set' ||
        baseType === 'HashSet'
      ) {
        return 'array';
      }
      if (baseType === 'Map' || baseType === 'HashMap') {
        return 'object';
      }
    }

    return typeMap[javaType] || 'object';
  }
}
