import React from 'react';
import { Power, Lightbulb, Volume2, Wind, Heart, Camera } from 'lucide-react';

export default function ControlsFooterBar({ controls, onToggleControl }) {
  const items = [
    { key: 'mainPower', icon: Power, label: 'Main Power' },
    { key: 'emergencyLights', icon: Lightbulb, label: 'Emergency' },
    { key: 'siren', icon: Volume2, label: 'Siren' },
    { key: 'airConditioning', icon: Wind, label: 'Air Con' },
    { key: 'oxygenSupply', icon: Heart, label: 'Oxygen' },
    { key: 'cabinCamera', icon: Camera, label: 'Camera' },
  ];

  return (
    <div className="bg-background-card border border-border rounded-full px-3 py-2 shadow-md">
      <div className="flex items-center justify-between gap-3">
        {items.map(({ key, icon: Icon, label }) => {
          const active = controls?.[key];
          return (
            <button
              key={key}
              onClick={() => onToggleControl(key)}
              className={`flex items-center gap-2 px-4 py-2 rounded-full transition text-sm font-medium ${
                active
                  ? 'bg-primary text-white shadow'
                  : 'bg-white dark:bg-slate-800 text-text border border-border hover:bg-gray-50'
              }`}
              title={label}
            >
              <Icon className="w-4 h-4" />
              <span className="hidden sm:inline">{label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
