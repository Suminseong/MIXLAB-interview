import React from 'react';

export default function QuestionsList({ questions, onAdd, onRemove, onChange }) {
  if (questions.length===0) {
    return <p className="placeholder">질문지를 생성해 주세요 :D</p>;
  }
  return (
    <div className="question-list">
      {questions.map((q,i)=>(
        <div key={i} className="question-item">
          <span className="index">{i+1}.</span>
          <input
            type="text"
            value={q}
            onChange={e=>onChange(i,e.target.value)}
            placeholder={`질문 ${i+1}`}
          />
        </div>
      ))}
      <div className="question-controls">
        <button onClick={onAdd}>＋</button>
        <button onClick={onRemove} disabled={questions.length===0}>－</button>
      </div>
    </div>
  );
}
