type BuildProviderModelConfigOptions = {
  envModel?: string;
  fallbackModel: string;
  catalog: string[];
  includeFallbackModel?: boolean;
};

const unique = (values: string[]): string[] => Array.from(new Set(values));

export const resolveEnvModel = (value: string | undefined, fallbackModel: string): string => {
  const trimmed = value?.trim();
  if (!trimmed || trimmed === 'undefined') {
    return fallbackModel;
  }
  return trimmed;
};

export const buildProviderModelConfig = ({
  envModel,
  fallbackModel,
  catalog,
  includeFallbackModel = true,
}: BuildProviderModelConfigOptions): { defaultModel: string; models: string[] } => {
  const defaultModel = resolveEnvModel(envModel, fallbackModel);
  const seeded = includeFallbackModel ? [defaultModel, fallbackModel] : [defaultModel];
  return {
    defaultModel,
    models: unique([...seeded, ...catalog]),
  };
};
