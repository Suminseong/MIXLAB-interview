import React from 'react';

export default function Counter({ label, value, min, max, onChange }) {
  return (
    <div className="counter-section">
      <span>{label}</span>
      <div className="counter">
        <button onClick={()=>onChange(Math.max(min, value-1))}>−</button>
        <span>{value}</span>
        <button onClick={()=>onChange(Math.min(max, value+1))}>＋</button>
      </div>
    </div>
  );
}
