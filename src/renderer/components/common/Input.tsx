/** Input 组件 */
import React from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
}

export const Input: React.FC<InputProps> = ({ label, style, ...rest }) => {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-1)' }}>
      {label && (
        <label
          style={{
            fontSize: 'var(--text-sm)',
            color: 'var(--text-secondary)',
            fontWeight: 'var(--font-medium)',
          }}
        >
          {label}
        </label>
      )}
      <input
        style={{
          height: 'var(--input-height)',
          padding: '0 var(--input-padding-x)',
          background: 'var(--bg-input)',
          border: '1px solid var(--border-default)',
          borderRadius: 'var(--radius-md)',
          color: 'var(--text-primary)',
          fontSize: 'var(--text-base)',
          outline: 'none',
          transition: 'var(--input-transition)',
          ...style,
        }}
        {...rest}
      />
    </div>
  );
};
