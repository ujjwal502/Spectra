import { ChatOpenAI } from '@langchain/openai';
import { HumanMessage } from '@langchain/core/messages';
import { TestCase, TestResult } from '../types';
import { CurlRunner } from './curlRunner';
import { NonFunctionalRunner } from './nonFunctionalRunner';

/**
 * Intelligent test execution state
 */
interface TestExecutionState {
  // Test suite information
  testCases: TestCase[];
  executionPlan: {
    testOrder: string[];
    dependencies: Record<string, string[]>;
    dataSetup: any[];
    teardownSteps: string[];
  };

  // Real-time execution state
  currentPhase: string;
  executedTests: string[];
  failedTests: string[];
  testResults: Map<string, TestResult>;

  // Adaptive execution data
  performanceMetrics: {
    averageResponseTime: number;
    successRate: number;
    errorPatterns: string[];
  };

  // Decision making
  adaptiveStrategy: 'conservative' | 'aggressive' | 'balanced';
  continuationDecision: 'continue' | 'pause' | 'abort' | 'retry';
  optimizations: string[];

  // Real-time insights
  insights: string[];
  recommendations: string[];
  riskAssessment: 'low' | 'medium' | 'high';
}

/**
 * Intelligent test runner with LangGraph-inspired decision making
 * Adapts execution strategy based on real-time results and AI analysis
 */
export class IntelligentTestRunner {
  private llm: ChatOpenAI;
  private curlRunner: CurlRunner;
  private nonFunctionalRunner: NonFunctionalRunner;
  private state: TestExecutionState;

  constructor(baseUrl: string = '') {
    this.llm = new ChatOpenAI({
      model: 'gpt-4o',
      temperature: 0.2,
      maxRetries: 2,
    });

    this.curlRunner = new CurlRunner(baseUrl);
    this.nonFunctionalRunner = new NonFunctionalRunner(baseUrl);

    this.state = this.initializeState();
  }

  /**
   * Execute test suite with intelligent adaptation
   */
  async executeIntelligentTestSuite(
    testCases: TestCase[],
    executionPlan: any,
    options: {
      enableAdaptation?: boolean;
      maxFailureThreshold?: number;
      enableRealTimeOptimization?: boolean;
    } = {},
  ): Promise<{
    results: Map<string, TestResult>;
    insights: string[];
    recommendations: string[];
    executionSummary: any;
  }> {
    console.log('🧠 Starting intelligent test execution with adaptive decision making...');

    // Initialize execution state
    this.state = {
      ...this.initializeState(),
      testCases,
      executionPlan,
    };

    const enableAdaptation = options.enableAdaptation ?? true;
    const maxFailureThreshold = options.maxFailureThreshold ?? 0.3; // 30% failure threshold
    const enableRealTimeOptimization = options.enableRealTimeOptimization ?? true;

    try {
      // Execute each phase with intelligent decision making
      for (const phase of this.state.executionPlan.testOrder) {
        console.log(`📋 Executing phase: ${phase}`);
        this.state.currentPhase = phase;

        // Get tests for current phase
        const phaseTests = this.getTestsForPhase(phase);

        if (phaseTests.length === 0) {
          console.log(`⚠️  No tests found for phase: ${phase}`);
          continue;
        }

        // Execute tests in phase with real-time monitoring
        await this.executePhaseWithMonitoring(phaseTests, {
          enableAdaptation,
          maxFailureThreshold,
          enableRealTimeOptimization,
        });

        // AI-driven continuation decision after each phase
        if (enableAdaptation) {
          try {
            const decision = await this.makeIntelligentContinuationDecision();

            if (decision === 'abort') {
              console.log('🛑 AI decided to abort execution due to critical issues');
              break;
            } else if (decision === 'pause') {
              console.log('⏸️  AI recommends pausing - waiting for manual decision');
              // In real implementation, could wait for manual override
              await this.waitForManualDecision();
            }
          } catch (error: any) {
            console.warn(
              '⚠️  AI continuation decision failed, continuing execution:',
              error.message,
            );
            // Continue execution if AI decision fails
          }
        }
      }

      // Generate final insights and recommendations (non-blocking)
      this.generateFinalInsights().catch((error) => {
        console.warn('⚠️  Final insights generation failed (non-blocking):', error.message);
      });

      // Small delay to let async operations complete
      await new Promise((resolve) => setTimeout(resolve, 100));

      const executionSummary = this.generateExecutionSummary();

      console.log('✅ Intelligent test execution completed');
      console.log(`📊 Total tests executed: ${this.state.executedTests.length}`);
      console.log(`❌ Failed tests: ${this.state.failedTests.length}`);
      console.log(
        `🎯 Success rate: ${(this.state.performanceMetrics.successRate * 100).toFixed(2)}%`,
      );

      return {
        results: this.state.testResults,
        insights: this.state.insights,
        recommendations: this.state.recommendations,
        executionSummary,
      };
    } catch (error) {
      console.error('❌ Intelligent test execution failed:', error);
      throw error;
    }
  }

