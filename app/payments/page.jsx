/**
 * Payments Page
 * View payment history and manage subscription
 */

'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';

/**
 * Format currency amount from cents
 */
function formatCurrency(amount, currency = 'usd') {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency.toUpperCase(),
  }).format(amount / 100);
}

/**
 * Format date for display
 */
function formatDate(dateString) {
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

/**
 * Subscription status badge component
 */
function StatusBadge({ status }) {
  const statusStyles = {
    active: 'bg-green-100 text-green-800',
    canceling: 'bg-yellow-100 text-yellow-800',
    canceled: 'bg-red-100 text-red-800',
    past_due: 'bg-red-100 text-red-800',
    trialing: 'bg-blue-100 text-blue-800',
    inactive: 'bg-gray-100 text-gray-800',
  };

  const statusLabels = {
    active: 'Active',
    canceling: 'Canceling',
    canceled: 'Canceled',
    past_due: 'Past Due',
    trialing: 'Trial',
    inactive: 'Inactive',
  };

  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusStyles[status] || statusStyles.inactive}`}
    >
      {statusLabels[status] || status}
    </span>
  );
}

export default function PaymentsPage() {
  const router = useRouter();
  const { user, loading: authLoading, isAuthenticated } = useAuth();
  const [paymentData, setPaymentData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [canceling, setCanceling] = useState(false);
  const [cancelSuccess, setCancelSuccess] = useState(false);

  // Redirect if not authenticated
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push('/signin?redirect=/payments');
    }
  }, [authLoading, isAuthenticated, router]);

  // Fetch payment data
  useEffect(() => {
    const fetchPaymentData = async () => {
      if (!user) return;

      try {
        const token = localStorage.getItem('parklookup_auth_token');
        const response = await fetch('/api/payments', {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!response.ok) {
          throw new Error('Failed to fetch payment data');
        }

        const data = await response.json();
        setPaymentData(data);
      } catch (err) {
        console.error('Error fetching payment data:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    if (user) {
      fetchPaymentData();
    }
  }, [user]);

  // Handle subscription cancellation
  const handleCancelSubscription = async () => {
    if (!confirm('Are you sure you want to cancel your subscription? You will keep access until the end of your billing period.')) {
      return;
    }

    setCanceling(true);
    try {
      const token = localStorage.getItem('parklookup_auth_token');
      const response = await fetch('/api/payments/cancel', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to cancel subscription');
      }

      setCancelSuccess(true);
      // Refresh payment data
      const refreshResponse = await fetch('/api/payments', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (refreshResponse.ok) {
        const data = await refreshResponse.json();
        setPaymentData(data);
      }
    } catch (err) {
      console.error('Error canceling subscription:', err);
      setError(err.message);
    } finally {
      setCanceling(false);
    }
  };

  // Handle upgrade
  const handleUpgrade = async () => {
    try {
      const token = localStorage.getItem('parklookup_auth_token');
      const response = await fetch('/api/checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({}),
      });

      if (!response.ok) {
        throw new Error('Failed to create checkout session');
      }

      const { url } = await response.json();
      window.location.href = url;
    } catch (err) {
      console.error('Error creating checkout:', err);
      setError(err.message);
    }
  };

  // Loading state
  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="animate-pulse">
            <div className="h-8 bg-gray-200 rounded w-1/4 mb-8"></div>
            <div className="bg-white rounded-lg shadow p-6 mb-6">
              <div className="h-6 bg-gray-200 rounded w-1/3 mb-4"></div>
              <div className="h-4 bg-gray-200 rounded w-1/2 mb-2"></div>
              <div className="h-4 bg-gray-200 rounded w-1/4"></div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">Payments & Subscription</h1>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">
            {error}
          </div>
        )}

        {cancelSuccess && (
          <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg mb-6">
            Your subscription has been scheduled for cancellation. You will keep access until the end of your billing period.
          </div>
        )}

        {/* Subscription Section */}
        <div className="bg-white rounded-lg shadow mb-6">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">Subscription</h2>
          </div>
          <div className="p-6">
            {paymentData?.subscription ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-500">Status</p>
                    <StatusBadge status={paymentData.subscription.status} />
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-gray-500">Plan</p>
                    <p className="text-lg font-semibold text-gray-900">
                      {formatCurrency(paymentData.subscription.plan.amount, paymentData.subscription.plan.currency)}
                      <span className="text-sm font-normal text-gray-500">
                        /{paymentData.subscription.plan.interval}
                      </span>
                    </p>
                  </div>
                </div>

                <div className="border-t border-gray-100 pt-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-gray-500">Current Period</p>
                      <p className="text-sm text-gray-900">
                        {formatDate(paymentData.subscription.currentPeriodStart)} -{' '}
                        {formatDate(paymentData.subscription.currentPeriodEnd)}
                      </p>
                    </div>
                    {paymentData.subscription.cancelAtPeriodEnd && (
                      <div>
                        <p className="text-sm text-gray-500">Cancels On</p>
                        <p className="text-sm text-red-600">
                          {formatDate(paymentData.subscription.currentPeriodEnd)}
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                {!paymentData.subscription.cancelAtPeriodEnd && paymentData.subscription.status === 'active' && (
                  <div className="border-t border-gray-100 pt-4">
                    <button
                      onClick={handleCancelSubscription}
                      disabled={canceling}
                      className="text-red-600 hover:text-red-700 text-sm font-medium disabled:opacity-50"
                    >
                      {canceling ? 'Canceling...' : 'Cancel Subscription'}
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-6">
                <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                  </svg>
                </div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">No Active Subscription</h3>
                <p className="text-gray-500 mb-4">
                  Upgrade to Pro to unlock unlimited trips and premium features.
                </p>
                <button
                  onClick={handleUpgrade}
                  className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
                >
                  Upgrade to Pro - $9.99/month
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Payment History Section */}
        <div className="bg-white rounded-lg shadow">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">Payment History</h2>
          </div>
          <div className="p-6">
            {paymentData?.payments && paymentData.payments.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead>
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Date
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Description
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Amount
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Invoice
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {paymentData.payments.map((payment) => (
                      <tr key={payment.id}>
                        <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                          {formatDate(payment.created)}
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500">
                          {payment.description}
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                          {formatCurrency(payment.amount, payment.currency)}
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap">
                          <StatusBadge status={payment.status === 'paid' ? 'active' : payment.status} />
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap text-right text-sm">
                          {payment.invoicePdf && (
                            <a
                              href={payment.invoicePdf}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-green-600 hover:text-green-700 font-medium"
                            >
                              Download
                            </a>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center py-6">
                <p className="text-gray-500">No payment history yet.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}