import { ApiStructure } from '../types';

/**
 * Interface for code parsers that analyze backend code and extract API information
 */
export interface Parser {
  /**
   * Name of the parser
   */
  name: string;
  
  /**
   * Parse source code to extract API structure information
   * 
   * @param rootDir Root directory of the source code
   * @returns Extracted API structure
   */
  parse(rootDir: string): Promise<ApiStructure>;
  
  /**
   * Check if this parser can handle the given codebase
   * 
   * @param rootDir Root directory of the source code
   * @returns True if this parser can handle the codebase
   */
  canHandle(rootDir: string): Promise<boolean>;
} 