  /**
   * Execute a phase of tests with real-time monitoring and adaptation
   */
  private async executePhaseWithMonitoring(
    tests: TestCase[],
    options: {
      enableAdaptation: boolean;
      maxFailureThreshold: number;
      enableRealTimeOptimization: boolean;
    },
  ): Promise<void> {
    console.log(`🔍 Executing ${tests.length} tests in phase: ${this.state.currentPhase}`);

    for (let i = 0; i < tests.length; i++) {
      const testCase = tests[i];
      console.log(`⚡ Executing test ${i + 1}/${tests.length}: ${testCase.id}`);

      try {
        // Execute the test
        const startTime = Date.now();
        const result = await this.curlRunner.executeTest(testCase);
        const executionTime = Date.now() - startTime;

        // Update state
        this.state.testResults.set(testCase.id, result);
        this.state.executedTests.push(testCase.id);

        if (!result.success) {
          this.state.failedTests.push(testCase.id);
        }

        // Update performance metrics
        this.updatePerformanceMetrics(result, executionTime);

        // Real-time analysis and adaptation (non-blocking)
        if (options.enableAdaptation && i % 5 === 0) {
          // Analyze every 5 tests - but don't let it block execution
          this.performRealTimeAnalysis().catch((error) => {
            console.warn('⚠️  Real-time analysis failed (non-blocking):', error.message);
          });

          // Check if we should adapt strategy
          if (this.state.performanceMetrics.successRate < options.maxFailureThreshold) {
            console.log('⚠️  High failure rate detected - analyzing and adapting...');
            this.adaptExecutionStrategy().catch((error) => {
              console.warn('⚠️  Strategy adaptation failed (non-blocking):', error.message);
            });
          }
        }

        // Real-time optimization (non-blocking)
        if (options.enableRealTimeOptimization && i % 10 === 0) {
          this.optimizeRemainingExecution(tests.slice(i + 1)).catch((error) => {
            console.warn('⚠️  Real-time optimization failed (non-blocking):', error.message);
          });
        }
      } catch (error) {
        console.error(`❌ Test execution failed: ${testCase.id}`, error);

        // Create failed result
        const failedResult: TestResult = {
          success: false,
          testCase,
          duration: 0,
          assertions: [],
          error: (error as any).message,
        };

        this.state.testResults.set(testCase.id, failedResult);
        this.state.failedTests.push(testCase.id);
      }
    }
  }

