import { jest } from '@jest/globals';

(jest as any).unstable_mockModule('../../embeddings/HfEmbeddings.js', () => ({
  embeddingsClient: {
    embedQuery: async (q: string) => Array(4).fill(0.5),
    embedDocuments: async (docs: string[]) => docs.map(() => Array(4).fill(0.4)),
  }
}));

describe('BgeReranker (embedding-based) - fixed test', () => {
  let bgeReranker: any;

  beforeAll(async () => {
    const mod = await import('../BgeReranker.js');
    bgeReranker = mod.bgeReranker;
  });

  test('rerank returns topK results', async () => {
    const docs = ['doc1', 'doc2', 'doc3'];
    const results = await bgeReranker.rerank('query', docs, 2);
    expect(results).toHaveLength(2);
    expect(results[0].text).toBeDefined();
    expect(typeof results[0].score).toBe('number');
  });

  test('rerank returns empty array when docs is empty', async () => {
    const results = await bgeReranker.rerank('query', [], 3);
    expect(results).toEqual([]);
  });

  test('rerank does not crash when topK > docs.length', async () => {
    const docs = ['doc1', 'doc2'];
    const results = await bgeReranker.rerank('query', docs, 5);
    expect(results.length).toBeLessThanOrEqual(docs.length);
  });
});