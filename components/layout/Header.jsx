/**
 * Header Component
 * Main navigation header
 */

'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/hooks/useAuth';
import Button from '../ui/Button';

export default function Header() {
  const { user, signOut, loading } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleSignOut = async () => {
    await signOut();
    window.location.href = '/';
  };

  return (
    <header className="bg-white shadow-sm sticky top-0 z-50">
      <nav className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          {/* Logo */}
          <div className="flex items-center">
            <Link href="/" className="flex items-center space-x-2">
              <svg
                className="w-8 h-8 text-green-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z"
                />
              </svg>
              <span className="text-xl font-bold text-gray-900">ParkLookup</span>
            </Link>
          </div>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center space-x-8">
            <Link
              href="/parks"
              className="text-gray-600 hover:text-green-600 font-medium transition-colors"
            >
              Explore Parks
            </Link>
            <Link
              href="/map"
              className="text-gray-600 hover:text-green-600 font-medium transition-colors"
            >
              Map
            </Link>
            {user && (
              <Link
                href="/favorites"
                className="text-gray-600 hover:text-green-600 font-medium transition-colors"
              >
                My Favorites
              </Link>
            )}
          </div>

          {/* Auth Buttons */}
          <div className="hidden md:flex items-center space-x-4">
            {loading ? (
              <div className="w-8 h-8 animate-pulse bg-gray-200 rounded-full" />
            ) : user ? (
              <div className="flex items-center space-x-4">
                <Link
                  href="/profile"
                  className="text-gray-600 hover:text-green-600 font-medium transition-colors"
                >
                  Profile
                </Link>
                <Button variant="outline" size="sm" onClick={handleSignOut}>
                  Sign Out
                </Button>
              </div>
            ) : (
              <>
                <Link href="/auth/signin">
                  <Button variant="ghost" size="sm">
                    Sign In
                  </Button>
                </Link>
                <Link href="/auth/signup">
                  <Button size="sm">Sign Up</Button>
                </Link>
              </>
            )}
          </div>

          {/* Mobile menu button */}
          <div className="md:hidden flex items-center">
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 rounded-md text-gray-600 hover:text-gray-900 hover:bg-gray-100"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                {mobileMenuOpen ? (
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                ) : (
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 6h16M4 12h16M4 18h16"
                  />
                )}
              </svg>
            </button>
          </div>
        </div>

        {/* Mobile menu */}
        {mobileMenuOpen && (
          <div className="md:hidden py-4 border-t border-gray-100">
            <div className="flex flex-col space-y-4">
              <Link
                href="/parks"
                className="text-gray-600 hover:text-green-600 font-medium"
                onClick={() => setMobileMenuOpen(false)}
              >
                Explore Parks
              </Link>
              <Link
                href="/map"
                className="text-gray-600 hover:text-green-600 font-medium"
                onClick={() => setMobileMenuOpen(false)}
              >
                Map
              </Link>
              {user && (
                <Link
                  href="/favorites"
                  className="text-gray-600 hover:text-green-600 font-medium"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  My Favorites
                </Link>
              )}
              <hr className="border-gray-100" />
              {user ? (
                <>
                  <Link
                    href="/profile"
                    className="text-gray-600 hover:text-green-600 font-medium"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    Profile
                  </Link>
                  <button
                    onClick={() => {
                      handleSignOut();
                      setMobileMenuOpen(false);
                    }}
                    className="text-left text-gray-600 hover:text-green-600 font-medium"
                  >
                    Sign Out
                  </button>
                </>
              ) : (
                <>
                  <Link
                    href="/auth/signin"
                    className="text-gray-600 hover:text-green-600 font-medium"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    Sign In
                  </Link>
                  <Link
                    href="/auth/signup"
                    className="text-green-600 font-medium"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    Sign Up
                  </Link>
                </>
              )}
            </div>
          </div>
        )}
      </nav>
    </header>
  );
}