  /**
   * Make intelligent decision about continuing execution using AI
   */
  private async makeIntelligentContinuationDecision(): Promise<
    'continue' | 'pause' | 'abort' | 'retry'
  > {
    const currentStats = {
      totalTests: this.state.executedTests.length,
      failedTests: this.state.failedTests.length,
      successRate: this.state.performanceMetrics.successRate,
      currentPhase: this.state.currentPhase,
      averageResponseTime: this.state.performanceMetrics.averageResponseTime,
      errorPatterns: this.state.performanceMetrics.errorPatterns,
    };

    const decisionPrompt = `
    As an intelligent test execution advisor, analyze the current test execution state and make a recommendation:

    CURRENT EXECUTION STATE:
    - Phase: ${currentStats.currentPhase}
    - Total tests executed: ${currentStats.totalTests}
    - Failed tests: ${currentStats.failedTests}
    - Success rate: ${(currentStats.successRate * 100).toFixed(2)}%
    - Average response time: ${currentStats.averageResponseTime}ms
    - Error patterns: ${currentStats.errorPatterns.join(', ')}

    RISK ASSESSMENT: ${this.state.riskAssessment}

    Based on this information, what should be the next action?

    OPTIONS:
    1. "continue" - Continue with execution as planned
    2. "pause" - Pause execution for manual review  
    3. "abort" - Stop execution due to critical issues
    - "retry" - Retry failed tests with different strategy

    DECISION CRITERIA:
    - If success rate < 50% and high-risk errors, consider "abort"
    - If success rate 50-70% with concerning patterns, consider "pause"
    - If success rate > 70% with minor issues, consider "continue"
    - If transient failures detected, consider "retry"

    Respond with ONLY the decision word and a brief reason:
    {
      "decision": "continue|pause|abort|retry",
      "reason": "Brief explanation for the decision",
      "confidence": 0.85
    }
    `;

    try {
      const response = await this.llm.invoke([new HumanMessage({ content: decisionPrompt })]);

      const decision = this.parseJsonResponse(response.content as string);

      console.log(`🤖 AI Decision: ${decision.decision} (${decision.reason})`);
      this.state.continuationDecision = decision.decision;

      return decision.decision;
    } catch (error) {
      console.error('Error making continuation decision:', error);
      // Default to continue on error
      return 'continue';
    }
  }

  /**
   * Perform real-time analysis of test execution
   */
  private async performRealTimeAnalysis(): Promise<void> {
    const recentResults = Array.from(this.state.testResults.values()).slice(-10);
    const failedResults = recentResults.filter((r) => !r.success);

    if (failedResults.length > 0) {
      const analysisPrompt = `
      Analyze recent test failures for patterns and insights:

      RECENT FAILURES:
      ${failedResults
        .map(
          (r) => `
      - Test: ${r.testCase.id}
      - Error: ${r.error}
      - Endpoint: ${r.testCase.method} ${r.testCase.endpoint}
      `,
        )
        .join('\n')}

      PERFORMANCE METRICS:
      - Success rate: ${(this.state.performanceMetrics.successRate * 100).toFixed(2)}%
      - Average response time: ${this.state.performanceMetrics.averageResponseTime}ms

      Provide insights and actionable recommendations:
      {
        "patterns": ["pattern1", "pattern2"],
        "rootCauses": ["cause1", "cause2"],
        "recommendations": ["rec1", "rec2"],
        "riskLevel": "low|medium|high"
      }
      `;

      try {
        const response = await this.llm.invoke([new HumanMessage({ content: analysisPrompt })]);

        const analysis = this.parseJsonResponse(response.content as string);

        // Update state with insights
        this.state.insights.push(...analysis.patterns.map((p: string) => `Pattern: ${p}`));
        this.state.recommendations.push(...analysis.recommendations);
        this.state.riskAssessment = analysis.riskLevel;
        this.state.performanceMetrics.errorPatterns = analysis.patterns;

        console.log(`🔍 Real-time analysis completed - Risk level: ${analysis.riskLevel}`);
      } catch (error) {
        console.error('Error in real-time analysis:', error);
      }
    }
  }

