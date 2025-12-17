/**
 * County Park Detail Page
 *
 * URL: /parks/county/{state}/{county}/{parkSlug}
 *
 * Server-rendered page for individual county park details with SEO optimization.
 */

// Force dynamic rendering to prevent static generation during build
export const dynamic = 'force-dynamic';

import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import LocalParkDetailClient from '@/components/parks/LocalParkDetailClient';

/**
 * Valid tab names for county park detail pages
 */
const VALID_TABS = ['overview', 'map', 'photos', 'reviews'];
const DEFAULT_TAB = 'overview';

/**
 * Generate metadata for SEO
 */
export async function generateMetadata({ params }) {
  const { state, county, parkSlug, tab } = await params;
  const activeTab = tab?.[0] || DEFAULT_TAB;

  const supabase = createClient();

  // Fetch park data
  const { data: park } = await supabase
    .from('local_parks')
    .select(
      `
      name,
      description,
      park_type,
      managing_agency,
      states!inner(code, name, slug),
      counties!inner(name, slug)
    `
    )
    .eq('slug', parkSlug)
    .eq('states.slug', state)
    .eq('counties.slug', county)
    .single();

  if (!park) {
    return {
      title: 'Park Not Found | ParkLookup',
    };
  }

  const title = `${park.name} | ${park.counties.name} County, ${park.states.name} | ParkLookup`;
  const description =
    park.description ||
    `Explore ${park.name}, a ${park.park_type} park in ${park.counties.name} County, ${park.states.name}. Find photos, maps, weather, and visitor information.`;

  // Canonical URL should point to the base park page (without tab) for overview,
  // or include the tab for other tabs to avoid duplicate content
  const canonicalPath = activeTab === DEFAULT_TAB
    ? `/parks/county/${state}/${county}/${parkSlug}`
    : `/parks/county/${state}/${county}/${parkSlug}/${activeTab}`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: 'website',
      url: canonicalPath,
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
    },
    alternates: {
      canonical: canonicalPath,
    },
  };
}

/**
 * Generate static params for popular parks (optional optimization)
 */
export async function generateStaticParams() {
  // Return empty array to use on-demand generation
  // Could be populated with popular parks for pre-rendering
  return [];
}

/**
 * Fetch park data from database
 */
async function getParkData(state, county, parkSlug) {
  const supabase = createClient();

  // Fetch park with all related data
  const { data: park, error } = await supabase
    .from('local_parks')
    .select(
      `
      id,
      name,
      slug,
      park_type,
      managing_agency,
      description,
      latitude,
      longitude,
      access,
      website,
      phone,
      address,
      amenities,
      activities,
      wikidata_id,
      created_at,
      updated_at,
      states!inner(id, code, name, slug),
      counties!inner(id, name, slug),
      cities(id, name, slug)
    `
    )
    .eq('slug', parkSlug)
    .eq('states.slug', state)
    .eq('counties.slug', county)
    .single();

  if (error || !park) {
    return null;
  }

  // Fetch photos
  const { data: photos } = await supabase
    .from('park_photos')
    .select('id, source, image_url, thumb_url, title, license, attribution, width, height, is_primary')
    .eq('park_id', park.id)
    .order('is_primary', { ascending: false })
    .order('created_at', { ascending: true });

  return {
    ...park,
    state: park.states,
    county: park.counties,
    city: park.cities,
    photos: photos || [],
    primary_photo: photos?.find((p) => p.is_primary) || photos?.[0] || null,
  };
}

/**
 * County Park Detail Page Component
 */
export default async function CountyParkPage({ params }) {
  const { state, county, parkSlug, tab: tabSegment } = await params;

  // Determine active tab from URL path segment
  // [[...tab]] is an optional catch-all, so tabSegment is an array or undefined
  const tab = tabSegment?.[0] || 'overview';

  // Fetch park data
  const park = await getParkData(state, county, parkSlug);

  if (!park) {
    notFound();
  }

  // Generate JSON-LD structured data for SEO
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Park',
    name: park.name,
    description: park.description,
    url: `https://parklookup.com/parks/county/${state}/${county}/${parkSlug}`,
    address: park.address
      ? {
          '@type': 'PostalAddress',
          addressLocality: park.county?.name,
          addressRegion: park.state?.code,
          addressCountry: 'US',
        }
      : undefined,
    geo: park.latitude && park.longitude
      ? {
          '@type': 'GeoCoordinates',
          latitude: park.latitude,
          longitude: park.longitude,
        }
      : undefined,
    telephone: park.phone,
    image: park.primary_photo?.image_url,
    isAccessibleForFree: park.access === 'Open',
    publicAccess: park.access === 'Open',
  };

  return (
    <>
      {/* JSON-LD Structured Data */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      {/* Breadcrumb JSON-LD */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'BreadcrumbList',
            itemListElement: [
              {
                '@type': 'ListItem',
                position: 1,
                name: 'Parks',
                item: 'https://parklookup.com/parks',
              },
              {
                '@type': 'ListItem',
                position: 2,
                name: park.state?.name,
                item: `https://parklookup.com/states/${park.state?.slug}`,
              },
              {
                '@type': 'ListItem',
                position: 3,
                name: `${park.county?.name} County`,
                item: `https://parklookup.com/parks/county/${state}/${county}`,
              },
              {
                '@type': 'ListItem',
                position: 4,
                name: park.name,
                item: `https://parklookup.com/parks/county/${state}/${county}/${parkSlug}`,
              },
            ],
          }),
        }}
      />

      <LocalParkDetailClient park={park} activeTab={tab} />
    </>
  );
}