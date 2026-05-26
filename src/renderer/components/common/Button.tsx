/** Button 组件 — 仅使用 CSS Token 变量 */
import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
}

const sizeStyles: Record<string, React.CSSProperties> = {
  sm: { height: 'var(--btn-height-sm)', padding: '0 var(--btn-padding-x-sm)', fontSize: 'var(--btn-font-size-sm)' },
  md: { height: 'var(--btn-height-md)', padding: '0 var(--btn-padding-x-md)', fontSize: 'var(--btn-font-size-md)' },
  lg: { height: 'var(--btn-height-lg)', padding: '0 var(--btn-padding-x-lg)', fontSize: 'var(--btn-font-size-lg)' },
};

const variantStyles: Record<string, React.CSSProperties> = {
  primary: {
    background: 'var(--accent-gradient)',
    color: 'var(--text-on-accent)',
    border: 'none',
  },
  secondary: {
    background: 'var(--bg-elevated)',
    color: 'var(--text-primary)',
    border: '1px solid var(--border-default)',
  },
  danger: {
    background: 'var(--status-error)',
    color: 'var(--text-on-accent)',
    border: 'none',
  },
  ghost: {
    background: 'transparent',
    color: 'var(--text-secondary)',
    border: 'none',
  },
};

export const Button: React.FC<ButtonProps> = ({
  variant = 'primary', size = 'md', style, children, ...rest
}) => {
  return (
    <button
      style={{
        borderRadius: 'var(--radius-md)',
        fontWeight: 'var(--font-medium)',
        cursor: 'pointer',
        transition: 'var(--btn-transition)',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 'var(--space-2)',
        ...sizeStyles[size],
        ...variantStyles[variant],
        opacity: rest.disabled ? 0.5 : 1,
        ...style,
      }}
      {...rest}
    >
      {children}
    </button>
  );
};
