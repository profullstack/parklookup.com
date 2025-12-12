/**
 * User Settings Page
 * Allows users to manage their profile and preferences
 */

'use client';

import { Suspense, useState, useEffect, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Image from 'next/image';
import { useAuth } from '@/hooks/useAuth';
import Card, { CardContent } from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import DiscountOfferModal from '@/components/ui/DiscountOfferModal';

/**
 * Loading fallback for the settings page
 */
function SettingsLoading() {
  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-2xl mx-auto px-4">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/3" />
          <div className="h-64 bg-gray-200 rounded" />
        </div>
      </div>
    </div>
  );
}

/**
 * Settings page content component
 * Separated to allow Suspense boundary for useSearchParams
 */
function SettingsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, loading: authLoading, isAuthenticated } = useAuth();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [showDiscountModal, setShowDiscountModal] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState(null);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const avatarInputRef = useRef(null);
  
  // Track if we've already processed the checkout status to prevent double-processing
  const checkoutProcessedRef = useRef(false);

  // Form state
  const [displayName, setDisplayName] = useState('');
  const [username, setUsername] = useState('');
  const [preferences, setPreferences] = useState({
    emailNotifications: true,
    darkMode: false,
    units: 'imperial', // imperial or metric
  });

  // Redirect if not authenticated
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push('/signin?redirect=/settings');
    }
  }, [authLoading, isAuthenticated, router]);

  // Check for checkout cancellation and show discount modal
  // Using window.location.search directly to avoid issues with Suspense boundary
  useEffect(() => {
    // Only process once to prevent issues with re-renders
    if (checkoutProcessedRef.current) {
      return;
    }
    
    // Check both useSearchParams and window.location.search for the checkout parameter
    // This handles cases where the Suspense boundary might delay the searchParams
    let checkoutStatus = searchParams.get('checkout');
    
    // Fallback to window.location.search if searchParams doesn't have the value
    if (!checkoutStatus && typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      checkoutStatus = urlParams.get('checkout');
    }
    
    if (checkoutStatus === 'cancelled') {
      checkoutProcessedRef.current = true;
      
      // Show discount modal after a short delay for better UX
      // Do this BEFORE cleaning up the URL
      const timer = setTimeout(() => {
        setShowDiscountModal(true);
        // Clean up the URL after showing the modal
        if (typeof window !== 'undefined') {
          window.history.replaceState({}, '', '/settings');
        }
      }, 500);
      
      return () => clearTimeout(timer);
    } else if (checkoutStatus === 'success') {
      checkoutProcessedRef.current = true;
      setSuccess('🎉 Welcome to Pro! Your subscription is now active.');
      
      // Clean up the URL
      if (typeof window !== 'undefined') {
        window.history.replaceState({}, '', '/settings');
      }
    }
  }, [searchParams]);

  // eslint-disable-next-line no-undef
  const showAlert = (message) => window.alert(message);
  // eslint-disable-next-line no-undef
  const showConfirm = (message) => window.confirm(message);

  /**
   * Handle upgrade to Pro - redirect to Stripe checkout
   * @param {string} couponCode - Optional coupon code to apply
   */
  const handleUpgrade = async (couponCode = null) => {
    const token = localStorage.getItem('parklookup_auth_token');
    if (!token) {
      router.push('/signin?redirect=/settings');
      return;
    }

    try {
      const requestBody = {};
      if (couponCode) {
        requestBody.couponCode = couponCode;
      }

      const response = await fetch('/api/checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to start checkout');
      }

      const { url } = await response.json();
      if (url) {
        window.location.href = url;
      }
    } catch (err) {
      console.error('Checkout error:', err);
      setError(err.message);
    }
  };

  /**
   * Handle accepting the discount offer
   * @param {string} couponCode - The coupon code to apply
   */
  const handleAcceptDiscount = async (couponCode) => {
    setShowDiscountModal(false);
    await handleUpgrade(couponCode);
  };

  // Fetch profile
  useEffect(() => {
    const fetchProfile = async () => {
      if (!user) {return;}

      try {
        // Get token from localStorage
        const token = localStorage.getItem('parklookup_auth_token');
        const headers = token ? { Authorization: `Bearer ${token}` } : {};
        
        const response = await fetch('/api/profile', { headers });
        if (!response.ok) {
          throw new Error('Failed to fetch profile');
        }
        const data = await response.json();
        setProfile(data.profile);
        setDisplayName(data.profile?.display_name || user.email?.split('@')[0] || '');
        setUsername(data.profile?.username || '');
        setAvatarUrl(data.profile?.avatar_url || null);
        if (data.profile?.preferences) {
          setPreferences((prev) => ({
            ...prev,
            ...data.profile.preferences,
          }));
        }
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    if (user) {
      fetchProfile();
    }
  }, [user]);

  /**
   * Handle avatar file selection
   */
  const handleAvatarChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      setError('Invalid file type. Please upload a JPEG, PNG, GIF, or WebP image.');
      return;
    }

    // Validate file size (max 5MB)
    const maxSize = 5 * 1024 * 1024;
    if (file.size > maxSize) {
      setError('File too large. Maximum size is 5MB.');
      return;
    }

    setAvatarUploading(true);
    setError(null);

    try {
      const token = localStorage.getItem('parklookup_auth_token');
      const formData = new FormData();
      formData.append('avatar', file);

      const response = await fetch('/api/profile/avatar', {
        method: 'POST',
        headers: {
          ...(token && { Authorization: `Bearer ${token}` }),
        },
        body: formData,
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to upload avatar');
      }

      const data = await response.json();
      setAvatarUrl(data.avatar_url);
      setSuccess('Avatar updated successfully!');
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err.message);
    } finally {
      setAvatarUploading(false);
      // Reset the input
      if (avatarInputRef.current) {
        avatarInputRef.current.value = '';
      }
    }
  };

  /**
   * Handle avatar removal
   */
  const handleRemoveAvatar = async () => {
    if (!avatarUrl) return;
    if (!showConfirm('Are you sure you want to remove your avatar?')) return;

    setAvatarUploading(true);
    setError(null);

    try {
      const token = localStorage.getItem('parklookup_auth_token');

      const response = await fetch('/api/profile/avatar', {
        method: 'DELETE',
        headers: {
          ...(token && { Authorization: `Bearer ${token}` }),
        },
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to remove avatar');
      }

      setAvatarUrl(null);
      setSuccess('Avatar removed successfully!');
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err.message);
    } finally {
      setAvatarUploading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      // Get token from localStorage
      const token = localStorage.getItem('parklookup_auth_token');
      
      const response = await fetch('/api/profile', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...(token && { Authorization: `Bearer ${token}` }),
        },
        body: JSON.stringify({
          display_name: displayName,
          username,
          preferences,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to save settings');
      }

      const data = await response.json();
      setProfile(data.profile);
      setSuccess('Settings saved successfully!');

      // Clear success message after 3 seconds
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  if (authLoading || loading) {
    return <SettingsLoading />;
  }

  if (!isAuthenticated) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      {/* Discount Offer Modal */}
      <DiscountOfferModal
        isOpen={showDiscountModal}
        onClose={() => setShowDiscountModal(false)}
        onAccept={handleAcceptDiscount}
        couponCode="50OFF"
        discountText="50% off for the lifetime of your subscription"
      />

      <div className="max-w-2xl mx-auto px-4">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">Settings</h1>

        {/* Profile Section */}
        <Card className="mb-6">
          <CardContent>
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Profile</h2>

            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Avatar */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Profile Photo
                </label>
                <div className="flex items-center gap-4">
                  {/* Avatar Preview */}
                  <div className="relative">
                    {avatarUrl ? (
                      <Image
                        src={avatarUrl}
                        alt="Your avatar"
                        width={80}
                        height={80}
                        className="rounded-full object-cover"
                      />
                    ) : (
                      <div className="w-20 h-20 rounded-full bg-gray-200 flex items-center justify-center">
                        <svg className="w-10 h-10 text-gray-400" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
                        </svg>
                      </div>
                    )}
                    {avatarUploading && (
                      <div className="absolute inset-0 bg-black bg-opacity-50 rounded-full flex items-center justify-center">
                        <svg className="w-6 h-6 text-white animate-spin" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                        </svg>
                      </div>
                    )}
                  </div>

                  {/* Upload/Remove Buttons */}
                  <div className="flex flex-col gap-2">
                    <input
                      ref={avatarInputRef}
                      type="file"
                      accept="image/jpeg,image/png,image/gif,image/webp"
                      onChange={handleAvatarChange}
                      className="hidden"
                      id="avatar-upload"
                    />
                    <label
                      htmlFor="avatar-upload"
                      className={`px-4 py-2 text-sm font-medium rounded-lg cursor-pointer transition-colors ${
                        avatarUploading
                          ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                          : 'bg-green-600 text-white hover:bg-green-700'
                      }`}
                    >
                      {avatarUploading ? 'Uploading...' : 'Upload Photo'}
                    </label>
                    {avatarUrl && (
                      <button
                        type="button"
                        onClick={handleRemoveAvatar}
                        disabled={avatarUploading}
                        className="px-4 py-2 text-sm font-medium text-red-600 hover:text-red-700 disabled:opacity-50"
                      >
                        Remove
                      </button>
                    )}
                  </div>
                </div>
                <p className="mt-2 text-xs text-gray-500">
                  JPEG, PNG, GIF, or WebP. Max 5MB.
                </p>
              </div>

              {/* Email (read-only) */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email
                </label>
                <input
                  type="email"
                  value={user?.email || ''}
                  disabled
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-100 text-gray-500 cursor-not-allowed"
                />
                <p className="mt-1 text-xs text-gray-500">
                  Email cannot be changed
                </p>
              </div>

              {/* Username */}
              <div>
                <label
                  htmlFor="username"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Username
                </label>
                <div className="flex items-center">
                  <span className="text-gray-500 mr-1">@</span>
                  <input
                    type="text"
                    id="username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                    placeholder="username"
                    pattern="[a-z0-9_]{3,50}"
                    title="3-50 characters, lowercase letters, numbers, and underscores only"
                  />
                </div>
                <p className="mt-1 text-xs text-gray-500">
                  Your unique username for your profile URL
                </p>
              </div>

              {/* Display Name */}
              <div>
                <label
                  htmlFor="displayName"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Display Name
                </label>
                <input
                  type="text"
                  id="displayName"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                  placeholder="Your display name"
                />
              </div>

              {/* Account Status */}
              <div className="p-4 bg-gray-50 rounded-lg">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-gray-900">Account Status</p>
                    <p className="text-sm text-gray-500">
                      {profile?.subscription_tier === 'pro' && profile?.subscription_status === 'active'
                        ? 'Pro Member'
                        : 'Free Account'}
                    </p>
                  </div>
                  {profile?.subscription_tier === 'pro' && profile?.subscription_status === 'active' ? (
                    <span className="px-3 py-1 bg-green-100 text-green-800 text-sm font-medium rounded-full">
                      ✨ Pro
                    </span>
                  ) : (
                    <Button
                      type="button"
                      onClick={() => handleUpgrade()}
                      className="bg-gradient-to-r from-green-600 to-green-700"
                    >
                      Upgrade to Pro
                    </Button>
                  )}
                </div>
                {!(profile?.subscription_tier === 'pro' && profile?.subscription_status === 'active') && (
                  <p className="mt-2 text-xs text-gray-500">
                    Pro members get unlimited trip creation and premium features.
                  </p>
                )}
              </div>

              {/* Error/Success Messages */}
              {error && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-sm text-red-600">{error}</p>
                </div>
              )}

              {success && (
                <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                  <p className="text-sm text-green-600">{success}</p>
                </div>
              )}

              {/* Save Button */}
              <div className="flex justify-end">
                <Button type="submit" disabled={saving}>
                  {saving ? 'Saving...' : 'Save Changes'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        {/* Preferences Section */}
        <Card className="mb-6">
          <CardContent>
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Preferences</h2>

            <div className="space-y-4">
              {/* Email Notifications */}
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-gray-900">Email Notifications</p>
                  <p className="text-sm text-gray-500">
                    Receive updates about your trips and favorites
                  </p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={preferences.emailNotifications}
                    onChange={(e) =>
                      setPreferences((prev) => ({
                        ...prev,
                        emailNotifications: e.target.checked,
                      }))
                    }
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-green-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-600" />
                </label>
              </div>

              {/* Units */}
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-gray-900">Distance Units</p>
                  <p className="text-sm text-gray-500">
                    Choose your preferred unit system
                  </p>
                </div>
                <select
                  value={preferences.units}
                  onChange={(e) =>
                    setPreferences((prev) => ({
                      ...prev,
                      units: e.target.value,
                    }))
                  }
                  className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                >
                  <option value="imperial">Imperial (miles)</option>
                  <option value="metric">Metric (km)</option>
                </select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Account Actions */}
        <Card>
          <CardContent>
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Account</h2>

            <div className="space-y-4">
              {/* Member Since */}
              <div className="flex items-center justify-between py-2">
                <div>
                  <p className="font-medium text-gray-900">Member Since</p>
                  <p className="text-sm text-gray-500">
                    {profile?.created_at
                      ? new Date(profile.created_at).toLocaleDateString('en-US', {
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric',
                        })
                      : 'N/A'}
                  </p>
                </div>
              </div>

              {/* Danger Zone */}
              <div className="pt-4 border-t border-gray-200">
                <p className="text-sm font-medium text-red-600 mb-2">Danger Zone</p>
                <Button
                  type="button"
                  variant="outline"
                  className="text-red-600 border-red-300 hover:bg-red-50"
                  onClick={() => {
                    if (
                      showConfirm(
                        'Are you sure you want to delete your account? This action cannot be undone.'
                      )
                    ) {
                      // TODO: Implement account deletion
                      showAlert('Account deletion coming soon. Please contact support.');
                    }
                  }}
                >
                  Delete Account
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

/**
 * Settings page wrapper with Suspense boundary
 * Required for useSearchParams to work during static generation
 */
export default function SettingsPage() {
  return (
    <Suspense fallback={<SettingsLoading />}>
      <SettingsContent />
    </Suspense>
  );
}