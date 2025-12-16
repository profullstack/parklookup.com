import { createServiceClient } from '@/lib/supabase/server';
import { notFound } from 'next/navigation';
import TrailDetailClient from './TrailDetailClient';

// Force dynamic rendering to avoid build-time errors
export const dynamic = 'force-dynamic';

/**
 * Generate metadata for the trail page
 */
export async function generateMetadata({ params }) {
  const { parkCode, trailSlug } = await params;
  const supabase = createServiceClient();
  
  // Fetch trail data
  const { data: trail } = await supabase
    .from('trails')
    .select(`
      id,
      name,
      slug,
      difficulty,
      length_meters,
      elevation_gain_m,
      surface,
      description
    `)
    .eq('slug', trailSlug)
    .single();

  if (!trail) {
    return {
      title: 'Trail Not Found | ParkLookup',
      description: 'The requested trail could not be found.',
    };
  }

  // Fetch park data
  const { data: park } = await supabase
    .from('all_parks')
    .select('name, full_name, park_code')
    .or(`park_code.eq.${parkCode},id.eq.${parkCode}`)
    .single();

  const parkName = park?.full_name || park?.name || 'Park';
  const lengthMiles = trail.length_meters 
    ? (trail.length_meters / 1609.34).toFixed(1) 
    : null;

  const title = `${trail.name || 'Trail'} - ${parkName} | ParkLookup`;
  const description = trail.description 
    || `${trail.name || 'Trail'} is a ${trail.difficulty || ''} ${lengthMiles ? `${lengthMiles} mile` : ''} trail in ${parkName}. ${trail.surface ? `Surface: ${trail.surface}.` : ''}`.trim();

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: 'website',
    },
    twitter: {
      card: 'summary',
      title,
      description,
    },
  };
}

/**
 * Trail detail page
 */
export default async function TrailPage({ params }) {
  const { parkCode, trailSlug } = await params;
  const supabase = createServiceClient();

  // Fetch trail with geometry
  const { data: trail, error: trailError } = await supabase
    .from('trails')
    .select(`
      id,
      source,
      source_id,
      park_id,
      park_source,
      name,
      slug,
      difficulty,
      length_meters,
      elevation_gain_m,
      surface,
      description,
      is_user_submitted,
      created_at,
      updated_at
    `)
    .eq('slug', trailSlug)
    .single();

  if (trailError || !trail) {
    notFound();
  }

  // Get GeoJSON geometry
  const { data: geoData } = await supabase
    .rpc('get_trail_with_geojson', { trail_id: trail.id });

  if (geoData && geoData.length > 0) {
    trail.geojson = geoData[0].geojson;
  }

  // Fetch park data
  const { data: park } = await supabase
    .from('all_parks')
    .select('id, name, full_name, park_code, source, latitude, longitude, states, description')
    .or(`park_code.eq.${parkCode},id.eq.${parkCode}`)
    .single();

  if (!park) {
    notFound();
  }

  // Calculate derived values
  const lengthMiles = trail.length_meters 
    ? (trail.length_meters / 1609.34).toFixed(1) 
    : null;
  const elevationFeet = trail.elevation_gain_m 
    ? Math.round(trail.elevation_gain_m * 3.28084) 
    : null;

  // Build TouristAttraction schema.org structured data
  const structuredData = {
    '@context': 'https://schema.org',
    '@type': 'TouristAttraction',
    name: trail.name || `Trail ${trail.source_id}`,
    description: trail.description || `A ${trail.difficulty || ''} hiking trail in ${park.full_name || park.name}`.trim(),
    touristType: 'Hiking',
    isAccessibleForFree: true,
    publicAccess: true,
  };

  // Add geo coordinates if available
  if (trail.geojson?.coordinates) {
    const coords = trail.geojson.coordinates;
    // Use the midpoint of the trail for geo
    const midIndex = Math.floor(coords.length / 2);
    const midPoint = coords[midIndex] || coords[0];
    
    if (midPoint) {
      structuredData.geo = {
        '@type': 'GeoCoordinates',
        latitude: midPoint[1],
        longitude: midPoint[0],
      };
    }
  } else if (park.latitude && park.longitude) {
    structuredData.geo = {
      '@type': 'GeoCoordinates',
      latitude: parseFloat(park.latitude),
      longitude: parseFloat(park.longitude),
    };
  }

  // Add hasMap if we have geometry
  if (trail.geojson) {
    structuredData.hasMap = {
      '@type': 'Map',
      mapType: 'https://schema.org/VenueMap',
    };
  }

  // Add containedInPlace for the park
  structuredData.containedInPlace = {
    '@type': 'Park',
    name: park.full_name || park.name,
    url: `https://parklookup.com/park/${park.id}`,
  };

  // Add additional properties
  if (lengthMiles) {
    structuredData.additionalProperty = structuredData.additionalProperty || [];
    structuredData.additionalProperty.push({
      '@type': 'PropertyValue',
      name: 'Trail Length',
      value: `${lengthMiles} miles`,
    });
  }

  if (elevationFeet) {
    structuredData.additionalProperty = structuredData.additionalProperty || [];
    structuredData.additionalProperty.push({
      '@type': 'PropertyValue',
      name: 'Elevation Gain',
      value: `${elevationFeet} feet`,
    });
  }

  if (trail.difficulty) {
    structuredData.additionalProperty = structuredData.additionalProperty || [];
    structuredData.additionalProperty.push({
      '@type': 'PropertyValue',
      name: 'Difficulty',
      value: trail.difficulty.charAt(0).toUpperCase() + trail.difficulty.slice(1),
    });
  }

  if (trail.surface) {
    structuredData.additionalProperty = structuredData.additionalProperty || [];
    structuredData.additionalProperty.push({
      '@type': 'PropertyValue',
      name: 'Surface',
      value: trail.surface,
    });
  }

  return (
    <>
      {/* Structured Data */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />
      
      {/* Trail Detail Client Component */}
      <TrailDetailClient
        trail={trail}
        park={park}
        lengthMiles={lengthMiles}
        elevationFeet={elevationFeet}
      />
    </>
  );
}