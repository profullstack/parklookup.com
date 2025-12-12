/**
 * State Counties Index Page
 *
 * URL: /parks/county/{state}
 *
 * Lists all counties in a state that have parks.
 */

// Force dynamic rendering to prevent static generation during build
export const dynamic = 'force-dynamic';

import { notFound } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';

/**
 * Generate metadata for SEO
 */
export async function generateMetadata({ params }) {
  const { state } = await params;

  const supabase = createClient();

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

  const title = `County Parks in ${stateData.name} | ParkLookup`;
  const description = `Browse county parks across ${stateData.name}. Find local parks by county with photos, maps, and visitor information.`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: 'website',
      url: `/parks/county/${state}`,
    },
    alternates: {
      canonical: `/parks/county/${state}`,
    },
  };
}

/**
 * Fetch counties with park counts for a state
 */
async function getStateCounties(stateSlug) {
  const supabase = createClient();

  // Get state info
  const { data: stateData, error: stateError } = await supabase
    .from('states')
    .select('id, code, name, slug')
    .eq('slug', stateSlug)
    .single();

  if (stateError || !stateData) {
    return null;
  }

  // Get counties with park counts
  const { data: counties, error: countiesError } = await supabase
    .from('counties')
    .select(
      `
      id,
      name,
      slug,
      local_parks(count)
    `
    )
    .eq('state_id', stateData.id)
    .order('name', { ascending: true });

  if (countiesError) {
    console.error('Error fetching counties:', countiesError);
    return null;
  }

  // Filter to only counties with parks and transform
  const countiesWithParks = counties
    ?.filter((c) => c.local_parks?.[0]?.count > 0)
    .map((c) => ({
      id: c.id,
      name: c.name,
      slug: c.slug,
      parkCount: c.local_parks?.[0]?.count || 0,
    }));

  // Get total park count for state
  const totalParks = countiesWithParks?.reduce((sum, c) => sum + c.parkCount, 0) || 0;

  return {
    state: stateData,
    counties: countiesWithParks || [],
    totalParks,
  };
}

/**
 * State Counties Index Page Component
 */
export default async function StateCountiesPage({ params }) {
  const { state } = await params;

  const data = await getStateCounties(state);

  if (!data) {
    notFound();
  }

  const { state: stateData, counties, totalParks } = data;

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
          <li className="text-gray-900 dark:text-white font-medium">County Parks</li>
        </ol>
      </nav>

      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
          County Parks in {stateData.name}
        </h1>
        <p className="mt-2 text-gray-600 dark:text-gray-400">
          {totalParks} parks across {counties.length} counties
        </p>
      </div>

      {/* Counties Grid */}
      {counties.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {counties.map((county) => (
            <Link
              key={county.id}
              href={`/parks/county/${state}/${county.slug}`}
              className="block p-4 bg-white dark:bg-gray-800 rounded-lg shadow-sm hover:shadow-md transition-shadow"
            >
              <h2 className="font-semibold text-gray-900 dark:text-white">
                {county.name} County
              </h2>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                {county.parkCount} {county.parkCount === 1 ? 'park' : 'parks'}
              </p>
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
              d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"
            />
          </svg>
          <p className="text-gray-600 dark:text-gray-400">
            No county parks found in {stateData.name}
          </p>
        </div>
      )}

      {/* Also show link to city parks */}
      <div className="mt-12 p-6 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
          Looking for city parks?
        </h2>
        <p className="text-gray-600 dark:text-gray-400 mb-4">
          Browse parks by city in {stateData.name}.
        </p>
        <Link
          href={`/parks/city/${state}`}
          className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          View City Parks
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
            name: `County Parks in ${stateData.name}`,
            description: `Browse county parks across ${stateData.name}.`,
            url: `https://parklookup.com/parks/county/${state}`,
            numberOfItems: totalParks,
          }),
        }}
      />
    </div>
  );
}