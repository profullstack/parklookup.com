'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

/**
 * StatesList component
 * Displays a list of states with park counts and a "more..." link
 */
export function StatesList({ limit = 10, showTitle = true }) {
  const [states, setStates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchStates = async () => {
      try {
        setLoading(true);
        const response = await fetch(`/api/states?withParks=true&limit=${limit + 5}`);
        if (!response.ok) {
          throw new Error('Failed to fetch states');
        }

        const data = await response.json();
        // Sort by park count descending and take top states
        const sortedStates = data.states
          .sort((a, b) => (b.park_count || 0) - (a.park_count || 0))
          .slice(0, limit);
        setStates(sortedStates);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchStates();
  }, [limit]);

  if (loading) {
    return (
      <div className="animate-pulse">
        {showTitle && <div className="h-6 bg-gray-200 rounded w-1/4 mb-4"></div>}
        <div className="flex flex-wrap gap-2">
          {[...Array(limit)].map((_, i) => (
            <div key={i} className="h-8 w-24 bg-gray-200 rounded-full"></div>
          ))}
        </div>
      </div>
    );
  }

  if (error || states.length === 0) {
    return null;
  }

  return (
    <div>
      {showTitle && (
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-gray-900">Explore by State</h2>
          <Link href="/states" className="text-green-600 hover:text-green-700 text-sm font-medium">
            View all states →
          </Link>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {states.map((state) => (
          <Link
            key={state.id}
            href={`/states/${state.slug}`}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-gray-200 rounded-full text-sm hover:border-green-500 hover:bg-green-50 transition-colors"
          >
            <span className="font-medium text-gray-900">{state.code}</span>
            <span className="text-gray-500">({state.park_count})</span>
          </Link>
        ))}
        <Link
          href="/states"
          className="inline-flex items-center px-3 py-1.5 bg-green-600 text-white rounded-full text-sm hover:bg-green-700 transition-colors"
        >
          more...
        </Link>
      </div>
    </div>
  );
}

/**
 * StatesGrid component
 * Displays states in a grid format with images/icons
 */
export function StatesGrid({ limit = 6 }) {
  const [states, setStates] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStates = async () => {
      try {
        setLoading(true);
        const response = await fetch(`/api/states?withParks=true&limit=20`);
        if (!response.ok) {
          throw new Error('Failed to fetch states');
        }

        const data = await response.json();
        // Sort by park count descending and take top states
        const sortedStates = data.states
          .sort((a, b) => (b.park_count || 0) - (a.park_count || 0))
          .slice(0, limit);
        setStates(sortedStates);
      } catch (err) {
        console.error('Failed to fetch states:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchStates();
  }, [limit]);

  if (loading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {[...Array(limit)].map((_, i) => (
          <div key={i} className="h-32 bg-gray-200 rounded-lg animate-pulse"></div>
        ))}
      </div>
    );
  }

  if (states.length === 0) {
    return null;
  }

  // State emoji/icon mapping (simplified)
  const stateIcons = {
    CA: '🌴',
    AK: '🏔️',
    HI: '🌺',
    FL: '🌊',
    TX: '🤠',
    AZ: '🏜️',
    CO: '⛰️',
    UT: '🏜️',
    WY: '🦬',
    MT: '🐻',
    WA: '🌲',
    OR: '🌲',
    NV: '🎰',
    NM: '🌵',
    ID: '🥔',
    default: '🏞️',
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold text-gray-900">Top States for Parks</h2>
        <Link href="/states" className="text-green-600 hover:text-green-700 text-sm font-medium">
          View all →
        </Link>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {states.map((state) => (
          <Link
            key={state.id}
            href={`/states/${state.slug}`}
            className="bg-white rounded-lg p-4 shadow-sm hover:shadow-md transition-shadow text-center border border-gray-100"
          >
            <div className="text-3xl mb-2">{stateIcons[state.code] || stateIcons.default}</div>
            <div className="font-semibold text-gray-900">{state.name}</div>
            <div className="text-sm text-gray-500">{state.park_count} parks</div>
          </Link>
        ))}
      </div>
    </div>
  );
}

export default StatesList;