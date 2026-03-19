import { GoogleGenAI } from '@google/genai';
import { GeminiEmbeddingConfig, GeminiEmbeddingTaskType } from '@/shared/types/chat';
import { sanitizeApiKey } from '@/infrastructure/providers/utils';

export const DEFAULT_GEMINI_EMBEDDING_MODEL = 'gemini-embedding-2-preview';
export const DEFAULT_GEMINI_EMBEDDING_OUTPUT_DIMENSIONALITY = 1536;
export const DEFAULT_GEMINI_EMBEDDING_TASK_TYPE: GeminiEmbeddingTaskType = 'RETRIEVAL_DOCUMENT';

export type GeminiEmbeddingResult = {
  vector: number[];
  dimensions: number;
  model: string;
  taskType: GeminiEmbeddingTaskType;
};

const VALID_TASK_TYPES = new Set<GeminiEmbeddingTaskType>([
  'SEMANTIC_SIMILARITY',
  'CLASSIFICATION',
  'CLUSTERING',
  'RETRIEVAL_DOCUMENT',
  'RETRIEVAL_QUERY',
  'QUESTION_ANSWERING',
  'FACT_VERIFICATION',
]);

const normalizePositiveInteger = (value: unknown): number | undefined => {
  if (typeof value !== 'number' || !Number.isFinite(value)) return undefined;
  const rounded = Math.round(value);
  return rounded > 0 ? rounded : undefined;
};

export const normalizeGeminiEmbeddingConfig = (
  value?: GeminiEmbeddingConfig
): GeminiEmbeddingConfig | undefined => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return undefined;
  }

  const model =
    typeof value.model === 'string' && value.model.trim().length > 0
      ? value.model.trim()
      : undefined;
  const outputDimensionality = normalizePositiveInteger(value.outputDimensionality);
  const taskType = VALID_TASK_TYPES.has(value.taskType as GeminiEmbeddingTaskType)
    ? (value.taskType as GeminiEmbeddingTaskType)
    : undefined;
  const title =
    typeof value.title === 'string' && value.title.trim().length > 0
      ? value.title.trim()
      : undefined;

  if (!model && !outputDimensionality && !taskType && !title) {
    return undefined;
  }

  return {
    model,
    outputDimensionality,
    taskType,
    title,
  };
};

export const getResolvedGeminiEmbeddingConfig = (
  config?: GeminiEmbeddingConfig
): Required<Pick<GeminiEmbeddingConfig, 'model' | 'outputDimensionality' | 'taskType'>> &
  Pick<GeminiEmbeddingConfig, 'title'> => {
  const normalized = normalizeGeminiEmbeddingConfig(config);

  return {
    model: normalized?.model ?? DEFAULT_GEMINI_EMBEDDING_MODEL,
    outputDimensionality:
      normalized?.outputDimensionality ?? DEFAULT_GEMINI_EMBEDDING_OUTPUT_DIMENSIONALITY,
    taskType: normalized?.taskType ?? DEFAULT_GEMINI_EMBEDDING_TASK_TYPE,
    title: normalized?.title,
  };
};

const extractVector = (response: unknown): number[] => {
  const embeddings = (response as { embeddings?: Array<{ values?: number[] }> })?.embeddings;
  const vector = embeddings?.[0]?.values;
  return Array.isArray(vector) ? vector.filter((value) => typeof value === 'number') : [];
};

export const embedTextWithGemini = async (
  apiKey: string,
  text: string,
  config?: GeminiEmbeddingConfig
): Promise<GeminiEmbeddingResult> => {
  const normalizedApiKey = sanitizeApiKey(apiKey);
  if (!normalizedApiKey) {
    throw new Error('Missing Gemini API key.');
  }

  const normalizedText = text.trim();
  if (!normalizedText) {
    throw new Error('Missing text for embedding.');
  }

  const resolvedConfig = getResolvedGeminiEmbeddingConfig(config);
  const client = new GoogleGenAI({ apiKey: normalizedApiKey });
  const response = await client.models.embedContent({
    model: resolvedConfig.model,
    contents: normalizedText,
    config: {
      outputDimensionality: resolvedConfig.outputDimensionality,
      taskType: resolvedConfig.taskType,
      ...(resolvedConfig.title && resolvedConfig.taskType === 'RETRIEVAL_DOCUMENT'
        ? { title: resolvedConfig.title }
        : {}),
    },
  });

  const vector = extractVector(response);
  if (vector.length === 0) {
    throw new Error('Gemini embedding response did not contain vector values.');
  }

  return {
    vector,
    dimensions: vector.length,
    model: resolvedConfig.model,
    taskType: resolvedConfig.taskType,
  };
};
