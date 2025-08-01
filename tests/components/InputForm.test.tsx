import {
  render, screen, fireEvent, waitFor,
} from '@testing-library/react';
import React from 'react';

import InputForm from '../../src/components/InputForm';
import { getLLMConfig } from '../../src/config';
import { extractFlashcards } from '../../src/services/llmService';
import { fetchWikipediaContent } from '../../src/services/wikipediaService';

jest.mock('../../src/services/llmService', () => ({
  extractFlashcards: jest.fn(),
}));

jest.mock('../../src/services/wikipediaService', () => ({
  fetchWikipediaContent: jest.fn(),
}));

jest.mock('../../src/config', () => ({
  getLLMConfig: jest.fn().mockReturnValue({
    baseUrl: 'http://test-api.com',
    model: 'test-model',
    defaultApiKey: 'default-test-key',
  }),
}));

const mockExtractFlashcards = extractFlashcards as jest.MockedFunction<typeof extractFlashcards>;
const mockFetchWikipediaContent = fetchWikipediaContent as jest.MockedFunction<typeof fetchWikipediaContent>;

describe('InputForm Component', () => {
  const mockSetFlashcardSet = jest.fn();
  const mockSetLoading = jest.fn();
  const mockSetError = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('renders input form with default elements', () => {
    render(
      <InputForm
        setFlashcardSet={mockSetFlashcardSet}
        setLoading={mockSetLoading}
        setError={mockSetError}
      />,
    );

    expect(screen.getByRole('button', { name: 'Wikipedia URL' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Generate Flashcards' })).toBeInTheDocument();
    expect(screen.getByText('🚀 Fast Mock Mode')).toBeInTheDocument();
  });

  test('switches between URL and text input modes', () => {
    render(
      <InputForm
        setFlashcardSet={mockSetFlashcardSet}
        setLoading={mockSetLoading}
        setError={mockSetError}
      />,
    );

    const textModeButton = screen.getByRole('button', { name: 'Custom Text' });
    fireEvent.click(textModeButton);

    expect(screen.getByRole('button', { name: 'Custom Text' })).toHaveClass('active');
    expect(screen.getByPlaceholderText('Paste your text here...')).toBeInTheDocument();

    const urlModeButton = screen.getByRole('button', { name: 'Wikipedia URL' });
    fireEvent.click(urlModeButton);

    expect(screen.getByRole('button', { name: 'Wikipedia URL' })).toHaveClass('active');
    const wikiPlaceholder = 'https://en.wikipedia.org/wiki/Artificial_intelligence';
    expect(screen.getByPlaceholderText(wikiPlaceholder)).toBeInTheDocument();
  });

  test('shows error when submitting without input', () => {
    render(
      <InputForm
        setFlashcardSet={mockSetFlashcardSet}
        setLoading={mockSetLoading}
        setError={mockSetError}
      />,
    );

    const submitButton = screen.getByRole('button', { name: 'Generate Flashcards' });
    fireEvent.click(submitButton);

    expect(mockSetError).toHaveBeenCalledWith('Please enter a Wikipedia URL or text');
  });

  test('shows error when API key is missing in config', () => {
    (getLLMConfig as jest.Mock).mockReturnValueOnce({
      baseUrl: 'http://test-api.com',
      model: 'test-model',
      defaultApiKey: '',
    });

    render(
      <InputForm
        setFlashcardSet={mockSetFlashcardSet}
        setLoading={mockSetLoading}
        setError={mockSetError}
      />,
    );

    const inputField = screen.getByPlaceholderText('https://en.wikipedia.org/wiki/Artificial_intelligence');
    fireEvent.change(inputField, { target: { value: 'https://en.wikipedia.org/wiki/React_(JavaScript_library)' } });

    const submitButton = screen.getByRole('button', { name: 'Generate Flashcards' });
    fireEvent.click(submitButton);

    expect(mockSetError).toHaveBeenCalledWith('Please set your API key in LLM Settings');
  });

  test('processes Wikipedia URL input correctly', async () => {
    const mockWikiContent = {
      title: 'React',
      content: 'React is a JavaScript library for building user interfaces.',
    };

    const mockFlashcards = [
      { id: '1', question: 'What is React?', answer: 'A JavaScript library for building user interfaces.' },
    ];

    mockFetchWikipediaContent.mockResolvedValue(mockWikiContent);
    mockExtractFlashcards.mockResolvedValue(mockFlashcards);

    render(
      <InputForm
        setFlashcardSet={mockSetFlashcardSet}
        setLoading={mockSetLoading}
        setError={mockSetError}
      />,
    );

    const urlInput = screen.getByPlaceholderText('https://en.wikipedia.org/wiki/Artificial_intelligence');
    fireEvent.change(urlInput, { target: { value: 'https://en.wikipedia.org/wiki/React_(JavaScript_library)' } });

    const submitButton = screen.getByRole('button', { name: 'Generate Flashcards' });
    fireEvent.click(submitButton);

    expect(mockSetLoading).toHaveBeenCalledWith(true);

    await waitFor(() => {
      expect(mockFetchWikipediaContent).toHaveBeenCalledWith(
        'https://en.wikipedia.org/wiki/React_(JavaScript_library)'
      );
      expect(mockExtractFlashcards).toHaveBeenCalledWith(mockWikiContent.content, undefined, expect.any(Boolean));
      expect(mockSetFlashcardSet).toHaveBeenCalledWith(expect.objectContaining({
        source: 'https://en.wikipedia.org/wiki/React_(JavaScript_library)',
        cards: mockFlashcards,
      }));
      expect(mockSetLoading).toHaveBeenCalledWith(false);
    });
  });

  test('processes custom text input correctly', async () => {
    const mockFlashcards = [
      { id: '1', question: 'What is TypeScript?', answer: 'A superset of JavaScript that adds static typing.' },
    ];

    mockExtractFlashcards.mockResolvedValue(mockFlashcards);

    render(
      <InputForm
        setFlashcardSet={mockSetFlashcardSet}
        setLoading={mockSetLoading}
        setError={mockSetError}
      />,
    );

    // Switch to custom text mode
    const textModeButton = screen.getByRole('button', { name: 'Custom Text' });
    fireEvent.click(textModeButton);

    // Enter custom text
    const textInput = screen.getByPlaceholderText('Paste your text here...');
    fireEvent.change(textInput, { target: { value: 'TypeScript is a superset of JavaScript that adds static typing.' } });

    // Submit the form
    const submitButton = screen.getByRole('button', { name: 'Generate Flashcards' });
    fireEvent.click(submitButton);

    expect(mockSetLoading).toHaveBeenCalledWith(true);

    await waitFor(() => {
      expect(mockFetchWikipediaContent).not.toHaveBeenCalled();
      expect(mockExtractFlashcards).toHaveBeenCalledWith(
        'TypeScript is a superset of JavaScript that adds static typing.',
        undefined,
        expect.any(Boolean),
      );
      expect(mockSetFlashcardSet).toHaveBeenCalledWith(expect.objectContaining({
        title: 'Custom Text Flashcards',
        source: 'Custom text',
        cards: mockFlashcards,
      }));
      expect(mockSetLoading).toHaveBeenCalledWith(false);
    });
  });

  test('validates Wikipedia URL correctly', () => {
    render(
      <InputForm
        setFlashcardSet={mockSetFlashcardSet}
        setLoading={mockSetLoading}
        setError={mockSetError}
      />,
    );

    // Enter invalid URL
    const wikiPlaceholder = 'https://en.wikipedia.org/wiki/Artificial_intelligence';
    const urlInput = screen.getByPlaceholderText(wikiPlaceholder);
    fireEvent.change(urlInput, { target: { value: 'https://example.com/not-wikipedia' } });

    // Submit the form
    const submitButton = screen.getByRole('button', { name: 'Generate Flashcards' });
    fireEvent.click(submitButton);

    expect(mockSetError).toHaveBeenCalledWith('Please enter a valid Wikipedia URL');
    expect(mockSetLoading).toHaveBeenCalledWith(true);
    expect(mockSetLoading).toHaveBeenCalledWith(false);
  });

  test('extracts title from Wikipedia URL correctly', async () => {
    const mockWikiContent = {
      title: 'Artificial Intelligence',
      content: 'AI content here',
    };

    const mockFlashcards = [
      { id: '1', question: 'What is AI?', answer: 'Artificial Intelligence' },
    ];

    mockFetchWikipediaContent.mockResolvedValue(mockWikiContent);
    mockExtractFlashcards.mockResolvedValue(mockFlashcards);

    render(
      <InputForm
        setFlashcardSet={mockSetFlashcardSet}
        setLoading={mockSetLoading}
        setError={mockSetError}
      />,
    );

    // Enter URL with underscores that should be converted to spaces in title
    const urlInput = screen.getByPlaceholderText('https://en.wikipedia.org/wiki/Artificial_intelligence');
    fireEvent.change(urlInput, { target: { value: 'https://en.wikipedia.org/wiki/Artificial_intelligence' } });

    // Submit the form
    const submitButton = screen.getByRole('button', { name: 'Generate Flashcards' });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(mockSetFlashcardSet).toHaveBeenCalledWith(expect.objectContaining({
        title: 'Artificial intelligence', // Underscores replaced with spaces
        source: 'https://en.wikipedia.org/wiki/Artificial_intelligence',
      }));
    });
  });

  test('handles API errors correctly', async () => {
    // Mock the extractFlashcards function to throw an error
    mockExtractFlashcards.mockRejectedValue(new Error('API error'));

    render(
      <InputForm
        setFlashcardSet={mockSetFlashcardSet}
        setLoading={mockSetLoading}
        setError={mockSetError}
      />,
    );

    // Enter valid URL
    const urlInput = screen.getByPlaceholderText('https://en.wikipedia.org/wiki/Artificial_intelligence');
    fireEvent.change(urlInput, { target: { value: 'https://en.wikipedia.org/wiki/React_(JavaScript_library)' } });

    // Submit the form
    const submitButton = screen.getByRole('button', { name: 'Generate Flashcards' });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(mockSetError).toHaveBeenCalledWith('Error: API error');
      expect(mockSetLoading).toHaveBeenCalledWith(false);
    });
  });

  test('handles Wikipedia fetch errors correctly', async () => {
    // Mock the fetchWikipediaContent function to throw an error
    mockFetchWikipediaContent.mockRejectedValue(new Error('Wikipedia API error'));

    render(
      <InputForm
        setFlashcardSet={mockSetFlashcardSet}
        setLoading={mockSetLoading}
        setError={mockSetError}
      />,
    );

    // Enter valid URL
    const urlInput = screen.getByPlaceholderText('https://en.wikipedia.org/wiki/Artificial_intelligence');
    fireEvent.change(urlInput, { target: { value: 'https://en.wikipedia.org/wiki/React_(JavaScript_library)' } });

    // Submit the form
    const submitButton = screen.getByRole('button', { name: 'Generate Flashcards' });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(mockSetError).toHaveBeenCalledWith('Error: Wikipedia API error');
      expect(mockSetLoading).toHaveBeenCalledWith(false);
    });
  });

  test('passes mock mode setting to extractFlashcards', async () => {
    const mockWikiContent = {
      title: 'React',
      content: 'React content',
    };

    const mockFlashcards = [{ id: '1', question: 'Q', answer: 'A' }];

    mockFetchWikipediaContent.mockResolvedValue(mockWikiContent);
    mockExtractFlashcards.mockResolvedValue(mockFlashcards);

    // Mock localStorage for mock mode setting
    const localStorageMock = {
      getItem: jest.fn().mockReturnValue('true'),
      setItem: jest.fn(),
    };
    Object.defineProperty(window, 'localStorage', { value: localStorageMock });

    render(
      <InputForm
        setFlashcardSet={mockSetFlashcardSet}
        setLoading={mockSetLoading}
        setError={mockSetError}
      />,
    );

    // Enter URL
    const urlInput = screen.getByPlaceholderText('https://en.wikipedia.org/wiki/Artificial_intelligence');
    fireEvent.change(urlInput, { target: { value: 'https://en.wikipedia.org/wiki/Test' } });

    // Submit the form
    const submitButton = screen.getByRole('button', { name: 'Generate Flashcards' });
    fireEvent.click(submitButton);

    await waitFor(() => {
      // Verify that mock mode (true) was passed to extractFlashcards
      expect(mockExtractFlashcards).toHaveBeenCalledWith(mockWikiContent.content, undefined, true);
    });
  });

  describe('Import JSON functionality', () => {
    test('renders import JSON button', () => {
      render(
        <InputForm
          setFlashcardSet={mockSetFlashcardSet}
          setLoading={mockSetLoading}
          setError={mockSetError}
        />,
      );

      expect(screen.getByRole('button', { name: '📄 Import from JSON' })).toBeInTheDocument();
      expect(screen.getByText('OR')).toBeInTheDocument();
    });

    test('opens file dialog when import JSON button is clicked', () => {
      render(
        <InputForm
          setFlashcardSet={mockSetFlashcardSet}
          setLoading={mockSetLoading}
          setError={mockSetError}
        />,
      );

      const importButton = screen.getByRole('button', { name: '📄 Import from JSON' });
      const fileInput = document.querySelector('input[type="file"][accept=".json"]') as HTMLInputElement;
      
      // Mock the click method
      const clickSpy = jest.spyOn(fileInput, 'click').mockImplementation(() => {});
      
      fireEvent.click(importButton);
      
      expect(clickSpy).toHaveBeenCalled();
      clickSpy.mockRestore();
    });

    test('processes valid JSON file correctly', async () => {
      render(
        <InputForm
          setFlashcardSet={mockSetFlashcardSet}
          setLoading={mockSetLoading}
          setError={mockSetError}
        />,
      );

      const fileInput = document.querySelector('input[type="file"][accept=".json"]') as HTMLInputElement;
      
      const validJsonContent = JSON.stringify({
        title: 'Test Flashcards',
        cards: [
          { id: '1', question: 'What is React?', answer: 'A JavaScript library' },
          { id: '2', question: 'What is TypeScript?', answer: 'A typed superset of JavaScript' },
        ],
      });

      const file = new File([validJsonContent], 'test-flashcards.json', { type: 'application/json' });
      
      Object.defineProperty(fileInput, 'files', {
        value: [file],
        writable: false,
      });

      fireEvent.change(fileInput);

      await waitFor(() => {
        expect(mockSetLoading).toHaveBeenCalledWith(true);
        expect(mockSetFlashcardSet).toHaveBeenCalledWith({
          title: 'Test Flashcards',
          source: 'Imported from test-flashcards.json',
          cards: [
            { id: '1', question: 'What is React?', answer: 'A JavaScript library' },
            { id: '2', question: 'What is TypeScript?', answer: 'A typed superset of JavaScript' },
          ],
          createdAt: expect.any(Date),
        });
        expect(mockSetLoading).toHaveBeenCalledWith(false);
      });
    });

    test('handles JSON file without title', async () => {
      render(
        <InputForm
          setFlashcardSet={mockSetFlashcardSet}
          setLoading={mockSetLoading}
          setError={mockSetError}
        />,
      );

      const fileInput = document.querySelector('input[type="file"][accept=".json"]') as HTMLInputElement;
      
      const jsonWithoutTitle = JSON.stringify({
        cards: [
          { question: 'Test question', answer: 'Test answer' },
        ],
      });

      const file = new File([jsonWithoutTitle], 'no-title.json', { type: 'application/json' });
      
      Object.defineProperty(fileInput, 'files', {
        value: [file],
        writable: false,
      });

      fireEvent.change(fileInput);

      await waitFor(() => {
        expect(mockSetFlashcardSet).toHaveBeenCalledWith(expect.objectContaining({
          title: 'no-title', // Should use filename without extension
          source: 'Imported from no-title.json',
        }));
      });
    });

    test('handles JSON file with cards missing IDs', async () => {
      render(
        <InputForm
          setFlashcardSet={mockSetFlashcardSet}
          setLoading={mockSetLoading}
          setError={mockSetError}
        />,
      );

      const fileInput = document.querySelector('input[type="file"][accept=".json"]') as HTMLInputElement;
      
      const jsonWithoutIds = JSON.stringify({
        title: 'Test Cards',
        cards: [
          { question: 'Question 1', answer: 'Answer 1' },
          { question: 'Question 2', answer: 'Answer 2' },
        ],
      });

      const file = new File([jsonWithoutIds], 'test.json', { type: 'application/json' });
      
      Object.defineProperty(fileInput, 'files', {
        value: [file],
        writable: false,
      });

      fireEvent.change(fileInput);

      await waitFor(() => {
        expect(mockSetFlashcardSet).toHaveBeenCalledWith(expect.objectContaining({
          cards: [
            { id: expect.stringMatching(/^imported-\d+-0$/), question: 'Question 1', answer: 'Answer 1' },
            { id: expect.stringMatching(/^imported-\d+-1$/), question: 'Question 2', answer: 'Answer 2' },
          ],
        }));
      });
    });

    test('shows error for invalid JSON format', async () => {
      render(
        <InputForm
          setFlashcardSet={mockSetFlashcardSet}
          setLoading={mockSetLoading}
          setError={mockSetError}
        />,
      );

      const fileInput = document.querySelector('input[type="file"][accept=".json"]') as HTMLInputElement;
      
      const invalidJson = '{ invalid json }';
      const file = new File([invalidJson], 'invalid.json', { type: 'application/json' });
      
      Object.defineProperty(fileInput, 'files', {
        value: [file],
        writable: false,
      });

      fireEvent.change(fileInput);

      await waitFor(() => {
        expect(mockSetError).toHaveBeenCalledWith(expect.stringContaining('Error reading JSON file'));
        expect(mockSetLoading).toHaveBeenCalledWith(false);
      });
    });

    test('shows error for JSON without cards array', async () => {
      render(
        <InputForm
          setFlashcardSet={mockSetFlashcardSet}
          setLoading={mockSetLoading}
          setError={mockSetError}
        />,
      );

      const fileInput = document.querySelector('input[type="file"][accept=".json"]') as HTMLInputElement;
      
      const jsonWithoutCards = JSON.stringify({ title: 'Test' });
      const file = new File([jsonWithoutCards], 'no-cards.json', { type: 'application/json' });
      
      Object.defineProperty(fileInput, 'files', {
        value: [file],
        writable: false,
      });

      fireEvent.change(fileInput);

      await waitFor(() => {
        expect(mockSetError).toHaveBeenCalledWith(
          'Error reading JSON file: Invalid JSON format. Expected structure: { "title": "...", "cards": [...] }'
        );
      });
    });

    test('shows error for cards with missing question or answer', async () => {
      render(
        <InputForm
          setFlashcardSet={mockSetFlashcardSet}
          setLoading={mockSetLoading}
          setError={mockSetError}
        />,
      );

      const fileInput = document.querySelector('input[type="file"][accept=".json"]') as HTMLInputElement;
      
      const jsonWithInvalidCard = JSON.stringify({
        cards: [
          { question: 'Valid question', answer: 'Valid answer' },
          { question: 'Missing answer' }, // Missing answer field
        ],
      });
      
      const file = new File([jsonWithInvalidCard], 'invalid-card.json', { type: 'application/json' });
      
      Object.defineProperty(fileInput, 'files', {
        value: [file],
        writable: false,
      });

      fireEvent.change(fileInput);

      await waitFor(() => {
        expect(mockSetError).toHaveBeenCalledWith(
          expect.stringContaining('Invalid card at index 1. Each card must have \'question\' and \'answer\' fields.')
        );
      });
    });
  });

  describe('Import CSV functionality', () => {
    test('renders import CSV button', () => {
      render(
        <InputForm
          setFlashcardSet={mockSetFlashcardSet}
          setLoading={mockSetLoading}
          setError={mockSetError}
        />,
      );

      expect(screen.getByRole('button', { name: '📊 Import from CSV' })).toBeInTheDocument();
    });

    test('opens file dialog when import CSV button is clicked', () => {
      render(
        <InputForm
          setFlashcardSet={mockSetFlashcardSet}
          setLoading={mockSetLoading}
          setError={mockSetError}
        />,
      );

      const importButton = screen.getByRole('button', { name: '📊 Import from CSV' });
      const fileInput = document.querySelector('input[type="file"][accept=".csv"]') as HTMLInputElement;
      
      // Mock the click method
      const clickSpy = jest.spyOn(fileInput, 'click').mockImplementation(() => {});
      
      fireEvent.click(importButton);
      
      expect(clickSpy).toHaveBeenCalled();
      clickSpy.mockRestore();
    });

    test('processes valid CSV file correctly', async () => {
      render(
        <InputForm
          setFlashcardSet={mockSetFlashcardSet}
          setLoading={mockSetLoading}
          setError={mockSetError}
        />,
      );

      const fileInput = document.querySelector('input[type="file"][accept=".csv"]') as HTMLInputElement;
      
      const validCsvContent = 'question,answer\n"What is React?","A JavaScript library"\n"What is TypeScript?","A typed superset of JavaScript"';
      const file = new File([validCsvContent], 'test-flashcards.csv', { type: 'text/csv' });
      
      Object.defineProperty(fileInput, 'files', {
        value: [file],
        writable: false,
      });

      fireEvent.change(fileInput);

      await waitFor(() => {
        expect(mockSetLoading).toHaveBeenCalledWith(true);
        expect(mockSetFlashcardSet).toHaveBeenCalledWith({
          title: 'test-flashcards',
          source: 'Imported from test-flashcards.csv',
          cards: [
            { id: expect.stringMatching(/^imported-csv-\d+-1$/), question: 'What is React?', answer: 'A JavaScript library' },
            { id: expect.stringMatching(/^imported-csv-\d+-2$/), question: 'What is TypeScript?', answer: 'A typed superset of JavaScript' },
          ],
          createdAt: expect.any(Date),
        });
        expect(mockSetLoading).toHaveBeenCalledWith(false);
      });
    });

    test('handles CSV with different column order', async () => {
      render(
        <InputForm
          setFlashcardSet={mockSetFlashcardSet}
          setLoading={mockSetLoading}
          setError={mockSetError}
        />,
      );

      const fileInput = document.querySelector('input[type="file"][accept=".csv"]') as HTMLInputElement;
      
      const csvWithDifferentOrder = 'answer,question,category\n"A JavaScript library","What is React?","Programming"\n"A typed superset","What is TypeScript?","Programming"';
      const file = new File([csvWithDifferentOrder], 'reordered.csv', { type: 'text/csv' });
      
      Object.defineProperty(fileInput, 'files', {
        value: [file],
        writable: false,
      });

      fireEvent.change(fileInput);

      await waitFor(() => {
        expect(mockSetFlashcardSet).toHaveBeenCalledWith(expect.objectContaining({
          cards: [
            { id: expect.any(String), question: 'What is React?', answer: 'A JavaScript library' },
            { id: expect.any(String), question: 'What is TypeScript?', answer: 'A typed superset' },
          ],
        }));
      });
    });

    test('shows error for CSV without question column', async () => {
      render(
        <InputForm
          setFlashcardSet={mockSetFlashcardSet}
          setLoading={mockSetLoading}
          setError={mockSetError}
        />,
      );

      const fileInput = document.querySelector('input[type="file"][accept=".csv"]') as HTMLInputElement;
      
      const csvWithoutQuestion = 'answer,category\n"An answer","Category"';
      const file = new File([csvWithoutQuestion], 'no-question.csv', { type: 'text/csv' });
      
      Object.defineProperty(fileInput, 'files', {
        value: [file],
        writable: false,
      });

      fireEvent.change(fileInput);

      await waitFor(() => {
        expect(mockSetError).toHaveBeenCalledWith(
          'Error reading CSV file: CSV file must contain columns with "question" and "answer" in their names'
        );
      });
    });

    test('shows error for CSV with only header row', async () => {
      render(
        <InputForm
          setFlashcardSet={mockSetFlashcardSet}
          setLoading={mockSetLoading}
          setError={mockSetError}
        />,
      );

      const fileInput = document.querySelector('input[type="file"][accept=".csv"]') as HTMLInputElement;
      
      const csvHeaderOnly = 'question,answer';
      const file = new File([csvHeaderOnly], 'header-only.csv', { type: 'text/csv' });
      
      Object.defineProperty(fileInput, 'files', {
        value: [file],
        writable: false,
      });

      fireEvent.change(fileInput);

      await waitFor(() => {
        expect(mockSetError).toHaveBeenCalledWith(
          'Error reading CSV file: CSV file must contain at least a header row and one data row'
        );
      });
    });

    test('shows error for CSV with no valid flashcards', async () => {
      render(
        <InputForm
          setFlashcardSet={mockSetFlashcardSet}
          setLoading={mockSetLoading}
          setError={mockSetError}
        />,
      );

      const fileInput = document.querySelector('input[type="file"][accept=".csv"]') as HTMLInputElement;
      
      const csvWithEmptyRows = 'question,answer\n"",""\n" "," "';
      const file = new File([csvWithEmptyRows], 'empty-rows.csv', { type: 'text/csv' });
      
      Object.defineProperty(fileInput, 'files', {
        value: [file],
        writable: false,
      });

      fireEvent.change(fileInput);

      await waitFor(() => {
        expect(mockSetError).toHaveBeenCalledWith(
          'Error reading CSV file: No valid flashcards found in CSV file'
        );
      });
    });

    test('skips empty rows and processes valid ones', async () => {
      render(
        <InputForm
          setFlashcardSet={mockSetFlashcardSet}
          setLoading={mockSetLoading}
          setError={mockSetError}
        />,
      );

      const fileInput = document.querySelector('input[type="file"][accept=".csv"]') as HTMLInputElement;
      
      const csvWithEmptyRows = 'question,answer\n"Valid question","Valid answer"\n"",""\n"Another question","Another answer"';
      const file = new File([csvWithEmptyRows], 'mixed-rows.csv', { type: 'text/csv' });
      
      Object.defineProperty(fileInput, 'files', {
        value: [file],
        writable: false,
      });

      fireEvent.change(fileInput);

      await waitFor(() => {
        expect(mockSetFlashcardSet).toHaveBeenCalledWith(expect.objectContaining({
          cards: [
            { id: expect.any(String), question: 'Valid question', answer: 'Valid answer' },
            { id: expect.any(String), question: 'Another question', answer: 'Another answer' },
          ],
        }));
      });
    });
  });

  describe('File input reset functionality', () => {
    test('resets JSON file input after successful import', async () => {
      render(
        <InputForm
          setFlashcardSet={mockSetFlashcardSet}
          setLoading={mockSetLoading}
          setError={mockSetError}
        />,
      );

      const fileInput = document.querySelector('input[type="file"][accept=".json"]') as HTMLInputElement;
      
      const validJsonContent = JSON.stringify({
        cards: [{ question: 'Q', answer: 'A' }],
      });
      const file = new File([validJsonContent], 'test.json', { type: 'application/json' });
      
      Object.defineProperty(fileInput, 'files', {
        value: [file],
        writable: false,
      });

      fireEvent.change(fileInput);

      await waitFor(() => {
        expect(mockSetFlashcardSet).toHaveBeenCalled();
        expect(fileInput.value).toBe(''); // File input should be reset
      });
    });

    test('resets CSV file input after successful import', async () => {
      render(
        <InputForm
          setFlashcardSet={mockSetFlashcardSet}
          setLoading={mockSetLoading}
          setError={mockSetError}
        />,
      );

      const fileInput = document.querySelector('input[type="file"][accept=".csv"]') as HTMLInputElement;
      
      const validCsvContent = 'question,answer\n"Q","A"';
      const file = new File([validCsvContent], 'test.csv', { type: 'text/csv' });
      
      Object.defineProperty(fileInput, 'files', {
        value: [file],
        writable: false,
      });

      fireEvent.change(fileInput);

      await waitFor(() => {
        expect(mockSetFlashcardSet).toHaveBeenCalled();
        expect(fileInput.value).toBe(''); // File input should be reset
      });
    });
  });
});
