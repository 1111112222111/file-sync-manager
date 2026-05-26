/** ProgressBar 组件 */
import React from 'react';

interface ProgressBarProps {
  percent: number;
  height?: string;
  color?: string;
}

export const ProgressBar: React.FC<ProgressBarProps> = ({
  percent, height, color,
}) => {
  const clamped = Math.max(0, Math.min(100, percent));

  return (
    <div
      style={{
        width: '100%',
        height: height ?? 'var(--progress-height)',
        background: 'var(--bg-hover)',
        borderRadius: 'var(--radius-full)',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          width: `${clamped}%`,
          height: '100%',
          background: color ?? 'var(--accent-gradient)',
          borderRadius: 'var(--radius-full)',
          transition: `width var(--duration-normal) var(--ease-default)`,
        }}
      />
    </div>
  );
};
