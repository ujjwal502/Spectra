import fs from 'fs';
import path from 'path';

/**
 * Framework detection result
 */
export interface FrameworkDetectionResult {
  language: string;
  framework: string;
  confidence: number;
}

/**
 * Utility class for detecting programming language and frameworks
 * in a given codebase
 */
export class LanguageDetector {
  /**
   * Detect programming language and framework used in the codebase
   *
   * @param rootDir Root directory of the codebase
   * @returns Detection result with language and framework information
   */
  async detectLanguageAndFramework(rootDir: string): Promise<FrameworkDetectionResult> {
    // Check for Kotlin first
    if (await this.isKotlinProject(rootDir)) {
      const framework = await this.detectKotlinFramework(rootDir);
      return {
        language: 'kotlin',
        framework,
        confidence: 0.95,
      };
    }

    // Check for API specification files
    if (await this.hasRamlFiles(rootDir)) {
      return {
        language: 'raml',
        framework: 'raml',
        confidence: 0.95,
      };
    }

    if (await this.hasOpenApiFiles(rootDir)) {
      return {
        language: 'openapi',
        framework: 'openapi',
        confidence: 0.95,
      };
    }

    // Check for Node.js
    if (await this.isNodeProject(rootDir)) {
      const framework = await this.detectNodeFramework(rootDir);
      return {
        language: 'javascript',
        framework,
        confidence: 0.9,
      };
    }

    // Check for Java
    if (await this.isJavaProject(rootDir)) {
      const framework = await this.detectJavaFramework(rootDir);
      return {
        language: 'java',
        framework,
        confidence: 0.9,
      };
    }

    // Check for Python
    if (await this.isPythonProject(rootDir)) {
      const framework = await this.detectPythonFramework(rootDir);
      return {
        language: 'python',
        framework,
        confidence: 0.9,
      };
    }

    // Default fallback
    return {
      language: 'unknown',
      framework: 'unknown',
      confidence: 0.1,
    };
  }

  /**
   * Check if the project contains RAML API specification files
   */
  private async hasRamlFiles(rootDir: string): Promise<boolean> {
    const ramlFiles = this.findFiles(rootDir, '.raml');
    return ramlFiles.length > 0;
  }

  /**
   * Check if the project contains OpenAPI specification files
   */
  private async hasOpenApiFiles(rootDir: string): Promise<boolean> {
    // Look for YAML or JSON files that might contain OpenAPI specs
    const yamlFiles = this.findFiles(rootDir, '.yaml').concat(this.findFiles(rootDir, '.yml'));
    const jsonFiles = this.findFiles(rootDir, '.json');

    // Check for OpenAPI content in YAML files
    for (const file of yamlFiles.slice(0, 5)) {
      // Check first 5 files only
      try {
        const content = fs.readFileSync(file, 'utf8');
        if (content.includes('openapi:') || content.includes('swagger:')) {
          return true;
        }
      } catch (error) {
        // Ignore file reading errors
      }
    }

    // Check for OpenAPI content in JSON files
    for (const file of jsonFiles.slice(0, 5)) {
      // Check first 5 files only
      try {
        const content = fs.readFileSync(file, 'utf8');
        if (content.includes('"openapi":') || content.includes('"swagger":')) {
          return true;
        }
      } catch (error) {
        // Ignore file reading errors
      }
    }

    return false;
  }

  /**
   * Check if the project is a Kotlin project
   */
  private async isKotlinProject(rootDir: string): Promise<boolean> {
    // Look for Kotlin files
    const kotlinFiles = this.findFiles(rootDir, '.kt');

    // A project with a significant number of Kotlin files is likely a Kotlin project
    if (kotlinFiles.length > 2) {
      return true;
    }

    // Check for Gradle Kotlin DSL build file
    const gradleKtsPath = path.join(rootDir, 'build.gradle.kts');
    if (fs.existsSync(gradleKtsPath)) {
      return true;
    }

    return false;
  }

