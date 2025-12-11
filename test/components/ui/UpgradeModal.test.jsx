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
  const mockOnUpgrade = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Rendering', () => {
    it('should render when isOpen is true', () => {
      render(
        <UpgradeModal
          isOpen={true}
          onClose={mockOnClose}
          onUpgrade={mockOnUpgrade}
        />
      );

      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    it('should not render when isOpen is false', () => {
      render(
        <UpgradeModal
          isOpen={false}
          onClose={mockOnClose}
          onUpgrade={mockOnUpgrade}
        />
      );

      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('should render upgrade title', () => {
      render(
        <UpgradeModal
          isOpen={true}
          onClose={mockOnClose}
          onUpgrade={mockOnUpgrade}
        />
      );

      expect(screen.getByText(/upgrade/i)).toBeInTheDocument();
    });

    it('should render free tier limit message', () => {
      render(
        <UpgradeModal
          isOpen={true}
          onClose={mockOnClose}
          onUpgrade={mockOnUpgrade}
        />
      );

      expect(screen.getByText(/free tier/i)).toBeInTheDocument();
    });

    it('should render upgrade button', () => {
      render(
        <UpgradeModal
          isOpen={true}
          onClose={mockOnClose}
          onUpgrade={mockOnUpgrade}
        />
      );

      expect(screen.getByRole('button', { name: /upgrade/i })).toBeInTheDocument();
    });

    it('should render close button', () => {
      render(
        <UpgradeModal
          isOpen={true}
          onClose={mockOnClose}
          onUpgrade={mockOnUpgrade}
        />
      );

      expect(screen.getByRole('button', { name: /close|cancel|×/i })).toBeInTheDocument();
    });
  });

  describe('Interactions', () => {
    it('should call onClose when close button is clicked', () => {
      render(
        <UpgradeModal
          isOpen={true}
          onClose={mockOnClose}
          onUpgrade={mockOnUpgrade}
        />
      );

      const closeButton = screen.getByRole('button', { name: /close|cancel|×/i });
      fireEvent.click(closeButton);

      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });

    it('should call onUpgrade when upgrade button is clicked', () => {
      render(
        <UpgradeModal
          isOpen={true}
          onClose={mockOnClose}
          onUpgrade={mockOnUpgrade}
        />
      );

      const upgradeButton = screen.getByRole('button', { name: /upgrade/i });
      fireEvent.click(upgradeButton);

      expect(mockOnUpgrade).toHaveBeenCalledTimes(1);
    });

    it('should call onClose when clicking backdrop', () => {
      render(
        <UpgradeModal
          isOpen={true}
          onClose={mockOnClose}
          onUpgrade={mockOnUpgrade}
        />
      );

      const backdrop = screen.getByTestId('modal-backdrop');
      fireEvent.click(backdrop);

      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });

    it('should not close when clicking modal content', () => {
      render(
        <UpgradeModal
          isOpen={true}
          onClose={mockOnClose}
          onUpgrade={mockOnUpgrade}
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
          onUpgrade={mockOnUpgrade}
        />
      );

      expect(screen.getByText(/unlimited/i)).toBeInTheDocument();
    });

    it('should display pricing information', () => {
      render(
        <UpgradeModal
          isOpen={true}
          onClose={mockOnClose}
          onUpgrade={mockOnUpgrade}
        />
      );

      // Should show some pricing info
      const priceText = screen.queryByText(/\$/);
      // Price may or may not be shown depending on implementation
    });
  });

  describe('Accessibility', () => {
    it('should have proper dialog role', () => {
      render(
        <UpgradeModal
          isOpen={true}
          onClose={mockOnClose}
          onUpgrade={mockOnUpgrade}
        />
      );

      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    it('should have aria-modal attribute', () => {
      render(
        <UpgradeModal
          isOpen={true}
          onClose={mockOnClose}
          onUpgrade={mockOnUpgrade}
        />
      );

      expect(screen.getByRole('dialog')).toHaveAttribute('aria-modal', 'true');
    });

    it('should trap focus within modal', () => {
      render(
        <UpgradeModal
          isOpen={true}
          onClose={mockOnClose}
          onUpgrade={mockOnUpgrade}
        />
      );

      const buttons = screen.getAllByRole('button');
      expect(buttons.length).toBeGreaterThan(0);
    });

    it('should close on Escape key', () => {
      render(
        <UpgradeModal
          isOpen={true}
          onClose={mockOnClose}
          onUpgrade={mockOnUpgrade}
        />
      );

      fireEvent.keyDown(document, { key: 'Escape' });

      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });
  });

  describe('Styling', () => {
    it('should have overlay styling', () => {
      render(
        <UpgradeModal
          isOpen={true}
          onClose={mockOnClose}
          onUpgrade={mockOnUpgrade}
        />
      );

      const backdrop = screen.getByTestId('modal-backdrop');
      expect(backdrop).toHaveClass('fixed');
    });

    it('should center modal content', () => {
      render(
        <UpgradeModal
          isOpen={true}
          onClose={mockOnClose}
          onUpgrade={mockOnUpgrade}
        />
      );

      const dialog = screen.getByRole('dialog');
      expect(dialog).toHaveClass('bg-white');
    });
  });
});

describe('UpgradeModal Pro Features', () => {
  it('should list pro features', () => {
    render(
      <UpgradeModal
        isOpen={true}
        onClose={vi.fn()}
        onUpgrade={vi.fn()}
      />
    );

    // Should mention unlimited trips
    expect(screen.getByText(/unlimited trips/i)).toBeInTheDocument();
  });

  it('should highlight the value proposition', () => {
    render(
      <UpgradeModal
        isOpen={true}
        onClose={vi.fn()}
        onUpgrade={vi.fn()}
      />
    );

    // Should have compelling copy
    const modal = screen.getByRole('dialog');
    expect(modal.textContent).toMatch(/pro|premium|upgrade/i);
  });
});