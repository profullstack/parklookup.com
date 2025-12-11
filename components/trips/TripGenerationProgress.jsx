/**
 * TripGenerationProgress Component
 * Shows progress during AI trip generation with stage indicators and day previews
 */

'use client';

import { TRIP_STREAM_STATUS } from '@/hooks/useTripStream';

/**
 * Progress stages configuration
 */
const STAGES = [
  { id: 'geocoding', label: 'Finding Location', icon: '📍' },
  { id: 'finding_parks', label: 'Discovering Parks', icon: '🏞️' },
  { id: 'generating', label: 'Creating Itinerary', icon: '🤖' },
  { id: 'saving', label: 'Saving Trip', icon: '💾' },
];

/**
 * Get stage index from status
 */
const getStageIndex = (status) => {
  switch (status) {
    case TRIP_STREAM_STATUS.CONNECTING:
    case TRIP_STREAM_STATUS.GEOCODING:
      return 0;
    case TRIP_STREAM_STATUS.FINDING_PARKS:
      return 1;
    case TRIP_STREAM_STATUS.GENERATING:
      return 2;
    case TRIP_STREAM_STATUS.SAVING:
      return 3;
    case TRIP_STREAM_STATUS.COMPLETE:
      return 4;
    default:
      return -1;
  }
};

/**
 * Spinner component
 */
function Spinner({ className = '' }) {
  return (
    <svg
      className={`animate-spin ${className}`}
      viewBox="0 0 24 24"
      fill="none"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      />
    </svg>
  );
}

/**
 * Check icon component
 */
function CheckIcon({ className = '' }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="3"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M5 13l4 4L19 7"
      />
    </svg>
  );
}

/**
 * Stage indicator component
 */
function StageIndicator({ stage, index, currentIndex, isComplete }) {
  const isPast = index < currentIndex;
  const isCurrent = index === currentIndex;
  const isFuture = index > currentIndex;

  return (
    <div className="flex items-center">
      {/* Connector line */}
      {index > 0 && (
        <div
          className={`
            h-0.5 w-8 sm:w-12 transition-colors duration-300
            ${isPast || isCurrent ? 'bg-green-500' : 'bg-gray-300'}
          `}
        />
      )}
      
      {/* Stage circle */}
      <div
        className={`
          relative flex items-center justify-center w-10 h-10 rounded-full
          transition-all duration-300
          ${isPast || isComplete ? 'bg-green-500 text-white' : ''}
          ${isCurrent && !isComplete ? 'bg-green-100 text-green-600 ring-4 ring-green-200' : ''}
          ${isFuture ? 'bg-gray-200 text-gray-400' : ''}
        `}
      >
        {isPast || isComplete ? (
          <CheckIcon className="w-5 h-5" />
        ) : isCurrent ? (
          <Spinner className="w-5 h-5 text-green-600" />
        ) : (
          <span className="text-lg">{stage.icon}</span>
        )}
      </div>
      
      {/* Stage label (visible on larger screens) */}
      <span
        className={`
          hidden sm:block ml-2 text-sm font-medium
          ${isPast || isComplete ? 'text-green-600' : ''}
          ${isCurrent && !isComplete ? 'text-green-700' : ''}
          ${isFuture ? 'text-gray-400' : ''}
        `}
      >
        {stage.label}
      </span>
    </div>
  );
}

/**
 * Day preview card component
 */
function DayPreviewCard({ day }) {
  return (
    <div className="flex items-center gap-3 p-3 bg-white rounded-lg border border-green-200 shadow-sm animate-fade-in">
      <div className="flex-shrink-0 w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
        <span className="text-green-700 font-bold">{day.day}</span>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-900 truncate">
          {day.park_name || 'Loading...'}
        </p>
        <p className="text-xs text-gray-500">Day {day.day}</p>
      </div>
      <CheckIcon className="w-5 h-5 text-green-500 flex-shrink-0" />
    </div>
  );
}

/**
 * TripGenerationProgress component
 * @param {Object} props - Component props
 * @param {string} props.status - Current generation status
 * @param {Object} props.progress - Progress data from stream
 * @param {Array} props.completedDays - Array of completed day previews
 * @param {Object} props.location - Geocoded location data
 * @param {number} props.parkCount - Number of parks found
 * @param {Function} props.onCancel - Cancel handler
 */
export default function TripGenerationProgress({
  status,
  progress,
  completedDays = [],
  location,
  parkCount,
  onCancel,
}) {
  const currentIndex = getStageIndex(status);
  const isComplete = status === TRIP_STREAM_STATUS.COMPLETE;

  return (
    <div className="space-y-6">
      {/* Progress Header */}
      <div className="text-center">
        <h2 className="text-xl font-bold text-gray-900">
          {isComplete ? '🎉 Trip Created!' : '🧭 Creating Your Trip'}
        </h2>
        <p className="text-gray-600 mt-1">
          {progress?.message || 'Preparing your personalized itinerary...'}
        </p>
      </div>

      {/* Stage Progress */}
      <div className="flex items-center justify-center py-4">
        {STAGES.map((stage, index) => (
          <StageIndicator
            key={stage.id}
            stage={stage}
            index={index}
            currentIndex={currentIndex}
            isComplete={isComplete}
          />
        ))}
      </div>

      {/* Location Info */}
      {location && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <span className="text-2xl">📍</span>
            <div>
              <p className="font-medium text-blue-900">Starting from</p>
              <p className="text-blue-700">{location.formattedAddress}</p>
              {location.stateCode && (
                <p className="text-sm text-blue-600 mt-1">
                  {location.city}, {location.stateCode}
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Parks Found */}
      {parkCount > 0 && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <div className="flex items-center gap-3">
            <span className="text-2xl">🏞️</span>
            <div>
              <p className="font-medium text-green-900">
                Found {parkCount} parks nearby
              </p>
              <p className="text-sm text-green-700">
                Selecting the best matches for your interests...
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Completed Days Preview */}
      {completedDays.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-medium text-gray-700">
            Itinerary Preview
          </h3>
          <div className="grid gap-2">
            {completedDays.map((day, index) => (
              <DayPreviewCard key={index} day={day} />
            ))}
          </div>
        </div>
      )}

      {/* Generating Animation */}
      {status === TRIP_STREAM_STATUS.GENERATING && completedDays.length === 0 && (
        <div className="flex flex-col items-center py-8">
          <div className="relative">
            <div className="w-16 h-16 border-4 border-green-200 rounded-full animate-pulse" />
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-3xl animate-bounce">🤖</span>
            </div>
          </div>
          <p className="mt-4 text-gray-600 text-center">
            AI is crafting your perfect trip...
          </p>
        </div>
      )}

      {/* Cancel Button */}
      {!isComplete && onCancel && (
        <div className="text-center pt-4">
          <button
            onClick={onCancel}
            className="text-sm text-gray-500 hover:text-gray-700 underline"
          >
            Cancel
          </button>
        </div>
      )}

      {/* Custom CSS for animations */}
      <style jsx>{`
        @keyframes fade-in {
          from {
            opacity: 0;
            transform: translateY(-10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .animate-fade-in {
          animation: fade-in 0.3s ease-out;
        }
      `}</style>
    </div>
  );
}