  /**
   * Detect which Kotlin framework is used
   */
  private async detectKotlinFramework(rootDir: string): Promise<string> {
    // Check Gradle build files for framework dependencies
    const gradleKtsPath = path.join(rootDir, 'build.gradle.kts');
    if (fs.existsSync(gradleKtsPath)) {
      const gradleKts = fs.readFileSync(gradleKtsPath, 'utf8');

      if (gradleKts.includes('io.ktor')) return 'ktor';
      if (gradleKts.includes('org.springframework.boot')) return 'spring-boot';
      if (gradleKts.includes('org.jetbrains.exposed')) return 'exposed';
    }

    const buildGradlePath = path.join(rootDir, 'build.gradle');
    if (fs.existsSync(buildGradlePath)) {
      const buildGradle = fs.readFileSync(buildGradlePath, 'utf8');

      if (buildGradle.includes('io.ktor')) return 'ktor';
      if (buildGradle.includes('org.springframework.boot')) return 'spring-boot';
    }

    // Check for the presence of specific import statements in Kotlin files
    const kotlinFiles = this.findFiles(rootDir, '.kt');
    for (const file of kotlinFiles.slice(0, 10)) {
      // Check first 10 files only
      try {
        const content = fs.readFileSync(file, 'utf8');

        if (content.includes('import io.ktor')) return 'ktor';
        if (content.includes('import org.springframework')) return 'spring-boot';
        if (content.includes('import kotlinx.serialization')) return 'kotlinx';
      } catch (error) {
        // Ignore file reading errors
      }
    }

    return 'kotlin';
  }

  /**
   * Check if the project is a Node.js project
   */
  private async isNodeProject(rootDir: string): Promise<boolean> {
    const packageJsonPath = path.join(rootDir, 'package.json');
    return fs.existsSync(packageJsonPath);
  }

  /**
   * Detect which Node.js framework is used
   */
  private async detectNodeFramework(rootDir: string): Promise<string> {
    const packageJsonPath = path.join(rootDir, 'package.json');

    try {
      const packageJsonContent = fs.readFileSync(packageJsonPath, 'utf8');
      const packageJson = JSON.parse(packageJsonContent);
      const dependencies = {
        ...packageJson.dependencies,
        ...packageJson.devDependencies,
      };

      if (dependencies.express) return 'express';
      if (dependencies.koa) return 'koa';
      if (dependencies['@nestjs/core']) return 'nestjs';
      if (dependencies.fastify) return 'fastify';
      if (dependencies.hapi) return 'hapi';

      return 'nodejs';
    } catch (error) {
      return 'nodejs';
    }
  }

  /**
   * Check if the project is a Java project
   */
  private async isJavaProject(rootDir: string): Promise<boolean> {
    // Check for pom.xml (Maven) or build.gradle (Gradle)
    const pomXmlPath = path.join(rootDir, 'pom.xml');
    const buildGradlePath = path.join(rootDir, 'build.gradle');
    const gradlePath = path.join(rootDir, 'build.gradle.kts');

    // Check for build files first
    const hasBuildFiles =
      fs.existsSync(pomXmlPath) || fs.existsSync(buildGradlePath) || fs.existsSync(gradlePath);

    if (hasBuildFiles) {
      return true;
    }

    // If no build files are found, search for Java files in the project
    try {
      // Search in common Java project structures
      let javaFiles = this.findFiles(path.join(rootDir, 'src', 'main', 'java'), '.java');

      // If no Java files are found in typical Maven/Gradle structure, search the entire project
      if (javaFiles.length === 0) {
        javaFiles = this.findFiles(rootDir, '.java');
      }

      // Log the results to help with debugging
      console.log(`Found ${javaFiles.length} Java files in the project`);

      return javaFiles.length > 0;
    } catch (error) {
      console.warn('Error searching for Java files:', error);
      return false;
    }
  }

