import { EnhancedSpecGenerator } from '../agents/enhancedSpecGenerator';
import { SpecGeneratorOptions } from '../types';
import fs from 'fs';
import path from 'path';

/**
 * Enhanced Spec Integration - Focused on generating the most accurate OpenAPI specs
 * Uses AI-powered LangGraph + Repomix workflow for superior spec accuracy
 */
export class EnhancedSpecIntegration {
  private enhancedGenerator: EnhancedSpecGenerator;

  constructor(options?: Partial<SpecGeneratorOptions>) {
    this.enhancedGenerator = new EnhancedSpecGenerator(options);
  }

  async generateSpec(rootDir: string, outputPath?: string): Promise<any> {
    console.log('🚀 Generating high-accuracy OpenAPI spec...');

    const spec = await this.enhancedGenerator.generateFromCode(rootDir);

    if (!spec) {
      throw new Error('Failed to generate OpenAPI spec');
    }

    if (outputPath) {
      await this.saveSpec(spec, outputPath);
      const endpointCount = spec.paths ? Object.keys(spec.paths).length : 0;
      console.log(`✅ Generated OpenAPI spec with ${endpointCount} endpoints → ${outputPath}`);
    }

    return spec;
  }

  private async saveSpec(spec: any, outputPath: string): Promise<void> {
    const outputDir = path.dirname(outputPath);

    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const formattedSpec = JSON.stringify(spec, null, 2);
    fs.writeFileSync(outputPath, formattedSpec, 'utf-8');
  }
}
