import { AzureChatOpenAI } from '@langchain/openai';
import { AzureOpenAIEmbeddings } from '@langchain/openai';
import { ChatPromptTemplate } from '@langchain/core/prompts';

interface AzureOpenAIConfig {
  // OpenAI Config from Python code
  openaiBaseUrl?: string;
  openaiBaseEmbeddingUrl?: string;
  openaiProjectId?: string;
  openaiApiKey?: string;
  openaiApiVersion?: string;
  openaiModel?: string;
  openaiEmbeddingModel?: string;
  
  // Azure specific
  azureOpenAIApiInstanceName?: string;
  azureOpenAIApiDeploymentName?: string;
  azureOpenAIApiEmbeddingsDeploymentName?: string;
  azureOpenAIApiKey?: string;
  azureOpenAIApiVersion?: string;
  azureOpenAIBasePath?: string;
}

export class AzureAIService {
  private chatModel!: AzureChatOpenAI;
  private embeddingsModel!: AzureOpenAIEmbeddings;
  private config: AzureOpenAIConfig;

  constructor(config?: Partial<AzureOpenAIConfig>) {
    // Load configuration from environment variables or provided config
    this.config = {
      // Azure Configuration (similar to Python code pattern)
      azureOpenAIApiInstanceName:  process.env.AZURE_OPENAI_API_INSTANCE_NAME,
      azureOpenAIApiKey:  process.env.AZURE_OPENAI_API_KEY,
      azureOpenAIApiVersion:  process.env.AZURE_OPENAI_API_VERSION || '2024-02-01',
      azureOpenAIBasePath:  process.env.AZURE_OPENAI_BASE_PATH,
      
      // Model deployments
      azureOpenAIApiDeploymentName:  process.env.AZURE_OPENAI_API_DEPLOYMENT_NAME || 'o4-mini',
      azureOpenAIApiEmbeddingsDeploymentName:  process.env.AZURE_OPENAI_API_EMBEDDINGS_DEPLOYMENT_NAME || 'text-embedding-ada-002',
      
      // OpenAI Config 
      openaiBaseUrl:  process.env.OPENAI_BASE_URL,
      openaiBaseEmbeddingUrl:  process.env.OPENAI_BASE_EMBEDDING_URL,
      openaiProjectId:  process.env.OPENAI_PROJECT_ID,
      openaiApiKey:  process.env.OPENAI_API_KEY,
      openaiApiVersion:  process.env.OPENAI_API_VERSION,
      openaiModel:  process.env.OPENAI_MODEL || 'gpt-4',
      openaiEmbeddingModel:  process.env.OPENAI_EMBEDDING_MODEL || 'text-embedding-ada-002',
      ...config,
    };

    this.initializeModels();
  }

  private initializeModels(): void {
    console.log('🔧 [AZURE AI SERVICE] Initializing Azure OpenAI models...');
    
    // Initialize Azure Chat OpenAI
    this.chatModel = new AzureChatOpenAI({
      azureOpenAIApiKey: this.config.azureOpenAIApiKey,
      azureOpenAIApiInstanceName: this.config.azureOpenAIApiInstanceName,
      azureOpenAIApiDeploymentName: this.config.azureOpenAIApiDeploymentName,
      azureOpenAIApiVersion: this.config.azureOpenAIApiVersion,
      azureOpenAIBasePath: this.config.azureOpenAIBasePath,
      temperature: 0.1,
      maxTokens: 2000,
      maxRetries: 3,
      timeout: 60000,
      // Custom HTTP client configuration (like Python code)
      configuration: {
        defaultHeaders: {
          'HSBC-Params': JSON.stringify({
            'req_from': this.config.openaiProjectId || 'spectra-testing',
            'type': 'chat'
          }),
          'Authorization-Type': 'openai',
          'Authorization': `Bearer ${this.config.openaiApiKey || this.config.azureOpenAIApiKey}`,
          'Content-Type': 'application/json'
        },
      },
    });

    // Initialize Azure OpenAI Embeddings (similar to Python)
    this.embeddingsModel = new AzureOpenAIEmbeddings({
      azureOpenAIApiKey: this.config.azureOpenAIApiKey,
      azureOpenAIApiInstanceName: this.config.azureOpenAIApiInstanceName,
      azureOpenAIApiEmbeddingsDeploymentName: this.config.azureOpenAIApiEmbeddingsDeploymentName,
      azureOpenAIApiVersion: this.config.azureOpenAIApiVersion,
      azureOpenAIBasePath: this.config.azureOpenAIBasePath,
      maxRetries: 3,
      timeout: 60000,
      // Custom configuration for embeddings (matching Python pattern)
      configuration: {
        defaultHeaders: {
          'HSBC-Params': JSON.stringify({
            'req_from': this.config.openaiProjectId || 'spectra-testing',
            'type': 'embedding'
          }),
          'Authorization-Type': 'openai',
          'Authorization': `Bearer ${this.config.openaiApiKey || this.config.azureOpenAIApiKey}`,
          'Content-Type': 'application/json'
        },
      },
    });

    console.log(`✅ [AZURE AI SERVICE] Models initialized with Azure instance: ${this.config.azureOpenAIApiInstanceName}`);
  }

