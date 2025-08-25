export interface EmbeddingModel {
  id: string;
  name: string;
  dimensions: number;
  description: string;
  provider: 'local' | 'openai';
  modelPath?: string; // For local models
  apiModel?: string;  // For API models
}

export const AVAILABLE_EMBEDDING_MODELS: EmbeddingModel[] = [
  // Local Models (Hugging Face Transformers)
  {
    id: 'all-minilm-l6-v2-small',
    name: 'All-MiniLM-L6-v2-Small',
    dimensions: 384,
    description: 'Lightweight, fast, good quality for most use cases',
    provider: 'local',
    modelPath: 'Xenova/all-MiniLM-L6-v2-small'
  },
  {
    id: 'all-minilm-l6-v2',
    name: 'All-MiniLM-L6-v2',
    dimensions: 384,
    description: 'Standard version, balanced performance',
    provider: 'local',
    modelPath: 'Xenova/all-MiniLM-L6-v2'
  },
  {
    id: 'all-mpnet-base-v2',
    name: 'All-MPNet-Base-v2',
    dimensions: 768,
    description: 'Higher quality, larger model',
    provider: 'local',
    modelPath: 'Xenova/all-mpnet-base-v2'
  },
  {
    id: 'multi-qa-minilm-l6-cos-v1',
    name: 'Multi-QA-MiniLM-L6-Cos-v1',
    dimensions: 384,
    description: 'Optimized for question-answer similarity',
    provider: 'local',
    modelPath: 'Xenova/multi-qa-MiniLM-L6-cos-v1'
  },
  
  // OpenAI Models
  {
    id: 'text-embedding-3-small',
    name: 'OpenAI Text Embedding 3 Small',
    dimensions: 1536,
    description: 'High quality, OpenAI API required',
    provider: 'openai',
    apiModel: 'text-embedding-3-small'
  },
  {
    id: 'text-embedding-3-large',
    name: 'OpenAI Text Embedding 3 Large',
    dimensions: 3072,
    description: 'Highest quality, OpenAI API required',
    provider: 'openai',
    apiModel: 'text-embedding-3-large'
  },
  

];

export function getModelById(id: string): EmbeddingModel | undefined {
  return AVAILABLE_EMBEDDING_MODELS.find(model => model.id === id);
}

export function getModelsByProvider(provider: 'local' | 'openai'): EmbeddingModel[] {
  return AVAILABLE_EMBEDDING_MODELS.filter(model => model.provider === provider);
}

export function getLocalModels(): EmbeddingModel[] {
  return getModelsByProvider('local');
}
