/**
 * UpgradeModal Component
 * Modal shown when free tier users hit their trip limit
 */

'use client';

import { useEffect, useCallback } from 'react';
import Button from '@/components/ui/Button';

/**
 * UpgradeModal component
 * @param {Object} props - Component props
 * @param {boolean} props.isOpen - Whether modal is open
 * @param {Function} props.onClose - Close handler
 * @param {string} props.title - Modal title
 * @param {string} props.message - Modal message
 */
export default function UpgradeModal({
  isOpen,
  onClose,
  title = 'Upgrade to Pro',
  message = 'You\'ve reached the free tier limit of 1 trip. Upgrade to Pro for unlimited trip creation!',
}) {
  /**
   * Handle escape key press
   */
  const handleEscape = useCallback((e) => {
    if (e.key === 'Escape') {
      onClose?.();
    }
  }, [onClose]);

  /**
   * Handle backdrop click
   */
  const handleBackdropClick = useCallback((e) => {
    if (e.target === e.currentTarget) {
      onClose?.();
    }
  }, [onClose]);

  useEffect(() => {
    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = '';
    };
  }, [isOpen, handleEscape]);

  if (!isOpen) {return null;}

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
      onClick={handleBackdropClick}
    >
      <div
        className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden animate-modal-enter"
        role="dialog"
        aria-modal="true"
        aria-labelledby="upgrade-modal-title"
      >
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1 text-gray-400 hover:text-gray-600 transition-colors"
          aria-label="Close modal"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {/* Header with gradient */}
        <div className="bg-gradient-to-r from-green-600 to-emerald-600 px-6 py-8 text-center">
          <div className="w-16 h-16 mx-auto bg-white/20 rounded-full flex items-center justify-center mb-4">
            <span className="text-4xl">🚀</span>
          </div>
          <h2 id="upgrade-modal-title" className="text-2xl font-bold text-white">
            {title}
          </h2>
        </div>

        {/* Content */}
        <div className="px-6 py-6">
          <p className="text-gray-600 text-center mb-6">
            {message}
          </p>

          {/* Pro Features */}
          <div className="space-y-3 mb-6">
            <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wide">
              Pro Features Include:
            </h3>
            <ul className="space-y-2">
              {[
                { icon: '♾️', text: 'Unlimited trip creation' },
                { icon: '🔄', text: 'Regenerate trips anytime' },
                { icon: '📤', text: 'Export trips to PDF' },
                { icon: '🤖', text: 'Advanced AI recommendations' },
                { icon: '⚡', text: 'Priority support' },
              ].map((feature, index) => (
                <li key={index} className="flex items-center gap-3">
                  <span className="text-lg">{feature.icon}</span>
                  <span className="text-gray-700">{feature.text}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Pricing */}
          <div className="bg-gray-50 rounded-lg p-4 mb-6 text-center">
            <p className="text-sm text-gray-500">Starting at</p>
            <p className="text-3xl font-bold text-gray-900">
              $9.99<span className="text-lg font-normal text-gray-500">/month</span>
            </p>
            <p className="text-xs text-gray-500 mt-1">Cancel anytime</p>
          </div>

          {/* Actions */}
          <div className="space-y-3">
            <Button
              className="w-full bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700"
              onClick={() => {
                // TODO: Integrate with Stripe
                alert('Stripe integration coming soon!');
              }}
            >
              🎉 Upgrade to Pro
            </Button>
            <button
              onClick={onClose}
              className="w-full py-2 text-sm text-gray-500 hover:text-gray-700 transition-colors"
            >
              Maybe later
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-gray-50 border-t text-center">
          <p className="text-xs text-gray-500">
            🔒 Secure payment powered by Stripe
          </p>
        </div>

        {/* Animation styles */}
        <style jsx>{`
          @keyframes modal-enter {
            from {
              opacity: 0;
              transform: scale(0.95) translateY(10px);
            }
            to {
              opacity: 1;
              transform: scale(1) translateY(0);
            }
          }
          .animate-modal-enter {
            animation: modal-enter 0.2s ease-out;
          }
        `}</style>
      </div>
    </div>
  );
}

/**
 * Simple upgrade banner for inline use
 */
export function UpgradeBanner({ onUpgrade }) {
  return (
    <div className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-lg p-4">
      <div className="flex items-center gap-4">
        <div className="flex-shrink-0">
          <span className="text-3xl">🚀</span>
        </div>
        <div className="flex-1">
          <h3 className="font-semibold text-green-900">Upgrade to Pro</h3>
          <p className="text-sm text-green-700">
            Get unlimited trips and premium features
          </p>
        </div>
        <Button
          onClick={onUpgrade}
          className="flex-shrink-0 bg-green-600 hover:bg-green-700"
        >
          Upgrade
        </Button>
      </div>
    </div>
  );
}