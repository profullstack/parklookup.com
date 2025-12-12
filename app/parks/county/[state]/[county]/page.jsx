/**
 * County Parks Listing Page
 *
 * URL: /parks/county/{state}/{county}
 *
 * Lists all parks in a specific county with filtering and pagination.
 */

import { notFound } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { LocalParkGrid } from '@/components/parks/LocalParkCard';

/**
 * Generate metadata for SEO
 */
export async function generateMetadata({ params }) {
  const { state, county } = await params;

  const supabase = await createClient();

  // Fetch county and state info
  const { data: countyData } = await supabase
    .from('counties')
    .select(
      `
      name,
      states!inner(name, slug)
    `
    )
    .eq('slug', county)
    .eq('states.slug', state)
    .single();

  if (!countyData) {
    return {
      title: 'County Not Found | ParkLookup',
    };
  }

  const title = `Parks in ${countyData.name} County, ${countyData.states.name} | ParkLookup`;
  const description = `Discover county and local parks in ${countyData.name} County, ${countyData.states.name}. Find photos, maps, and visitor information for parks near you.`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: 'website',
      url: `/parks/county/${state}/${county}`,
    },
    alternates: {
      canonical: `/parks/county/${state}/${county}`,
    },
  };
}

/**
 * Fetch parks for a county
 */
async function getCountyParks(state, county, page = 1, limit = 24) {
  const supabase = await createClient();
  const offset = (page - 1) * limit;

  // First get county info
  const { data: countyData, error: countyError } = await supabase
    .from('counties')
    .select(
      `
      id,
      name,
      slug,
      states!inner(id, code, name, slug)
    `
    )
    .eq('slug', county)
    .eq('states.slug', state)
    .single();

  if (countyError || !countyData) {
    return null;
  }

  // Fetch parks in this county
  const { data: parks, error: parksError, count } = await supabase
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
      wikidata_id
    `,
      { count: 'exact' }
    )
    .eq('county_id', countyData.id)
    .order('name', { ascending: true })
    .range(offset, offset + limit - 1);

  if (parksError) {
    console.error('Error fetching county parks:', parksError);
    return null;
  }

  // Fetch primary photos for parks
  const parkIds = parks?.map((p) => p.id) || [];
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

  // Transform parks with state/county info
  const transformedParks = parks?.map((park) => ({
    ...park,
    state: {
      code: countyData.states.code,
      name: countyData.states.name,
      slug: countyData.states.slug,
    },
    county: {
      name: countyData.name,
      slug: countyData.slug,
    },
    primary_photo_url: photosMap[park.id] || null,
  }));

  return {
    county: countyData,
    state: countyData.states,
    parks: transformedParks || [],
    pagination: {
      page,
      limit,
      total: count || 0,
      totalPages: Math.ceil((count || 0) / limit),
    },
  };
}

/**
 * County Parks Listing Page Component
 */
export default async function CountyParksPage({ params, searchParams }) {
  const { state, county } = await params;
  const resolvedSearchParams = await searchParams;
  const page = parseInt(resolvedSearchParams?.page || '1', 10);

  const data = await getCountyParks(state, county, page);

  if (!data) {
    notFound();
  }

  const { county: countyData, state: stateData, parks, pagination } = data;

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
          <li className="text-gray-900 dark:text-white font-medium">
            {countyData.name} County
          </li>
        </ol>
      </nav>

      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
          Parks in {countyData.name} County
        </h1>
        <p className="mt-2 text-gray-600 dark:text-gray-400">
          {pagination.total} {pagination.total === 1 ? 'park' : 'parks'} in {countyData.name} County,{' '}
          {stateData.name}
        </p>
      </div>

      {/* Parks Grid */}
      <LocalParkGrid parks={parks} />

      {/* Pagination */}
      {pagination.totalPages > 1 && (
        <div className="mt-8 flex justify-center gap-2">
          {pagination.page > 1 && (
            <Link
              href={`/parks/county/${state}/${county}?page=${pagination.page - 1}`}
              className="px-4 py-2 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700"
            >
              Previous
            </Link>
          )}

          <span className="px-4 py-2 text-gray-600 dark:text-gray-400">
            Page {pagination.page} of {pagination.totalPages}
          </span>

          {pagination.page < pagination.totalPages && (
            <Link
              href={`/parks/county/${state}/${county}?page=${pagination.page + 1}`}
              className="px-4 py-2 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700"
            >
              Next
            </Link>
          )}
        </div>
      )}

      {/* JSON-LD Structured Data */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'CollectionPage',
            name: `Parks in ${countyData.name} County, ${stateData.name}`,
            description: `Discover county and local parks in ${countyData.name} County, ${stateData.name}.`,
            url: `https://parklookup.com/parks/county/${state}/${county}`,
            numberOfItems: pagination.total,
            itemListElement: parks.slice(0, 10).map((park, index) => ({
              '@type': 'ListItem',
              position: index + 1,
              item: {
                '@type': 'Park',
                name: park.name,
                url: `https://parklookup.com/parks/county/${state}/${county}/${park.slug}`,
              },
            })),
          }),
        }}
      />
    </div>
  );
}