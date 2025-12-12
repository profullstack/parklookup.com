'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useAuth } from '@/hooks/useAuth';
import { useParams } from 'next/navigation';

/**
 * Category configuration
 */
const CATEGORY_CONFIG = {
  dining: {
    label: 'Dining',
    icon: '🍽️',
    color: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
  },
  entertainment: {
    label: 'Entertainment',
    icon: '🎭',
    color: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  },
  bars: {
    label: 'Bars & Nightlife',
    icon: '🍺',
    color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  },
  shopping: {
    label: 'Shopping',
    icon: '🛍️',
    color: 'bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-400',
  },
  attractions: {
    label: 'Attractions',
    icon: '🎡',
    color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  },
};

/**
 * Comment component
 */
function Comment({ comment, currentUserId, onDelete, onEdit }) {
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(comment.content);
  const [editRating, setEditRating] = useState(comment.rating || 0);

  const isOwner = currentUserId === comment.user_id;

  const handleSave = async () => {
    await onEdit(comment.id, editContent, editRating || null);
    setIsEditing(false);
  };

  return (
    <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
      <div className="flex justify-between items-start mb-2">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-green-600 rounded-full flex items-center justify-center text-white text-sm font-medium">
            {comment.user_id?.slice(0, 2).toUpperCase() || 'U'}
          </div>
          <div>
            <p className="text-sm font-medium text-gray-900 dark:text-white">User</p>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {new Date(comment.created_at).toLocaleDateString()}
            </p>
          </div>
        </div>
        {isOwner && !isEditing && (
          <div className="flex gap-2">
            <button
              onClick={() => setIsEditing(true)}
              className="text-xs text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
            >
              Edit
            </button>
            <button
              onClick={() => onDelete(comment.id)}
              className="text-xs text-red-500 hover:text-red-700"
            >
              Delete
            </button>
          </div>
        )}
      </div>

      {isEditing ? (
        <div className="space-y-3">
          <textarea
            value={editContent}
            onChange={(e) => setEditContent(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            rows={3}
          />
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-600 dark:text-gray-400">Rating:</span>
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                onClick={() => setEditRating(star)}
                className={`text-xl ${star <= editRating ? 'text-yellow-500' : 'text-gray-300'}`}
              >
                ★
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleSave}
              className="px-3 py-1 bg-green-600 text-white rounded text-sm hover:bg-green-700"
            >
              Save
            </button>
            <button
              onClick={() => setIsEditing(false)}
              className="px-3 py-1 bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-300 rounded text-sm"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <>
          {comment.rating && (
            <div className="flex items-center gap-1 mb-2">
              {[1, 2, 3, 4, 5].map((star) => (
                <span
                  key={star}
                  className={star <= comment.rating ? 'text-yellow-500' : 'text-gray-300'}
                >
                  ★
                </span>
              ))}
            </div>
          )}
          <p className="text-gray-700 dark:text-gray-300">{comment.content}</p>
        </>
      )}
    </div>
  );
}

/**
 * Comment form component
 */
function CommentForm({ onSubmit, isSubmitting }) {
  const [content, setContent] = useState('');
  const [rating, setRating] = useState(0);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!content.trim()) {return;}

    await onSubmit(content, rating || null);
    setContent('');
    setRating(0);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Your Review
        </label>
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Share your experience..."
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500"
          rows={4}
          required
        />
      </div>

      <div className="flex items-center gap-2">
        <span className="text-sm text-gray-600 dark:text-gray-400">Rating (optional):</span>
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            onClick={() => setRating(star === rating ? 0 : star)}
            className={`text-2xl transition-colors ${star <= rating ? 'text-yellow-500' : 'text-gray-300 hover:text-yellow-400'}`}
          >
            ★
          </button>
        ))}
      </div>

      <button
        type="submit"
        disabled={isSubmitting || !content.trim()}
        className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isSubmitting ? 'Posting...' : 'Post Review'}
      </button>
    </form>
  );
}

/**
 * Place detail page
 */
