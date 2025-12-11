/**
 * TripCard Component
 * Displays a trip summary card for the trips list
 */

'use client';

import Link from 'next/link';
import Card, { CardContent } from '@/components/ui/Card';

/**
 * Format date for display
 * @param {string} dateString - ISO date string
 * @returns {string} Formatted date
 */
const formatDate = (dateString) => {
  if (!dateString) return '';
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
};

/**
 * Get difficulty badge color
 * @param {string} difficulty - Difficulty level
 * @returns {string} Tailwind color classes
 */
const getDifficultyColor = (difficulty) => {
  switch (difficulty) {
    case 'easy':
      return 'bg-green-100 text-green-800';
    case 'moderate':
      return 'bg-yellow-100 text-yellow-800';
    case 'hard':
      return 'bg-red-100 text-red-800';
    default:
      return 'bg-gray-100 text-gray-800';
  }
};

/**
 * Interest icon mapping
 */
const INTEREST_ICONS = {
  camping: '🏕️',
  hiking: '🥾',
  photography: '📷',
  scenic_drives: '🚗',
  wildlife: '🦌',
  stargazing: '⭐',
  rock_climbing: '🧗',
  fishing: '🎣',
  kayaking: '🛶',
  bird_watching: '🦅',
};

/**
 * TripCard component
 * @param {Object} props - Component props
 * @param {Object} props.trip - Trip data
 * @param {Function} props.onDelete - Delete handler (optional)
 */
export default function TripCard({ trip, onDelete }) {
  const {
    id,
    title,
    origin,
    startDate,
    endDate,
    interests = [],
    difficulty,
    parkCount,
    dayCount,
    summary,
    createdAt,
  } = trip;

  /**
   * Calculate trip duration
   */
  const getDuration = () => {
    if (!startDate || !endDate) return null;
    const start = new Date(startDate);
    const end = new Date(endDate);
    const days = Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1;
    return days;
  };

  const duration = getDuration();

  /**
   * Handle delete click
   */
  const handleDelete = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (onDelete) {
      onDelete(id);
    }
  };

  return (
    <Link href={`/trip/${id}`}>
      <Card hoverable className="h-full">
        <CardContent className="p-0">
          {/* Header */}
          <div className="p-4 border-b border-gray-100">
            <div className="flex items-start justify-between gap-2">
              <h3 className="text-lg font-semibold text-gray-900 line-clamp-2">
                {title || 'Untitled Trip'}
              </h3>
              {onDelete && (
                <button
                  onClick={handleDelete}
                  className="p-1 text-gray-400 hover:text-red-500 transition-colors"
                  title="Delete trip"
                >
                  <svg
                    className="w-5 h-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                    />
                  </svg>
                </button>
              )}
            </div>
            
            {/* Origin */}
            <div className="flex items-center gap-1 mt-2 text-sm text-gray-600">
              <span>📍</span>
              <span className="truncate">{origin}</span>
            </div>
          </div>

          {/* Body */}
          <div className="p-4 space-y-3">
            {/* Dates */}
            <div className="flex items-center gap-2 text-sm">
              <span className="text-gray-500">📅</span>
              <span className="text-gray-700">
                {formatDate(startDate)} - {formatDate(endDate)}
              </span>
              {duration && (
                <span className="text-gray-500">
                  ({duration} day{duration > 1 ? 's' : ''})
                </span>
              )}
            </div>

            {/* Stats */}
            <div className="flex items-center gap-4 text-sm">
              {parkCount > 0 && (
                <div className="flex items-center gap-1">
                  <span>🏞️</span>
                  <span className="text-gray-700">
                    {parkCount} park{parkCount > 1 ? 's' : ''}
                  </span>
                </div>
              )}
              {dayCount > 0 && (
                <div className="flex items-center gap-1">
                  <span>🗓️</span>
                  <span className="text-gray-700">
                    {dayCount} day{dayCount > 1 ? 's' : ''} planned
                  </span>
                </div>
              )}
            </div>

            {/* Summary */}
            {summary && (
              <p className="text-sm text-gray-600 line-clamp-2">
                {summary}
              </p>
            )}

            {/* Interests */}
            {interests.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {interests.slice(0, 5).map(interest => (
                  <span
                    key={interest}
                    className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-gray-100 text-gray-700"
                    title={interest.replace('_', ' ')}
                  >
                    {INTEREST_ICONS[interest] || '•'}
                  </span>
                ))}
                {interests.length > 5 && (
                  <span className="text-xs text-gray-500">
                    +{interests.length - 5} more
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-4 py-3 bg-gray-50 border-t border-gray-100 flex items-center justify-between">
            {/* Difficulty Badge */}
            {difficulty && (
              <span
                className={`
                  inline-flex items-center px-2 py-0.5 rounded text-xs font-medium capitalize
                  ${getDifficultyColor(difficulty)}
                `}
              >
                {difficulty}
              </span>
            )}

            {/* Created Date */}
            <span className="text-xs text-gray-500">
              Created {formatDate(createdAt)}
            </span>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

/**
 * TripCard skeleton for loading state
 */
export function TripCardSkeleton() {
  return (
    <Card className="h-full animate-pulse">
      <CardContent className="p-0">
        {/* Header */}
        <div className="p-4 border-b border-gray-100">
          <div className="h-6 bg-gray-200 rounded w-3/4" />
          <div className="h-4 bg-gray-200 rounded w-1/2 mt-2" />
        </div>

        {/* Body */}
        <div className="p-4 space-y-3">
          <div className="h-4 bg-gray-200 rounded w-2/3" />
          <div className="h-4 bg-gray-200 rounded w-1/2" />
          <div className="h-12 bg-gray-200 rounded" />
          <div className="flex gap-1">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-6 w-6 bg-gray-200 rounded" />
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="px-4 py-3 bg-gray-50 border-t border-gray-100 flex justify-between">
          <div className="h-5 bg-gray-200 rounded w-16" />
          <div className="h-4 bg-gray-200 rounded w-24" />
        </div>
      </CardContent>
    </Card>
  );
}