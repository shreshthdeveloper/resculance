import { Activity, Heart, Droplet, Thermometer } from 'lucide-react';
import { Card } from '../ui/Card';

export default function NewVitalsCard({ vitals }) {
  const vitalStats = [
    {
      label: 'Heart Rate',
      value: vitals?.heartRate || '--',
      unit: 'bpm',
      icon: Heart,
      color: 'text-red-500',
      bgColor: 'bg-red-50 dark:bg-red-900/20',
    },
    {
      label: 'Blood Pressure',
      value: vitals?.bloodPressure || '--',
      unit: 'mmHg',
      icon: Activity,
      color: 'text-blue-500',
      bgColor: 'bg-blue-50 dark:bg-blue-900/20',
    },
    {
      label: 'SpO2',
      value: vitals?.spo2 || '--',
      unit: '%',
      icon: Droplet,
      color: 'text-cyan-500',
      bgColor: 'bg-cyan-50 dark:bg-cyan-900/20',
    },
    {
      label: 'Temperature',
      value: vitals?.temp || '--',
      unit: '°C',
      icon: Thermometer,
      color: 'text-orange-500',
      bgColor: 'bg-orange-50 dark:bg-orange-900/20',
    },
  ];

  return (
    <Card className="p-3 h-full flex flex-col overflow-hidden">
      <h3 className="text-sm font-semibold text-text mb-3 flex items-center gap-2">
        <Activity className="w-4 h-4" /> Patient Vitals
      </h3>

      <div className="grid grid-cols-2 gap-3 flex-1">
        {vitalStats.map((vital) => {
          const Icon = vital.icon;
          return (
            <div
              key={vital.label}
              className={`${vital.bgColor} rounded-lg p-3 flex flex-col justify-between`}
            >
              <div className="flex items-center justify-between mb-2">
                <Icon className={`w-5 h-5 ${vital.color}`} />
                <span className="text-xs font-medium text-text-secondary">
                  {vital.label}
                </span>
              </div>
              <div className="flex items-baseline gap-1">
                <span className="text-2xl font-bold text-text">
                  {vital.value}
                </span>
                <span className="text-xs font-medium text-text-secondary">
                  {vital.unit}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
