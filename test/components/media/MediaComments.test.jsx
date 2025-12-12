/**
 * MediaComments Component Tests
 * Using Vitest (project's testing framework)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// Mock useAuth hook
const mockUseAuth = vi.fn();
vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => mockUseAuth(),
  default: () => mockUseAuth(),
}));

// Mock media-client
const mockGetMediaComments = vi.fn();
const mockAddMediaComment = vi.fn();
const mockUpdateMediaComment = vi.fn();
const mockDeleteMediaComment = vi.fn();
vi.mock('@/lib/media/media-client', () => ({
  getMediaComments: (...args) => mockGetMediaComments(...args),
  addMediaComment: (...args) => mockAddMediaComment(...args),
  updateMediaComment: (...args) => mockUpdateMediaComment(...args),
  deleteMediaComment: (...args) => mockDeleteMediaComment(...args),
}));

// Mock next/link
vi.mock('next/link', () => ({
  default: ({ children, href }) => <a href={href}>{children}</a>,
}));

// Mock next/image
vi.mock('next/image', () => ({
  default: ({ src, alt, ...props }) => <img src={src} alt={alt} {...props} />,
}));

// Mock window.confirm
vi.stubGlobal('confirm', vi.fn(() => true));

import MediaComments from '@/components/media/MediaComments';

describe('MediaComments Component', () => {
  const mockComments = [
    {
      id: 'comment-1',
      user_id: 'user-1',
      media_id: 'media-123',
      content: 'Great photo!',
      created_at: '2024-01-15T10:00:00Z',
      updated_at: '2024-01-15T10:00:00Z',
      profiles: {
        display_name: 'John Doe',
        avatar_url: 'https://example.com/avatar1.jpg',
      },
      replies: [],
    },
    {
      id: 'comment-2',
      user_id: 'user-2',
      media_id: 'media-123',
      content: 'Amazing view!',
      created_at: '2024-01-15T11:00:00Z',
      updated_at: '2024-01-15T11:00:00Z',
      profiles: {
        display_name: 'Jane Smith',
        avatar_url: 'https://example.com/avatar2.jpg',
      },
      replies: [],
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    mockGetMediaComments.mockResolvedValue({ comments: mockComments, error: null });
  });

  describe('Loading State', () => {
    beforeEach(() => {
      mockUseAuth.mockReturnValue({
        user: { id: 'user-123' },
        session: { access_token: 'test-token' },
        accessToken: 'test-token',
        loading: false,
      });
    });

    it('should show loading skeleton initially', () => {
      mockGetMediaComments.mockImplementation(() => new Promise(() => {})); // Never resolves

      render(<MediaComments mediaId="media-123" />);

      // Should show skeleton loaders (animate-pulse divs)
      const skeletons = document.querySelectorAll('.animate-pulse');
      expect(skeletons.length).toBeGreaterThan(0);
    });
  });

  describe('Rendering Comments', () => {
    beforeEach(() => {
      mockUseAuth.mockReturnValue({
        user: { id: 'user-123' },
        session: { access_token: 'test-token' },
        accessToken: 'test-token',
        loading: false,
      });
    });

    it('should fetch and display comments', async () => {
      render(<MediaComments mediaId="media-123" />);

      await waitFor(() => {
        expect(screen.getByText('Great photo!')).toBeInTheDocument();
        expect(screen.getByText('Amazing view!')).toBeInTheDocument();
      });
    });

    it('should display user names', async () => {
      render(<MediaComments mediaId="media-123" />);

      await waitFor(() => {
        expect(screen.getByText('John Doe')).toBeInTheDocument();
        expect(screen.getByText('Jane Smith')).toBeInTheDocument();
      });
    });

    it('should show empty state when no comments', async () => {
      mockGetMediaComments.mockResolvedValueOnce({ comments: [], error: null });

      render(<MediaComments mediaId="media-123" />);

      await waitFor(() => {
        expect(screen.getByText(/no comments yet/i)).toBeInTheDocument();
      });
    });

    it('should link to user profiles', async () => {
      render(<MediaComments mediaId="media-123" />);

      await waitFor(() => {
        const userLinks = screen.getAllByRole('link').filter((link) =>
          link.getAttribute('href')?.includes('/users/')
        );
        expect(userLinks.length).toBeGreaterThan(0);
      });
    });

    it('should call getMediaComments with correct mediaId', async () => {
      render(<MediaComments mediaId="media-123" />);

      await waitFor(() => {
        expect(mockGetMediaComments).toHaveBeenCalledWith('media-123');
      });
    });

    it('should show comments count in header', async () => {
      render(<MediaComments mediaId="media-123" />);

      await waitFor(() => {
        expect(screen.getByText(/comments \(2\)/i)).toBeInTheDocument();
      });
    });
  });

  describe('Adding Comments', () => {
    beforeEach(() => {
      mockUseAuth.mockReturnValue({
        user: { id: 'user-123', user_metadata: { avatar_url: null } },
        session: { access_token: 'test-token' },
        accessToken: 'test-token',
        loading: false,
      });
    });

    it('should show comment input form for authenticated users', async () => {
      render(<MediaComments mediaId="media-123" />);

      await waitFor(() => {
        expect(screen.getByPlaceholderText(/add a comment/i)).toBeInTheDocument();
      });
    });

    it('should submit comment when form is submitted', async () => {
      const newComment = {
        id: 'comment-3',
        user_id: 'user-123',
        media_id: 'media-123',
        content: 'New comment!',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        profiles: {
          display_name: 'Test User',
          avatar_url: null,
        },
        replies: [],
      };

      mockAddMediaComment.mockResolvedValueOnce({ comment: newComment, error: null });

      render(<MediaComments mediaId="media-123" />);

      await waitFor(() => {
        expect(screen.getByPlaceholderText(/add a comment/i)).toBeInTheDocument();
      });

      const input = screen.getByPlaceholderText(/add a comment/i);
      await userEvent.type(input, 'New comment!');

      const submitButton = screen.getByRole('button', { name: /post comment/i });
      await userEvent.click(submitButton);

      await waitFor(() => {
        expect(mockAddMediaComment).toHaveBeenCalledWith('test-token', 'media-123', {
          content: 'New comment!',
        });
      });
    });

    it('should add new comment to the list after submission', async () => {
      const newComment = {
        id: 'comment-3',
        user_id: 'user-123',
        media_id: 'media-123',
        content: 'New comment!',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        profiles: {
          display_name: 'Test User',
          avatar_url: null,
        },
        replies: [],
      };

      mockAddMediaComment.mockResolvedValueOnce({ comment: newComment, error: null });

      render(<MediaComments mediaId="media-123" />);

      await waitFor(() => {
        expect(screen.getByPlaceholderText(/add a comment/i)).toBeInTheDocument();
      });

      const input = screen.getByPlaceholderText(/add a comment/i);
      await userEvent.type(input, 'New comment!');

      const submitButton = screen.getByRole('button', { name: /post comment/i });
      await userEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText('New comment!')).toBeInTheDocument();
      });
    });

    it('should clear input after successful submission', async () => {
      const newComment = {
        id: 'comment-3',
        user_id: 'user-123',
        media_id: 'media-123',
        content: 'New comment!',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        profiles: {
          display_name: 'Test User',
          avatar_url: null,
        },
        replies: [],
      };

      mockAddMediaComment.mockResolvedValueOnce({ comment: newComment, error: null });

      render(<MediaComments mediaId="media-123" />);

      await waitFor(() => {
        expect(screen.getByPlaceholderText(/add a comment/i)).toBeInTheDocument();
      });

      const input = screen.getByPlaceholderText(/add a comment/i);
      await userEvent.type(input, 'New comment!');

      const submitButton = screen.getByRole('button', { name: /post comment/i });
      await userEvent.click(submitButton);

      await waitFor(() => {
        expect(input).toHaveValue('');
      });
    });

    it('should show error message on submission failure', async () => {
      mockAddMediaComment.mockResolvedValueOnce({
        comment: null,
        error: { message: 'Failed to add comment' },
      });

      render(<MediaComments mediaId="media-123" />);

      await waitFor(() => {
        expect(screen.getByPlaceholderText(/add a comment/i)).toBeInTheDocument();
      });

      const input = screen.getByPlaceholderText(/add a comment/i);
      await userEvent.type(input, 'New comment!');

      const submitButton = screen.getByRole('button', { name: /post comment/i });
      await userEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText(/failed to add comment/i)).toBeInTheDocument();
      });
    });

    it('should disable submit button when input is empty', async () => {
      render(<MediaComments mediaId="media-123" />);

      await waitFor(() => {
        const submitButton = screen.getByRole('button', { name: /post comment/i });
        expect(submitButton).toBeDisabled();
      });
    });
  });

  describe('Deleting Comments', () => {
    beforeEach(() => {
      mockUseAuth.mockReturnValue({
        user: { id: 'user-1' }, // Same as comment-1 author
        session: { access_token: 'test-token' },
        accessToken: 'test-token',
        loading: false,
      });
    });

    it('should show delete button for own comments', async () => {
      render(<MediaComments mediaId="media-123" />);

      await waitFor(() => {
        expect(screen.getByText('Great photo!')).toBeInTheDocument();
      });

      // Should have delete button for user-1's comment
      const deleteButtons = screen.getAllByRole('button', { name: /delete/i });
      expect(deleteButtons.length).toBeGreaterThan(0);
    });

    it('should not show delete button for other users comments', async () => {
      mockUseAuth.mockReturnValue({
        user: { id: 'user-999' }, // Different user
        session: { access_token: 'test-token' },
        accessToken: 'test-token',
        loading: false,
      });

      render(<MediaComments mediaId="media-123" />);

      await waitFor(() => {
        expect(screen.getByText('Great photo!')).toBeInTheDocument();
      });

      // Should not have any delete buttons
      const deleteButtons = screen.queryAllByRole('button', { name: /delete/i });
      expect(deleteButtons.length).toBe(0);
    });

    it('should delete comment when delete button is clicked', async () => {
      mockDeleteMediaComment.mockResolvedValueOnce({ error: null });

      render(<MediaComments mediaId="media-123" />);

      await waitFor(() => {
        expect(screen.getByText('Great photo!')).toBeInTheDocument();
      });

      const deleteButton = screen.getAllByRole('button', { name: /delete/i })[0];
      await userEvent.click(deleteButton);

      await waitFor(() => {
        expect(mockDeleteMediaComment).toHaveBeenCalledWith('test-token', 'media-123', 'comment-1');
      });
    });

    it('should remove comment from list after deletion', async () => {
      mockDeleteMediaComment.mockResolvedValueOnce({ error: null });

      render(<MediaComments mediaId="media-123" />);

      await waitFor(() => {
        expect(screen.getByText('Great photo!')).toBeInTheDocument();
      });

      const deleteButton = screen.getAllByRole('button', { name: /delete/i })[0];
      await userEvent.click(deleteButton);

      await waitFor(() => {
        expect(screen.queryByText('Great photo!')).not.toBeInTheDocument();
      });
    });
  });

  describe('Editing Comments', () => {
    beforeEach(() => {
      mockUseAuth.mockReturnValue({
        user: { id: 'user-1' }, // Same as comment-1 author
        session: { access_token: 'test-token' },
        accessToken: 'test-token',
        loading: false,
      });
    });

    it('should show edit button for own comments', async () => {
      render(<MediaComments mediaId="media-123" />);

      await waitFor(() => {
        expect(screen.getByText('Great photo!')).toBeInTheDocument();
      });

      const editButtons = screen.getAllByRole('button', { name: /edit/i });
      expect(editButtons.length).toBeGreaterThan(0);
    });

    it('should show edit form when edit button is clicked', async () => {
      render(<MediaComments mediaId="media-123" />);

      await waitFor(() => {
        expect(screen.getByText('Great photo!')).toBeInTheDocument();
      });

      const editButton = screen.getAllByRole('button', { name: /edit/i })[0];
      await userEvent.click(editButton);

      await waitFor(() => {
        expect(screen.getByDisplayValue('Great photo!')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /save/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument();
      });
    });

    it('should update comment when save is clicked', async () => {
      const updatedComment = {
        ...mockComments[0],
        content: 'Updated comment!',
        updated_at: new Date().toISOString(),
      };

      mockUpdateMediaComment.mockResolvedValueOnce({ comment: updatedComment, error: null });

      render(<MediaComments mediaId="media-123" />);

      await waitFor(() => {
        expect(screen.getByText('Great photo!')).toBeInTheDocument();
      });

      const editButton = screen.getAllByRole('button', { name: /edit/i })[0];
      await userEvent.click(editButton);

      const textarea = screen.getByDisplayValue('Great photo!');
      await userEvent.clear(textarea);
      await userEvent.type(textarea, 'Updated comment!');

      const saveButton = screen.getByRole('button', { name: /save/i });
      await userEvent.click(saveButton);

      await waitFor(() => {
        expect(mockUpdateMediaComment).toHaveBeenCalledWith(
          'test-token',
          'media-123',
          'comment-1',
          'Updated comment!'
        );
      });
    });
  });

  describe('Unauthenticated User', () => {
    beforeEach(() => {
      mockUseAuth.mockReturnValue({
        user: null,
        session: null,
        accessToken: null,
        loading: false,
      });
    });

    it('should still display comments', async () => {
      render(<MediaComments mediaId="media-123" />);

      await waitFor(() => {
        expect(screen.getByText('Great photo!')).toBeInTheDocument();
      });
    });

    it('should show sign in prompt instead of comment form', async () => {
      render(<MediaComments mediaId="media-123" />);

      await waitFor(() => {
        expect(screen.getByText(/sign in to leave a comment/i)).toBeInTheDocument();
      });
    });

    it('should not show delete buttons', async () => {
      render(<MediaComments mediaId="media-123" />);

      await waitFor(() => {
        expect(screen.getByText('Great photo!')).toBeInTheDocument();
      });

      const deleteButtons = screen.queryAllByRole('button', { name: /delete/i });
      expect(deleteButtons.length).toBe(0);
    });

    it('should not show edit buttons', async () => {
      render(<MediaComments mediaId="media-123" />);

      await waitFor(() => {
        expect(screen.getByText('Great photo!')).toBeInTheDocument();
      });

      const editButtons = screen.queryAllByRole('button', { name: /edit/i });
      expect(editButtons.length).toBe(0);
    });
  });

  describe('Access Token Handling', () => {
    it('should correctly extract access_token from session', async () => {
      mockUseAuth.mockReturnValue({
        user: { id: 'user-123' },
        session: { access_token: 'my-secret-token' },
        accessToken: 'my-secret-token',
        loading: false,
      });

      const newComment = {
        id: 'comment-3',
        user_id: 'user-123',
        media_id: 'media-123',
        content: 'Test',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        profiles: { display_name: 'Test', avatar_url: null },
        replies: [],
      };

      mockAddMediaComment.mockResolvedValueOnce({ comment: newComment, error: null });

      render(<MediaComments mediaId="media-123" />);

      await waitFor(() => {
        expect(screen.getByPlaceholderText(/add a comment/i)).toBeInTheDocument();
      });

      const input = screen.getByPlaceholderText(/add a comment/i);
      await userEvent.type(input, 'Test');

      const submitButton = screen.getByRole('button', { name: /post comment/i });
      await userEvent.click(submitButton);

      await waitFor(() => {
        expect(mockAddMediaComment).toHaveBeenCalledWith('my-secret-token', 'media-123', {
          content: 'Test',
        });
      });
    });

    it('should handle null session gracefully', () => {
      mockUseAuth.mockReturnValue({
        user: { id: 'user-123' },
        session: null,
        accessToken: null,
        loading: false,
      });

      // Should not throw
      expect(() => render(<MediaComments mediaId="media-123" />)).not.toThrow();
    });
  });

  describe('Error Handling', () => {
    beforeEach(() => {
      mockUseAuth.mockReturnValue({
        user: { id: 'user-123' },
        session: { access_token: 'test-token' },
        accessToken: 'test-token',
        loading: false,
      });
    });

    it('should show error message when fetching comments fails', async () => {
      mockGetMediaComments.mockResolvedValueOnce({
        comments: null,
        error: { message: 'Failed to load comments' },
      });

      render(<MediaComments mediaId="media-123" />);

      await waitFor(() => {
        expect(screen.getByText(/failed to load comments/i)).toBeInTheDocument();
      });
    });
  });
});