  /**
   * Adapt execution strategy based on current performance
   */
  private async adaptExecutionStrategy(): Promise<void> {
    console.log('🔄 Adapting execution strategy based on performance...');

    const adaptationPrompt = `
    Current execution strategy needs adaptation based on performance data:

    CURRENT PERFORMANCE:
    - Success rate: ${(this.state.performanceMetrics.successRate * 100).toFixed(2)}%
    - Failed tests: ${this.state.failedTests.length}
    - Error patterns: ${this.state.performanceMetrics.errorPatterns.join(', ')}
    - Average response time: ${this.state.performanceMetrics.averageResponseTime}ms

    CURRENT STRATEGY: ${this.state.adaptiveStrategy}

    Recommend strategy adaptations:
    {
      "newStrategy": "conservative|aggressive|balanced",
      "optimizations": ["opt1", "opt2", "opt3"],
      "reasoning": "Why these changes are needed"
    }
    `;

    try {
      const response = await this.llm.invoke([new HumanMessage({ content: adaptationPrompt })]);

      const adaptation = this.parseJsonResponse(response.content as string);

      this.state.adaptiveStrategy = adaptation.newStrategy;
      this.state.optimizations.push(...adaptation.optimizations);

      console.log(`📈 Strategy adapted to: ${adaptation.newStrategy}`);
      console.log(`🛠️  Applied optimizations: ${adaptation.optimizations.join(', ')}`);
    } catch (error) {
      console.error('Error adapting execution strategy:', error);
    }
  }

  /**
   * Optimize remaining test execution
   */
  private async optimizeRemainingExecution(remainingTests: TestCase[]): Promise<void> {
    if (remainingTests.length === 0) return;

    console.log(`⚡ Optimizing execution for ${remainingTests.length} remaining tests...`);

    // Example optimizations based on current performance
    if (this.state.performanceMetrics.averageResponseTime > 5000) {
      console.log('🐌 Slow response times detected - implementing timeout optimizations');
      // Could adjust timeouts, implement parallel execution, etc.
    }

    if (this.state.performanceMetrics.successRate < 0.8) {
      console.log('❌ High failure rate - implementing retry mechanisms');
      // Could implement intelligent retry logic
    }
  }

  /**
   * Generate final insights and recommendations
   */
  private async generateFinalInsights(): Promise<void> {
    const summaryPrompt = `
    Generate final insights and recommendations for the test execution:

    EXECUTION SUMMARY:
    - Total tests: ${this.state.executedTests.length}
    - Failed tests: ${this.state.failedTests.length}
    - Success rate: ${(this.state.performanceMetrics.successRate * 100).toFixed(2)}%
    - Average response time: ${this.state.performanceMetrics.averageResponseTime}ms
    - Strategy used: ${this.state.adaptiveStrategy}
    - Phases completed: ${this.state.executionPlan.testOrder.join(', ')}

    ERROR PATTERNS DETECTED:
    ${this.state.performanceMetrics.errorPatterns.join(', ')}

    OPTIMIZATIONS APPLIED:
    ${this.state.optimizations.join(', ')}

    Provide comprehensive final analysis:
    {
      "overallAssessment": "excellent|good|concerning|poor",
      "keyInsights": ["insight1", "insight2", "insight3"],
      "criticalIssues": ["issue1", "issue2"],
      "recommendations": ["rec1", "rec2", "rec3"],
      "nextSteps": ["step1", "step2"]
    }
    `;

    try {
      const response = await this.llm.invoke([new HumanMessage({ content: summaryPrompt })]);

      const analysis = this.parseJsonResponse(response.content as string);

      this.state.insights.push(...analysis.keyInsights);
      this.state.recommendations.push(...analysis.recommendations);

      console.log(`📋 Overall assessment: ${analysis.overallAssessment}`);
      console.log(`🔍 Key insights: ${analysis.keyInsights.length} identified`);
      console.log(`⚠️  Critical issues: ${analysis.criticalIssues.length} identified`);
    } catch (error) {
      console.error('Error generating final insights:', error);
    }
  }

  // Helper methods

  private initializeState(): TestExecutionState {
    return {
      testCases: [],
      executionPlan: {
        testOrder: [],
        dependencies: {},
        dataSetup: [],
        teardownSteps: [],
      },
      currentPhase: '',
      executedTests: [],
      failedTests: [],
      testResults: new Map(),
      performanceMetrics: {
        averageResponseTime: 0,
        successRate: 1.0,
        errorPatterns: [],
      },
      adaptiveStrategy: 'balanced',
      continuationDecision: 'continue',
      optimizations: [],
      insights: [],
      recommendations: [],
      riskAssessment: 'low',
    };
  }

