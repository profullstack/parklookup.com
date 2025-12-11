/**
 * Discount Offer Modal Component
 * Shows a special discount offer when user cancels checkout
 */

'use client';

import { useState } from 'react';
import Button from '@/components/ui/Button';

/**
 * Modal that displays a discount offer to users who cancelled checkout
 * @param {Object} props - Component props
 * @param {boolean} props.isOpen - Whether the modal is open
 * @param {Function} props.onClose - Callback when modal is closed
 * @param {Function} props.onAccept - Callback when user accepts the offer
 * @param {string} props.couponCode - The coupon code to display
 * @param {string} props.discountText - Description of the discount (e.g., "50% off")
 */
export default function DiscountOfferModal({
  isOpen,
  onClose,
  onAccept,
  couponCode = '50OFF',
  discountText = '50% off for the lifetime of your subscription',
}) {
  const [loading, setLoading] = useState(false);

  if (!isOpen) {
    return null;
  }

  const handleAccept = async () => {
    setLoading(true);
    try {
      await onAccept(couponCode);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black bg-opacity-50 transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal */}
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="relative transform overflow-hidden rounded-2xl bg-white shadow-2xl transition-all w-full max-w-md">
          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors"
            aria-label="Close modal"
          >
            <svg
              className="h-6 w-6"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>

          {/* Content */}
          <div className="p-8 text-center">
            {/* Icon */}
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-r from-green-400 to-green-600 mb-6">
              <svg
                className="h-8 w-8 text-white"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>

            {/* Heading */}
            <h2 className="text-2xl font-bold text-gray-900 mb-2">
              Wait! Don&apos;t miss out! 🎉
            </h2>

            {/* Description */}
            <p className="text-gray-600 mb-6">
              We noticed you didn&apos;t complete your upgrade. Here&apos;s a special offer
              just for you:
            </p>

            {/* Discount Badge */}
            <div className="bg-gradient-to-r from-green-50 to-emerald-50 border-2 border-green-200 rounded-xl p-6 mb-6">
              <p className="text-lg font-semibold text-green-800 mb-2">
                Get {discountText}!
              </p>
              <div className="flex items-center justify-center gap-2">
                <span className="text-sm text-gray-600">Use coupon code:</span>
                <code className="px-3 py-1 bg-white border border-green-300 rounded-lg font-mono font-bold text-green-700 text-lg">
                  {couponCode}
                </code>
              </div>
            </div>

            {/* Price comparison */}
            <div className="flex items-center justify-center gap-4 mb-6">
              <div className="text-gray-400">
                <span className="line-through text-lg">$9.99/mo</span>
              </div>
              <div className="text-green-600 font-bold">
                <span className="text-2xl">$4.99/mo</span>
              </div>
            </div>

            {/* CTA Buttons */}
            <div className="space-y-3">
              <Button
                onClick={handleAccept}
                disabled={loading}
                className="w-full bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 text-lg py-3"
              >
                {loading ? 'Loading...' : 'Claim My 50% Discount'}
              </Button>
              <button
                onClick={onClose}
                className="w-full text-gray-500 hover:text-gray-700 text-sm py-2 transition-colors"
              >
                No thanks, I&apos;ll pay full price later
              </button>
            </div>

            {/* Urgency text */}
            <p className="mt-4 text-xs text-gray-400">
              ⏰ This offer expires when you close this window
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}