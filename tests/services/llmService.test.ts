import { extractFlashcards } from '../../src/services/llmService';
import { getLLMConfig } from '../../src/config';

jest.mock('../../src/config', () => ({
  getLLMConfig: jest.fn().mockReturnValue({
    baseUrl: 'http://test-api.com',
    model: 'test-model',
    defaultApiKey: 'default-test-key'
  })
}));

// Mock console methods to avoid noise in test output
console.log = jest.fn();
console.error = jest.fn();

global.fetch = jest.fn();

jest.mock('uuid', () => ({
  v4: jest.fn(() => 'mocked-uuid')
}));

describe('LLM Service', () => {
  const mockContent = 'Test content for flashcard generation';
  const mockApiKey = 'test-api-key';
  
  // Create a long content string for truncation tests
  const longContent = 'A'.repeat(5000);

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Reset getLLMConfig mock to default values
    (getLLMConfig as jest.Mock).mockReturnValue({
      baseUrl: 'http://test-api.com',
      model: 'test-model',
      defaultApiKey: 'default-test-key'
    });
  });

  test('calls LLM API with correct parameters', async () => {
    const mockResponse = {
      choices: [
        {
          message: {
            content: JSON.stringify({
              flashcards: [
                { question: 'Test Question 1', answer: 'Test Answer 1' },
                { question: 'Test Question 2', answer: 'Test Answer 2' }
              ]
            })
          }
        }
      ]
    };

    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: jest.fn().mockResolvedValueOnce(mockResponse)
    });

    const result = await extractFlashcards(mockContent, mockApiKey, false);

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/chat/completions'),
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'Content-Type': 'application/json'
        }),
        body: expect.stringContaining(mockContent)
      })
    );

    expect(result).toEqual([
      { id: 'mocked-uuid', question: 'Test Question 1', answer: 'Test Answer 1' },
      { id: 'mocked-uuid', question: 'Test Question 2', answer: 'Test Answer 2' }
    ]);
  });

  test('handles API errors gracefully', async () => {
    (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('API error'));

    await expect(extractFlashcards(mockContent, mockApiKey, false)).rejects.toThrow('Failed to extract flashcards');
  });

  test('throws error when LLM response is invalid', async () => {
    const mockResponse = {
      choices: [
        {
          message: {
            content: '{ "invalid": "response" }'
          }
        }
      ]
    };
    
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: jest.fn().mockResolvedValueOnce(mockResponse)
    });

    await expect(extractFlashcards(mockContent, mockApiKey, false)).rejects.toThrow('Invalid response format from LLM');
  });

  test('handles non-ok response from API', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      status: 400,
      text: jest.fn().mockResolvedValueOnce('Bad request')
    });

    await expect(extractFlashcards(mockContent, mockApiKey, false)).rejects.toThrow('API request failed');
  });
  
  test('uses mock mode correctly', async () => {
    const mockResponse = {
      choices: [
        {
          message: {
            content: JSON.stringify({
              flashcards: [
                { question: 'Mock Question', answer: 'Mock Answer' }
              ]
            })
          }
        }
      ]
    };

    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: jest.fn().mockResolvedValueOnce(mockResponse)
    });

    await extractFlashcards(mockContent, mockApiKey, true);

    // Verify that the URL includes the mock parameter and headers include X-Use-Mock
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('?mock=true'),
      expect.objectContaining({
        headers: expect.objectContaining({
          'X-Use-Mock': 'true'
        })
      })
    );
  });
  
  test('truncates long content correctly', async () => {
    const mockResponse = {
      choices: [
        {
          message: {
            content: JSON.stringify({
              flashcards: [{ question: 'Q', answer: 'A' }]
            })
          }
        }
      ]
    };

    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: jest.fn().mockResolvedValueOnce(mockResponse)
    });

    await extractFlashcards(longContent, mockApiKey, false);

    // Check that the content was truncated in the request body
    const fetchCall = (global.fetch as jest.Mock).mock.calls[0][1];
    const requestBody = JSON.parse(fetchCall.body);
    
    // Verify the content in the messages was truncated
    const userMessage = requestBody.messages.find((m: any) => m.role === 'user');
    expect(userMessage.content.length).toBeLessThan(longContent.length);
    expect(userMessage.content).toContain('[Content truncated due to length]');
  });
  
  test('uses CORS proxy for localhost URLs', async () => {
    // Mock config to return a localhost URL
    (getLLMConfig as jest.Mock).mockReturnValue({
      baseUrl: 'http://localhost:1234',
      model: 'test-model',
      defaultApiKey: 'default-test-key'
    });

    const mockResponse = {
      choices: [
        {
          message: {
            content: JSON.stringify({
              flashcards: [{ question: 'Q', answer: 'A' }]
            })
          }
        }
      ]
    };

    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: jest.fn().mockResolvedValueOnce(mockResponse)
    });

    await extractFlashcards(mockContent, mockApiKey, false);

    // Verify that the proxy URL was used instead of the original localhost URL
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('http://localhost:3001/api/v1/chat/completions'),
      expect.any(Object)
    );
  });
  
  test('handles missing API base URL', async () => {
    // Mock config to return an empty base URL
    (getLLMConfig as jest.Mock).mockReturnValue({
      baseUrl: '',
      model: 'test-model',
      defaultApiKey: 'default-test-key'
    });

    await expect(extractFlashcards(mockContent, mockApiKey, false))
      .rejects.toThrow('API base URL is not configured');
  });
  
  test('handles empty response content', async () => {
    const mockResponse = {
      choices: [{ message: { content: '' } }]
    };

    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: jest.fn().mockResolvedValueOnce(mockResponse)
    });

    await expect(extractFlashcards(mockContent, mockApiKey, false))
      .rejects.toThrow('No response from LLM API');
  });
  
  test('handles missing response choices', async () => {
    const mockResponse = { choices: [] };

    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: jest.fn().mockResolvedValueOnce(mockResponse)
    });

    await expect(extractFlashcards(mockContent, mockApiKey, false))
      .rejects.toThrow('No response from LLM API');
  });
});
