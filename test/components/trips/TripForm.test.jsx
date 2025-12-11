/**
 * TripForm Component Tests
 * Tests for the trip creation form
 * 
 * Testing Framework: Vitest with React Testing Library
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import TripForm from '@/components/trips/TripForm';

describe('TripForm Component', () => {
  const mockOnSubmit = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Rendering', () => {
    it('should render the form with all required fields', () => {
      render(<TripForm onSubmit={mockOnSubmit} />);

      // Origin input
      expect(screen.getByLabelText(/starting location/i)).toBeInTheDocument();
      // Date inputs
      expect(screen.getByLabelText(/start date/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/end date/i)).toBeInTheDocument();
      // Interests section
      expect(screen.getByText(/interests/i)).toBeInTheDocument();
      // Difficulty section
      expect(screen.getByText(/difficulty level/i)).toBeInTheDocument();
    });

    it('should render interest buttons', () => {
      render(<TripForm onSubmit={mockOnSubmit} />);

      // Interests are rendered as buttons with text
      expect(screen.getByText('Hiking')).toBeInTheDocument();
      expect(screen.getByText('Camping')).toBeInTheDocument();
      expect(screen.getByText('Photography')).toBeInTheDocument();
      expect(screen.getByText('Wildlife')).toBeInTheDocument();
    });

    it('should render difficulty buttons', () => {
      render(<TripForm onSubmit={mockOnSubmit} />);

      expect(screen.getByText('Easy')).toBeInTheDocument();
      expect(screen.getByText('Moderate')).toBeInTheDocument();
      expect(screen.getByText('Hard')).toBeInTheDocument();
    });

    it('should render submit button', () => {
      render(<TripForm onSubmit={mockOnSubmit} />);

      expect(screen.getByRole('button', { name: /generate ai trip/i })).toBeInTheDocument();
    });

    it('should render radius slider', () => {
      render(<TripForm onSubmit={mockOnSubmit} />);

      expect(screen.getByLabelText(/search radius/i)).toBeInTheDocument();
    });
  });

  describe('Form Validation', () => {
    it('should require origin field', async () => {
      render(<TripForm onSubmit={mockOnSubmit} />);

      // Clear the origin field
      const originInput = screen.getByLabelText(/starting location/i);
      fireEvent.change(originInput, { target: { value: '' } });

      const submitButton = screen.getByRole('button', { name: /generate ai trip/i });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(mockOnSubmit).not.toHaveBeenCalled();
      });
    });

    it('should show error when origin is empty', async () => {
      render(<TripForm onSubmit={mockOnSubmit} />);

      const submitButton = screen.getByRole('button', { name: /generate ai trip/i });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText(/starting location is required/i)).toBeInTheDocument();
      });
    });
  });

  describe('Form Submission', () => {
    it('should call onSubmit with form data when valid', async () => {
      render(<TripForm onSubmit={mockOnSubmit} />);

      // Fill origin
      const originInput = screen.getByLabelText(/starting location/i);
      fireEvent.change(originInput, { target: { value: 'San Francisco, CA' } });

      // Submit - dates and interests have defaults
      const submitButton = screen.getByRole('button', { name: /generate ai trip/i });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(mockOnSubmit).toHaveBeenCalledWith(
          expect.objectContaining({
            origin: 'San Francisco, CA',
            interests: expect.arrayContaining(['hiking', 'scenic_drives']),
            difficulty: 'moderate',
          })
        );
      });
    });

    it('should include difficulty in submission', async () => {
      render(<TripForm onSubmit={mockOnSubmit} />);

      // Fill required fields
      const originInput = screen.getByLabelText(/starting location/i);
      fireEvent.change(originInput, { target: { value: 'Test' } });

      // Select hard difficulty
      const hardButton = screen.getByText('Hard');
      fireEvent.click(hardButton);

      // Submit
      const submitButton = screen.getByRole('button', { name: /generate ai trip/i });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(mockOnSubmit).toHaveBeenCalledWith(
          expect.objectContaining({
            difficulty: 'hard',
          })
        );
      });
    });
  });

  describe('Interest Selection', () => {
    it('should allow selecting interests', async () => {
      render(<TripForm onSubmit={mockOnSubmit} />);

      // Click on camping button (not selected by default)
      const campingButton = screen.getByText('Camping').closest('button');
      fireEvent.click(campingButton);

      // Fill origin and submit
      const originInput = screen.getByLabelText(/starting location/i);
      fireEvent.change(originInput, { target: { value: 'Test' } });

      const submitButton = screen.getByRole('button', { name: /generate ai trip/i });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(mockOnSubmit).toHaveBeenCalledWith(
          expect.objectContaining({
            interests: expect.arrayContaining(['camping']),
          })
        );
      });
    });

    it('should allow deselecting interests', async () => {
      render(<TripForm onSubmit={mockOnSubmit} />);

      // Hiking is selected by default, click to deselect
      const hikingButton = screen.getByText('Hiking').closest('button');
      fireEvent.click(hikingButton);

      // Fill origin and submit
      const originInput = screen.getByLabelText(/starting location/i);
      fireEvent.change(originInput, { target: { value: 'Test' } });

      const submitButton = screen.getByRole('button', { name: /generate ai trip/i });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(mockOnSubmit).toHaveBeenCalledWith(
          expect.objectContaining({
            interests: expect.not.arrayContaining(['hiking']),
          })
        );
      });
    });
  });

  describe('Loading State', () => {
    it('should disable form when loading', () => {
      render(<TripForm onSubmit={mockOnSubmit} isLoading={true} />);

      expect(screen.getByLabelText(/starting location/i)).toBeDisabled();
    });

    it('should show loading text on button', () => {
      render(<TripForm onSubmit={mockOnSubmit} isLoading={true} />);

      expect(screen.getByText(/generating trip/i)).toBeInTheDocument();
    });
  });

  describe('Default Values', () => {
    it('should have moderate as default difficulty', async () => {
      render(<TripForm onSubmit={mockOnSubmit} />);

      // Fill origin and submit to check default
      const originInput = screen.getByLabelText(/starting location/i);
      fireEvent.change(originInput, { target: { value: 'Test' } });

      const submitButton = screen.getByRole('button', { name: /generate ai trip/i });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(mockOnSubmit).toHaveBeenCalledWith(
          expect.objectContaining({
            difficulty: 'moderate',
          })
        );
      });
    });

    it('should have default interests selected', async () => {
      render(<TripForm onSubmit={mockOnSubmit} />);

      // Fill origin and submit to check defaults
      const originInput = screen.getByLabelText(/starting location/i);
      fireEvent.change(originInput, { target: { value: 'Test' } });

      const submitButton = screen.getByRole('button', { name: /generate ai trip/i });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(mockOnSubmit).toHaveBeenCalledWith(
          expect.objectContaining({
            interests: expect.arrayContaining(['hiking', 'scenic_drives']),
          })
        );
      });
    });

    it('should have default radius value', () => {
      render(<TripForm onSubmit={mockOnSubmit} />);

      const radiusSlider = screen.getByLabelText(/search radius/i);
      expect(radiusSlider.value).toBe('200');
    });
  });
});

describe('TripForm Accessibility', () => {
  it('should have accessible labels for inputs', () => {
    render(<TripForm onSubmit={vi.fn()} />);

    expect(screen.getByLabelText(/starting location/i)).toHaveAttribute('id');
    expect(screen.getByLabelText(/start date/i)).toHaveAttribute('id');
    expect(screen.getByLabelText(/end date/i)).toHaveAttribute('id');
  });

  it('should have a form element', () => {
    const { container } = render(<TripForm onSubmit={vi.fn()} />);

    expect(container.querySelector('form')).toBeInTheDocument();
  });
});