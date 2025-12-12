/**
 * County Parks Index Page
 * Lists all states with county parks
 */

import Link from 'next/link';
import { createServiceClient } from '@/lib/supabase/server';

export const metadata = {
  title: 'County Parks by State | ParkLookup',
  description:
    'Browse county parks across all 50 states. Find regional parks, nature preserves, and recreation areas managed by county governments.',
  openGraph: {
    title: 'County Parks by State | ParkLookup',
    description:
      'Browse county parks across all 50 states. Find regional parks, nature preserves, and recreation areas managed by county governments.',
  },
};

/**
 * Fetches states that have county parks
 */
async function getStatesWithCountyParks() {
  const supabase = createServiceClient();

  const { data, error } = await supabase
    .from('local_parks')
    .select('state_id, states!inner(id, code, name, slug)')
    .eq('park_type', 'county')
    .not('state_id', 'is', null);

  if (error) {
    console.error('Error fetching states with county parks:', error);
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
 * Gets total count of county parks
 */
async function getCountyParksCount() {
  const supabase = createServiceClient();

  const { count, error } = await supabase
    .from('local_parks')
    .select('id', { count: 'exact', head: true })
    .eq('park_type', 'county');

  if (error) {
    console.error('Error getting county parks count:', error);
    return 0;
  }

  return count || 0;
}

export default async function CountyParksIndexPage() {
  const [states, totalCount] = await Promise.all([
    getStatesWithCountyParks(),
    getCountyParksCount(),
  ]);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Hero Section */}
      <section className="bg-gradient-to-br from-blue-600 to-blue-800 text-white py-16">
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
                    d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"
                  />
                </svg>
              </div>
            </div>
            <h1 className="text-4xl md:text-5xl font-bold mb-4">County Parks</h1>
            <p className="text-xl text-blue-100 max-w-2xl mx-auto mb-6">
              Explore {totalCount.toLocaleString()} county parks across {states.length} states.
              Regional parks, nature preserves, and recreation areas managed by county governments.
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
                  href={`/parks/county/${state.slug}`}
                  className="flex flex-col items-center p-4 bg-white rounded-lg shadow-sm hover:shadow-md transition-shadow border border-gray-200"
                >
                  <span className="text-lg font-semibold text-gray-900">{state.code}</span>
                  <span className="text-sm text-gray-600">{state.name}</span>
                  <span className="text-xs text-blue-600 mt-1">
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
                  d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"
                />
              </svg>
              <h3 className="text-lg font-medium text-gray-900 mb-2">No County Parks Yet</h3>
              <p className="text-gray-500">
                County parks haven&apos;t been imported yet. Run the import script to add parks.
              </p>
            </div>
          )}
        </div>
      </section>

      {/* Info Section */}
      <section className="py-12 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl mx-auto text-center">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">About County Parks</h2>
            <p className="text-gray-600 mb-6">
              County parks are managed by county governments and typically offer larger natural
              areas, extensive trail systems, campgrounds, and recreational facilities. They serve
              as important green spaces for regional communities, providing opportunities for
              hiking, camping, fishing, and wildlife observation.
            </p>
            <div className="flex flex-wrap justify-center gap-4">
              <Link
                href="/parks/city"
                className="inline-flex items-center px-6 py-3 bg-purple-600 text-white font-semibold rounded-lg hover:bg-purple-700 transition-colors"
              >
                Browse City Parks
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