import React from 'react';

export default function ArrowToggle({ collapsed, onToggle }) {
  return (
    <button className="arrow-toggle" onClick={onToggle}>
      {collapsed ? '«' : '»'}
    </button>
  );
}
