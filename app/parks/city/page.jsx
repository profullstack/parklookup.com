/**
 * City Parks Index Page
 * Lists all states with city parks
 */

import Link from 'next/link';
import { createServiceClient } from '@/lib/supabase/server';

// Force dynamic rendering to prevent static generation during build
export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'City Parks by State | ParkLookup',
  description:
    'Browse city parks across all 50 states. Find municipal parks, urban green spaces, and neighborhood recreation areas.',
  openGraph: {
    title: 'City Parks by State | ParkLookup',
    description:
      'Browse city parks across all 50 states. Find municipal parks, urban green spaces, and neighborhood recreation areas.',
  },
};

/**
 * Fetches states that have city parks
 */
async function getStatesWithCityParks() {
  const supabase = createServiceClient();

  const { data, error } = await supabase
    .from('local_parks')
    .select('state_id, states!inner(id, code, name, slug)')
    .eq('park_type', 'city')
    .not('state_id', 'is', null);

  if (error) {
    console.error('Error fetching states with city parks:', error);
    return [];
  }

  // Get unique states with park counts
  const stateMap = new Map();
  data?.forEach((park) => {
    const state = park.states;
    if (state && !stateMap.has(state.id)) {
      stateMap.set(state.id, {
        id: state.id,
        code: state.code,
        name: state.name,
        slug: state.slug,
        count: 0,
      });
    }
    if (state) {
      stateMap.get(state.id).count++;
    }
  });

  return Array.from(stateMap.values()).sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Gets total count of city parks
 */
async function getCityParksCount() {
  const supabase = createServiceClient();

  const { count, error } = await supabase
    .from('local_parks')
    .select('id', { count: 'exact', head: true })
    .eq('park_type', 'city');

  if (error) {
    console.error('Error getting city parks count:', error);
    return 0;
  }

  return count || 0;
}

export default async function CityParksIndexPage() {
  const [states, totalCount] = await Promise.all([getStatesWithCityParks(), getCityParksCount()]);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Hero Section */}
      <section className="bg-gradient-to-br from-purple-600 to-purple-800 text-white py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <div className="flex items-center justify-center gap-3 mb-4">
              <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center">
                <svg
                  className="w-6 h-6 text-white"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
                  />
                </svg>
              </div>
            </div>
            <h1 className="text-4xl md:text-5xl font-bold mb-4">City Parks</h1>
            <p className="text-xl text-purple-100 max-w-2xl mx-auto mb-6">
              Explore {totalCount.toLocaleString()} city parks across {states.length} states.
              Municipal parks, urban green spaces, and neighborhood recreation areas.
            </p>
            <Link
              href="/parks/local"
              className="inline-flex items-center px-6 py-3 border-2 border-white text-white font-semibold rounded-lg hover:bg-white/10 transition-colors"
            >
              ← Back to All Local Parks
            </Link>
          </div>
        </div>
      </section>

      {/* States Grid */}
      <section className="py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Browse by State</h2>
          {states.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
              {states.map((state) => (
                <Link
                  key={state.id}
                  href={`/parks/city/${state.slug}`}
                  className="flex flex-col items-center p-4 bg-white rounded-lg shadow-sm hover:shadow-md transition-shadow border border-gray-200"
                >
                  <span className="text-lg font-semibold text-gray-900">{state.code}</span>
                  <span className="text-sm text-gray-600">{state.name}</span>
                  <span className="text-xs text-purple-600 mt-1">
                    {state.count.toLocaleString()} parks
                  </span>
                </Link>
              ))}
            </div>
          ) : (
            <div className="text-center py-12 bg-white rounded-lg border border-gray-200">
              <svg
                className="w-16 h-16 text-gray-300 mx-auto mb-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
                />
              </svg>
              <h3 className="text-lg font-medium text-gray-900 mb-2">No City Parks Yet</h3>
              <p className="text-gray-500">
                City parks haven&apos;t been imported yet. Run the import script to add parks.
              </p>
            </div>
          )}
        </div>
      </section>

      {/* Info Section */}
      <section className="py-12 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl mx-auto text-center">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">About City Parks</h2>
            <p className="text-gray-600 mb-6">
              City parks are managed by municipal governments and range from small neighborhood
              parks to large urban green spaces. They provide essential recreation opportunities for
              urban residents, including playgrounds, sports facilities, walking paths, and
              community gathering spaces.
            </p>
            <div className="flex flex-wrap justify-center gap-4">
              <Link
                href="/parks/county"
                className="inline-flex items-center px-6 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors"
              >
                Browse County Parks
              </Link>
              <Link
                href="/parks"
                className="inline-flex items-center px-6 py-3 border border-gray-300 text-gray-700 font-semibold rounded-lg hover:bg-gray-50 transition-colors"
              >
                All Parks
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}