'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useAnalytics } from '@/hooks/useAnalytics';

/**
 * States listing page
 * Shows all U.S. states with their park counts
 */
export default function StatesPage() {
  const [states, setStates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState('all'); // 'all' or 'withParks'

  useAnalytics();

  useEffect(() => {
    const fetchStates = async () => {
      try {
        setLoading(true);
        const params = new URLSearchParams();
        if (filter === 'withParks') {
          params.set('withParks', 'true');
        }

        const response = await fetch(`/api/states?${params.toString()}`);
        if (!response.ok) {
          throw new Error('Failed to fetch states');
        }

        const data = await response.json();
        setStates(data.states);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchStates();
  }, [filter]);

  // Group states by region
  const regions = {
    Northeast: ['CT', 'DE', 'ME', 'MD', 'MA', 'NH', 'NJ', 'NY', 'PA', 'RI', 'VT'],
    Southeast: ['AL', 'AR', 'FL', 'GA', 'KY', 'LA', 'MS', 'NC', 'SC', 'TN', 'VA', 'WV'],
    Midwest: ['IL', 'IN', 'IA', 'KS', 'MI', 'MN', 'MO', 'NE', 'ND', 'OH', 'SD', 'WI'],
    Southwest: ['AZ', 'NM', 'OK', 'TX'],
    West: ['AK', 'CA', 'CO', 'HI', 'ID', 'MT', 'NV', 'OR', 'UT', 'WA', 'WY'],
    Territories: ['DC', 'PR', 'VI', 'GU', 'AS', 'MP'],
  };

  const getStatesByRegion = (regionCodes) => states.filter((state) => regionCodes.includes(state.code));

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="animate-pulse">
            <div className="h-8 bg-gray-200 rounded w-1/4 mb-8"></div>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {[...Array(12)].map((_, i) => (
                <div key={i} className="h-24 bg-gray-200 rounded-lg"></div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Error Loading States</h2>
          <p className="text-gray-600 mb-4">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Explore Parks by State</h1>
          <p className="text-gray-600">
            Discover national parks, monuments, and historic sites across the United States.
          </p>
        </div>

        {/* Filter */}
        <div className="mb-6 flex gap-2">
          <button
            onClick={() => setFilter('all')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              filter === 'all'
                ? 'bg-green-600 text-white'
                : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
            }`}
          >
            All States
          </button>
          <button
            onClick={() => setFilter('withParks')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              filter === 'withParks'
                ? 'bg-green-600 text-white'
                : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
            }`}
          >
            States with Parks
          </button>
        </div>

        {/* Stats */}
        <div className="mb-8 grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-lg p-4 shadow-sm">
            <div className="text-2xl font-bold text-green-600">{states.length}</div>
            <div className="text-sm text-gray-600">States & Territories</div>
          </div>
          <div className="bg-white rounded-lg p-4 shadow-sm">
            <div className="text-2xl font-bold text-green-600">
              {states.filter((s) => s.park_count > 0).length}
            </div>
            <div className="text-sm text-gray-600">With National Parks</div>
          </div>
          <div className="bg-white rounded-lg p-4 shadow-sm">
            <div className="text-2xl font-bold text-green-600">
              {states.reduce((sum, s) => sum + (s.park_count || 0), 0)}
            </div>
            <div className="text-sm text-gray-600">Total Park Sites</div>
          </div>
          <div className="bg-white rounded-lg p-4 shadow-sm">
            <div className="text-2xl font-bold text-green-600">
              {Math.max(...states.map((s) => s.park_count || 0))}
            </div>
            <div className="text-sm text-gray-600">Most Parks in One State</div>
          </div>
        </div>

        {/* States by Region */}
        {Object.entries(regions).map(([region, codes]) => {
          const regionStates = getStatesByRegion(codes);
          if (regionStates.length === 0) {return null;}

          return (
            <div key={region} className="mb-8">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">{region}</h2>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                {regionStates.map((state) => (
                  <Link
                    key={state.id}
                    href={`/states/${state.slug}`}
                    className="bg-white rounded-lg p-4 shadow-sm hover:shadow-md transition-shadow border border-gray-100"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-lg font-semibold text-gray-900">{state.code}</span>
                      {state.park_count > 0 && (
                        <span className="bg-green-100 text-green-800 text-xs font-medium px-2 py-0.5 rounded-full">
                          {state.park_count} parks
                        </span>
                      )}
                    </div>
                    <div className="text-sm text-gray-600 truncate">{state.name}</div>
                  </Link>
                ))}
              </div>
            </div>
          );
        })}

        {/* All States Alphabetically (alternative view) */}
        <div className="mt-12">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">All States (A-Z)</h2>
          <div className="bg-white rounded-lg shadow-sm overflow-hidden">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-gray-100">
              {['A-I', 'J-N', 'O-Z'].map((range, idx) => {
                const [start, end] = range.split('-');
                const filteredStates = states.filter((s) => {
                  const firstLetter = s.name[0].toUpperCase();
                  return firstLetter >= start && firstLetter <= end;
                });

                return (
                  <div key={range} className="p-4">
                    <h3 className="text-sm font-medium text-gray-500 mb-3">{range}</h3>
                    <ul className="space-y-2">
                      {filteredStates.map((state) => (
                        <li key={state.id}>
                          <Link
                            href={`/states/${state.slug}`}
                            className="flex items-center justify-between text-sm hover:text-green-600"
                          >
                            <span>{state.name}</span>
                            {state.park_count > 0 && (
                              <span className="text-gray-400">{state.park_count}</span>
                            )}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}