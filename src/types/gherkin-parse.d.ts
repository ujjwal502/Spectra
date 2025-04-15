declare module 'gherkin-parse' {
  interface GherkinStep {
    keyword: string;
    text: string;
  }

  interface GherkinTag {
    name: string;
  }

  interface GherkinScenario {
    name: string;
    steps: GherkinStep[];
    tags?: GherkinTag[];
  }

  interface GherkinChild {
    scenario?: GherkinScenario;
  }

  interface GherkinFeature {
    name: string;
    description?: string;
    children: GherkinChild[];
  }

  interface ParseResult {
    feature: GherkinFeature;
  }

  export function parse(gherkinContent: string): ParseResult;
}
