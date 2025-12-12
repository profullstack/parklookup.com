/**
 * City Parks Listing Page
 *
 * URL: /parks/city/{state}/{city}
 *
 * Lists all parks in a specific city with filtering and pagination.
 */

import { notFound } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { LocalParkGrid } from '@/components/parks/LocalParkCard';

/**
 * Generate metadata for SEO
 */
export async function generateMetadata({ params }) {
  const { state, city } = await params;

  const supabase = createClient();

  // Fetch city and state info
  const { data: cityData } = await supabase
    .from('cities')
    .select(
      `
      name,
      states!inner(name, slug)
    `
    )
    .eq('slug', city)
    .eq('states.slug', state)
    .single();

  if (!cityData) {
    return {
      title: 'City Not Found | ParkLookup',
    };
  }

  const title = `Parks in ${cityData.name}, ${cityData.states.name} | ParkLookup`;
  const description = `Discover city and local parks in ${cityData.name}, ${cityData.states.name}. Find photos, maps, and visitor information for parks near you.`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: 'website',
      url: `/parks/city/${state}/${city}`,
    },
    alternates: {
      canonical: `/parks/city/${state}/${city}`,
    },
  };
}

/**
 * Fetch parks for a city
 */
async function getCityParks(state, city, page = 1, limit = 24) {
  const supabase = createClient();
  const offset = (page - 1) * limit;

  // First get city info
  const { data: cityData, error: cityError } = await supabase
    .from('cities')
    .select(
      `
      id,
      name,
      slug,
      states!inner(id, code, name, slug),
      counties(id, name, slug)
    `
    )
    .eq('slug', city)
    .eq('states.slug', state)
    .single();

  if (cityError || !cityData) {
    return null;
  }

  // Fetch parks in this city
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
    .eq('city_id', cityData.id)
    .order('name', { ascending: true })
    .range(offset, offset + limit - 1);

  if (parksError) {
    console.error('Error fetching city parks:', parksError);
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

  // Transform parks with state/city info
  const transformedParks = parks?.map((park) => ({
    ...park,
    state: {
      code: cityData.states.code,
      name: cityData.states.name,
      slug: cityData.states.slug,
    },
    city: {
      name: cityData.name,
      slug: cityData.slug,
    },
    county: cityData.counties
      ? {
          name: cityData.counties.name,
          slug: cityData.counties.slug,
        }
      : null,
    primary_photo_url: photosMap[park.id] || null,
  }));

  return {
    city: cityData,
    state: cityData.states,
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
 * City Parks Listing Page Component
 */
export default async function CityParksPage({ params, searchParams }) {
  const { state, city } = await params;
  const resolvedSearchParams = await searchParams;
  const page = parseInt(resolvedSearchParams?.page || '1', 10);

  const data = await getCityParks(state, city, page);

  if (!data) {
    notFound();
  }

  const { city: cityData, state: stateData, parks, pagination } = data;

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
          <li className="text-gray-900 dark:text-white font-medium">{cityData.name}</li>
        </ol>
      </nav>

      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
          Parks in {cityData.name}
        </h1>
        <p className="mt-2 text-gray-600 dark:text-gray-400">
          {pagination.total} {pagination.total === 1 ? 'park' : 'parks'} in {cityData.name},{' '}
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
              href={`/parks/city/${state}/${city}?page=${pagination.page - 1}`}
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
              href={`/parks/city/${state}/${city}?page=${pagination.page + 1}`}
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
            name: `Parks in ${cityData.name}, ${stateData.name}`,
            description: `Discover city and local parks in ${cityData.name}, ${stateData.name}.`,
            url: `https://parklookup.com/parks/city/${state}/${city}`,
            numberOfItems: pagination.total,
            itemListElement: parks.slice(0, 10).map((park, index) => ({
              '@type': 'ListItem',
              position: index + 1,
              item: {
                '@type': 'Park',
                name: park.name,
                url: `https://parklookup.com/parks/city/${state}/${city}/${park.slug}`,
              },
            })),
          }),
        }}
      />
    </div>
  );
}