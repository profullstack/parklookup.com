/**
 * TripForm Component
 * Form for creating AI-generated trip itineraries
 */

'use client';

import { useState, useCallback } from 'react';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';

/**
 * Available interests for trip planning
 */
const INTERESTS = [
  { id: 'camping', label: 'Camping', icon: '🏕️' },
  { id: 'hiking', label: 'Hiking', icon: '🥾' },
  { id: 'photography', label: 'Photography', icon: '📷' },
  { id: 'scenic_drives', label: 'Scenic Drives', icon: '🚗' },
  { id: 'wildlife', label: 'Wildlife', icon: '🦌' },
  { id: 'stargazing', label: 'Stargazing', icon: '⭐' },
  { id: 'rock_climbing', label: 'Rock Climbing', icon: '🧗' },
  { id: 'fishing', label: 'Fishing', icon: '🎣' },
  { id: 'kayaking', label: 'Kayaking', icon: '🛶' },
  { id: 'bird_watching', label: 'Bird Watching', icon: '🦅' },
];

/**
 * Difficulty levels
 */
const DIFFICULTY_LEVELS = [
  { id: 'easy', label: 'Easy', description: 'Light walking, accessible trails' },
  { id: 'moderate', label: 'Moderate', description: 'Some hiking, moderate elevation' },
  { id: 'hard', label: 'Hard', description: 'Strenuous hikes, challenging terrain' },
];

/**
 * Radius options in miles
 */
const RADIUS_OPTIONS = [
  { value: 50, label: '50 miles' },
  { value: 100, label: '100 miles' },
  { value: 150, label: '150 miles' },
  { value: 200, label: '200 miles' },
  { value: 300, label: '300 miles' },
  { value: 400, label: '400 miles' },
  { value: 500, label: '500 miles' },
];

/**
 * Get default dates (tomorrow to 3 days from now)
 */
const getDefaultDates = () => {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  
  const endDate = new Date(tomorrow);
  endDate.setDate(endDate.getDate() + 2);
  
  return {
    startDate: tomorrow.toISOString().split('T')[0],
    endDate: endDate.toISOString().split('T')[0],
  };
};

/**
 * TripForm component
 * @param {Object} props - Component props
 * @param {Function} props.onSubmit - Submit handler
 * @param {boolean} props.isLoading - Loading state
 * @param {boolean} props.disabled - Disabled state
 */
