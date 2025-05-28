import React from 'react';

const PAGES = ['preset','persona','interview','analysis','revision'];

export default function Sidebar({ activePage, onChange, apiKey }) {
  return (
    <aside className="aside-left">
      <div id="aside-bar">
        <p className="logo-text">MIX.AI</p>
        <nav id="nav-bar">
          {PAGES.map(p => (
            <div
              key={p}
              className={`btn-${p} ${activePage===p?'nav-active':''}`}
              onClick={()=>onChange(p)}
            >
              <div className="nav-img">
                <img src={`./img/${p}.svg`} alt={p}/>
              </div>
              <p className="nav-text">
                {p.charAt(0).toUpperCase()+p.slice(1)}
              </p>
            </div>
          ))}
        </nav>
        <button id="changeApiKey" onClick={()=>{ localStorage.removeItem('openai_api_key'); window.location.reload(); }}>
          API 키 변경
        </button>
      </div>
    </aside>
  );
}
