import { jest } from '@jest/globals';

const mockSearch = jest.fn<any>();
const mockRerank = jest.fn<any>();
const mockGenerate = jest.fn<any>();
const mockLog = jest.fn<any>();

(jest as any).unstable_mockModule('../retriever/retrieveContext.js', () => ({
  retrieverService: { search: mockSearch },
}));

(jest as any).unstable_mockModule('../../infrastructure/llm/BgeReranker.js', () => ({
  bgeReranker: { rerank: mockRerank },
}));

(jest as any).unstable_mockModule('../../infrastructure/llm/HfInferenceClient.js', () => ({
  llmClient: { generate: mockGenerate },
}));

(jest as any).unstable_mockModule('../../infrastructure/db/repositories/ChatLogRepository.js', () => ({
  chatLogRepository: { log: mockLog },
}));

describe('ChatService FAQ flow with reranker', () => {
  let ChatService: any;
  let chatService: any;

  beforeAll(async () => {
    const mod = await import('../handleChat.js');
    ChatService = mod.ChatService;
    chatService = new ChatService();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('uses reranked docs and calls LLM when scores are high', async () => {
    mockSearch.mockResolvedValue([
      { id: '1', content: 'doc livraison', score: 0.1, metadata: { topic: 'livraison' } },
      { id: '2', content: 'doc retours', score: 0.05, metadata: { topic: 'retours' } },
    ]);

    mockRerank.mockResolvedValue([
      { id: '2', text: 'doc retours', score: 0.7 },
      { id: '1', text: 'doc livraison', score: 0.5 },
    ]);

    mockGenerate.mockResolvedValue('Réponse test');

    const res = await chatService.processMessage(
      'Que faire pour un retour de produit ?',
      'sess_test'
    );

    expect(mockSearch).toHaveBeenCalled();
    expect(mockRerank).toHaveBeenCalled();
    expect(mockGenerate).toHaveBeenCalled();
    expect(res.answer).toBe('Réponse test');
    expect(res.sources[0].title).toBe('retours');
    expect(mockLog).toHaveBeenCalled();
  });

  test('returns fallback when reranker scores are too low', async () => {
    mockSearch.mockResolvedValue([
      { id: '1', content: 'doc bruit', score: 0.01, metadata: {} },
    ]);

    mockRerank.mockResolvedValue([
      { id: '1', text: 'doc bruit', score: 0.01 }, 
    ]);

    const res = await chatService.processMessage(
      'Question floue',
      'sess_low'
    );

    expect(mockGenerate).not.toHaveBeenCalled();
    expect(res.sources).toHaveLength(0);
    expect(res.answer.toLowerCase()).toContain("je n'ai pas trouvé");
    expect(mockLog).toHaveBeenCalled();
  });
});