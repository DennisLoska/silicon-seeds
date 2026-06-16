declare module "@hyperframes/engine" {
  export interface EngineConfig {
    [key: string]: unknown;
  }

  export const DEFAULT_CONFIG: EngineConfig;

  export function resolveConfig(): EngineConfig;
}