  /**
   * Detect which Java framework is used
   */
  private async detectJavaFramework(rootDir: string): Promise<string> {
    // Look for Spring, Quarkus, or Micronaut in dependencies

    // Check Maven pom.xml first
    const pomXmlPath = path.join(rootDir, 'pom.xml');
    if (fs.existsSync(pomXmlPath)) {
      const pomXml = fs.readFileSync(pomXmlPath, 'utf8');

      if (pomXml.includes('org.springframework.boot')) return 'spring-boot';
      if (pomXml.includes('io.quarkus')) return 'quarkus';
      if (pomXml.includes('io.micronaut')) return 'micronaut';
      if (pomXml.includes('org.springframework')) return 'spring';
    }

    // Check Gradle build files
    const buildGradlePath = path.join(rootDir, 'build.gradle');
    if (fs.existsSync(buildGradlePath)) {
      const buildGradle = fs.readFileSync(buildGradlePath, 'utf8');

      if (buildGradle.includes('org.springframework.boot')) return 'spring-boot';
      if (buildGradle.includes('io.quarkus')) return 'quarkus';
      if (buildGradle.includes('io.micronaut')) return 'micronaut';
      if (buildGradle.includes('org.springframework')) return 'spring';
    }

    // Check for presence of framework-specific files or annotations in Java files
    // First check in common Java source locations
    let javaFiles = this.findFiles(path.join(rootDir, 'src', 'main', 'java'), '.java');

    // If no files are found in typical location, search in the entire project
    if (javaFiles.length === 0) {
      javaFiles = this.findFiles(rootDir, '.java');
    }

    // Look at up to 10 Java files to determine the framework
    for (const file of javaFiles.slice(0, 10)) {
      try {
        const content = fs.readFileSync(file, 'utf8');

        if (content.includes('@RestController') || content.includes('@SpringBootApplication'))
          return 'spring-boot';
        if (content.includes('@QuarkusMain')) return 'quarkus';
        if (content.includes('@MicronautApplication')) return 'micronaut';
        if (
          content.includes('@Controller') ||
          content.includes('@Service') ||
          content.includes('@Component')
        )
          return 'spring';
        // Add more Java-specific framework detection
        if (content.includes('javax.ws.rs') || content.includes('jakarta.ws.rs')) return 'jax-rs';
      } catch (error) {
        // Ignore file reading errors
      }
    }

    // Default to generic Java if no specific framework detected
    return 'java';
  }

  /**
   * Check if the project is a Python project
   */
  private async isPythonProject(rootDir: string): Promise<boolean> {
    // Check for requirements.txt, setup.py, or pyproject.toml
    const reqsPath = path.join(rootDir, 'requirements.txt');
    const setupPath = path.join(rootDir, 'setup.py');
    const pyprojectPath = path.join(rootDir, 'pyproject.toml');

    return fs.existsSync(reqsPath) || fs.existsSync(setupPath) || fs.existsSync(pyprojectPath);
  }

  /**
   * Detect which Python framework is used
   */
  private async detectPythonFramework(rootDir: string): Promise<string> {
    // Look for common web frameworks in the project files
    const reqsPath = path.join(rootDir, 'requirements.txt');

    if (fs.existsSync(reqsPath)) {
      const requirements = fs.readFileSync(reqsPath, 'utf8');

      if (requirements.includes('django')) return 'django';
      if (requirements.includes('flask')) return 'flask';
      if (requirements.includes('fastapi')) return 'fastapi';
      if (requirements.includes('pyramid')) return 'pyramid';
    }

    // Check for framework-specific files
    const djangoSettingsPath = path.join(rootDir, 'manage.py');
    if (fs.existsSync(djangoSettingsPath)) return 'django';

    // Look in Python files for imports or app instantiation
    try {
      const pythonFiles = this.findFiles(rootDir, '.py');

      for (const filePath of pythonFiles.slice(0, 20)) {
        // Check first 20 files only
        const content = fs.readFileSync(filePath, 'utf8');

        if (content.includes('from flask import')) return 'flask';
        if (content.includes('from fastapi import')) return 'fastapi';
        if (content.includes('from django')) return 'django';
      }
    } catch (error) {
      // Ignore file reading errors
    }

    return 'python';
  }

  /**
   * Find files with a specific extension in a directory and its subdirectories
   */
  private findFiles(dir: string, extension: string): string[] {
    let results: string[] = [];

    try {
      const files = fs.readdirSync(dir);

      for (const file of files) {
        const filePath = path.join(dir, file);
        const stat = fs.statSync(filePath);

        if (stat.isDirectory() && !file.startsWith('node_modules') && !file.startsWith('.git')) {
          results = results.concat(this.findFiles(filePath, extension));
        } else if (file.endsWith(extension)) {
          results.push(filePath);
        }
      }
    } catch (error) {
      // Ignore directory reading errors
    }

    return results;
  }
}
