/**
 * Local Parks Index Page
 * Lists all county and city parks with filtering by state
 */

import Link from 'next/link';
import { createServiceClient } from '@/lib/supabase/server';
import LocalParkCard from '@/components/parks/LocalParkCard';

// Force dynamic rendering to prevent static generation during build
export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'County & City Parks | ParkLookup',
  description:
    'Discover thousands of county and city parks across America. Find local parks near you with photos, maps, and visitor information.',
  openGraph: {
    title: 'County & City Parks | ParkLookup',
    description:
      'Discover thousands of county and city parks across America. Find local parks near you with photos, maps, and visitor information.',
  },
};

/**
 * Fetches states that have local parks
 */
async function getStatesWithLocalParks() {
  const supabase = createServiceClient();

  // First, get all states
  const { data: states, error: statesError } = await supabase
    .from('states')
    .select('id, code, name, slug')
    .order('name');

  if (statesError) {
    console.error('Error fetching states:', statesError);
    return [];
  }

  // Then get park counts for each state using a more efficient approach
  // Use RPC or aggregate query if available, otherwise count per state
  const statesWithParks = [];

  for (const state of states || []) {
    const { count, error } = await supabase
      .from('local_parks')
      .select('id', { count: 'exact', head: true })
      .eq('state_id', state.id);

    if (!error && count > 0) {
      statesWithParks.push({
        id: state.id,
        code: state.code,
        name: state.name,
        slug: state.slug,
        count,
      });
    }
  }

  return statesWithParks.sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Fetches featured local parks (parks with photos)
 */
async function getFeaturedLocalParks(limit = 12) {
  const supabase = createServiceClient();

  // Get parks that have photos
  const { data: parksWithPhotos } = await supabase
    .from('park_photos')
    .select('park_id')
    .eq('is_primary', true)
    .limit(limit * 2);

  const parkIds = parksWithPhotos?.map((p) => p.park_id) || [];

  if (parkIds.length === 0) {
    // Fallback: get any parks
    const { data } = await supabase
      .from('local_parks')
      .select(
        `
        id,
        name,
        slug,
        park_type,
        managing_agency,
        latitude,
        longitude,
        access,
        states!inner(code, name, slug),
        counties(name, slug),
        cities(name, slug)
      `
      )
      .limit(limit);

    return (
      data?.map((park) => ({
        ...park,
        state: park.states,
        county: park.counties,
        city: park.cities,
        primary_photo_url: null,
      })) || []
    );
  }

  const { data } = await supabase
    .from('local_parks')
    .select(
      `
      id,
      name,
      slug,
      park_type,
      managing_agency,
      latitude,
      longitude,
      access,
      states!inner(code, name, slug),
      counties(name, slug),
      cities(name, slug)
    `
    )
    .in('id', parkIds)
    .limit(limit);

  // Get photos
  const { data: photos } = await supabase
    .from('park_photos')
    .select('park_id, thumb_url')
    .in('park_id', parkIds)
    .eq('is_primary', true);

  const photoMap = new Map(photos?.map((p) => [p.park_id, p.thumb_url]) || []);

  return (
    data?.map((park) => ({
      ...park,
      state: park.states,
      county: park.counties,
      city: park.cities,
      primary_photo_url: photoMap.get(park.id) || null,
    })) || []
  );
}

/**
 * Gets total count of local parks
 */
async function getLocalParksCount() {
  const supabase = createServiceClient();

  const { count, error } = await supabase
    .from('local_parks')
    .select('id', { count: 'exact', head: true });

  if (error) {
    console.error('Error getting local parks count:', error);
    return 0;
  }

  return count || 0;
}

export default async function LocalParksPage() {
  const [states, featuredParks, totalCount] = await Promise.all([
    getStatesWithLocalParks(),
    getFeaturedLocalParks(12),
    getLocalParksCount(),
  ]);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Hero Section */}
      <section className="bg-gradient-to-br from-green-600 to-green-800 text-white py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h1 className="text-4xl md:text-5xl font-bold mb-4">County & City Parks</h1>
            <p className="text-xl text-green-100 max-w-2xl mx-auto mb-6">
              Discover {totalCount.toLocaleString()} local parks across America. From neighborhood
              playgrounds to regional recreation areas.
            </p>
            <div className="flex flex-wrap justify-center gap-4">
              <Link
                href="/parks/county"
                className="inline-flex items-center px-6 py-3 bg-white text-green-700 font-semibold rounded-lg hover:bg-green-50 transition-colors"
              >
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"
                  />
                </svg>
                County Parks
              </Link>
              <Link
                href="/parks/city"
                className="inline-flex items-center px-6 py-3 border-2 border-white text-white font-semibold rounded-lg hover:bg-white/10 transition-colors"
              >
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
                  />
                </svg>
                City Parks
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Browse by State */}
      <section className="py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Browse by State</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {states.map((state) => (
              <Link
                key={state.id}
                href={`/parks/local/${state.slug}`}
                className="flex flex-col items-center p-4 bg-white rounded-lg shadow-sm hover:shadow-md transition-shadow border border-gray-200"
              >
                <span className="text-lg font-semibold text-gray-900">{state.code}</span>
                <span className="text-sm text-gray-500">{state.count.toLocaleString()} parks</span>
              </Link>
            ))}
          </div>
          {states.length === 0 && (
            <p className="text-center text-gray-500 py-8">
              No local parks have been imported yet. Run the import script to add parks.
            </p>
          )}
        </div>
      </section>

      {/* Featured Parks */}
      {featuredParks.length > 0 && (
        <section className="py-12 bg-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Featured Local Parks</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {featuredParks.map((park) => (
                <LocalParkCard key={park.id} park={park} />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Park Types Info */}
      <section className="py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Types of Local Parks</h2>
          <div className="grid md:grid-cols-2 gap-6">
            <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                  <svg
                    className="w-6 h-6 text-green-600"
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
                <h3 className="text-xl font-semibold text-gray-900">County Parks</h3>
              </div>
              <p className="text-gray-600">
                County parks are managed by county governments and often feature larger natural
                areas, trails, campgrounds, and recreational facilities. They serve as important
                green spaces for regional communities.
              </p>
              <Link
                href="/parks/county"
                className="inline-flex items-center mt-4 text-green-600 hover:text-green-700 font-medium"
              >
                Browse County Parks
                <svg className="w-4 h-4 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 5l7 7-7 7"
                  />
                </svg>
              </Link>
            </div>

            <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                  <svg
                    className="w-6 h-6 text-green-600"
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
                <h3 className="text-xl font-semibold text-gray-900">City Parks</h3>
              </div>
              <p className="text-gray-600">
                City parks are managed by municipal governments and range from small neighborhood
                parks to large urban green spaces. They provide essential recreation opportunities
                for urban residents.
              </p>
              <Link
                href="/parks/city"
                className="inline-flex items-center mt-4 text-green-600 hover:text-green-700 font-medium"
              >
                Browse City Parks
                <svg className="w-4 h-4 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 5l7 7-7 7"
                  />
                </svg>
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}