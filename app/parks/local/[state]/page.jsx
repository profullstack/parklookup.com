/**
 * State Local Parks Page
 * Lists all local parks in a specific state with county breakdown
 */

// Force dynamic rendering to prevent static generation during build
export const dynamic = 'force-dynamic';

import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createServiceClient } from '@/lib/supabase/server';
import LocalParkCard from '@/components/parks/LocalParkCard';

/**
 * Generate metadata for the page
 */
export async function generateMetadata({ params }) {
  const { state: stateSlug } = await params;
  const supabase = createServiceClient();

  const { data: state } = await supabase
    .from('states')
    .select('name, code')
    .eq('slug', stateSlug)
    .single();

  if (!state) {
    return {
      title: 'State Not Found | ParkLookup',
    };
  }

  return {
    title: `Local Parks in ${state.name} | ParkLookup`,
    description: `Discover county and city parks in ${state.name}. Find local parks near you with photos, maps, and visitor information.`,
    openGraph: {
      title: `Local Parks in ${state.name} | ParkLookup`,
      description: `Discover county and city parks in ${state.name}. Find local parks near you with photos, maps, and visitor information.`,
    },
  };
}

/**
 * Fetches state info
 */
async function getState(stateSlug) {
  const supabase = createServiceClient();

  const { data, error } = await supabase
    .from('states')
    .select('id, code, name, slug')
    .eq('slug', stateSlug)
    .single();

  if (error || !data) {
    return null;
  }

  return data;
}

/**
 * Fetches counties with local parks in this state
 */
async function getCountiesWithParks(stateId) {
  const supabase = createServiceClient();

  const { data } = await supabase
    .from('local_parks')
    .select('county_id, counties!inner(id, name, slug)')
    .eq('state_id', stateId)
    .not('county_id', 'is', null);

  // Aggregate counties with park counts
  const countyMap = new Map();
  (data ?? []).forEach((park) => {
    const county = park.counties;
    if (county && !countyMap.has(county.id)) {
      countyMap.set(county.id, {
        id: county.id,
        name: county.name,
        slug: county.slug,
        park_count: 0,
      });
    }
    if (county) {
      countyMap.get(county.id).park_count++;
    }
  });

  return Array.from(countyMap.values()).sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Fetches local parks in this state
 */
async function getLocalParks(stateId, limit = 24) {
  const supabase = createServiceClient();

  const { data, count } = await supabase
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
    `,
      { count: 'exact' }
    )
    .eq('state_id', stateId)
    .order('name')
    .limit(limit);

  // Get photos for these parks
  const parkIds = data?.map((p) => p.id) || [];
  let photosMap = {};

  if (parkIds.length > 0) {
    const { data: photos } = await supabase
      .from('park_photos')
      .select('park_id, thumb_url')
      .in('park_id', parkIds)
      .eq('is_primary', true);

    if (photos) {
      photosMap = photos.reduce((acc, photo) => {
        acc[photo.park_id] = photo.thumb_url;
        return acc;
      }, {});
    }
  }

  const parks =
    data?.map((park) => ({
      ...park,
      state: park.states,
      county: park.counties,
      city: park.cities,
      primary_photo_url: photosMap[park.id] || null,
    })) || [];

  return { parks, total: count || 0 };
}

export default async function StateLocalParksPage({ params }) {
  const { state: stateSlug } = await params;

  const state = await getState(stateSlug);

  if (!state) {
    notFound();
  }

  const [counties, { parks, total }] = await Promise.all([
    getCountiesWithParks(state.id),
    getLocalParks(state.id),
  ]);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Hero Section */}
      <section className="bg-gradient-to-br from-green-600 to-green-800 text-white py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Breadcrumb */}
          <nav className="mb-4">
            <ol className="flex items-center space-x-2 text-sm text-green-100">
              <li>
                <Link href="/" className="hover:text-white">
                  Home
                </Link>
              </li>
              <li>/</li>
              <li>
                <Link href="/parks/local" className="hover:text-white">
                  Local Parks
                </Link>
              </li>
              <li>/</li>
              <li className="text-white font-medium">{state.name}</li>
            </ol>
          </nav>

          <div className="flex items-center gap-4 mb-4">
            <h1 className="text-3xl md:text-4xl font-bold">Local Parks in {state.name}</h1>
            <span className="bg-white/20 text-white text-lg font-medium px-3 py-1 rounded">
              {state.code}
            </span>
          </div>
          <p className="text-xl text-green-100">
            {total.toLocaleString()} county and city parks across {counties.length} counties
          </p>
        </div>
      </section>

      {/* Counties Section */}
      {counties.length > 0 && (
        <section className="py-8 bg-white border-b">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Browse by County</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
              {counties.map((county) => (
                <Link
                  key={county.id}
                  href={`/parks/county/${stateSlug}/${county.slug}`}
                  className="flex flex-col items-center p-3 bg-gray-50 rounded-lg hover:bg-green-50 hover:border-green-200 transition-colors border border-gray-200"
                >
                  <span className="font-medium text-gray-900 text-sm text-center line-clamp-1">
                    {county.name}
                  </span>
                  <span className="text-xs text-green-600 mt-1">
                    {county.park_count} park{county.park_count !== 1 ? 's' : ''}
                  </span>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Parks Grid */}
      <section className="py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold text-gray-900">
              All Local Parks ({total.toLocaleString()})
            </h2>
          </div>

          {parks.length > 0 ? (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {parks.map((park) => (
                  <LocalParkCard key={park.id} park={park} />
                ))}
              </div>

              {total > parks.length && (
                <div className="text-center mt-8">
                  <p className="text-gray-500 mb-4">
                    Showing {parks.length} of {total.toLocaleString()} parks
                  </p>
                  <p className="text-sm text-gray-400">
                    Browse by county above to see all parks in a specific area
                  </p>
                </div>
              )}
            </>
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
              <h3 className="text-lg font-medium text-gray-900 mb-2">No Local Parks Yet</h3>
              <p className="text-gray-500">
                Local parks for {state.name} haven&apos;t been imported yet.
              </p>
            </div>
          )}
        </div>
      </section>

      {/* Back Link */}
      <section className="py-8 bg-white border-t">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <Link href="/parks/local" className="text-green-600 hover:text-green-700 font-medium">
            ← Back to All Local Parks
          </Link>
          <span className="mx-4 text-gray-300">|</span>
          <Link
            href={`/states/${stateSlug}`}
            className="text-green-600 hover:text-green-700 font-medium"
          >
            View All {state.name} Parks →
          </Link>
        </div>
      </section>
    </div>
  );
}