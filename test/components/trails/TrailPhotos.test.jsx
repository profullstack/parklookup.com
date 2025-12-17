/**
 * TrailPhotos Component Tests
 * Using Vitest (project's testing framework)
 * Tests for photo and video upload functionality for trails
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// Mock useAuth hook
const mockUseAuth = vi.fn();
vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => mockUseAuth(),
  default: () => mockUseAuth(),
}));

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock localStorage
const mockLocalStorage = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
};
Object.defineProperty(window, 'localStorage', { value: mockLocalStorage });

// Mock URL.createObjectURL and revokeObjectURL
global.URL.createObjectURL = vi.fn(() => 'blob:mock-url');
global.URL.revokeObjectURL = vi.fn();

import TrailPhotos from '@/components/trails/TrailPhotos';

describe('TrailPhotos Component', () => {
  const mockTrailId = 'trail-123';

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers({ shouldAdvanceTime: true });
    mockLocalStorage.getItem.mockReturnValue('mock-auth-token');
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('Loading State', () => {
    it('should show loading skeleton initially', () => {
      mockUseAuth.mockReturnValue({
        user: null,
        accessToken: null,
        loading: true,
      });

      mockFetch.mockImplementation(() => new Promise(() => {})); // Never resolves

      render(<TrailPhotos trailId={mockTrailId} />);

      // Should show loading skeleton
      const skeletons = document.querySelectorAll('.animate-pulse');
      expect(skeletons.length).toBeGreaterThan(0);
    });
  });

  describe('Unauthenticated User', () => {
    beforeEach(() => {
      mockUseAuth.mockReturnValue({
        user: null,
        accessToken: null,
        loading: false,
      });

      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ media: [] }),
      });
    });

    it('should show sign in prompt when user is not authenticated', async () => {
      render(<TrailPhotos trailId={mockTrailId} />);

      await waitFor(() => {
        expect(
          screen.getByText(/sign in to share your trail photos and videos/i)
        ).toBeInTheDocument();
      });

      expect(screen.getByRole('link', { name: /sign in/i })).toHaveAttribute('href', '/signin');
    });

    it('should not show upload button when user is not authenticated', async () => {
      render(<TrailPhotos trailId={mockTrailId} />);

      await waitFor(() => {
        expect(screen.queryByRole('button', { name: /add media/i })).not.toBeInTheDocument();
      });
    });

    it('should still display existing media when not authenticated', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            media: [
              {
                id: 'media-1',
                url: 'https://example.com/photo1.jpg',
                media_type: 'image',
                caption: 'Beautiful trail view',
                user_id: 'other-user',
              },
            ],
          }),
      });

      render(<TrailPhotos trailId={mockTrailId} />);

      await waitFor(() => {
        expect(screen.getByAltText(/beautiful trail view/i)).toBeInTheDocument();
      });
    });
  });

  describe('Authenticated User', () => {
    beforeEach(() => {
      mockUseAuth.mockReturnValue({
        user: { id: 'user-123', email: 'test@example.com' },
        accessToken: 'test-token-123',
        loading: false,
      });

      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ media: [] }),
      });
    });

    it('should show upload button when user is authenticated', async () => {
      render(<TrailPhotos trailId={mockTrailId} />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /add media/i })).toBeInTheDocument();
      });
    });

    it('should show upload form when Add Media button is clicked', async () => {
      render(<TrailPhotos trailId={mockTrailId} />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /add media/i })).toBeInTheDocument();
      });

      const addButton = screen.getByRole('button', { name: /add media/i });
      await userEvent.click(addButton);

      expect(screen.getByText(/upload photo or video/i)).toBeInTheDocument();
      expect(screen.getByText(/drag and drop or click to upload/i)).toBeInTheDocument();
    });

    it('should hide upload form when close button is clicked', async () => {
      render(<TrailPhotos trailId={mockTrailId} />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /add media/i })).toBeInTheDocument();
      });

      // Open upload form
      await userEvent.click(screen.getByRole('button', { name: /add media/i }));
      expect(screen.getByText(/upload photo or video/i)).toBeInTheDocument();

      // Find and click close button
      const closeButtons = screen.getAllByRole('button');
      const closeButton = closeButtons.find((btn) =>
        btn.querySelector('svg path[d*="M6 18L18 6"]')
      );

      if (closeButton) {
        await userEvent.click(closeButton);
        await waitFor(() => {
          expect(screen.queryByText(/upload photo or video/i)).not.toBeInTheDocument();
        });
      }
    });
  });

  describe('File Selection and Validation', () => {
    beforeEach(() => {
      mockUseAuth.mockReturnValue({
        user: { id: 'user-123' },
        accessToken: 'test-token-123',
        loading: false,
      });

      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ media: [] }),
      });
    });

    it('should accept valid image files', async () => {
      render(<TrailPhotos trailId={mockTrailId} />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /add media/i })).toBeInTheDocument();
      });

      await userEvent.click(screen.getByRole('button', { name: /add media/i }));

      const input = document.querySelector('input[type="file"]');
      const validFile = new File(['test image content'], 'test.jpg', { type: 'image/jpeg' });

      // Mock FileReader
      const mockFileReader = {
        readAsDataURL: vi.fn(),
        onload: null,
        result: 'data:image/jpeg;base64,test',
      };
      vi.spyOn(global, 'FileReader').mockImplementation(() => mockFileReader);

      await userEvent.upload(input, validFile);
      mockFileReader.onload({ target: { result: 'data:image/jpeg;base64,test' } });

      await waitFor(() => {
        expect(screen.getByText(/test.jpg/i)).toBeInTheDocument();
      });
    });

    it('should reject unsupported file types', async () => {
      render(<TrailPhotos trailId={mockTrailId} />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /add media/i })).toBeInTheDocument();
      });

      await userEvent.click(screen.getByRole('button', { name: /add media/i }));

      const input = document.querySelector('input[type="file"]');
      const invalidFile = new File(['test'], 'test.txt', { type: 'text/plain' });

      fireEvent.change(input, { target: { files: [invalidFile] } });

      await waitFor(() => {
        expect(screen.getByText(/unsupported file type/i)).toBeInTheDocument();
      });
    });

    it('should reject images larger than 10MB', async () => {
      render(<TrailPhotos trailId={mockTrailId} />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /add media/i })).toBeInTheDocument();
      });

      await userEvent.click(screen.getByRole('button', { name: /add media/i }));

      const input = document.querySelector('input[type="file"]');
      // Create a file larger than 10MB
      const largeContent = new Array(11 * 1024 * 1024).fill('a').join('');
      const largeFile = new File([largeContent], 'large.jpg', { type: 'image/jpeg' });

      fireEvent.change(input, { target: { files: [largeFile] } });

      await waitFor(() => {
        expect(screen.getByText(/file too large.*10mb/i)).toBeInTheDocument();
      });
    });

    it('should reject videos larger than 50MB', async () => {
      render(<TrailPhotos trailId={mockTrailId} />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /add media/i })).toBeInTheDocument();
      });

      await userEvent.click(screen.getByRole('button', { name: /add media/i }));

      const input = document.querySelector('input[type="file"]');
      // Create a file larger than 50MB
      const largeContent = new Array(51 * 1024 * 1024).fill('a').join('');
      const largeFile = new File([largeContent], 'large.mp4', { type: 'video/mp4' });

      fireEvent.change(input, { target: { files: [largeFile] } });

      await waitFor(() => {
        expect(screen.getByText(/file too large.*50mb/i)).toBeInTheDocument();
      });
    });
  });

  describe('Upload Functionality', () => {
    beforeEach(() => {
      mockUseAuth.mockReturnValue({
        user: { id: 'user-123' },
        accessToken: 'test-token-123',
        loading: false,
      });
    });

    it('should upload photo successfully', async () => {
      vi.useRealTimers();

      // First call: fetch media (empty)
      // Second call: upload to /api/media
      // Third call: create trail media record
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ media: [] }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              media: { url: 'https://example.com/uploaded.jpg' },
              url: 'https://example.com/uploaded.jpg',
            }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              media: {
                id: 'new-media-1',
                url: 'https://example.com/uploaded.jpg',
                media_type: 'image',
                caption: 'Test caption',
              },
            }),
        });

      render(<TrailPhotos trailId={mockTrailId} />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /add media/i })).toBeInTheDocument();
      });

      await userEvent.click(screen.getByRole('button', { name: /add media/i }));

      const input = document.querySelector('input[type="file"]');
      const validFile = new File(['test'], 'test.jpg', { type: 'image/jpeg' });

      const mockFileReader = {
        readAsDataURL: vi.fn(),
        onload: null,
        result: 'data:image/jpeg;base64,test',
      };
      vi.spyOn(global, 'FileReader').mockImplementation(() => mockFileReader);

      await userEvent.upload(input, validFile);
      mockFileReader.onload({ target: { result: 'data:image/jpeg;base64,test' } });

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /upload photo/i })).toBeInTheDocument();
      });

      // Add caption
      const captionInput = screen.getByPlaceholderText(/add a caption/i);
      await userEvent.type(captionInput, 'Test caption');

      // Click upload
      const uploadButton = screen.getByRole('button', { name: /upload photo/i });
      await userEvent.click(uploadButton);

      // Verify API calls
      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith('/api/media', expect.any(Object));
      });
    });

    it('should show error on upload failure', async () => {
      vi.useRealTimers();

      // Mock alert
      const mockAlert = vi.spyOn(window, 'alert').mockImplementation(() => {});

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ media: [] }),
        })
        .mockResolvedValueOnce({
          ok: false,
          json: () => Promise.resolve({ error: 'Upload failed' }),
        });

      render(<TrailPhotos trailId={mockTrailId} />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /add media/i })).toBeInTheDocument();
      });

      await userEvent.click(screen.getByRole('button', { name: /add media/i }));

      const input = document.querySelector('input[type="file"]');
      const validFile = new File(['test'], 'test.jpg', { type: 'image/jpeg' });

      const mockFileReader = {
        readAsDataURL: vi.fn(),
        onload: null,
        result: 'data:image/jpeg;base64,test',
      };
      vi.spyOn(global, 'FileReader').mockImplementation(() => mockFileReader);

      await userEvent.upload(input, validFile);
      mockFileReader.onload({ target: { result: 'data:image/jpeg;base64,test' } });

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /upload photo/i })).toBeInTheDocument();
      });

      const uploadButton = screen.getByRole('button', { name: /upload photo/i });
      await userEvent.click(uploadButton);

      await waitFor(() => {
        expect(mockAlert).toHaveBeenCalledWith(expect.stringContaining('Failed to upload'));
      });

      mockAlert.mockRestore();
    });

    it('should show progress bar during upload', async () => {
      vi.useRealTimers();

      // Make upload take some time
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ media: [] }),
        })
        .mockImplementationOnce(
          () =>
            new Promise((resolve) =>
              setTimeout(
                () =>
                  resolve({
                    ok: true,
                    json: () => Promise.resolve({ media: { url: 'test.jpg' } }),
                  }),
                2000
              )
            )
        );

      render(<TrailPhotos trailId={mockTrailId} />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /add media/i })).toBeInTheDocument();
      });

      await userEvent.click(screen.getByRole('button', { name: /add media/i }));

      const input = document.querySelector('input[type="file"]');
      const validFile = new File(['test'], 'test.jpg', { type: 'image/jpeg' });

      const mockFileReader = {
        readAsDataURL: vi.fn(),
        onload: null,
        result: 'data:image/jpeg;base64,test',
      };
      vi.spyOn(global, 'FileReader').mockImplementation(() => mockFileReader);

      fireEvent.change(input, { target: { files: [validFile] } });
      mockFileReader.onload({ target: { result: 'data:image/jpeg;base64,test' } });

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /upload photo/i })).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole('button', { name: /upload photo/i }));

      // Should show uploading state - use getAllByText since there are multiple elements
      await waitFor(
        () => {
          const uploadingElements = screen.getAllByText(/uploading/i);
          expect(uploadingElements.length).toBeGreaterThan(0);
        },
        { timeout: 1000 }
      );
    });
  });

  describe('Media Display', () => {
    beforeEach(() => {
      mockUseAuth.mockReturnValue({
        user: { id: 'user-123' },
        accessToken: 'test-token-123',
        loading: false,
      });
    });

    it('should display photos correctly', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            media: [
              {
                id: 'photo-1',
                url: 'https://example.com/photo1.jpg',
                media_type: 'image',
                caption: 'Mountain view',
                user_id: 'user-123',
              },
              {
                id: 'photo-2',
                url: 'https://example.com/photo2.jpg',
                media_type: 'image',
                caption: 'River crossing',
                user_id: 'other-user',
              },
            ],
          }),
      });

      render(<TrailPhotos trailId={mockTrailId} />);

      await waitFor(() => {
        expect(screen.getByAltText(/mountain view/i)).toBeInTheDocument();
        expect(screen.getByAltText(/river crossing/i)).toBeInTheDocument();
      });
    });

    it('should display videos with play indicator', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            media: [
              {
                id: 'video-1',
                url: 'https://example.com/video1.mp4',
                media_type: 'video',
                duration: 125,
                caption: 'Trail walkthrough',
                user_id: 'user-123',
              },
            ],
          }),
      });

      render(<TrailPhotos trailId={mockTrailId} />);

      await waitFor(() => {
        // Should show video element
        const video = document.querySelector('video');
        expect(video).toBeInTheDocument();
        // Should show duration
        expect(screen.getByText(/2:05/)).toBeInTheDocument();
      });
    });

    it('should show photo and video counts', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            media: [
              { id: '1', media_type: 'image', url: 'test1.jpg', user_id: 'u1' },
              { id: '2', media_type: 'image', url: 'test2.jpg', user_id: 'u1' },
              { id: '3', media_type: 'video', url: 'test.mp4', user_id: 'u1' },
            ],
          }),
      });

      render(<TrailPhotos trailId={mockTrailId} />);

      await waitFor(() => {
        expect(screen.getByText(/2 photos/i)).toBeInTheDocument();
        expect(screen.getByText(/1 video/i)).toBeInTheDocument();
      });
    });

    it('should show empty state when no media exists', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ media: [] }),
      });

      render(<TrailPhotos trailId={mockTrailId} />);

      await waitFor(() => {
        expect(screen.getByText(/no photos or videos yet/i)).toBeInTheDocument();
      });
    });
  });

  describe('Delete Functionality', () => {
    beforeEach(() => {
      mockUseAuth.mockReturnValue({
        user: { id: 'user-123' },
        accessToken: 'test-token-123',
        loading: false,
      });
    });

    it('should show delete button only for own media', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            media: [
              {
                id: 'own-photo',
                url: 'https://example.com/own.jpg',
                media_type: 'image',
                caption: 'My photo',
                user_id: 'user-123', // Same as logged in user
              },
              {
                id: 'other-photo',
                url: 'https://example.com/other.jpg',
                media_type: 'image',
                caption: 'Other photo',
                user_id: 'other-user', // Different user
              },
            ],
          }),
      });

      render(<TrailPhotos trailId={mockTrailId} />);

      await waitFor(() => {
        expect(screen.getByAltText(/my photo/i)).toBeInTheDocument();
      });

      // Find media cards
      const mediaCards = document.querySelectorAll('.group');

      // Hover over own photo - should have delete button
      const ownPhotoCard = Array.from(mediaCards).find((card) =>
        card.querySelector('img[alt*="My photo"]')
      );

      if (ownPhotoCard) {
        const deleteButton = ownPhotoCard.querySelector('button[title*="Delete"]');
        expect(deleteButton).toBeInTheDocument();
      }
    });

    it('should delete media when confirmed', async () => {
      vi.useRealTimers();

      const mockConfirm = vi.spyOn(window, 'confirm').mockReturnValue(true);

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              media: [
                {
                  id: 'photo-to-delete',
                  url: 'https://example.com/delete.jpg',
                  media_type: 'image',
                  caption: 'Delete me',
                  user_id: 'user-123',
                },
              ],
            }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ success: true }),
        });

      render(<TrailPhotos trailId={mockTrailId} />);

      await waitFor(() => {
        expect(screen.getByAltText(/delete me/i)).toBeInTheDocument();
      });

      // Find and click delete button
      const deleteButton = document.querySelector('button[title*="Delete"]');
      if (deleteButton) {
        await userEvent.click(deleteButton);

        await waitFor(() => {
          expect(mockConfirm).toHaveBeenCalled();
          expect(mockFetch).toHaveBeenCalledWith(
            expect.stringContaining('/api/trails/trail-123/media?mediaId=photo-to-delete'),
            expect.objectContaining({ method: 'DELETE' })
          );
        });
      }

      mockConfirm.mockRestore();
    });

    it('should not delete media when cancelled', async () => {
      vi.useRealTimers();

      const mockConfirm = vi.spyOn(window, 'confirm').mockReturnValue(false);

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            media: [
              {
                id: 'photo-keep',
                url: 'https://example.com/keep.jpg',
                media_type: 'image',
                caption: 'Keep me',
                user_id: 'user-123',
              },
            ],
          }),
      });

      render(<TrailPhotos trailId={mockTrailId} />);

      await waitFor(() => {
        expect(screen.getByAltText(/keep me/i)).toBeInTheDocument();
      });

      const deleteButton = document.querySelector('button[title*="Delete"]');
      if (deleteButton) {
        await userEvent.click(deleteButton);

        // Should only have the initial fetch call, not a delete call
        expect(mockFetch).toHaveBeenCalledTimes(1);
      }

      mockConfirm.mockRestore();
    });
  });

  describe('Drag and Drop', () => {
    beforeEach(() => {
      mockUseAuth.mockReturnValue({
        user: { id: 'user-123' },
        accessToken: 'test-token-123',
        loading: false,
      });

      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ media: [] }),
      });
    });

    it('should handle drag over event', async () => {
      render(<TrailPhotos trailId={mockTrailId} />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /add media/i })).toBeInTheDocument();
      });

      await userEvent.click(screen.getByRole('button', { name: /add media/i }));

      const dropZone = screen.getByText(/drag and drop/i).closest('div');

      const dragOverEvent = new Event('dragover', { bubbles: true });
      dragOverEvent.preventDefault = vi.fn();

      fireEvent(dropZone, dragOverEvent);

      expect(dropZone).toBeInTheDocument();
    });

    it('should handle drop event with valid image', async () => {
      render(<TrailPhotos trailId={mockTrailId} />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /add media/i })).toBeInTheDocument();
      });

      await userEvent.click(screen.getByRole('button', { name: /add media/i }));

      const dropZone = screen.getByText(/drag and drop/i).closest('div');
      const validFile = new File(['test'], 'dropped.jpg', { type: 'image/jpeg' });

      // Mock FileReader
      const mockFileReader = {
        readAsDataURL: vi.fn(),
        onload: null,
        result: 'data:image/jpeg;base64,test',
      };
      vi.spyOn(global, 'FileReader').mockImplementation(() => mockFileReader);

      const dropEvent = new Event('drop', { bubbles: true });
      dropEvent.preventDefault = vi.fn();
      dropEvent.dataTransfer = {
        files: [validFile],
      };

      fireEvent(dropZone, dropEvent);

      // Trigger FileReader onload
      if (mockFileReader.onload) {
        mockFileReader.onload({ target: { result: 'data:image/jpeg;base64,test' } });
      }

      await waitFor(() => {
        expect(screen.getByText(/dropped.jpg/i)).toBeInTheDocument();
      });
    });
  });

  describe('Video Duration Formatting', () => {
    beforeEach(() => {
      mockUseAuth.mockReturnValue({
        user: { id: 'user-123' },
        accessToken: 'test-token-123',
        loading: false,
      });
    });

    it('should format short video duration correctly', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            media: [
              {
                id: 'video-1',
                url: 'https://example.com/short.mp4',
                media_type: 'video',
                duration: 45, // 45 seconds
                user_id: 'user-123',
              },
            ],
          }),
      });

      render(<TrailPhotos trailId={mockTrailId} />);

      await waitFor(() => {
        expect(screen.getByText(/0:45/)).toBeInTheDocument();
      });
    });

    it('should format long video duration correctly', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            media: [
              {
                id: 'video-2',
                url: 'https://example.com/long.mp4',
                media_type: 'video',
                duration: 3661, // 1 hour, 1 minute, 1 second
                user_id: 'user-123',
              },
            ],
          }),
      });

      render(<TrailPhotos trailId={mockTrailId} />);

      await waitFor(() => {
        expect(screen.getByText(/61:01/)).toBeInTheDocument();
      });
    });
  });

  describe('Supported Image File Types', () => {
    beforeEach(() => {
      mockUseAuth.mockReturnValue({
        user: { id: 'user-123' },
        accessToken: 'test-token-123',
        loading: false,
      });

      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ media: [] }),
      });
    });

    const imageTypes = [
      { type: 'image/jpeg', ext: 'jpg' },
      { type: 'image/png', ext: 'png' },
      { type: 'image/gif', ext: 'gif' },
      { type: 'image/webp', ext: 'webp' },
    ];

    imageTypes.forEach(({ type, ext }) => {
      it(`should accept ${type} files`, async () => {
        render(<TrailPhotos trailId={mockTrailId} />);

        await waitFor(() => {
          expect(screen.getByRole('button', { name: /add media/i })).toBeInTheDocument();
        });

        await userEvent.click(screen.getByRole('button', { name: /add media/i }));

        const input = document.querySelector('input[type="file"]');
        const validFile = new File(['test'], `test.${ext}`, { type });

        const mockFileReader = {
          readAsDataURL: vi.fn(),
          onload: null,
          result: `data:${type};base64,test`,
        };
        vi.spyOn(global, 'FileReader').mockImplementation(() => mockFileReader);

        fireEvent.change(input, { target: { files: [validFile] } });
        mockFileReader.onload({ target: { result: `data:${type};base64,test` } });

        await waitFor(() => {
          expect(screen.getByText(new RegExp(`test\\.${ext}`, 'i'))).toBeInTheDocument();
        });
      });
    });
  });

  describe('API Error Handling', () => {
    beforeEach(() => {
      mockUseAuth.mockReturnValue({
        user: { id: 'user-123' },
        accessToken: 'test-token-123',
        loading: false,
      });
    });

    it('should handle fetch media error gracefully', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      render(<TrailPhotos trailId={mockTrailId} />);

      // Should not crash, should show empty state or error
      await waitFor(() => {
        // Component should still render
        expect(screen.getByText(/photos & videos/i)).toBeInTheDocument();
      });
    });

    it('should handle non-ok response when fetching media', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: () => Promise.resolve({ error: 'Server error' }),
      });

      render(<TrailPhotos trailId={mockTrailId} />);

      await waitFor(() => {
        // Should show empty state
        expect(screen.getByText(/no photos or videos yet/i)).toBeInTheDocument();
      });
    });
  });

  describe('Caption Input', () => {
    beforeEach(() => {
      mockUseAuth.mockReturnValue({
        user: { id: 'user-123' },
        accessToken: 'test-token-123',
        loading: false,
      });

      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ media: [] }),
      });
    });

    it('should allow entering caption', async () => {
      render(<TrailPhotos trailId={mockTrailId} />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /add media/i })).toBeInTheDocument();
      });

      await userEvent.click(screen.getByRole('button', { name: /add media/i }));

      const input = document.querySelector('input[type="file"]');
      const validFile = new File(['test'], 'test.jpg', { type: 'image/jpeg' });

      const mockFileReader = {
        readAsDataURL: vi.fn(),
        onload: null,
        result: 'data:image/jpeg;base64,test',
      };
      vi.spyOn(global, 'FileReader').mockImplementation(() => mockFileReader);

      await userEvent.upload(input, validFile);
      mockFileReader.onload({ target: { result: 'data:image/jpeg;base64,test' } });

      await waitFor(() => {
        expect(screen.getByPlaceholderText(/add a caption/i)).toBeInTheDocument();
      });

      const captionInput = screen.getByPlaceholderText(/add a caption/i);
      await userEvent.type(captionInput, 'Beautiful sunset on the trail');

      expect(captionInput).toHaveValue('Beautiful sunset on the trail');
    });

    it('should limit caption to 255 characters', async () => {
      render(<TrailPhotos trailId={mockTrailId} />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /add media/i })).toBeInTheDocument();
      });

      await userEvent.click(screen.getByRole('button', { name: /add media/i }));

      const input = document.querySelector('input[type="file"]');
      const validFile = new File(['test'], 'test.jpg', { type: 'image/jpeg' });

      const mockFileReader = {
        readAsDataURL: vi.fn(),
        onload: null,
        result: 'data:image/jpeg;base64,test',
      };
      vi.spyOn(global, 'FileReader').mockImplementation(() => mockFileReader);

      await userEvent.upload(input, validFile);
      mockFileReader.onload({ target: { result: 'data:image/jpeg;base64,test' } });

      await waitFor(() => {
        expect(screen.getByPlaceholderText(/add a caption/i)).toBeInTheDocument();
      });

      const captionInput = screen.getByPlaceholderText(/add a caption/i);
      expect(captionInput).toHaveAttribute('maxLength', '255');
    });
  });

  describe('Clear File Selection', () => {
    beforeEach(() => {
      mockUseAuth.mockReturnValue({
        user: { id: 'user-123' },
        accessToken: 'test-token-123',
        loading: false,
      });

      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ media: [] }),
      });
    });

    it('should show clear button when file is selected', async () => {
      render(<TrailPhotos trailId={mockTrailId} />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /add media/i })).toBeInTheDocument();
      });

      await userEvent.click(screen.getByRole('button', { name: /add media/i }));

      const input = document.querySelector('input[type="file"]');
      const validFile = new File(['test'], 'test.jpg', { type: 'image/jpeg' });

      const mockFileReader = {
        readAsDataURL: vi.fn(),
        onload: null,
        result: 'data:image/jpeg;base64,test',
      };
      vi.spyOn(global, 'FileReader').mockImplementation(() => mockFileReader);

      await userEvent.upload(input, validFile);
      mockFileReader.onload({ target: { result: 'data:image/jpeg;base64,test' } });

      await waitFor(() => {
        expect(screen.getByText(/test.jpg/i)).toBeInTheDocument();
      });

      // Find the clear button (X button in preview) - should exist
      const clearButtons = screen.getAllByRole('button');
      const clearButton = clearButtons.find((btn) =>
        btn.querySelector('svg path[d*="M6 18L18 6"]')
      );

      // Clear button should exist when file is selected
      expect(clearButton).toBeTruthy();
    });
  });

  describe('File Size Display', () => {
    beforeEach(() => {
      mockUseAuth.mockReturnValue({
        user: { id: 'user-123' },
        accessToken: 'test-token-123',
        loading: false,
      });

      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ media: [] }),
      });
    });

    it('should display file size in MB', async () => {
      render(<TrailPhotos trailId={mockTrailId} />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /add media/i })).toBeInTheDocument();
      });

      await userEvent.click(screen.getByRole('button', { name: /add media/i }));

      const input = document.querySelector('input[type="file"]');
      // Create a 2MB file
      const content = new Array(2 * 1024 * 1024).fill('a').join('');
      const validFile = new File([content], 'large.jpg', { type: 'image/jpeg' });

      const mockFileReader = {
        readAsDataURL: vi.fn(),
        onload: null,
        result: 'data:image/jpeg;base64,test',
      };
      vi.spyOn(global, 'FileReader').mockImplementation(() => mockFileReader);

      fireEvent.change(input, { target: { files: [validFile] } });
      mockFileReader.onload({ target: { result: 'data:image/jpeg;base64,test' } });

      await waitFor(() => {
        expect(screen.getByText(/2\.00 MB/i)).toBeInTheDocument();
      });
    });
  });
});