export default function TripForm({ onSubmit, isLoading = false, disabled = false }) {
  const defaultDates = getDefaultDates();
  
  const [formData, setFormData] = useState({
    origin: '',
    startDate: defaultDates.startDate,
    endDate: defaultDates.endDate,
    interests: ['hiking', 'scenic_drives'],
    difficulty: 'moderate',
    radiusMiles: 200,
  });

  const [errors, setErrors] = useState({});

  /**
   * Handle input change
   */
  const handleChange = useCallback((e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    // Clear error when field is modified
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: null }));
    }
  }, [errors]);

  /**
   * Handle interest toggle
   */
  const handleInterestToggle = useCallback((interestId) => {
    setFormData(prev => {
      const interests = prev.interests.includes(interestId)
        ? prev.interests.filter(i => i !== interestId)
        : [...prev.interests, interestId];
      return { ...prev, interests };
    });
    if (errors.interests) {
      setErrors(prev => ({ ...prev, interests: null }));
    }
  }, [errors]);

  /**
   * Handle radius change
   */
  const handleRadiusChange = useCallback((e) => {
    setFormData(prev => ({ ...prev, radiusMiles: parseInt(e.target.value, 10) }));
  }, []);

  /**
   * Validate form
   */
  const validate = useCallback(() => {
    const newErrors = {};

    if (!formData.origin.trim()) {
      newErrors.origin = 'Starting location is required';
    }

    if (!formData.startDate) {
      newErrors.startDate = 'Start date is required';
    }

    if (!formData.endDate) {
      newErrors.endDate = 'End date is required';
    }

    if (formData.startDate && formData.endDate) {
      const start = new Date(formData.startDate);
      const end = new Date(formData.endDate);
      
      if (end < start) {
        newErrors.endDate = 'End date must be after start date';
      }
      
      const days = Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1;
      if (days > 14) {
        newErrors.endDate = 'Trip cannot exceed 14 days';
      }
    }

    if (formData.interests.length === 0) {
      newErrors.interests = 'Select at least one interest';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [formData]);

  /**
   * Handle form submit
   */
  const handleSubmit = useCallback((e) => {
    e.preventDefault();
    
    if (!validate()) {
      return;
    }

    onSubmit?.(formData);
  }, [formData, validate, onSubmit]);

  /**
   * Calculate trip duration
   */
  const getTripDuration = () => {
    if (!formData.startDate || !formData.endDate) return null;
    const start = new Date(formData.startDate);
    const end = new Date(formData.endDate);
    const days = Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1;
    return days;
  };

  const tripDuration = getTripDuration();

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Origin Input */}
      <div>
        <label htmlFor="origin" className="block text-sm font-medium text-gray-700 mb-1">
          Starting Location
        </label>
        <Input
          id="origin"
          name="origin"
          type="text"
          placeholder="Enter city, zip code, or address"
          value={formData.origin}
          onChange={handleChange}
          disabled={isLoading || disabled}
          className={errors.origin ? 'border-red-500' : ''}
        />
        {errors.origin && (
          <p className="mt-1 text-sm text-red-600">{errors.origin}</p>
        )}
        <p className="mt-1 text-xs text-gray-500">
          e.g., San Francisco, CA or 94102
        </p>
      </div>

      {/* Date Range */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label htmlFor="startDate" className="block text-sm font-medium text-gray-700 mb-1">
            Start Date
          </label>
          <Input
            id="startDate"
            name="startDate"
            type="date"
            value={formData.startDate}
            onChange={handleChange}
            disabled={isLoading || disabled}
            min={new Date().toISOString().split('T')[0]}
            className={errors.startDate ? 'border-red-500' : ''}
          />
          {errors.startDate && (
            <p className="mt-1 text-sm text-red-600">{errors.startDate}</p>
          )}
        </div>
        <div>
          <label htmlFor="endDate" className="block text-sm font-medium text-gray-700 mb-1">
            End Date
          </label>
          <Input
            id="endDate"
            name="endDate"
            type="date"
            value={formData.endDate}
            onChange={handleChange}
            disabled={isLoading || disabled}
            min={formData.startDate}
            className={errors.endDate ? 'border-red-500' : ''}
          />
          {errors.endDate && (
            <p className="mt-1 text-sm text-red-600">{errors.endDate}</p>
          )}
        </div>
      </div>

      {/* Trip Duration Display */}
      {tripDuration && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-3">
          <p className="text-sm text-green-800">
            <span className="font-medium">{tripDuration} day{tripDuration > 1 ? 's' : ''}</span> trip
          </p>
        </div>
      )}

      {/* Interests */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Interests
        </label>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
          {INTERESTS.map(interest => (
            <button
              key={interest.id}
              type="button"
              onClick={() => handleInterestToggle(interest.id)}
              disabled={isLoading || disabled}
              className={`
                flex items-center gap-2 px-3 py-2 rounded-lg border text-sm
                transition-colors duration-150
                ${formData.interests.includes(interest.id)
                  ? 'bg-green-100 border-green-500 text-green-800'
                  : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
                }
                ${(isLoading || disabled) ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
              `}
            >
              <span>{interest.icon}</span>
              <span>{interest.label}</span>
            </button>
          ))}
        </div>
        {errors.interests && (
          <p className="mt-1 text-sm text-red-600">{errors.interests}</p>
        )}
      </div>

      {/* Difficulty */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Difficulty Level
        </label>
        <div className="grid grid-cols-3 gap-3">
          {DIFFICULTY_LEVELS.map(level => (
            <button
              key={level.id}
              type="button"
              onClick={() => setFormData(prev => ({ ...prev, difficulty: level.id }))}
              disabled={isLoading || disabled}
              className={`
                p-3 rounded-lg border text-center transition-colors duration-150
                ${formData.difficulty === level.id
                  ? 'bg-green-100 border-green-500'
                  : 'bg-white border-gray-300 hover:bg-gray-50'
                }
                ${(isLoading || disabled) ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
              `}
            >
              <p className={`font-medium ${formData.difficulty === level.id ? 'text-green-800' : 'text-gray-900'}`}>
                {level.label}
              </p>
              <p className="text-xs text-gray-500 mt-1">{level.description}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Radius */}
      <div>
        <label htmlFor="radiusMiles" className="block text-sm font-medium text-gray-700 mb-2">
          Search Radius: <span className="font-bold">{formData.radiusMiles} miles</span>
        </label>
        <input
          id="radiusMiles"
          name="radiusMiles"
          type="range"
          min="50"
          max="500"
          step="50"
          value={formData.radiusMiles}
          onChange={handleRadiusChange}
          disabled={isLoading || disabled}
          className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-green-600"
        />
        <div className="flex justify-between text-xs text-gray-500 mt-1">
          <span>50 mi</span>
          <span>250 mi</span>
          <span>500 mi</span>
        </div>
      </div>

      {/* Submit Button */}
      <Button
        type="submit"
        disabled={isLoading || disabled}
        className="w-full"
      >
        {isLoading ? (
          <span className="flex items-center justify-center gap-2">
            <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
                fill="none"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
            Generating Trip...
          </span>
        ) : (
          '🧭 Generate AI Trip'
        )}
      </Button>
    </form>
  );
}