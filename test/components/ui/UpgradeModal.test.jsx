/**
 * UpgradeModal Component Tests
 * Tests for the free tier limit upgrade modal
 * 
 * Testing Framework: Vitest with React Testing Library
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import UpgradeModal from '@/components/ui/UpgradeModal';

describe('UpgradeModal Component', () => {
  const mockOnClose = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Rendering', () => {
    it('should render when isOpen is true', () => {
      render(
        <UpgradeModal
          isOpen={true}
          onClose={mockOnClose}
        />
      );

      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    it('should not render when isOpen is false', () => {
      render(
        <UpgradeModal
          isOpen={false}
          onClose={mockOnClose}
        />
      );

      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('should render upgrade title', () => {
      render(
        <UpgradeModal
          isOpen={true}
          onClose={mockOnClose}
        />
      );

      expect(screen.getByText('Upgrade to Pro')).toBeInTheDocument();
    });

    it('should render free tier limit message', () => {
      render(
        <UpgradeModal
          isOpen={true}
          onClose={mockOnClose}
        />
      );

      expect(screen.getByText(/free tier limit/i)).toBeInTheDocument();
    });

    it('should render upgrade button', () => {
      render(
        <UpgradeModal
          isOpen={true}
          onClose={mockOnClose}
        />
      );

      expect(screen.getByRole('button', { name: /upgrade to pro/i })).toBeInTheDocument();
    });

    it('should render close button with aria-label', () => {
      render(
        <UpgradeModal
          isOpen={true}
          onClose={mockOnClose}
        />
      );

      expect(screen.getByRole('button', { name: /close modal/i })).toBeInTheDocument();
    });

    it('should render maybe later button', () => {
      render(
        <UpgradeModal
          isOpen={true}
          onClose={mockOnClose}
        />
      );

      expect(screen.getByRole('button', { name: /maybe later/i })).toBeInTheDocument();
    });
  });

  describe('Interactions', () => {
    it('should call onClose when close button is clicked', () => {
      render(
        <UpgradeModal
          isOpen={true}
          onClose={mockOnClose}
        />
      );

      const closeButton = screen.getByRole('button', { name: /close modal/i });
      fireEvent.click(closeButton);

      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });

    it('should call onClose when maybe later button is clicked', () => {
      render(
        <UpgradeModal
          isOpen={true}
          onClose={mockOnClose}
        />
      );

      const maybeLaterButton = screen.getByRole('button', { name: /maybe later/i });
      fireEvent.click(maybeLaterButton);

      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });

    it('should call onClose when clicking backdrop', () => {
      render(
        <UpgradeModal
          isOpen={true}
          onClose={mockOnClose}
        />
      );

      // The backdrop is the outer div with the fixed class
      const backdrop = document.querySelector('.fixed.inset-0');
      fireEvent.click(backdrop);

      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });

    it('should not close when clicking modal content', () => {
      render(
        <UpgradeModal
          isOpen={true}
          onClose={mockOnClose}
        />
      );

      const modalContent = screen.getByRole('dialog');
      fireEvent.click(modalContent);

      expect(mockOnClose).not.toHaveBeenCalled();
    });
  });

  describe('Content', () => {
    it('should display benefits of upgrading', () => {
      render(
        <UpgradeModal
          isOpen={true}
          onClose={mockOnClose}
        />
      );

      // Check for "Unlimited trip creation" text
      expect(screen.getByText('Unlimited trip creation')).toBeInTheDocument();
    });

    it('should display pricing information', () => {
      render(
        <UpgradeModal
          isOpen={true}
          onClose={mockOnClose}
        />
      );

      expect(screen.getByText('$9.99')).toBeInTheDocument();
      expect(screen.getByText('/month')).toBeInTheDocument();
    });

    it('should display pro features list', () => {
      render(
        <UpgradeModal
          isOpen={true}
          onClose={mockOnClose}
        />
      );

      expect(screen.getByText('Regenerate trips anytime')).toBeInTheDocument();
      expect(screen.getByText('Export trips to PDF')).toBeInTheDocument();
      expect(screen.getByText('Advanced AI recommendations')).toBeInTheDocument();
      expect(screen.getByText('Priority support')).toBeInTheDocument();
    });

    it('should display Stripe security note', () => {
      render(
        <UpgradeModal
          isOpen={true}
          onClose={mockOnClose}
        />
      );

      expect(screen.getByText(/secure payment powered by stripe/i)).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('should have proper dialog role', () => {
      render(
        <UpgradeModal
          isOpen={true}
          onClose={mockOnClose}
        />
      );

      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    it('should have aria-modal attribute', () => {
      render(
        <UpgradeModal
          isOpen={true}
          onClose={mockOnClose}
        />
      );

      expect(screen.getByRole('dialog')).toHaveAttribute('aria-modal', 'true');
    });

    it('should have aria-labelledby attribute', () => {
      render(
        <UpgradeModal
          isOpen={true}
          onClose={mockOnClose}
        />
      );

      expect(screen.getByRole('dialog')).toHaveAttribute('aria-labelledby', 'upgrade-modal-title');
    });

    it('should close on Escape key', () => {
      render(
        <UpgradeModal
          isOpen={true}
          onClose={mockOnClose}
        />
      );

      fireEvent.keyDown(document, { key: 'Escape' });

      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });
  });

  describe('Custom Props', () => {
    it('should render custom title', () => {
      render(
        <UpgradeModal
          isOpen={true}
          onClose={mockOnClose}
          title="Custom Title"
        />
      );

      expect(screen.getByText('Custom Title')).toBeInTheDocument();
    });

    it('should render custom message', () => {
      render(
        <UpgradeModal
          isOpen={true}
          onClose={mockOnClose}
          message="Custom message here"
        />
      );

      expect(screen.getByText('Custom message here')).toBeInTheDocument();
    });
  });
});

describe('UpgradeModal Styling', () => {
  it('should have overlay styling', () => {
    render(
      <UpgradeModal
        isOpen={true}
        onClose={vi.fn()}
      />
    );

    const backdrop = document.querySelector('.fixed.inset-0');
    expect(backdrop).toBeInTheDocument();
    expect(backdrop).toHaveClass('bg-black/50');
  });

  it('should have modal content styling', () => {
    render(
      <UpgradeModal
        isOpen={true}
        onClose={vi.fn()}
      />
    );

    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveClass('bg-white');
    expect(dialog).toHaveClass('rounded-2xl');
  });
});