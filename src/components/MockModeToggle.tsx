import React, { useState, useEffect } from 'react';
import '../styles/MockModeToggle.css';

interface MockModeToggleProps {
  onChange: (useMock: boolean) => void;
}

export const MockModeToggle: React.FC<MockModeToggleProps> = ({ onChange }) => {
  const [useMock, setUseMock] = useState<boolean>(true);

  useEffect(() => {
    const savedSetting = localStorage.getItem('use_mock_mode');
    if (savedSetting) {
      setUseMock(savedSetting === 'true');
    }
  }, []);

  const handleToggle = (): void => {
    const newValue = !useMock;
    setUseMock(newValue);
    localStorage.setItem('use_mock_mode', String(newValue));
    onChange(newValue);
  };

  return (
    <div className="mock-mode-toggle">
      <label className="toggle-switch">
        <input
          type="checkbox"
          checked={useMock}
          onChange={handleToggle}
        />
        <span className="toggle-slider" />
      </label>
      <span className="toggle-label">
        {useMock ? '🚀 Fast Mock Mode' : '🤖 Real LLM Mode'}
      </span>
      <div className="toggle-tooltip">
        {useMock
          ? 'Using mock responses (fast, no API calls)'
          : 'Using real AI calls (will be slower)'}
      </div>
    </div>
  );
};
