/**
 * User Settings Page
 * Allows users to manage their profile and preferences
 */

'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import Card, { CardContent } from '@/components/ui/Card';
import Button from '@/components/ui/Button';

export default function SettingsPage() {
  const router = useRouter();
  const { user, loading: authLoading, isAuthenticated } = useAuth();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  // Form state
  const [displayName, setDisplayName] = useState('');
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

  // eslint-disable-next-line no-undef
  const showAlert = (message) => window.alert(message);
  // eslint-disable-next-line no-undef
  const showConfirm = (message) => window.confirm(message);

  /**
   * Handle upgrade to Pro - redirect to Stripe checkout
   */
  const handleUpgrade = async () => {
    const token = localStorage.getItem('parklookup_auth_token');
    if (!token) {
      router.push('/signin?redirect=/settings');
      return;
    }

    try {
      const response = await fetch('/api/checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({}),
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

  if (!isAuthenticated) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-2xl mx-auto px-4">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">Settings</h1>

        {/* Profile Section */}
        <Card className="mb-6">
          <CardContent>
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Profile</h2>

            <form onSubmit={handleSubmit} className="space-y-6">
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
                      {profile?.is_pro ? 'Pro Member' : 'Free Account'}
                    </p>
                  </div>
                  {profile?.is_pro ? (
                    <span className="px-3 py-1 bg-green-100 text-green-800 text-sm font-medium rounded-full">
                      ✨ Pro
                    </span>
                  ) : (
                    <Button
                      type="button"
                      onClick={handleUpgrade}
                      className="bg-gradient-to-r from-green-600 to-green-700"
                    >
                      Upgrade to Pro
                    </Button>
                  )}
                </div>
                {!profile?.is_pro && (
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