/**
 * State Cities Index Page
 *
 * URL: /parks/city/{state}
 *
 * Lists all cities in a state that have parks.
 */

import { notFound } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';

/**
 * Generate metadata for SEO
 */
export async function generateMetadata({ params }) {
  const { state } = await params;

  const supabase = await createClient();

  const { data: stateData } = await supabase
    .from('states')
    .select('name, code')
    .eq('slug', state)
    .single();

  if (!stateData) {
    return {
      title: 'State Not Found | ParkLookup',
    };
  }

  const title = `City Parks in ${stateData.name} | ParkLookup`;
  const description = `Browse city parks across ${stateData.name}. Find local parks by city with photos, maps, and visitor information.`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: 'website',
      url: `/parks/city/${state}`,
    },
    alternates: {
      canonical: `/parks/city/${state}`,
    },
  };
}

/**
 * Fetch cities with park counts for a state
 */
async function getStateCities(stateSlug) {
  const supabase = await createClient();

  // Get state info
  const { data: stateData, error: stateError } = await supabase
    .from('states')
    .select('id, code, name, slug')
    .eq('slug', stateSlug)
    .single();

  if (stateError || !stateData) {
    return null;
  }

  // Get cities with park counts
  const { data: cities, error: citiesError } = await supabase
    .from('cities')
    .select(
      `
      id,
      name,
      slug,
      population,
      local_parks(count)
    `
    )
    .eq('state_id', stateData.id)
    .order('name', { ascending: true });

  if (citiesError) {
    console.error('Error fetching cities:', citiesError);
    return null;
  }

  // Filter to only cities with parks and transform
  const citiesWithParks = cities
    ?.filter((c) => c.local_parks?.[0]?.count > 0)
    .map((c) => ({
      id: c.id,
      name: c.name,
      slug: c.slug,
      population: c.population,
      parkCount: c.local_parks?.[0]?.count || 0,
    }))
    .sort((a, b) => b.parkCount - a.parkCount); // Sort by park count descending

  // Get total park count for state
  const totalParks = citiesWithParks?.reduce((sum, c) => sum + c.parkCount, 0) || 0;

  return {
    state: stateData,
    cities: citiesWithParks || [],
    totalParks,
  };
}

/**
 * State Cities Index Page Component
 */
export default async function StateCitiesPage({ params }) {
  const { state } = await params;

  const data = await getStateCities(state);

  if (!data) {
    notFound();
  }

  const { state: stateData, cities, totalParks } = data;

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* Breadcrumbs */}
      <nav className="mb-6">
        <ol className="flex flex-wrap items-center text-sm text-gray-500 dark:text-gray-400">
          <li className="flex items-center">
            <Link href="/parks" className="hover:text-green-600 dark:hover:text-green-400">
              Parks
            </Link>
            <svg className="w-4 h-4 mx-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </li>
          <li className="flex items-center">
            <Link
              href={`/states/${stateData.slug}`}
              className="hover:text-green-600 dark:hover:text-green-400"
            >
              {stateData.name}
            </Link>
            <svg className="w-4 h-4 mx-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </li>
          <li className="text-gray-900 dark:text-white font-medium">City Parks</li>
        </ol>
      </nav>

      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
          City Parks in {stateData.name}
        </h1>
        <p className="mt-2 text-gray-600 dark:text-gray-400">
          {totalParks} parks across {cities.length} cities
        </p>
      </div>

      {/* Cities Grid */}
      {cities.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {cities.map((city) => (
            <Link
              key={city.id}
              href={`/parks/city/${state}/${city.slug}`}
              className="block p-4 bg-white dark:bg-gray-800 rounded-lg shadow-sm hover:shadow-md transition-shadow"
            >
              <h2 className="font-semibold text-gray-900 dark:text-white">{city.name}</h2>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                {city.parkCount} {city.parkCount === 1 ? 'park' : 'parks'}
              </p>
              {city.population && (
                <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">
                  Pop. {city.population.toLocaleString()}
                </p>
              )}
            </Link>
          ))}
        </div>
      ) : (
        <div className="text-center py-12 bg-gray-100 dark:bg-gray-800 rounded-lg">
          <svg
            className="w-12 h-12 mx-auto text-gray-400 mb-4"
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
          <p className="text-gray-600 dark:text-gray-400">
            No city parks found in {stateData.name}
          </p>
        </div>
      )}

      {/* Also show link to county parks */}
      <div className="mt-12 p-6 bg-green-50 dark:bg-green-900/20 rounded-lg">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
          Looking for county parks?
        </h2>
        <p className="text-gray-600 dark:text-gray-400 mb-4">
          Browse parks by county in {stateData.name}.
        </p>
        <Link
          href={`/parks/county/${state}`}
          className="inline-flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
        >
          View County Parks
          <svg className="w-4 h-4 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </Link>
      </div>

      {/* JSON-LD Structured Data */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'CollectionPage',
            name: `City Parks in ${stateData.name}`,
            description: `Browse city parks across ${stateData.name}.`,
            url: `https://parklookup.com/parks/city/${state}`,
            numberOfItems: totalParks,
          }),
        }}
      />
    </div>
  );
}