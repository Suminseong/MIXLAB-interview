import React, { useState } from 'react';
import Sidebar from './components/Sidebar';
import QuestionsPage from './components/QuestionsPage';
import './styles/main.css';

export default function App() {
  const [page, setPage] = useState('preset');
  const apiKey = localStorage.getItem('openai_api_key') || '';

  return (
    <div className="base-container">
      <Sidebar activePage={page} onChange={setPage} apiKey={apiKey} />
      {page === 'preset' && <QuestionsPage apiKey={apiKey} onNext={() => setPage('persona')} />}
      {/* 이후 PersonaPage, InterviewPage 등 */}
    </div>
  );
}
