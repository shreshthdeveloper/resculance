import React from 'react';
import ReactSelect from 'react-select';
import { useTheme } from '../../contexts/ThemeContext';

const Select = (props) => {
  const { isDark } = useTheme();

  const defaultStyles = {
    menuPortal: (base) => ({ ...base, zIndex: 30000 }),
    menu: (base) => ({ ...base, boxShadow: isDark ? '0 8px 20px rgba(2,6,23,0.6)' : '0 10px 30px rgba(2,6,23,0.08)', borderRadius: 12, background: isDark ? '#0b1220' : '#ffffff' }),
    control: (base, state) => ({
      ...base,
      minHeight: 44,
      borderRadius: 10,
      background: isDark ? '#071022' : '#ffffff',
      borderColor: state.isFocused ? (isDark ? '#0ea5a3' : '#34d399') : (isDark ? '#1f2937' : '#e6eef9'),
      boxShadow: 'none',
      paddingLeft: 6,
      color: isDark ? '#e6eef9' : '#0f172a'
    }),
    option: (base, state) => ({
      ...base,
      padding: '10px 12px',
      background: state.isFocused ? (isDark ? '#06242e' : '#f0fdfa') : state.isSelected ? (isDark ? 'rgba(14,165,140,0.08)' : 'rgba(20,184,166,0.06)') : (isDark ? '#071022' : '#ffffff'),
      color: state.isFocused ? (isDark ? '#e6eef9' : '#0f172a') : state.isSelected ? (isDark ? '#14b8a6' : '#0f766e') : (isDark ? '#e6eef9' : '#0f172a'),
    }),
    singleValue: (base) => ({ ...base, color: isDark ? '#e6eef9' : '#0f172a' }),
    menuList: (base) => ({ ...base, background: isDark ? '#071022' : '#ffffff' }),
    placeholder: (base) => ({ ...base, color: isDark ? '#6b7280' : '#9ca3af' }),
    input: (base) => ({ ...base, color: isDark ? '#e6eef9' : '#0f172a' })
  };

  // Merge custom styles properly: custom styles should not override theme-aware defaults
  const mergedStyles = Object.keys(defaultStyles).reduce((acc, key) => {
    acc[key] = (base, state) => {
      const defaultStyle = defaultStyles[key](base, state);
      const customStyle = props.styles?.[key]?.(base, state) || {};
      return { ...defaultStyle, ...customStyle };
    };
    return acc;
  }, {});

  return (
    <ReactSelect
      {...props}
      isSearchable={props.isSearchable !== false}
      menuPortalTarget={typeof document !== 'undefined' ? document.body : null}
      menuPosition="fixed"
      classNamePrefix={props.classNamePrefix || 'react-select'}
      styles={mergedStyles}
    />
  );
};

export default Select;
