import React from 'react';
import Counter from './Counter';

export default function RightSideTools({
  topic,onTopicChange,
  purpose,onPurposeChange,
  count,onCountChange,
  onGenerate
}) {
  return (
    <aside className="right-tools">
      <div className="side-box">
        <label>인터뷰 주제</label>
        <input
          type="text"
          placeholder="인터뷰 주제를 입력하세요."
          value={topic}
          onChange={e=>onTopicChange(e.target.value)}
        />
      </div>
      <div className="side-box">
        <label>인터뷰 목적</label>
        <input
          type="text"
          placeholder="ex) 서비스 피드백, 사용자 요구사항 조사"
          value={purpose}
          onChange={e=>onPurposeChange(e.target.value)}
        />
      </div>
      <div className="side-box">
        <Counter
          label="질문 생성 개수"
          value={count}
          min={4}
          max={16}
          onChange={onCountChange}
        />
        <button className="create-btn-style" onClick={onGenerate}>
          인터뷰 질문지 생성
        </button>
      </div>
    </aside>
  );
}
