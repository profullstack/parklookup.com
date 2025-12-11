/**
 * Header Component
 * Main navigation header
 */

'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
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
            <Link href="/" className="flex items-center">
              <Image
                src="/logo.white.svg"
                alt="ParkLookup"
                width={225}
                height={50}
                className="h-[50px] w-auto"
                priority
              />
            </Link>
          </div>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center space-x-8">
            <Link
              href="/search"
              className="text-gray-600 hover:text-green-600 font-medium transition-colors"
            >
              Explore Parks
            </Link>
            <Link
              href="/states"
              className="text-gray-600 hover:text-green-600 font-medium transition-colors"
            >
              States
            </Link>
            {user && (
              <>
                <Link
                  href="/trips"
                  className="text-gray-600 hover:text-green-600 font-medium transition-colors flex items-center gap-1"
                >
                  <span>🧭</span>
                  My Trips
                </Link>
                <Link
                  href="/favorites"
                  className="text-gray-600 hover:text-green-600 font-medium transition-colors"
                >
                  My Favorites
                </Link>
              </>
            )}
          </div>

          {/* Auth Buttons */}
          <div className="hidden md:flex items-center space-x-4">
            {loading ? (
              <div className="w-8 h-8 animate-pulse bg-gray-200 rounded-full" />
            ) : user ? (
              <div className="flex items-center space-x-4">
                <span className="text-gray-600 text-sm">
                  {user.email?.split('@')[0]}
                </span>
                <Button variant="outline" size="sm" onClick={handleSignOut}>
                  Sign Out
                </Button>
              </div>
            ) : (
              <>
                <Link href="/signin">
                  <Button variant="ghost" size="sm">
                    Sign In
                  </Button>
                </Link>
                <Link href="/signup">
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
                href="/search"
                className="text-gray-600 hover:text-green-600 font-medium"
                onClick={() => setMobileMenuOpen(false)}
              >
                Explore Parks
              </Link>
              <Link
                href="/states"
                className="text-gray-600 hover:text-green-600 font-medium"
                onClick={() => setMobileMenuOpen(false)}
              >
                States
              </Link>
              {user && (
                <>
                  <Link
                    href="/trips"
                    className="text-gray-600 hover:text-green-600 font-medium flex items-center gap-1"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    <span>🧭</span>
                    My Trips
                  </Link>
                  <Link
                    href="/favorites"
                    className="text-gray-600 hover:text-green-600 font-medium"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    My Favorites
                  </Link>
                </>
              )}
              <hr className="border-gray-100" />
              {user ? (
                <>
                  <span className="text-gray-600 text-sm">
                    {user.email?.split('@')[0]}
                  </span>
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
                    href="/signin"
                    className="text-gray-600 hover:text-green-600 font-medium"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    Sign In
                  </Link>
                  <Link
                    href="/signup"
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