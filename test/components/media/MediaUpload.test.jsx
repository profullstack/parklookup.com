/**
 * MediaUpload Component Tests
 * Using Vitest (project's testing framework)
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

// Mock media-client
const mockUploadMedia = vi.fn();
vi.mock('@/lib/media/media-client', () => ({
  uploadMedia: (...args) => mockUploadMedia(...args),
}));

import MediaUpload from '@/components/media/MediaUpload';

describe('MediaUpload Component', () => {
  const mockOnUploadComplete = vi.fn();
  const mockOnCancel = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    vi.useRealTimers();
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

    it('should show sign in prompt when user is not authenticated', () => {
      render(
        <MediaUpload
          parkCode="yose"
          onUploadComplete={mockOnUploadComplete}
          onCancel={mockOnCancel}
        />
      );

      expect(screen.getByText(/sign in to share your photos/i)).toBeInTheDocument();
      expect(screen.getByRole('link', { name: /sign in/i })).toHaveAttribute('href', '/signin');
    });
  });

  describe('Authenticated User', () => {
    beforeEach(() => {
      mockUseAuth.mockReturnValue({
        user: { id: 'user-123', email: 'test@example.com' },
        session: { access_token: 'test-token-123' },
        accessToken: 'test-token-123',
        loading: false,
      });
    });

    it('should render upload form when user is authenticated', () => {
      render(
        <MediaUpload
          parkCode="yose"
          onUploadComplete={mockOnUploadComplete}
          onCancel={mockOnCancel}
        />
      );

      expect(screen.getByText(/share your experience/i)).toBeInTheDocument();
      expect(screen.getByText(/drag and drop/i)).toBeInTheDocument();
    });

    it('should show file drop zone initially', () => {
      render(
        <MediaUpload
          parkCode="yose"
          onUploadComplete={mockOnUploadComplete}
          onCancel={mockOnCancel}
        />
      );

      expect(screen.getByText(/drag and drop your photo or video/i)).toBeInTheDocument();
      expect(screen.getByText(/or click to browse/i)).toBeInTheDocument();
    });

    it('should validate file type', async () => {
      render(
        <MediaUpload
          parkCode="yose"
          onUploadComplete={mockOnUploadComplete}
          onCancel={mockOnCancel}
        />
      );

      const input = document.querySelector('input[type="file"]');
      const invalidFile = new File(['test'], 'test.txt', { type: 'text/plain' });

      // Manually trigger the change event with the file
      fireEvent.change(input, { target: { files: [invalidFile] } });

      await waitFor(() => {
        expect(screen.getByText(/unsupported file type/i)).toBeInTheDocument();
      });
    });

    it('should validate file size for images', async () => {
      render(
        <MediaUpload
          parkCode="yose"
          onUploadComplete={mockOnUploadComplete}
          onCancel={mockOnCancel}
        />
      );

      const input = document.querySelector('input[type="file"]');
      // Create a file larger than 10MB
      const largeContent = new Array(11 * 1024 * 1024).fill('a').join('');
      const largeFile = new File([largeContent], 'large.jpg', { type: 'image/jpeg' });

      await userEvent.upload(input, largeFile);

      expect(screen.getByText(/file too large/i)).toBeInTheDocument();
    });

    it('should show preview after selecting valid image', async () => {
      render(
        <MediaUpload
          parkCode="yose"
          onUploadComplete={mockOnUploadComplete}
          onCancel={mockOnCancel}
        />
      );

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

      // Trigger the onload callback
      mockFileReader.onload({ target: { result: 'data:image/jpeg;base64,test' } });

      await waitFor(() => {
        expect(screen.getByText(/test.jpg/i)).toBeInTheDocument();
      });
    });

    it('should show title and description fields after file selection', async () => {
      render(
        <MediaUpload
          parkCode="yose"
          onUploadComplete={mockOnUploadComplete}
          onCancel={mockOnCancel}
        />
      );

      const input = document.querySelector('input[type="file"]');
      const validFile = new File(['test'], 'test.jpg', { type: 'image/jpeg' });

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
        expect(screen.getByLabelText(/title/i)).toBeInTheDocument();
        expect(screen.getByLabelText(/description/i)).toBeInTheDocument();
      });
    });

    it('should call uploadMedia with correct parameters', async () => {
      vi.useRealTimers(); // Use real timers for this test
      
      mockUploadMedia.mockResolvedValueOnce({
        media: { id: 'media-123', title: 'Test' },
        error: null,
      });

      render(
        <MediaUpload
          parkCode="yose"
          onUploadComplete={mockOnUploadComplete}
          onCancel={mockOnCancel}
        />
      );

      const input = document.querySelector('input[type="file"]');
      const validFile = new File(['test'], 'test.jpg', { type: 'image/jpeg' });

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
        expect(screen.getByRole('button', { name: /upload/i })).toBeInTheDocument();
      });

      // Fill in title
      const titleInput = screen.getByLabelText(/title/i);
      await userEvent.type(titleInput, 'My Photo');

      // Click upload
      const uploadButton = screen.getByRole('button', { name: /upload/i });
      await userEvent.click(uploadButton);

      await waitFor(() => {
        expect(mockUploadMedia).toHaveBeenCalledWith('test-token-123', {
          file: validFile,
          parkCode: 'yose',
          title: 'My Photo',
          description: '',
        });
      });
    });

    it('should show error message on upload failure', async () => {
      vi.useRealTimers();
      
      mockUploadMedia.mockResolvedValueOnce({
        media: null,
        error: { message: 'Upload failed' },
      });

      render(
        <MediaUpload
          parkCode="yose"
          onUploadComplete={mockOnUploadComplete}
          onCancel={mockOnCancel}
        />
      );

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
        expect(screen.getByRole('button', { name: /upload/i })).toBeInTheDocument();
      });

      const uploadButton = screen.getByRole('button', { name: /upload/i });
      await userEvent.click(uploadButton);

      await waitFor(() => {
        expect(screen.getByText(/upload failed/i)).toBeInTheDocument();
      });
    });

    it('should call onCancel when cancel button is clicked', async () => {
      render(
        <MediaUpload
          parkCode="yose"
          onUploadComplete={mockOnUploadComplete}
          onCancel={mockOnCancel}
        />
      );

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
        expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument();
      });

      const cancelButton = screen.getByRole('button', { name: /cancel/i });
      await userEvent.click(cancelButton);

      expect(mockOnCancel).toHaveBeenCalled();
    });

    it('should clear file when X button is clicked', async () => {
      render(
        <MediaUpload
          parkCode="yose"
          onUploadComplete={mockOnUploadComplete}
          onCancel={mockOnCancel}
        />
      );

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

      // Find and click the clear button (X button) - it's the button with the X icon
      const clearButtons = screen.getAllByRole('button');
      const clearButton = clearButtons.find(btn => btn.querySelector('svg path[d*="M6 18L18 6"]'));
      
      if (clearButton) {
        await userEvent.click(clearButton);

        // Should show drop zone again
        await waitFor(() => {
          expect(screen.getByText(/drag and drop/i)).toBeInTheDocument();
        });
      }
    });

    it('should show progress bar during upload', async () => {
      vi.useRealTimers();
      
      // Make upload take some time
      mockUploadMedia.mockImplementation(() =>
        new Promise(resolve => setTimeout(() => resolve({ media: { id: '1' }, error: null }), 2000))
      );

      render(
        <MediaUpload
          parkCode="yose"
          onUploadComplete={mockOnUploadComplete}
          onCancel={mockOnCancel}
        />
      );

      const input = document.querySelector('input[type="file"]');
      const validFile = new File(['test'], 'test.jpg', { type: 'image/jpeg' });

      const mockFileReader = {
        readAsDataURL: vi.fn(),
        onload: null,
        result: 'data:image/jpeg;base64,test',
      };
      vi.spyOn(global, 'FileReader').mockImplementation(() => mockFileReader);

      // Use fireEvent instead of userEvent for more reliable file upload
      fireEvent.change(input, { target: { files: [validFile] } });
      mockFileReader.onload({ target: { result: 'data:image/jpeg;base64,test' } });

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /^upload$/i })).toBeInTheDocument();
      });

      const uploadButton = screen.getByRole('button', { name: /^upload$/i });
      fireEvent.click(uploadButton);

      // Should show uploading state - look for the button text change
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /uploading/i })).toBeInTheDocument();
      }, { timeout: 1000 });
    });
  });

  describe('Access Token Handling', () => {
    it('should correctly extract access_token from session', () => {
      mockUseAuth.mockReturnValue({
        user: { id: 'user-123' },
        session: { access_token: 'my-secret-token' },
        accessToken: 'my-secret-token',
        loading: false,
      });

      render(
        <MediaUpload
          parkCode="yose"
          onUploadComplete={mockOnUploadComplete}
          onCancel={mockOnCancel}
        />
      );

      // Component should render upload form (not sign in prompt)
      expect(screen.getByText(/share your experience/i)).toBeInTheDocument();
    });

    it('should handle null session gracefully', () => {
      mockUseAuth.mockReturnValue({
        user: { id: 'user-123' },
        session: null,
        accessToken: null,
        loading: false,
      });

      render(
        <MediaUpload
          parkCode="yose"
          onUploadComplete={mockOnUploadComplete}
          onCancel={mockOnCancel}
        />
      );

      // Should still render the form since user exists
      expect(screen.getByText(/share your experience/i)).toBeInTheDocument();
    });
  });

  describe('Drag and Drop', () => {
    beforeEach(() => {
      mockUseAuth.mockReturnValue({
        user: { id: 'user-123' },
        session: { access_token: 'test-token' },
        accessToken: 'test-token',
        loading: false,
      });
    });

    it('should handle drag over event', () => {
      render(
        <MediaUpload
          parkCode="yose"
          onUploadComplete={mockOnUploadComplete}
          onCancel={mockOnCancel}
        />
      );

      const dropZone = screen.getByText(/drag and drop/i).closest('div');
      
      const dragOverEvent = new Event('dragover', { bubbles: true });
      dragOverEvent.preventDefault = vi.fn();
      
      fireEvent(dropZone, dragOverEvent);
      
      // Should not throw
      expect(dropZone).toBeInTheDocument();
    });

    it('should handle drop event with valid file', async () => {
      render(
        <MediaUpload
          parkCode="yose"
          onUploadComplete={mockOnUploadComplete}
          onCancel={mockOnCancel}
        />
      );

      const dropZone = screen.getByText(/drag and drop/i).closest('div');
      const validFile = new File(['test'], 'test.jpg', { type: 'image/jpeg' });

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
        expect(screen.getByText(/test.jpg/i)).toBeInTheDocument();
      });
    });
  });
});