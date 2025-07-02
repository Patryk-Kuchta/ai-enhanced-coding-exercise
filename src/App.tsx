import React, { useState } from 'react';
import { FlashcardSet, InputType } from './types';
import InputForm from './components/InputForm';
import FlashcardViewer from './components/FlashcardViewer';
import './App.css';

const App: React.FC = () => {
  const [flashcardSet, setFlashcardSet] = useState<FlashcardSet | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="app-container">
      <header>
        <h1>Flashcard Extractor</h1>
        <p>Extract flashcards from Wikipedia articles or text</p>
      </header>

      <main>
        {!flashcardSet ? (
          <InputForm 
            setFlashcardSet={setFlashcardSet} 
            setLoading={setLoading} 
            setError={setError} 
          />
        ) : (
          <FlashcardViewer 
            flashcardSet={flashcardSet} 
            onReset={() => setFlashcardSet(null)} 
          />
        )}

        {loading && <div className="loader">Generating flashcards...</div>}
        {error && <div className="error">{error}</div>}
      </main>

      <footer>
        <p>© {new Date().getFullYear()} Flashcard Extractor</p>
      </footer>
    </div>
  );
};

export default App;
