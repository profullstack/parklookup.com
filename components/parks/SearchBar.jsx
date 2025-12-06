/**
 * SearchBar Component
 * Search input for parks
 */

'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { debounce } from '@/lib/utils/debounce';

export function SearchBar({ initialQuery = '', onSearch, placeholder = 'Search parks...' }) {
  const [query, setQuery] = useState(initialQuery);
  const router = useRouter();

  const debouncedSearch = useCallback(
    debounce((searchQuery) => {
      if (onSearch) {
        onSearch(searchQuery);
      } else {
        router.push(`/parks?q=${encodeURIComponent(searchQuery)}`);
      }
    }, 300),
    [onSearch, router]
  );

  const handleChange = (e) => {
    const value = e.target.value;
    setQuery(value);
    if (value.length >= 2 || value.length === 0) {
      debouncedSearch(value);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (onSearch) {
      onSearch(query);
    } else {
      router.push(`/parks?q=${encodeURIComponent(query)}`);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="w-full">
      <div className="relative">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <svg
            className="h-5 w-5 text-gray-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
        </div>
        <input
          type="text"
          value={query}
          onChange={handleChange}
          placeholder={placeholder}
          className="
            w-full pl-10 pr-4 py-3
            border border-gray-300 rounded-xl
            focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent
            placeholder-gray-400
            text-lg
          "
        />
        {query && (
          <button
            type="button"
            onClick={() => {
              setQuery('');
              if (onSearch) onSearch('');
            }}
            className="absolute inset-y-0 right-0 pr-3 flex items-center"
          >
            <svg className="h-5 w-5 text-gray-400 hover:text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>
    </form>
  );
}

export default SearchBar;