  /**
   * Get Azure Chat OpenAI model for spec generation and testing
   */
  getChatModel(): AzureChatOpenAI {
    return this.chatModel;
  }

  /**
   * Get Azure OpenAI Embeddings model for vector operations
   */
  getEmbeddingsModel(): AzureOpenAIEmbeddings {
    return this.embeddingsModel;
  }

  /**
   * Enhanced text generation with Azure OpenAI (similar to the original aiService.ts)
   */
  async generateText(prompt: string, options?: { 
    temperature?: number; 
    maxTokens?: number;
    systemPrompt?: string;
  }): Promise<string> {
    try {
      const messages: Array<[string, string]> = [];
      
      if (options?.systemPrompt) {
        messages.push(['system', options.systemPrompt]);
      }
      
      messages.push(['human', prompt]);

      // Create a temporary model with custom settings if needed
      const tempModel = options?.temperature !== undefined || options?.maxTokens !== undefined
        ? new AzureChatOpenAI({
            azureOpenAIApiKey: this.config.azureOpenAIApiKey,
            azureOpenAIApiInstanceName: this.config.azureOpenAIApiInstanceName,
            azureOpenAIApiDeploymentName: this.config.azureOpenAIApiDeploymentName,
            azureOpenAIApiVersion: this.config.azureOpenAIApiVersion,
            azureOpenAIBasePath: this.config.azureOpenAIBasePath,
            temperature: options?.temperature ?? 0.1,
            maxTokens: options?.maxTokens ?? 2000,
            maxRetries: 3,
            timeout: 60000,
          })
        : this.chatModel;

      const response = await tempModel.invoke(messages);
      return response.content as string;
    } catch (error) {
      console.error('❌ [AZURE AI SERVICE] Error generating text:', error);
      throw error;
    }
  }

  /**
   * Generate embeddings using Azure OpenAI
   */
  async generateEmbeddings(texts: string[]): Promise<number[][]> {
    try {
      console.log(`🔄 [AZURE AI SERVICE] Generating embeddings for ${texts.length} texts...`);
      const embeddings = await this.embeddingsModel.embedDocuments(texts);
      console.log(`✅ [AZURE AI SERVICE] Generated ${embeddings.length} embeddings`);
      return embeddings;
    } catch (error) {
      console.error('❌ [AZURE AI SERVICE] Error generating embeddings:', error);
      throw error;
    }
  }

  /**
   * Generate single embedding
   */
  async generateEmbedding(text: string): Promise<number[]> {
    try {
      const embedding = await this.embeddingsModel.embedQuery(text);
      return embedding;
    } catch (error) {
      console.error('❌ [AZURE AI SERVICE] Error generating single embedding:', error);
      throw error;
    }
  }

  /**
   * Enhanced prompt template creation with Azure OpenAI
   */
  async createPromptTemplate(template: string, variables: Record<string, any>): Promise<string> {
    const promptTemplate = ChatPromptTemplate.fromTemplate(template);
    const prompt = await promptTemplate.format(variables);
    return prompt;
  }

  /**
   * Get configuration info for debugging
   */
  getConfig(): Partial<AzureOpenAIConfig> {
    return {
      azureOpenAIApiInstanceName: this.config.azureOpenAIApiInstanceName,
      azureOpenAIApiVersion: this.config.azureOpenAIApiVersion,
      azureOpenAIApiDeploymentName: this.config.azureOpenAIApiDeploymentName,
      azureOpenAIApiEmbeddingsDeploymentName: this.config.azureOpenAIApiEmbeddingsDeploymentName,
      openaiProjectId: this.config.openaiProjectId,
      openaiModel: this.config.openaiModel,
      openaiEmbeddingModel: this.config.openaiEmbeddingModel,
      // Don't expose API keys
    };
  }

  /**
   * Health check for Azure OpenAI services
   */
  async healthCheck(): Promise<{ chat: boolean; embeddings: boolean; config: any }> {
    const results = { chat: false, embeddings: false, config: this.getConfig() };

    try {
      await this.chatModel.invoke([['human', 'Health check']]);
      results.chat = true;
      console.log('✅ [AZURE AI SERVICE] Chat model health check passed');
    } catch (error) {
      console.error('❌ [AZURE AI SERVICE] Chat model health check failed:', error);
    }

    try {
      await this.embeddingsModel.embedQuery('Health check');
      results.embeddings = true;
      console.log('✅ [AZURE AI SERVICE] Embeddings model health check passed');
    } catch (error) {
      console.error('❌ [AZURE AI SERVICE] Embeddings model health check failed:', error);
    }

    return results;
  }
}

// Export default instance for backward compatibility
export const azureAIService = new AzureAIService(); 