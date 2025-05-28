import React, { useState } from 'react';
import QuestionsList from './QuestionsList';
import RightSideTools from './RightSideTools';
import LoadingOverlay from './LoadingOverlay';
import ArrowToggle from './ArrowToggle';
import '../styles/QuestionsPage.css';

export default function QuestionsPage({ apiKey, onNext }) {
  const [topic, setTopic] = useState('');
  const [purpose, setPurpose] = useState('');
  const [count, setCount] = useState(8);
  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  const generate = async () => {
    if (!apiKey) return alert('API 키를 입력해주세요.');
    if (!topic || !purpose) return alert('주제와 목적을 모두 입력해주세요.');
    setLoading(true);
    try {
      const payload = {
        model: 'gpt-4o-mini',
        messages: [{
          role: 'system',
          content: [
            { text: `${topic}를 주제로, 목적은 ${purpose}입니다. 질문 ${count}개 생성해주세요.`, type: 'text' }
          ]
        }],
        response_format: { type: 'text' },
        temperature: 0.75,
        max_completion_tokens: 2048
      };
      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method:'POST',
        headers:{
          'Content-Type':'application/json',
          Authorization:`Bearer ${apiKey}`
        },
        body:JSON.stringify(payload)
      });
      const data = await res.json();
      const qs = JSON.parse(data.choices[0].message.content);
      setQuestions(qs);
    } catch(e) {
      console.error(e);
      alert('질문 생성에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {loading && <LoadingOverlay />}
      <div className="page-layout">
        <section className="workspace">
          <h2>인터뷰 질문지</h2>
          <QuestionsList
            questions={questions}
            onAdd={()=> setQuestions([...questions, ''])}
            onRemove={()=> setQuestions(questions.slice(0,-1))}
            onChange={(i,text)=>{
              const arr = [...questions];
              arr[i]=text;
              setQuestions(arr);
            }}
          />
          <button className="next-btn" onClick={onNext} disabled={questions.length===0}>
            다음
          </button>
        </section>

        <ArrowToggle collapsed={collapsed} onToggle={()=>setCollapsed(!collapsed)} />

        {!collapsed &&
          <RightSideTools
            topic={topic} onTopicChange={setTopic}
            purpose={purpose} onPurposeChange={setPurpose}
            count={count} onCountChange={setCount}
            onGenerate={generate}
          />
        }
      </div>
    </>
  );
}
