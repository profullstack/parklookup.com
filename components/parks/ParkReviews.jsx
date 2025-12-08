'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';

/**
 * Comment component for displaying individual reviews
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
            <p className="text-sm font-medium text-gray-900 dark:text-white">Visitor</p>
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
    if (!content.trim()) return;

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
          placeholder="Share your experience at this park..."
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
 * Park Reviews component
 * Displays reviews/comments for a park with like functionality
 */
export default function ParkReviews({ parkCode }) {
  const { user, loading: authLoading } = useAuth();

  const [comments, setComments] = useState([]);
  const [likesCount, setLikesCount] = useState(0);
  const [userHasLiked, setUserHasLiked] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);
  const [isTogglingLike, setIsTogglingLike] = useState(false);

  // Fetch comments and likes
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);

        // Fetch comments
        const commentsRes = await fetch(`/api/parks/${parkCode}/comments`);
        if (commentsRes.ok) {
          const commentsData = await commentsRes.json();
          setComments(commentsData.comments || []);
        }

        // Fetch likes status
        const likesRes = await fetch(`/api/parks/${parkCode}/likes`);
        if (likesRes.ok) {
          const likesData = await likesRes.json();
          setLikesCount(likesData.likes_count || 0);
          setUserHasLiked(likesData.user_has_liked || false);
        }
      } catch (err) {
        console.error('Error fetching park reviews:', err);
      } finally {
        setLoading(false);
      }
    };

    if (parkCode) {
      fetchData();
    }
  }, [parkCode]);

  // Handle like toggle
  const handleLikeToggle = async () => {
    if (!user) {
      alert('Please sign in to like parks');
      return;
    }

    try {
      setIsTogglingLike(true);
      const method = userHasLiked ? 'DELETE' : 'POST';
      const res = await fetch(`/api/parks/${parkCode}/likes`, { method });

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
      const res = await fetch(`/api/parks/${parkCode}/comments`, {
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
      const res = await fetch(`/api/parks/${parkCode}/comments/${commentId}`, {
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
    if (!confirm('Are you sure you want to delete this review?')) return;

    try {
      const res = await fetch(`/api/parks/${parkCode}/comments/${commentId}`, {
        method: 'DELETE',
      });

      if (res.ok) {
        setComments(comments.filter((c) => c.id !== commentId));
      }
    } catch (err) {
      console.error('Error deleting comment:', err);
    }
  };

  if (loading) {
    return (
      <div className="animate-pulse space-y-4">
        <div className="h-10 bg-gray-200 dark:bg-gray-700 rounded w-1/4" />
        <div className="h-32 bg-gray-200 dark:bg-gray-700 rounded" />
        <div className="h-24 bg-gray-200 dark:bg-gray-700 rounded" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Like button and stats */}
      <div className="flex items-center gap-4">
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
        <span className="text-gray-500 dark:text-gray-400">
          {comments.length} {comments.length === 1 ? 'Review' : 'Reviews'}
        </span>
      </div>

      {/* Comment form */}
      {user ? (
        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
          <CommentForm onSubmit={handleCommentSubmit} isSubmitting={isSubmittingComment} />
        </div>
      ) : (
        <div className="bg-gray-100 dark:bg-gray-800 rounded-lg p-4 text-center">
          <p className="text-gray-600 dark:text-gray-400 mb-2">Sign in to leave a review</p>
          <a href="/signin" className="text-green-600 hover:text-green-700 font-medium">
            Sign In →
          </a>
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
  );
}