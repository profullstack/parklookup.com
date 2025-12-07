import Link from 'next/link';
import ParkCard from '@/components/parks/ParkCard';
import { createAnonClient } from '@/lib/supabase/server';

/**
 * Fetches all parks from the database (NPS + State Parks)
 * @param {number} page - Page number (1-indexed)
 * @param {number} limit - Number of parks per page
 * @returns {Promise<Object>} Parks data with pagination info
 */
async function getParks(page = 1, limit = 24) {
  const supabase = createAnonClient();
  const offset = (page - 1) * limit;

  // Get total count from all_parks view (includes NPS + state parks)
  const { count } = await supabase
    .from('all_parks')
    .select('*', { count: 'exact', head: true });

  // Get parks for current page from all_parks view
  const { data: parks, error } = await supabase
    .from('all_parks')
    .select(
      `
      id,
      park_code,
      full_name,
      description,
      states,
      latitude,
      longitude,
      designation,
      url,
      images,
      source
    `
    )
    .order('full_name', { ascending: true })
    .range(offset, offset + limit - 1);

  if (error) {
    console.error('Error fetching parks:', error);
    return { parks: [], total: 0, page, limit };
  }

  return {
    parks: parks || [],
    total: count || 0,
    page,
    limit,
    totalPages: Math.ceil((count || 0) / limit),
  };
}

/**
 * Generate metadata for the parks page
 */
export const metadata = {
  title: 'All Parks | ParkLookup',
  description:
    'Browse all national parks, state parks, monuments, historic sites, and more. Find your next outdoor adventure.',
  openGraph: {
    title: 'All Parks | ParkLookup',
    description:
      'Browse all national parks, state parks, monuments, historic sites, and more. Find your next outdoor adventure.',
  },
};

/**
 * Parks listing page - displays all parks with pagination
 */
export default async function ParksPage({ searchParams }) {
  const params = await searchParams;
  const page = parseInt(params?.page || '1', 10);
  const { parks, total, totalPages } = await getParks(page);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header Section */}
      <div className="bg-green-700 dark:bg-green-800 text-white py-12">
        <div className="container mx-auto px-4">
          <nav className="mb-4">
            <Link href="/" className="text-green-200 hover:text-white transition-colors">
              ← Back to Home
            </Link>
          </nav>
          <h1 className="text-4xl font-bold mb-2">All Parks</h1>
          <p className="text-green-100 text-lg">
            {total.toLocaleString()} national parks, state parks, monuments, and historic sites to
            explore
          </p>
        </div>
      </div>

      {/* Parks Grid */}
      <div className="container mx-auto px-4 py-8">
        {parks.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-6xl mb-4">🏕️</div>
            <h2 className="text-2xl font-semibold text-gray-700 dark:text-gray-300 mb-2">
              No Parks Found
            </h2>
            <p className="text-gray-500 dark:text-gray-400 mb-6">
              We couldn&apos;t find any parks at this time.
            </p>
            <Link
              href="/search"
              className="inline-block bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-lg transition-colors"
            >
              Search Parks
            </Link>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {parks.map((park) => (
                <ParkCard key={park.id || park.park_code} park={park} />
              ))}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="mt-8 flex justify-center items-center gap-2">
                {page > 1 && (
                  <Link
                    href={`/parks?page=${page - 1}`}
                    className="px-4 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                  >
                    ← Previous
                  </Link>
                )}

                <span className="px-4 py-2 text-gray-600 dark:text-gray-400">
                  Page {page} of {totalPages}
                </span>

                {page < totalPages && (
                  <Link
                    href={`/parks?page=${page + 1}`}
                    className="px-4 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                  >
                    Next →
                  </Link>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* Quick Links Section */}
      <div className="bg-gray-100 dark:bg-gray-800 py-12">
        <div className="container mx-auto px-4">
          <h2 className="text-2xl font-bold text-gray-800 dark:text-white mb-6">
            Browse by State
          </h2>
          <Link
            href="/states"
            className="inline-block bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-lg transition-colors"
          >
            View All States →
          </Link>
        </div>
      </div>
    </div>
  );
}