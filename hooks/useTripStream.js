/**
 * useTripStream Hook
 * Custom hook for handling SSE stream during trip generation
 */

'use client';

import { useState, useCallback, useRef } from 'react';

/**
 * Status values for trip generation
 */
export const TRIP_STREAM_STATUS = {
  IDLE: 'idle',
  CONNECTING: 'connecting',
  GEOCODING: 'geocoding',
  FINDING_PARKS: 'finding_parks',
  GENERATING: 'generating',
  SAVING: 'saving',
  COMPLETE: 'complete',
  ERROR: 'error',
};

/**
 * Custom hook for handling trip generation with SSE streaming
 * @returns {Object} Hook state and methods
 */
export function useTripStream() {
  const [status, setStatus] = useState(TRIP_STREAM_STATUS.IDLE);
  const [progress, setProgress] = useState(null);
  const [completedDays, setCompletedDays] = useState([]);
  const [error, setError] = useState(null);
  const [tripId, setTripId] = useState(null);
  const [tripTitle, setTripTitle] = useState(null);
  const [location, setLocation] = useState(null);
  const [parkCount, setParkCount] = useState(0);
  
  const abortControllerRef = useRef(null);

  /**
   * Reset the hook state
   */
  const reset = useCallback(() => {
    setStatus(TRIP_STREAM_STATUS.IDLE);
    setProgress(null);
    setCompletedDays([]);
    setError(null);
    setTripId(null);
    setTripTitle(null);
    setLocation(null);
    setParkCount(0);
  }, []);

  /**
   * Cancel the current trip generation
   */
  const cancel = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setStatus(TRIP_STREAM_STATUS.IDLE);
    setProgress(null);
  }, []);

  /**
   * Parse SSE event data
   * @param {string} line - SSE line
   * @returns {Object|null} Parsed event or null
   */
  const parseSSELine = (line) => {
    if (line.startsWith('event:')) {
      return { type: 'event', value: line.substring(6).trim() };
    }
    if (line.startsWith('data:')) {
      try {
        return { type: 'data', value: JSON.parse(line.substring(5).trim()) };
      } catch {
        return null;
      }
    }
    return null;
  };

  /**
   * Generate a trip with SSE streaming
   * @param {Object} formData - Trip form data
   * @param {string} token - Auth token
   * @returns {Promise<Object|null>} Trip result or null on error
   */
  const generateTrip = useCallback(async (formData, token) => {
    // Reset state
    reset();
    setStatus(TRIP_STREAM_STATUS.CONNECTING);

    // Create abort controller for cancellation
    abortControllerRef.current = new AbortController();

    try {
      const response = await fetch('/api/ai/trip', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(formData),
        signal: abortControllerRef.current.signal,
      });

      // Handle non-streaming errors
      if (!response.ok) {
        const contentType = response.headers.get('content-type');
        if (contentType?.includes('application/json')) {
          const errorData = await response.json();
          
          // Special handling for free tier limit
          if (response.status === 402) {
            setError({
              code: 'FREE_TIER_LIMIT',
              message: errorData.error || 'Free tier limit reached',
            });
            setStatus(TRIP_STREAM_STATUS.ERROR);
            return null;
          }
          
          setError({
            code: 'API_ERROR',
            message: errorData.error || 'Failed to generate trip',
            details: errorData.details,
          });
          setStatus(TRIP_STREAM_STATUS.ERROR);
          return null;
        }
        
        setError({
          code: 'NETWORK_ERROR',
          message: `Request failed with status ${response.status}`,
        });
        setStatus(TRIP_STREAM_STATUS.ERROR);
        return null;
      }

      // Process SSE stream
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let currentEvent = null;

      while (true) {
        const { done, value } = await reader.read();
        
        if (done) {
          break;
        }

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmedLine = line.trim();
          if (!trimmedLine) {
            currentEvent = null;
            continue;
          }

          const parsed = parseSSELine(trimmedLine);
          if (!parsed) continue;

          if (parsed.type === 'event') {
            currentEvent = parsed.value;
          } else if (parsed.type === 'data' && currentEvent) {
            const data = parsed.value;

            switch (currentEvent) {
              case 'progress':
                setProgress(data);
                // Update status based on stage
                if (data.stage === 'geocoding') {
                  setStatus(TRIP_STREAM_STATUS.GEOCODING);
                } else if (data.stage === 'geocoded') {
                  setLocation(data.location);
                } else if (data.stage === 'finding_parks') {
                  setStatus(TRIP_STREAM_STATUS.FINDING_PARKS);
                } else if (data.stage === 'parks_found') {
                  setParkCount(data.parkCount || 0);
                } else if (data.stage === 'generating') {
                  setStatus(TRIP_STREAM_STATUS.GENERATING);
                } else if (data.stage === 'saving') {
                  setStatus(TRIP_STREAM_STATUS.SAVING);
                }
                break;

              case 'day_complete':
                setCompletedDays(prev => [...prev, data]);
                break;

              case 'chunk':
                // Could be used for real-time text display if needed
                break;

              case 'complete':
                setTripId(data.trip_id);
                setTripTitle(data.title);
                setStatus(TRIP_STREAM_STATUS.COMPLETE);
                return {
                  tripId: data.trip_id,
                  redirect: data.redirect,
                  title: data.title,
                  days: data.days,
                };

              case 'error':
                setError({
                  code: 'GENERATION_ERROR',
                  message: data.message || 'Trip generation failed',
                });
                setStatus(TRIP_STREAM_STATUS.ERROR);
                return null;
            }
          }
        }
      }

      // If we get here without a complete event, something went wrong
      if (status !== TRIP_STREAM_STATUS.COMPLETE && status !== TRIP_STREAM_STATUS.ERROR) {
        setError({
          code: 'STREAM_INCOMPLETE',
          message: 'Trip generation stream ended unexpectedly',
        });
        setStatus(TRIP_STREAM_STATUS.ERROR);
        return null;
      }

    } catch (err) {
      if (err.name === 'AbortError') {
        // User cancelled
        setStatus(TRIP_STREAM_STATUS.IDLE);
        return null;
      }

      console.error('Trip generation error:', err);
      setError({
        code: 'UNEXPECTED_ERROR',
        message: err.message || 'An unexpected error occurred',
      });
      setStatus(TRIP_STREAM_STATUS.ERROR);
      return null;
    } finally {
      abortControllerRef.current = null;
    }
  }, [reset, status]);

  return {
    // State
    status,
    progress,
    completedDays,
    error,
    tripId,
    tripTitle,
    location,
    parkCount,
    
    // Computed
    isIdle: status === TRIP_STREAM_STATUS.IDLE,
    isLoading: [
      TRIP_STREAM_STATUS.CONNECTING,
      TRIP_STREAM_STATUS.GEOCODING,
      TRIP_STREAM_STATUS.FINDING_PARKS,
      TRIP_STREAM_STATUS.GENERATING,
      TRIP_STREAM_STATUS.SAVING,
    ].includes(status),
    isComplete: status === TRIP_STREAM_STATUS.COMPLETE,
    isError: status === TRIP_STREAM_STATUS.ERROR,
    isFreeTierLimit: error?.code === 'FREE_TIER_LIMIT',
    
    // Methods
    generateTrip,
    reset,
    cancel,
  };
}

export default useTripStream;