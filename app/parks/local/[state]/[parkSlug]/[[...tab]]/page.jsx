/**
 * Local Park Detail Page
 *
 * URL: /parks/local/{state}/{parkSlug}
 *
 * Server-rendered page for individual local park details with SEO optimization.
 */

// Force dynamic rendering to prevent static generation during build
export const dynamic = 'force-dynamic';

import { notFound } from 'next/navigation';
import Link from 'next/link';
import { createAnonClient } from '@/lib/supabase/server';
import LocalParkDetailClient from '@/components/parks/LocalParkDetailClient';

/**
 * Fetches a local park by state slug and park slug
 */
async function getLocalPark(stateSlug, parkSlug) {
  const supabase = createAnonClient();

  // Get state by slug
  const { data: state } = await supabase
    .from('states')
    .select('id, name, code')
    .eq('slug', stateSlug)
    .single();

  if (!state) {
    return null;
  }

  // Get park by slug
  const { data: park, error } = await supabase
    .from('local_parks')
    .select(`
      *,
      park_photos (
        id,
        image_url,
        thumb_url,
        title,
        license,
        attribution,
        is_primary
      )
    `)
    .eq('state_id', state.id)
    .eq('slug', parkSlug)
    .single();

  if (error || !park) {
    return null;
  }

  return {
    ...park,
    state_code: state.code,
    state_name: state.name,
  };
}

/**
 * Generate metadata for the park page
 */
export async function generateMetadata({ params }) {
  const { state, parkSlug } = await params;
  const park = await getLocalPark(state, parkSlug);

  if (!park) {
    return {
      title: 'Park Not Found | ParkLookup',
    };
  }

  const parkType = park.park_type === 'county' ? 'County Park' : 
                   park.park_type === 'city' ? 'City Park' : 'Local Park';

  return {
    title: `${park.name} | ${parkType} in ${park.state_name} | ParkLookup`,
    description: park.description || `Explore ${park.name}, a ${parkType.toLowerCase()} in ${park.state_name}. Find location, photos, and visitor information.`,
    openGraph: {
      title: `${park.name} | ${parkType}`,
      description: park.description || `Explore ${park.name} in ${park.state_name}`,
      images: park.park_photos?.[0]?.image_url ? [park.park_photos[0].image_url] : [],
    },
  };
}

/**
 * Local park detail page
 */
export default async function LocalParkPage({ params }) {
  const { state, parkSlug, tab: tabSegment } = await params;
  
  // Determine active tab from URL path segment
  // [[...tab]] is an optional catch-all, so tabSegment is an array or undefined
  const activeTab = tabSegment?.[0] || 'overview';
  
  const park = await getLocalPark(state, parkSlug);

  if (!park) {
    notFound();
  }

  const parkType = park.park_type === 'county' ? 'County Park' : 
                   park.park_type === 'city' ? 'City Park' : 
                   park.park_type === 'regional' ? 'Regional Park' :
                   park.park_type === 'municipal' ? 'Municipal Park' : 'Local Park';

  // Schema.org structured data
  const structuredData = {
    '@context': 'https://schema.org',
    '@type': 'Park',
    name: park.name,
    description: park.description,
    address: {
      '@type': 'PostalAddress',
      addressRegion: park.state_code,
    },
    geo: park.latitude && park.longitude ? {
      '@type': 'GeoCoordinates',
      latitude: park.latitude,
      longitude: park.longitude,
    } : undefined,
    image: park.park_photos?.map(p => p.image_url).filter(Boolean),
    url: park.website,
    isAccessibleForFree: park.access === 'Open',
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />
      
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        {/* Breadcrumb */}
        <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
          <div className="container mx-auto px-4 py-3">
            <nav className="flex items-center text-sm text-gray-500 dark:text-gray-400">
              <Link href="/" className="hover:text-green-600">Home</Link>
              <span className="mx-2">/</span>
              <Link href="/parks" className="hover:text-green-600">Parks</Link>
              <span className="mx-2">/</span>
              <Link href={`/parks/local/${state.toLowerCase()}`} className="hover:text-green-600">
                {park.state_name}
              </Link>
              <span className="mx-2">/</span>
              <span className="text-gray-900 dark:text-white">{park.name}</span>
            </nav>
          </div>
        </div>

        {/* Park Detail */}
        <LocalParkDetailClient
          park={park}
          parkType={parkType}
          stateCode={park.state_code}
          stateName={park.state_name}
          activeTab={activeTab}
        />
      </div>
    </>
  );
}