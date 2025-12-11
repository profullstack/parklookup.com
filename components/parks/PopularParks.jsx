/**
 * PopularParks Component
 * Displays popular national parks on the homepage
 * Fetches real data from the parks API
 */

'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';

export default function PopularParks() {
  const [parks, setParks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchPopularParks = async () => {
      try {
        // Fetch parks with images using the hasImages filter
        // The API will filter for parks with valid images server-side
        const response = await fetch('/api/parks/search?limit=8&hasImages=true');
        
        if (!response.ok) {
          throw new Error('Failed to fetch parks');
        }
        
        const data = await response.json();
        
        // Helper function to get the image URL from a park
        // The API already filtered for parks with images, but we still need to extract the URL
        const getImageUrl = (park) => {
          // Check for NPS images array first
          if (Array.isArray(park.images) && park.images.length > 0 && park.images[0]?.url) {
            return park.images[0].url;
          }
          // Fall back to wikidata_image
          if (park.wikidata_image) {
            return park.wikidata_image;
          }
          return null;
        };
        
        // Helper function to check if URL is from Wikimedia (needs unoptimized)
        const isWikimediaUrl = (url) => {
          if (!url) {
            return false;
          }
          return url.includes('wikimedia.org') || url.includes('wikipedia.org');
        };
        
        // Add the image URL to each park for rendering
        const parksWithImageUrls = (data.parks || []).map(park => {
          const imageUrl = getImageUrl(park);
          return {
            ...park,
            validatedImageUrl: imageUrl,
            // Wikimedia URLs need unoptimized because they use redirects
            useUnoptimized: isWikimediaUrl(imageUrl)
          };
        });
        
        console.log('PopularParks: Received', parksWithImageUrls.length, 'parks with images from API');
        
        setParks(parksWithImageUrls);
      } catch (err) {
        console.error('Error fetching popular parks:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchPopularParks();
  }, []);

  if (loading) {
    return (
      <section className="py-16 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">Popular Parks</h2>
            <p className="text-lg text-gray-600">Discover America&apos;s most visited national parks</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {[...Array(8)].map((_, i) => (
              <div
                key={i}
                className="bg-gray-100 rounded-xl overflow-hidden animate-pulse"
              >
                <div className="h-48 bg-gray-200" />
                <div className="p-4">
                  <div className="h-5 bg-gray-200 rounded mb-2" />
                  <div className="h-4 bg-gray-200 rounded w-2/3" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    );
  }

  if (error || parks.length === 0) {
    return null; // Don't show section if there's an error or no parks
  }

  return (
    <section className="py-16 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">Popular Parks</h2>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            Discover America&apos;s most visited national parks. From geysers to canyons, these
            iconic destinations offer unforgettable experiences.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {parks.map((park) => (
            <Link
              key={park.park_code}
              href={`/parks/${park.park_code}`}
              className="group block bg-white rounded-xl overflow-hidden shadow-md hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1"
            >
              <div className="relative h-48 overflow-hidden">
                {park.useUnoptimized ? (
                  // Use regular img for Wikimedia URLs (they use redirects that Next.js can't optimize)
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={park.validatedImageUrl}
                    alt={park.full_name}
                    className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                ) : (
                  <Image
                    src={park.validatedImageUrl}
                    alt={park.full_name}
                    fill
                    className="object-cover group-hover:scale-105 transition-transform duration-300"
                    sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
                  />
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                <div className="absolute bottom-0 left-0 right-0 p-4">
                  <h3 className="text-white font-bold text-lg leading-tight">
                    {park.full_name}
                  </h3>
                  <p className="text-white/80 text-sm mt-1">{park.states}</p>
                </div>
              </div>
              <div className="p-4">
                <p className="text-gray-600 text-sm line-clamp-2">
                  {park.description?.substring(0, 100)}
                  {park.description?.length > 100 ? '...' : ''}
                </p>
                <div className="mt-3 flex items-center text-green-600 text-sm font-medium group-hover:text-green-700">
                  <span>Explore Park</span>
                  <svg
                    className="w-4 h-4 ml-1 group-hover:translate-x-1 transition-transform"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 5l7 7-7 7"
                    />
                  </svg>
                </div>
              </div>
            </Link>
          ))}
        </div>

        <div className="text-center mt-10">
          <Link
            href="/parks"
            className="inline-flex items-center gap-2 px-6 py-3 bg-green-600 text-white font-semibold rounded-lg hover:bg-green-700 transition-colors"
          >
            View All Parks
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M17 8l4 4m0 0l-4 4m4-4H3"
              />
            </svg>
          </Link>
        </div>
      </div>
    </section>
  );
}