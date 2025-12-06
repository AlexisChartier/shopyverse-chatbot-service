import { HfInference } from '@huggingface/inference';

export class HfEmbeddings {
  private hf: HfInference;

   public readonly dimension = 384; 
   public readonly modelId = 'sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2';

  constructor() {
    this.hf = new HfInference(process.env.HF_ACCESS_TOKEN);
  }

  async embedDocuments(texts: string[]): Promise<number[][]> {
    // Utilisation d'un modèle performant pour le français/multilingue
    // 'sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2' est un standard léger
    const output = await this.hf.featureExtraction({
      model: 'sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2',
      inputs: texts,
    });

    // Le type de retour de featureExtraction peut varier, on force le cast
    return output as number[][];
  }

  async embedQuery(text: string): Promise<number[]> {
    const vectors = await this.embedDocuments([text]);
    return vectors[0];
  }
}

export const embeddingsClient = new HfEmbeddings();