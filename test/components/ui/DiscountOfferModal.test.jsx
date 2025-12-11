/**
 * Tests for DiscountOfferModal component
 * Using Vitest for testing (following project conventions)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import DiscountOfferModal from '@/components/ui/DiscountOfferModal';

describe('DiscountOfferModal', () => {
  const defaultProps = {
    isOpen: true,
    onClose: vi.fn(),
    onAccept: vi.fn(),
    couponCode: '50OFF',
    discountText: '50% off for the lifetime of your subscription',
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Rendering', () => {
    it('should render nothing when isOpen is false', () => {
      render(<DiscountOfferModal {...defaultProps} isOpen={false} />);
      
      expect(screen.queryByText(/Wait! Don't miss out!/)).not.toBeInTheDocument();
    });

    it('should render modal when isOpen is true', () => {
      render(<DiscountOfferModal {...defaultProps} />);
      
      expect(screen.getByText(/Wait! Don't miss out!/)).toBeInTheDocument();
    });

    it('should display the coupon code', () => {
      render(<DiscountOfferModal {...defaultProps} />);
      
      expect(screen.getByText('50OFF')).toBeInTheDocument();
    });

    it('should display the discount text', () => {
      render(<DiscountOfferModal {...defaultProps} />);
      
      expect(screen.getByText(/50% off for the lifetime of your subscription/)).toBeInTheDocument();
    });

    it('should display price comparison', () => {
      render(<DiscountOfferModal {...defaultProps} />);
      
      expect(screen.getByText('$9.99/mo')).toBeInTheDocument();
      expect(screen.getByText('$4.99/mo')).toBeInTheDocument();
    });

    it('should display CTA button', () => {
      render(<DiscountOfferModal {...defaultProps} />);
      
      expect(screen.getByRole('button', { name: /Claim My 50% Discount/i })).toBeInTheDocument();
    });

    it('should display decline option', () => {
      render(<DiscountOfferModal {...defaultProps} />);
      
      expect(screen.getByText(/No thanks, I'll pay full price later/i)).toBeInTheDocument();
    });

    it('should display urgency text', () => {
      render(<DiscountOfferModal {...defaultProps} />);
      
      expect(screen.getByText(/This offer expires when you close this window/i)).toBeInTheDocument();
    });
  });

  describe('Interactions', () => {
    it('should call onClose when close button is clicked', () => {
      render(<DiscountOfferModal {...defaultProps} />);
      
      const closeButton = screen.getByLabelText('Close modal');
      fireEvent.click(closeButton);
      
      expect(defaultProps.onClose).toHaveBeenCalledTimes(1);
    });

    it('should call onClose when backdrop is clicked', () => {
      render(<DiscountOfferModal {...defaultProps} />);
      
      // The backdrop has aria-hidden="true"
      const backdrop = document.querySelector('[aria-hidden="true"]');
      fireEvent.click(backdrop);
      
      expect(defaultProps.onClose).toHaveBeenCalledTimes(1);
    });

    it('should call onClose when decline button is clicked', () => {
      render(<DiscountOfferModal {...defaultProps} />);
      
      const declineButton = screen.getByText(/No thanks, I'll pay full price later/i);
      fireEvent.click(declineButton);
      
      expect(defaultProps.onClose).toHaveBeenCalledTimes(1);
    });

    it('should call onAccept with coupon code when CTA is clicked', async () => {
      const onAccept = vi.fn().mockResolvedValue(undefined);
      render(<DiscountOfferModal {...defaultProps} onAccept={onAccept} />);
      
      const ctaButton = screen.getByRole('button', { name: /Claim My 50% Discount/i });
      fireEvent.click(ctaButton);
      
      await waitFor(() => {
        expect(onAccept).toHaveBeenCalledWith('50OFF');
      });
    });

    it('should show loading state when accepting', async () => {
      // Create a promise that we can control
      let resolveAccept;
      const onAccept = vi.fn().mockImplementation(() => new Promise((resolve) => {
        resolveAccept = resolve;
      }));
      
      render(<DiscountOfferModal {...defaultProps} onAccept={onAccept} />);
      
      const ctaButton = screen.getByRole('button', { name: /Claim My 50% Discount/i });
      fireEvent.click(ctaButton);
      
      // Should show loading state
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Loading.../i })).toBeInTheDocument();
      });
      
      // Resolve the promise
      resolveAccept();
      
      // Should return to normal state
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Claim My 50% Discount/i })).toBeInTheDocument();
      });
    });
  });

  describe('Custom Props', () => {
    it('should display custom coupon code', () => {
      render(<DiscountOfferModal {...defaultProps} couponCode="SPECIAL25" />);
      
      expect(screen.getByText('SPECIAL25')).toBeInTheDocument();
    });

    it('should display custom discount text', () => {
      render(<DiscountOfferModal {...defaultProps} discountText="25% off your first month" />);
      
      expect(screen.getByText(/25% off your first month/)).toBeInTheDocument();
    });
  });
});