export default function PlaceDetailPage() {
  const params = useParams();
  const dataCid = params?.dataCid;
  const { user, loading: authLoading } = useAuth();

  const [place, setPlace] = useState(null);
  const [parks, setParks] = useState([]);
  const [comments, setComments] = useState([]);
  const [likesCount, setLikesCount] = useState(0);
  const [userHasLiked, setUserHasLiked] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);
  const [isTogglingLike, setIsTogglingLike] = useState(false);

  // Fetch place data
  useEffect(() => {
    const fetchPlace = async () => {
      try {
        setLoading(true);

        // Fetch place details
        const placeRes = await fetch(`/api/places/${dataCid}`);
        if (!placeRes.ok) {
          if (placeRes.status === 404) {
            setError('Place not found');
            return;
          }
          throw new Error('Failed to fetch place');
        }
        const placeData = await placeRes.json();
        setPlace(placeData.place);
        setParks(placeData.parks || []);
        setLikesCount(placeData.place.likes_count || 0);

        // Fetch comments
        const commentsRes = await fetch(`/api/places/${dataCid}/comments`);
        if (commentsRes.ok) {
          const commentsData = await commentsRes.json();
          setComments(commentsData.comments || []);
        }

        // Fetch likes status
        const likesRes = await fetch(`/api/places/${dataCid}/likes`);
        if (likesRes.ok) {
          const likesData = await likesRes.json();
          setLikesCount(likesData.likes_count || 0);
          setUserHasLiked(likesData.user_has_liked || false);
        }
      } catch (err) {
        console.error('Error fetching place:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    if (dataCid) {
      fetchPlace();
    }
  }, [dataCid]);

  // Handle like toggle
  const handleLikeToggle = async () => {
    if (!user) {
      alert('Please sign in to like places');
      return;
    }

    try {
      setIsTogglingLike(true);
      const method = userHasLiked ? 'DELETE' : 'POST';
      const res = await fetch(`/api/places/${dataCid}/likes`, { method });

      if (res.ok) {
        const data = await res.json();
        setLikesCount(data.likes_count);
        setUserHasLiked(data.user_has_liked);
      }
    } catch (err) {
      console.error('Error toggling like:', err);
    } finally {
      setIsTogglingLike(false);
    }
  };

  // Handle comment submission
  const handleCommentSubmit = async (content, rating) => {
    if (!user) {
      alert('Please sign in to post a review');
      return;
    }

    try {
      setIsSubmittingComment(true);
      const res = await fetch(`/api/places/${dataCid}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content, rating }),
      });

      if (res.ok) {
        const data = await res.json();
        setComments([data.comment, ...comments]);
      }
    } catch (err) {
      console.error('Error posting comment:', err);
    } finally {
      setIsSubmittingComment(false);
    }
  };

  // Handle comment edit
  const handleCommentEdit = async (commentId, content, rating) => {
    try {
      const res = await fetch(`/api/places/${dataCid}/comments/${commentId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content, rating }),
      });

      if (res.ok) {
        const data = await res.json();
        setComments(comments.map((c) => (c.id === commentId ? data.comment : c)));
      }
    } catch (err) {
      console.error('Error editing comment:', err);
    }
  };

  // Handle comment delete
  const handleCommentDelete = async (commentId) => {
    if (!confirm('Are you sure you want to delete this review?')) {return;}

    try {
      const res = await fetch(`/api/places/${dataCid}/comments/${commentId}`, {
        method: 'DELETE',
      });

      if (res.ok) {
        setComments(comments.filter((c) => c.id !== commentId));
      }
    } catch (err) {
      console.error('Error deleting comment:', err);
    }
  };

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <div className="max-w-4xl mx-auto px-4 py-8">
          <div className="animate-pulse">
            <div className="h-64 bg-gray-200 dark:bg-gray-700 rounded-lg mb-6" />
            <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-3/4 mb-4" />
            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/2 mb-2" />
            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-2/3" />
          </div>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
            {error === 'Place not found' ? 'Place Not Found' : 'Error'}
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mb-4">{error}</p>
          <Link href="/" className="text-green-600 hover:text-green-700">
            ← Back to Home
          </Link>
        </div>
      </div>
    );
  }

  if (!place) {return null;}

  const config = CATEGORY_CONFIG[place.category] || CATEGORY_CONFIG.attractions;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Hero section with image */}
      {place.thumbnail && (
        <div className="relative h-64 md:h-80 bg-gray-200 dark:bg-gray-700">
          <Image
            src={place.thumbnail}
            alt={place.title}
            fill
            className="object-cover"
            unoptimized
            priority
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
        </div>
      )}

      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          {/* Category badge */}
          <span
            className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${config.color} mb-3`}
          >
            {config.icon} {config.label}
          </span>

          <h1 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white mb-2">
            {place.title}
          </h1>

          {/* Rating and reviews */}
          <div className="flex items-center gap-4 mb-4">
            {place.rating && (
              <div className="flex items-center gap-1">
                <span className="text-yellow-500 text-xl">★</span>
                <span className="text-lg font-semibold text-gray-900 dark:text-white">
                  {place.rating}
                </span>
                {place.reviews_count && (
                  <span className="text-gray-500 dark:text-gray-400">
                    ({place.reviews_count.toLocaleString()} reviews)
                  </span>
                )}
              </div>
            )}
            {place.price_level && (
              <span className="text-gray-600 dark:text-gray-400 font-medium">
                {place.price_level}
              </span>
            )}
          </div>

          {/* Address */}
          {place.address && (
            <p className="text-gray-600 dark:text-gray-400 mb-4">📍 {place.address}</p>
          )}

          {/* Actions */}
          <div className="flex flex-wrap gap-3">
            <button
              onClick={handleLikeToggle}
              disabled={isTogglingLike || authLoading}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
                userHasLiked
                  ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                  : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
              }`}
            >
              {userHasLiked ? '❤️' : '🤍'} {likesCount} {likesCount === 1 ? 'Like' : 'Likes'}
            </button>

            {place.website && (
              <a
                href={place.website}
                target="_blank"
                rel="noopener noreferrer"
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
              >
                Visit Website
              </a>
            )}

            {place.phone && (
              <a
                href={`tel:${place.phone}`}
                className="px-4 py-2 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
              >
                📞 {place.phone}
              </a>
            )}

            {place.latitude && place.longitude && (
              <a
                href={`https://www.google.com/maps/dir/?api=1&destination=${place.latitude},${place.longitude}`}
                target="_blank"
                rel="noopener noreferrer"
                className="px-4 py-2 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
              >
                🗺️ Get Directions
              </a>
            )}
          </div>
        </div>

        {/* Description */}
        {place.description && (
          <div className="mb-8">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">About</h2>
            <p className="text-gray-700 dark:text-gray-300">{place.description}</p>
          </div>
        )}

        {/* Hours */}
        {place.hours && (Array.isArray(place.hours) ? place.hours.length > 0 : Object.keys(place.hours).length > 0) && (
          <div className="mb-8">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">Hours</h2>
            <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
              {Array.isArray(place.hours) ? (
                // Handle array format: [{name: "Sunday", value: "5 PM–2 AM"}, ...]
                place.hours.map((item, index) => (
                  <div key={index} className="flex justify-between py-1">
                    <span className="text-gray-600 dark:text-gray-400">{item.name}</span>
                    <span className="text-gray-900 dark:text-white">{item.value}</span>
                  </div>
                ))
              ) : (
                // Handle object format: {sunday: "5 PM–2 AM", ...}
                Object.entries(place.hours).map(([day, hours]) => (
                  <div key={day} className="flex justify-between py-1">
                    <span className="text-gray-600 dark:text-gray-400 capitalize">{day}</span>
                    <span className="text-gray-900 dark:text-white">{typeof hours === 'object' ? hours.value || JSON.stringify(hours) : hours}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* Nearby Parks */}
        {parks.length > 0 && (
          <div className="mb-8">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">
              Nearby Parks
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {parks.map((park) => (
                <Link
                  key={park.id}
                  href={`/park/${park.id}`}
                  className="flex items-center gap-4 p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 hover:shadow-md transition-shadow"
                >
                  {park.images?.[0] && (
                    <div className="relative w-16 h-16 rounded-lg overflow-hidden flex-shrink-0">
                      <Image
                        src={park.images[0].url || park.images[0]}
                        alt={park.name}
                        fill
                        className="object-cover"
                        unoptimized
                      />
                    </div>
                  )}
                  <div>
                    <h3 className="font-medium text-gray-900 dark:text-white">{park.name}</h3>
                    {park.designation && (
                      <p className="text-sm text-gray-500 dark:text-gray-400">{park.designation}</p>
                    )}
                    {park.distance_miles && (
                      <p className="text-sm text-green-600 dark:text-green-400">
                        {park.distance_miles.toFixed(1)} miles away
                      </p>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Reviews Section */}
        <div className="mb-8">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
            User Reviews ({comments.length})
          </h2>

          {/* Comment form */}
          {user ? (
            <div className="mb-6 bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
              <CommentForm onSubmit={handleCommentSubmit} isSubmitting={isSubmittingComment} />
            </div>
          ) : (
            <div className="mb-6 bg-gray-100 dark:bg-gray-800 rounded-lg p-4 text-center">
              <p className="text-gray-600 dark:text-gray-400 mb-2">Sign in to leave a review</p>
              <Link
                href="/signin"
                className="text-green-600 hover:text-green-700 font-medium"
              >
                Sign In →
              </Link>
            </div>
          )}

          {/* Comments list */}
          {comments.length > 0 ? (
            <div className="space-y-4">
              {comments.map((comment) => (
                <Comment
                  key={comment.id}
                  comment={comment}
                  currentUserId={user?.id}
                  onDelete={handleCommentDelete}
                  onEdit={handleCommentEdit}
                />
              ))}
            </div>
          ) : (
            <p className="text-center text-gray-500 dark:text-gray-400 py-8">
              No reviews yet. Be the first to share your experience!
            </p>
          )}
        </div>
      </div>
    </div>
  );
}