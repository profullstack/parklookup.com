/**
 * TripForm Component Tests
 * Tests for the trip creation form
 * 
 * Testing Framework: Vitest with React Testing Library
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import TripForm from '@/components/trips/TripForm';

describe('TripForm Component', () => {
  const mockOnSubmit = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Rendering', () => {
    it('should render the form with all required fields', () => {
      render(<TripForm onSubmit={mockOnSubmit} />);

      expect(screen.getByLabelText(/starting location/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/start date/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/end date/i)).toBeInTheDocument();
      expect(screen.getByText(/interests/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/difficulty/i)).toBeInTheDocument();
    });

    it('should render interest checkboxes', () => {
      render(<TripForm onSubmit={mockOnSubmit} />);

      expect(screen.getByLabelText(/hiking/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/camping/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/photography/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/wildlife/i)).toBeInTheDocument();
    });

    it('should render difficulty options', () => {
      render(<TripForm onSubmit={mockOnSubmit} />);

      expect(screen.getByRole('option', { name: /easy/i })).toBeInTheDocument();
      expect(screen.getByRole('option', { name: /moderate/i })).toBeInTheDocument();
      expect(screen.getByRole('option', { name: /hard/i })).toBeInTheDocument();
    });

    it('should render submit button', () => {
      render(<TripForm onSubmit={mockOnSubmit} />);

      expect(screen.getByRole('button', { name: /generate/i })).toBeInTheDocument();
    });

    it('should render radius slider', () => {
      render(<TripForm onSubmit={mockOnSubmit} />);

      expect(screen.getByLabelText(/radius/i)).toBeInTheDocument();
    });
  });

  describe('Form Validation', () => {
    it('should require origin field', async () => {
      render(<TripForm onSubmit={mockOnSubmit} />);

      const submitButton = screen.getByRole('button', { name: /generate/i });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(mockOnSubmit).not.toHaveBeenCalled();
      });
    });

    it('should require start date', async () => {
      render(<TripForm onSubmit={mockOnSubmit} />);

      const originInput = screen.getByLabelText(/starting location/i);
      await userEvent.type(originInput, 'San Francisco');

      const submitButton = screen.getByRole('button', { name: /generate/i });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(mockOnSubmit).not.toHaveBeenCalled();
      });
    });

    it('should require at least one interest', async () => {
      render(<TripForm onSubmit={mockOnSubmit} />);

      const originInput = screen.getByLabelText(/starting location/i);
      await userEvent.type(originInput, 'San Francisco');

      // Fill dates but no interests
      const startDate = screen.getByLabelText(/start date/i);
      const endDate = screen.getByLabelText(/end date/i);
      fireEvent.change(startDate, { target: { value: '2025-01-15' } });
      fireEvent.change(endDate, { target: { value: '2025-01-18' } });

      const submitButton = screen.getByRole('button', { name: /generate/i });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(mockOnSubmit).not.toHaveBeenCalled();
      });
    });
  });

  describe('Form Submission', () => {
    it('should call onSubmit with form data when valid', async () => {
      render(<TripForm onSubmit={mockOnSubmit} />);

      // Fill origin
      const originInput = screen.getByLabelText(/starting location/i);
      await userEvent.type(originInput, 'San Francisco, CA');

      // Fill dates
      const startDate = screen.getByLabelText(/start date/i);
      const endDate = screen.getByLabelText(/end date/i);
      fireEvent.change(startDate, { target: { value: '2025-01-15' } });
      fireEvent.change(endDate, { target: { value: '2025-01-18' } });

      // Select interests
      const hikingCheckbox = screen.getByLabelText(/hiking/i);
      fireEvent.click(hikingCheckbox);

      // Submit
      const submitButton = screen.getByRole('button', { name: /generate/i });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(mockOnSubmit).toHaveBeenCalledWith(
          expect.objectContaining({
            origin: 'San Francisco, CA',
            startDate: '2025-01-15',
            endDate: '2025-01-18',
            interests: expect.arrayContaining(['hiking']),
          })
        );
      });
    });

    it('should include difficulty in submission', async () => {
      render(<TripForm onSubmit={mockOnSubmit} />);

      // Fill required fields
      await userEvent.type(screen.getByLabelText(/starting location/i), 'Test');
      fireEvent.change(screen.getByLabelText(/start date/i), { target: { value: '2025-01-15' } });
      fireEvent.change(screen.getByLabelText(/end date/i), { target: { value: '2025-01-18' } });
      fireEvent.click(screen.getByLabelText(/hiking/i));

      // Select difficulty
      const difficultySelect = screen.getByLabelText(/difficulty/i);
      fireEvent.change(difficultySelect, { target: { value: 'hard' } });

      // Submit
      fireEvent.click(screen.getByRole('button', { name: /generate/i }));

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
    it('should allow selecting multiple interests', async () => {
      render(<TripForm onSubmit={mockOnSubmit} />);

      const hikingCheckbox = screen.getByLabelText(/hiking/i);
      const campingCheckbox = screen.getByLabelText(/camping/i);
      const photographyCheckbox = screen.getByLabelText(/photography/i);

      fireEvent.click(hikingCheckbox);
      fireEvent.click(campingCheckbox);
      fireEvent.click(photographyCheckbox);

      expect(hikingCheckbox).toBeChecked();
      expect(campingCheckbox).toBeChecked();
      expect(photographyCheckbox).toBeChecked();
    });

    it('should allow deselecting interests', async () => {
      render(<TripForm onSubmit={mockOnSubmit} />);

      const hikingCheckbox = screen.getByLabelText(/hiking/i);

      fireEvent.click(hikingCheckbox);
      expect(hikingCheckbox).toBeChecked();

      fireEvent.click(hikingCheckbox);
      expect(hikingCheckbox).not.toBeChecked();
    });
  });

  describe('Loading State', () => {
    it('should disable form when loading', () => {
      render(<TripForm onSubmit={mockOnSubmit} isLoading={true} />);

      expect(screen.getByLabelText(/starting location/i)).toBeDisabled();
      expect(screen.getByRole('button', { name: /generating/i })).toBeDisabled();
    });

    it('should show loading text on button', () => {
      render(<TripForm onSubmit={mockOnSubmit} isLoading={true} />);

      expect(screen.getByRole('button')).toHaveTextContent(/generating/i);
    });
  });

  describe('Default Values', () => {
    it('should have moderate as default difficulty', () => {
      render(<TripForm onSubmit={mockOnSubmit} />);

      const difficultySelect = screen.getByLabelText(/difficulty/i);
      expect(difficultySelect.value).toBe('moderate');
    });

    it('should have default radius value', () => {
      render(<TripForm onSubmit={mockOnSubmit} />);

      const radiusSlider = screen.getByLabelText(/radius/i);
      expect(radiusSlider.value).toBeDefined();
    });
  });
});

describe('TripForm Accessibility', () => {
  it('should have accessible labels for all inputs', () => {
    render(<TripForm onSubmit={vi.fn()} />);

    expect(screen.getByLabelText(/starting location/i)).toHaveAttribute('id');
    expect(screen.getByLabelText(/start date/i)).toHaveAttribute('id');
    expect(screen.getByLabelText(/end date/i)).toHaveAttribute('id');
    expect(screen.getByLabelText(/difficulty/i)).toHaveAttribute('id');
  });

  it('should have proper form structure', () => {
    render(<TripForm onSubmit={vi.fn()} />);

    expect(screen.getByRole('form')).toBeInTheDocument();
  });
});