  private getTestsForPhase(phase: string): TestCase[] {
    // Filter tests based on phase (could be based on tags, naming, etc.)
    return this.state.testCases.filter((test) => {
      if (phase === 'functional') {
        return test.feature.scenarios.some((s) => s.tags?.includes('functional'));
      } else if (phase === 'boundary') {
        return test.feature.scenarios.some((s) => s.tags?.includes('boundary'));
      } else if (phase === 'error') {
        return test.feature.scenarios.some((s) => s.tags?.includes('error'));
      } else if (phase === 'security') {
        return test.feature.scenarios.some((s) => s.tags?.includes('security'));
      } else if (phase === 'performance') {
        return test.feature.scenarios.some((s) => s.tags?.includes('performance'));
      }
      return true; // Default to include all tests
    });
  }

  private updatePerformanceMetrics(result: TestResult, executionTime: number): void {
    const currentAvg = this.state.performanceMetrics.averageResponseTime;
    const count = this.state.executedTests.length;

    // Update average response time
    this.state.performanceMetrics.averageResponseTime =
      (currentAvg * (count - 1) + executionTime) / count;

    // Update success rate
    const successCount = this.state.executedTests.length - this.state.failedTests.length;
    this.state.performanceMetrics.successRate = successCount / this.state.executedTests.length;
  }

  private async waitForManualDecision(): Promise<void> {
    // In a real implementation, this would wait for manual input
    // For now, we'll just wait a short time and continue
    console.log('⏳ Waiting 5 seconds for manual decision...');
    await new Promise((resolve) => setTimeout(resolve, 5000));
    console.log('▶️  Continuing execution...');
  }

  private generateExecutionSummary(): any {
    return {
      totalTests: this.state.executedTests.length,
      passedTests: this.state.executedTests.length - this.state.failedTests.length,
      failedTests: this.state.failedTests.length,
      successRate: this.state.performanceMetrics.successRate,
      averageResponseTime: this.state.performanceMetrics.averageResponseTime,
      phasesCompleted: this.state.executionPlan.testOrder,
      strategyUsed: this.state.adaptiveStrategy,
      optimizationsApplied: this.state.optimizations.length,
      riskAssessment: this.state.riskAssessment,
      executionTime: Date.now(), // Would calculate actual execution time
    };
  }

  private parseJsonResponse(content: string): any {
    try {
      // First, try direct JSON parsing
      return JSON.parse(content);
    } catch {
      try {
        // Try to extract JSON from markdown code blocks
        const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
        if (jsonMatch) {
          return JSON.parse(jsonMatch[1]);
        }

        // Try to extract JSON object from text
        const objectMatch = content.match(/\{[\s\S]*\}/);
        if (objectMatch) {
          return JSON.parse(objectMatch[0]);
        }

        // If no JSON found, return a default safe response
        console.warn('⚠️  Could not parse AI response, using default');
        return {
          decision: 'continue',
          reason: 'AI response parsing failed',
          confidence: 0.5,
          patterns: [],
          rootCauses: [],
          recommendations: ['Manual review recommended'],
          riskLevel: 'low',
          newStrategy: 'balanced',
          optimizations: ['increase error logging'],
          reasoning: 'Default strategy due to parsing error',
        };
      } catch (secondError) {
        // Return a completely safe default
        console.warn('⚠️  Complete JSON parsing failure, using safe defaults');
        return {
          decision: 'continue',
          reason: 'JSON parsing failed',
          confidence: 0.1,
          patterns: [],
          rootCauses: [],
          recommendations: [],
          riskLevel: 'low',
          newStrategy: 'balanced',
          optimizations: [],
          reasoning: 'Safe default due to error',
        };
      }
    }
  }
}
