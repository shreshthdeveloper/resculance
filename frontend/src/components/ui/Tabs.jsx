import React from 'react';

export const Tabs = ({ tabs = [], activeKey, onChange, className = '' }) => {
  return (
    <div className={`flex items-center gap-3 ${className}`}>
      {tabs.map(tab => (
        <button
          key={tab.key || tab.id}
          onClick={() => onChange(tab.key || tab.id)}
          className={`px-4 py-2 rounded-lg text-sm font-medium ${activeKey === (tab.key || tab.id) ? 'bg-primary text-white' : 'bg-background dark:bg-gray-800 border border-border text-text'}`}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
};

export default Tabs;
