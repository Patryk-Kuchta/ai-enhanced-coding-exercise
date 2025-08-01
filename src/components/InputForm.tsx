import React, { useState, useEffect, useRef } from 'react';

import { getLLMConfig } from '../config';
import { extractFlashcards } from '../services/llmService';
import { fetchWikipediaContent } from '../services/wikipediaService';
import { FlashcardSet, Flashcard } from '../types';

import { MockModeToggle } from './MockModeToggle';
import '../styles/InputForm.css';

interface InputFormProps {
  setFlashcardSet: React.Dispatch<React.SetStateAction<FlashcardSet | null>>;
  setLoading: React.Dispatch<React.SetStateAction<boolean>>;
  setError: React.Dispatch<React.SetStateAction<string | null>>;
}

const InputForm: React.FC<InputFormProps> = ({ setFlashcardSet, setLoading, setError }) => {
  const [isUrlInput, setIsUrlInput] = useState(true);
  const [input, setInput] = useState('');
  const [useMockMode, setUseMockMode] = useState(false);
  const jsonFileInputRef = useRef<HTMLInputElement>(null);
  const csvFileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const savedSetting = localStorage.getItem('use_mock_mode');
    if (savedSetting !== null && savedSetting !== '') {
      setUseMockMode(savedSetting === 'true');
    }
  }, []);

  const isValidWikipediaUrl = (url: string): boolean => {
    try {
      const parsedUrl = new URL(url);
      return (
        parsedUrl.hostname === 'en.wikipedia.org'
        || parsedUrl.hostname === 'wikipedia.org'
      );
    } catch (error) {
      return false;
    }
  };

  const extractTitleFromUrl = (url: string): string => {
    try {
      const parsedUrl = new URL(url);
      const pathParts = parsedUrl.pathname.split('/');
      const title = pathParts[pathParts.length - 1];
      return title.replace(/_/g, ' ');
    } catch (error) {
      return 'Wikipedia Article';
    }
  };
  const handleSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    setError(null);

    if (!input.trim()) {
      setError('Please enter a Wikipedia URL or text');
      return;
    }

    const config = getLLMConfig();

    if (config.defaultApiKey === undefined || config.defaultApiKey === '' || config.defaultApiKey.trim() === '') {
      setError('Please set your API key in LLM Settings');
      return;
    }

    setLoading(true);

    try {
      let content = input;
      let source = 'Custom text';

      if (isUrlInput) {
        if (!isValidWikipediaUrl(input)) {
          setError('Please enter a valid Wikipedia URL');
          setLoading(false);
          return;
        }

        const wikiContent = await fetchWikipediaContent(input);
        content = wikiContent.content;
        source = input;
      }

      const flashcards = await extractFlashcards(content, undefined, useMockMode);

      setFlashcardSet({
        title: isUrlInput ? extractTitleFromUrl(input) : 'Custom Text Flashcards',
        source,
        cards: flashcards,
        createdAt: new Date(),
      });
    } catch (error) {
      setError(`Error: ${error instanceof Error ? error.message : 'Unknown error occurred'}`);
    } finally {
      setLoading(false);
    }
  };

  const handleJsonImport = (): void => {
    jsonFileInputRef.current?.click();
  };

  const handleCsvImport = (): void => {
    csvFileInputRef.current?.click();
  };

  const handleJsonFileChange = (event: React.ChangeEvent<HTMLInputElement>): void => {
    const file = event.target.files?.[0];
    if (file === undefined) return;

    setError(null);
    setLoading(true);

    const reader = new FileReader();
    reader.onload = (e): void => {
      try {
        const result = e.target?.result;
        if (typeof result !== 'string') {
          throw new Error('Failed to read file content');
        }

        const jsonData = JSON.parse(result) as unknown;
        
        // Validate JSON structure
        if (typeof jsonData !== 'object' || jsonData === null || !('cards' in jsonData) || !Array.isArray((jsonData as { cards: unknown }).cards)) {
          throw new Error('Invalid JSON format. Expected structure: { "title": "...", "cards": [...] }');
        }

        const data = jsonData as { title?: string; cards: unknown[] };
        
        // Validate each card
        const validCards: Flashcard[] = data.cards.map((card: unknown, index: number) => {
          if (typeof card !== 'object' || card === null || !('question' in card) || !('answer' in card)) {
            throw new Error(`Invalid card at index ${index}. Each card must have 'question' and 'answer' fields.`);
          }
          
          const cardObj = card as { question: unknown; answer: unknown; id?: unknown };
          
          if (typeof cardObj.question !== 'string' || typeof cardObj.answer !== 'string') {
            throw new Error(`Invalid card at index ${index}. Question and answer must be strings.`);
          }
          
          return {
            id: typeof cardObj.id === 'string' ? cardObj.id : `imported-${Date.now()}-${index}`,
            question: cardObj.question,
            answer: cardObj.answer,
          };
        });

        const flashcardSet: FlashcardSet = {
          title: typeof data.title === 'string' ? data.title : file.name.replace('.json', ''),
          source: `Imported from ${file.name}`,
          cards: validCards,
          createdAt: new Date(),
        };

        setFlashcardSet(flashcardSet);
      } catch (error) {
        setError(`Error reading JSON file: ${error instanceof Error ? error.message : 'Invalid JSON format'}`);
      } finally {
        setLoading(false);
        // Reset file input
        if (jsonFileInputRef.current !== null) {
          jsonFileInputRef.current.value = '';
        }
      }
    };

    reader.onerror = (): void => {
      setError('Error reading file');
      setLoading(false);
    };

    reader.readAsText(file);
  };

  const handleCsvFileChange = (event: React.ChangeEvent<HTMLInputElement>): void => {
    const file = event.target.files?.[0];
    if (file === undefined) return;

    setError(null);
    setLoading(true);

    const reader = new FileReader();
    reader.onload = (e): void => {
      try {
        const result = e.target?.result;
        if (typeof result !== 'string') {
          throw new Error('Failed to read file content');
        }

        const csvContent = result;
        const lines = csvContent.split('\n').filter((line) => line.trim() !== '');
        
        if (lines.length < 2) {
          throw new Error('CSV file must contain at least a header row and one data row');
        }

        const headers = lines[0].split(',').map((h) => h.trim().toLowerCase());
        const questionIndex = headers.findIndex((h) => h.includes('question'));
        const answerIndex = headers.findIndex((h) => h.includes('answer'));

        if (questionIndex === -1 || answerIndex === -1) {
          throw new Error('CSV file must contain columns with "question" and "answer" in their names');
        }

        const cards: Flashcard[] = [];
        for (let i = 1; i < lines.length; i += 1) {
          const columns = lines[i].split(',').map((col) => col.trim().replace(/^"|"$/g, ''));
          
          if (columns.length > questionIndex && columns.length > answerIndex) {
            const question = columns[questionIndex]?.trim();
            const answer = columns[answerIndex]?.trim();
            
            if (question !== undefined && answer !== undefined && question !== '' && answer !== '') {
              cards.push({
                id: `imported-csv-${Date.now()}-${i}`,
                question,
                answer,
              });
            }
          }
        }

        if (cards.length === 0) {
          throw new Error('No valid flashcards found in CSV file');
        }

        const flashcardSet: FlashcardSet = {
          title: file.name.replace('.csv', ''),
          source: `Imported from ${file.name}`,
          cards,
          createdAt: new Date(),
        };

        setFlashcardSet(flashcardSet);
      } catch (error) {
        setError(`Error reading CSV file: ${error instanceof Error ? error.message : 'Invalid CSV format'}`);
      } finally {
        setLoading(false);
        // Reset file input
        if (csvFileInputRef.current !== null) {
          csvFileInputRef.current.value = '';
        }
      }
    };

    reader.onerror = (): void => {
      setError('Error reading file');
      setLoading(false);
    };

    reader.readAsText(file);
  };

  return (
    <div className="input-form-container">
      <form
        onSubmit={(e): void => {
          handleSubmit(e).catch((_) => { /* Error handled in handleSubmit */ });
        }}
      >
        <div className="input-type-selector">
          <button
            type="button"
            className={isUrlInput === true ? 'active' : ''}
            onClick={(): void => setIsUrlInput(true)}
          >
            Wikipedia URL
          </button>
          <button
            type="button"
            className={isUrlInput === false ? 'active' : ''}
            onClick={(): void => setIsUrlInput(false)}
          >
            Custom Text
          </button>
        </div>

        <div className="form-group">
          <label htmlFor="input">
            {isUrlInput ? 'Wikipedia URL' : 'Text to extract flashcards from'}
          </label>
          <textarea
            id="input"
            value={input}
            onChange={(e): void => setInput(e.target.value)}
            placeholder={
              isUrlInput
                ? 'https://en.wikipedia.org/wiki/Artificial_intelligence'
                : 'Paste your text here...'
            }
            rows={isUrlInput ? 1 : 10}
          />
        </div>

        <MockModeToggle onChange={setUseMockMode} />

        <button className="submit-button" type="submit">Generate Flashcards</button>
      </form>

      <div className="import-section">
        <div className="divider">
          <span>OR</span>
        </div>
        
        <div className="import-buttons">
          <button 
            type="button" 
            className="import-button import-json" 
            onClick={handleJsonImport}
          >
            📄 Import from JSON
          </button>
          <button 
            type="button" 
            className="import-button import-csv" 
            onClick={handleCsvImport}
          >
            📊 Import from CSV
          </button>
        </div>
        
        {/* Hidden file inputs */}
        <input
          ref={jsonFileInputRef}
          type="file"
          accept=".json"
          onChange={handleJsonFileChange}
          style={{ display: 'none' }}
        />
        <input
          ref={csvFileInputRef}
          type="file"
          accept=".csv"
          onChange={handleCsvFileChange}
          style={{ display: 'none' }}
        />
      </div>
    </div>
  );
};

export default InputForm;
