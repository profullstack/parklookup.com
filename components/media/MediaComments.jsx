'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useAuth } from '@/hooks/useAuth';
import {
  getMediaComments,
  addMediaComment,
  updateMediaComment,
  deleteMediaComment,
} from '@/lib/media/media-client';

/**
 * Format relative time
 */
const formatRelativeTime = (dateString) => {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now - date;
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffDays > 7) {
    return date.toLocaleDateString();
  } else if (diffDays > 0) {
    return `${diffDays}d ago`;
  } else if (diffHours > 0) {
    return `${diffHours}h ago`;
  } else if (diffMins > 0) {
    return `${diffMins}m ago`;
  } else {
    return 'Just now';
  }
};

/**
 * Single Comment Component
 */
function Comment({ comment, mediaId, currentUserId, accessToken, onDelete, onUpdate, depth = 0 }) {
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(comment.content);
  const [isReplying, setIsReplying] = useState(false);
  const [replyContent, setReplyContent] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showReplies, setShowReplies] = useState(true);

  const isOwner = currentUserId === comment.user_id;
  const maxDepth = 2;

  const handleEdit = async () => {
    if (!editContent.trim() || isSubmitting) return;

    setIsSubmitting(true);
    const { comment: updated, error } = await updateMediaComment(
      accessToken,
      mediaId,
      comment.id,
      editContent.trim()
    );

    if (!error && updated) {
      onUpdate(comment.id, updated);
      setIsEditing(false);
    }
    setIsSubmitting(false);
  };

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this comment?')) return;

    setIsSubmitting(true);
    const { error } = await deleteMediaComment(accessToken, mediaId, comment.id);

    if (!error) {
      onDelete(comment.id);
    }
    setIsSubmitting(false);
  };

  const handleReply = async () => {
    if (!replyContent.trim() || isSubmitting) return;

    setIsSubmitting(true);
    const { comment: newReply, error } = await addMediaComment(accessToken, mediaId, {
      content: replyContent.trim(),
      parentId: comment.id,
    });

    if (!error && newReply) {
      // Add reply to comment's replies
      comment.replies = [...(comment.replies || []), newReply];
      setReplyContent('');
      setIsReplying(false);
    }
    setIsSubmitting(false);
  };

  return (
    <div className={`${depth > 0 ? 'ml-8 border-l-2 border-gray-200 dark:border-gray-700 pl-4' : ''}`}>
      <div className="flex gap-3">
        {/* Avatar */}
        <Link href={`/users/${comment.user_id}`} className="flex-shrink-0">
          {comment.profiles?.avatar_url ? (
            <Image
              src={comment.profiles.avatar_url}
              alt={comment.profiles.display_name || 'User'}
              width={32}
              height={32}
              className="rounded-full"
            />
          ) : (
            <div className="w-8 h-8 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center">
              <svg className="w-5 h-5 text-gray-400" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
              </svg>
            </div>
          )}
        </Link>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <Link
              href={`/users/${comment.user_id}`}
              className="text-sm font-medium text-gray-900 dark:text-white hover:underline"
            >
              {comment.profiles?.display_name || 'Anonymous'}
            </Link>
            <span className="text-xs text-gray-500 dark:text-gray-400">
              {formatRelativeTime(comment.created_at)}
            </span>
            {comment.updated_at !== comment.created_at && (
              <span className="text-xs text-gray-400 dark:text-gray-500">(edited)</span>
            )}
          </div>

          {isEditing ? (
            <div className="space-y-2">
              <textarea
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm resize-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                rows={2}
                disabled={isSubmitting}
              />
              <div className="flex gap-2">
                <button
                  onClick={handleEdit}
                  disabled={isSubmitting || !editContent.trim()}
                  className="px-3 py-1 text-sm bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50 transition-colors"
                >
                  Save
                </button>
                <button
                  onClick={() => {
                    setIsEditing(false);
                    setEditContent(comment.content);
                  }}
                  disabled={isSubmitting}
                  className="px-3 py-1 text-sm bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-300 dark:hover:bg-gray-500 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap break-words">
              {comment.content}
            </p>
          )}

          {/* Actions */}
          {!isEditing && (
            <div className="flex items-center gap-4 mt-2">
              {currentUserId && depth < maxDepth && (
                <button
                  onClick={() => setIsReplying(!isReplying)}
                  className="text-xs text-gray-500 dark:text-gray-400 hover:text-green-600 dark:hover:text-green-400"
                >
                  Reply
                </button>
              )}
              {isOwner && (
                <>
                  <button
                    onClick={() => setIsEditing(true)}
                    className="text-xs text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400"
                  >
                    Edit
                  </button>
                  <button
                    onClick={handleDelete}
                    disabled={isSubmitting}
                    className="text-xs text-gray-500 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400"
                  >
                    Delete
                  </button>
                </>
              )}
            </div>
          )}

          {/* Reply Form */}
          {isReplying && (
            <div className="mt-3 space-y-2">
              <textarea
                value={replyContent}
                onChange={(e) => setReplyContent(e.target.value)}
                placeholder="Write a reply..."
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm resize-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                rows={2}
                disabled={isSubmitting}
              />
              <div className="flex gap-2">
                <button
                  onClick={handleReply}
                  disabled={isSubmitting || !replyContent.trim()}
                  className="px-3 py-1 text-sm bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50 transition-colors"
                >
                  Reply
                </button>
                <button
                  onClick={() => {
                    setIsReplying(false);
                    setReplyContent('');
                  }}
                  disabled={isSubmitting}
                  className="px-3 py-1 text-sm bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-300 dark:hover:bg-gray-500 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Replies */}
      {comment.replies?.length > 0 && (
        <div className="mt-4">
          {comment.replies.length > 2 && (
            <button
              onClick={() => setShowReplies(!showReplies)}
              className="text-xs text-gray-500 dark:text-gray-400 hover:text-green-600 dark:hover:text-green-400 mb-2"
            >
              {showReplies ? 'Hide' : 'Show'} {comment.replies.length} replies
            </button>
          )}
          {showReplies && (
            <div className="space-y-4">
              {comment.replies.map((reply) => (
                <Comment
                  key={reply.id}
                  comment={reply}
                  mediaId={mediaId}
                  currentUserId={currentUserId}
                  accessToken={accessToken}
                  onDelete={onDelete}
                  onUpdate={onUpdate}
                  depth={depth + 1}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Media Comments Component
 * Displays and manages comments for a media item
 */
export default function MediaComments({ mediaId }) {
  const { user, accessToken } = useAuth();
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [newComment, setNewComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    loadComments();
  }, [mediaId]);

  const loadComments = async () => {
    setLoading(true);
    setError(null);

    const { comments: fetchedComments, error: fetchError } = await getMediaComments(mediaId);

    if (fetchError) {
      setError(fetchError.message);
    } else {
      setComments(fetchedComments);
    }

    setLoading(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!newComment.trim() || !accessToken || isSubmitting) return;

    setIsSubmitting(true);
    const { comment, error: submitError } = await addMediaComment(accessToken, mediaId, {
      content: newComment.trim(),
    });

    if (submitError) {
      setError(submitError.message);
    } else if (comment) {
      setComments((prev) => [...prev, comment]);
      setNewComment('');
    }

    setIsSubmitting(false);
  };

  const handleDelete = (commentId) => {
    setComments((prev) => prev.filter((c) => c.id !== commentId));
  };

  const handleUpdate = (commentId, updatedComment) => {
    setComments((prev) =>
      prev.map((c) => (c.id === commentId ? { ...c, ...updatedComment } : c))
    );
  };

  if (loading) {
    return (
      <div className="space-y-4">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="flex gap-3 animate-pulse">
            <div className="w-8 h-8 rounded-full bg-gray-200 dark:bg-gray-700" />
            <div className="flex-1 space-y-2">
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/4" />
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
        Comments ({comments.length})
      </h3>

      {/* Comment Form */}
      {user ? (
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="flex gap-3">
            {user.user_metadata?.avatar_url ? (
              <Image
                src={user.user_metadata.avatar_url}
                alt="Your avatar"
                width={32}
                height={32}
                className="rounded-full flex-shrink-0"
              />
            ) : (
              <div className="w-8 h-8 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5 text-gray-400" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
                </svg>
              </div>
            )}
            <textarea
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              placeholder="Add a comment..."
              className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm resize-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
              rows={2}
              disabled={isSubmitting}
              maxLength={1000}
            />
          </div>
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={isSubmitting || !newComment.trim()}
              className="px-4 py-2 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isSubmitting ? 'Posting...' : 'Post Comment'}
            </button>
          </div>
        </form>
      ) : (
        <div className="text-center py-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
          <p className="text-gray-600 dark:text-gray-400 mb-2">Sign in to leave a comment</p>
          <a
            href="/signin"
            className="inline-flex items-center px-4 py-2 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 transition-colors"
          >
            Sign In
          </a>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        </div>
      )}

      {/* Comments List */}
      {comments.length === 0 ? (
        <div className="text-center py-8">
          <svg className="w-12 h-12 mx-auto text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
          <p className="text-gray-600 dark:text-gray-400">No comments yet. Be the first to comment!</p>
        </div>
      ) : (
        <div className="space-y-6">
          {comments.map((comment) => (
            <Comment
              key={comment.id}
              comment={comment}
              mediaId={mediaId}
              currentUserId={user?.id}
              accessToken={accessToken}
              onDelete={handleDelete}
              onUpdate={handleUpdate}
            />
          ))}
        </div>
      )}
    </div>
  );
}