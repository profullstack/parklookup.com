/**
 * TripDetail Component
 * Displays full trip details with day-by-day schedule, packing list, and safety notes
 */

'use client';

import { useState } from 'react';
import Link from 'next/link';
import Card, { CardContent } from '@/components/ui/Card';
import Button from '@/components/ui/Button';

/**
 * Format date for display
 * @param {string} dateString - ISO date string
 * @returns {string} Formatted date
 */
const formatDate = (dateString) => {
  if (!dateString) return '';
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
};

/**
 * Get difficulty badge color
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
 * Day card component
 */
function DayCard({ stop, tripStartDate }) {
  const [isExpanded, setIsExpanded] = useState(true);
  
  // Calculate actual date for this day
  const getDateForDay = () => {
    if (!tripStartDate) return null;
    const date = new Date(tripStartDate);
    date.setDate(date.getDate() + stop.dayNumber - 1);
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    });
  };

  const dayDate = getDateForDay();
  const parkImage = stop.park?.images?.[0]?.url;

  return (
    <Card className="overflow-hidden">
      {/* Day Header */}
      <div
        className="flex items-center gap-4 p-4 bg-gradient-to-r from-green-600 to-green-700 text-white cursor-pointer"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex-shrink-0 w-12 h-12 bg-white/20 rounded-full flex items-center justify-center">
          <span className="text-xl font-bold">{stop.dayNumber}</span>
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-lg font-semibold truncate">
            {stop.park?.name || stop.parkCode}
          </h3>
          {dayDate && (
            <p className="text-green-100 text-sm">{dayDate}</p>
          )}
        </div>
        <svg
          className={`w-6 h-6 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </div>

      {/* Day Content */}
      {isExpanded && (
        <CardContent className="p-0">
          {/* Park Image */}
          {parkImage && (
            <div className="relative h-48 w-full">
              <img
                src={parkImage}
                alt={stop.park?.name}
                className="w-full h-full object-cover"
              />
              {stop.park?.designation && (
                <span className="absolute bottom-2 left-2 px-2 py-1 bg-black/60 text-white text-xs rounded">
                  {stop.park.designation}
                </span>
              )}
            </div>
          )}

          <div className="p-4 space-y-4">
            {/* Driving Notes */}
            {stop.drivingNotes && (
              <div className="flex items-start gap-2 p-3 bg-blue-50 rounded-lg">
                <span className="text-xl">🚗</span>
                <div>
                  <p className="text-sm font-medium text-blue-900">Getting There</p>
                  <p className="text-sm text-blue-700">{stop.drivingNotes}</p>
                </div>
              </div>
            )}

            {/* Highlights */}
            {stop.highlights && (
              <div className="flex items-start gap-2 p-3 bg-yellow-50 rounded-lg">
                <span className="text-xl">⭐</span>
                <div>
                  <p className="text-sm font-medium text-yellow-900">Highlights</p>
                  <p className="text-sm text-yellow-700">{stop.highlights}</p>
                </div>
              </div>
            )}

            {/* Schedule */}
            <div className="space-y-3">
              {stop.morningPlan && (
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 w-20 text-sm font-medium text-gray-500">
                    Morning
                  </div>
                  <p className="text-sm text-gray-700">{stop.morningPlan}</p>
                </div>
              )}
              {stop.afternoonPlan && (
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 w-20 text-sm font-medium text-gray-500">
                    Afternoon
                  </div>
                  <p className="text-sm text-gray-700">{stop.afternoonPlan}</p>
                </div>
              )}
              {stop.eveningPlan && (
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 w-20 text-sm font-medium text-gray-500">
                    Evening
                  </div>
                  <p className="text-sm text-gray-700">{stop.eveningPlan}</p>
                </div>
              )}
            </div>

            {/* Activities */}
            {stop.activities && stop.activities.length > 0 && (
              <div>
                <p className="text-sm font-medium text-gray-700 mb-2">Activities</p>
                <div className="flex flex-wrap gap-2">
                  {stop.activities.map((activity, index) => (
                    <span
                      key={index}
                      className="px-2 py-1 bg-green-100 text-green-800 text-xs rounded-full"
                    >
                      {activity}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Park Link */}
            {stop.parkCode && (
              <Link
                href={`/parks/${stop.parkCode}`}
                className="inline-flex items-center gap-1 text-sm text-green-600 hover:text-green-700"
              >
                View park details →
              </Link>
            )}
          </div>
        </CardContent>
      )}
    </Card>
  );
}

/**
 * Packing list section component
 */
function PackingListSection({ packingList }) {
  if (!packingList) return null;

  const sections = [
    { key: 'essentials', label: 'Essentials', icon: '✅' },
    { key: 'clothing', label: 'Clothing', icon: '👕' },
    { key: 'gear', label: 'Gear', icon: '🎒' },
    { key: 'optional', label: 'Optional', icon: '💡' },
  ];

  return (
    <Card>
      <CardContent>
        <h3 className="text-lg font-semibold text-gray-900 mb-4">📦 Packing List</h3>
        <div className="grid md:grid-cols-2 gap-4">
          {sections.map(section => {
            const items = packingList[section.key];
            if (!items || items.length === 0) return null;

            return (
              <div key={section.key}>
                <h4 className="text-sm font-medium text-gray-700 mb-2">
                  {section.icon} {section.label}
                </h4>
                <ul className="space-y-1">
                  {items.map((item, index) => (
                    <li key={index} className="flex items-center gap-2 text-sm text-gray-600">
                      <input type="checkbox" className="rounded text-green-600" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Safety notes section component
 */
function SafetyNotesSection({ safetyNotes }) {
  if (!safetyNotes || safetyNotes.length === 0) return null;

  return (
    <Card className="border-orange-200 bg-orange-50">
      <CardContent>
        <h3 className="text-lg font-semibold text-orange-900 mb-3">⚠️ Safety Notes</h3>
        <ul className="space-y-2">
          {safetyNotes.map((note, index) => (
            <li key={index} className="flex items-start gap-2 text-sm text-orange-800">
              <span className="flex-shrink-0 mt-0.5">•</span>
              <span>{note}</span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

/**
 * Photo spots section component
 */
function PhotoSpotsSection({ photoSpots }) {
  if (!photoSpots || photoSpots.length === 0) return null;

  return (
    <Card className="border-purple-200 bg-purple-50">
      <CardContent>
        <h3 className="text-lg font-semibold text-purple-900 mb-3">📷 Best Photo Spots</h3>
        <ul className="space-y-2">
          {photoSpots.map((spot, index) => (
            <li key={index} className="flex items-start gap-2 text-sm text-purple-800">
              <span className="flex-shrink-0">📍</span>
              <span>{spot}</span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

/**
 * Budget section component
 */
function BudgetSection({ budget }) {
  if (!budget) return null;

  return (
    <Card className="border-green-200 bg-green-50">
      <CardContent>
        <h3 className="text-lg font-semibold text-green-900 mb-3">💰 Estimated Budget</h3>
        <div className="space-y-2 text-sm">
          {budget.entrance_fees && (
            <div className="flex justify-between">
              <span className="text-green-700">Entrance Fees</span>
              <span className="font-medium text-green-900">{budget.entrance_fees}</span>
            </div>
          )}
          {budget.fuel_estimate && (
            <div className="flex justify-between">
              <span className="text-green-700">Fuel Estimate</span>
              <span className="font-medium text-green-900">{budget.fuel_estimate}</span>
            </div>
          )}
          {budget.total_range && (
            <div className="flex justify-between pt-2 border-t border-green-200">
              <span className="text-green-700 font-medium">Total Range</span>
              <span className="font-bold text-green-900">{budget.total_range}</span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * TripDetail component
 * @param {Object} props - Component props
 * @param {Object} props.trip - Full trip data
 * @param {Function} props.onRegenerate - Regenerate handler
 * @param {Function} props.onDelete - Delete handler
 * @param {boolean} props.isRegenerating - Regenerating state
 */
export default function TripDetail({ trip, onRegenerate, onDelete, isRegenerating = false }) {
  const {
    title,
    origin,
    startDate,
    endDate,
    interests,
    difficulty,
    radiusMiles,
    summary,
    stops = [],
    packingList,
    safetyNotes,
    bestPhotoSpots,
    estimatedBudget,
  } = trip;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-xl shadow-md p-6">
        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-gray-900">
              {title || 'Your Trip'}
            </h1>
            
            {/* Origin & Dates */}
            <div className="mt-2 space-y-1 text-gray-600">
              <p className="flex items-center gap-2">
                <span>📍</span>
                <span>Starting from {origin}</span>
              </p>
              <p className="flex items-center gap-2">
                <span>📅</span>
                <span>{formatDate(startDate)} - {formatDate(endDate)}</span>
              </p>
            </div>

            {/* Tags */}
            <div className="mt-3 flex flex-wrap gap-2">
              {difficulty && (
                <span className={`px-2 py-1 rounded text-xs font-medium capitalize ${getDifficultyColor(difficulty)}`}>
                  {difficulty}
                </span>
              )}
              <span className="px-2 py-1 rounded text-xs font-medium bg-blue-100 text-blue-800">
                {radiusMiles} mile radius
              </span>
              <span className="px-2 py-1 rounded text-xs font-medium bg-purple-100 text-purple-800">
                {stops.length} park{stops.length !== 1 ? 's' : ''}
              </span>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-2">
            {onRegenerate && (
              <Button
                onClick={onRegenerate}
                disabled={isRegenerating}
                variant="outline"
              >
                {isRegenerating ? 'Regenerating...' : '🔄 Regenerate'}
              </Button>
            )}
            {onDelete && (
              <Button
                onClick={onDelete}
                variant="outline"
                className="text-red-600 border-red-300 hover:bg-red-50"
              >
                🗑️ Delete
              </Button>
            )}
          </div>
        </div>

        {/* Summary */}
        {summary && (
          <p className="mt-4 text-gray-700 leading-relaxed">
            {summary}
          </p>
        )}
      </div>

      {/* Day-by-Day Schedule */}
      <div>
        <h2 className="text-xl font-bold text-gray-900 mb-4">📅 Day-by-Day Itinerary</h2>
        <div className="space-y-4">
          {stops.map((stop, index) => (
            <DayCard
              key={stop.id || index}
              stop={stop}
              tripStartDate={startDate}
            />
          ))}
        </div>
      </div>

      {/* Additional Sections */}
      <div className="grid md:grid-cols-2 gap-4">
        <PackingListSection packingList={packingList} />
        <div className="space-y-4">
          <SafetyNotesSection safetyNotes={safetyNotes} />
          <PhotoSpotsSection photoSpots={bestPhotoSpots} />
          <BudgetSection budget={estimatedBudget} />
        </div>
      </div>
    </div>
  );
}