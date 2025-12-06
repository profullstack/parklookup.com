/**
 * Input Component
 * Reusable form input
 */

'use client';

import { forwardRef } from 'react';

const Input = forwardRef(function Input(
  { label, error, type = 'text', className = '', id, ...props },
  ref
) {
  const inputId = id || `input-${Math.random().toString(36).substr(2, 9)}`;

  return (
    <div className="w-full">
      {label && (
        <label htmlFor={inputId} className="block text-sm font-medium text-gray-700 mb-1">
          {label}
        </label>
      )}
      <input
        ref={ref}
        id={inputId}
        type={type}
        className={`
          w-full px-4 py-2
          border border-gray-300 rounded-lg
          focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent
          placeholder-gray-400
          disabled:bg-gray-100 disabled:cursor-not-allowed
          ${error ? 'border-red-500 focus:ring-red-500' : ''}
          ${className}
        `}
        {...props}
      />
      {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
    </div>
  );
});

export default Input;