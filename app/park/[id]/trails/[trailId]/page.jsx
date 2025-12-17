import { notFound } from 'next/navigation';
import Link from 'next/link';
import { createAnonClient } from '@/lib/supabase/server';
import TrailDetailClient from './TrailDetailClient';

/**
 * Generate metadata for SEO
 */
export async function generateMetadata({ params }) {
  const { id: parkId, trailId } = await params;

  const supabase = createAnonClient();
  
  // Fetch trail data
  const { data: trail } = await supabase
    .from('trails')
    .select('name, description, difficulty, length_meters')
    .eq('id', trailId)
    .single();

  if (!trail) {
    return {
      title: 'Trail Not Found | ParkLookup',
    };
  }

  // Fetch park data
  const { data: park } = await supabase
    .from('all_parks')
    .select('full_name')
    .eq('id', parkId)
    .single();

  const parkName = park?.full_name || 'Park';
  const lengthMiles = trail.length_meters ? (trail.length_meters / 1609.34).toFixed(1) : null;

  return {
    title: `${trail.name} Trail - ${parkName} | ParkLookup`,
    description: trail.description || 
      `${trail.name} is a ${trail.difficulty || 'hiking'} trail${lengthMiles ? ` (${lengthMiles} mi)` : ''} in ${parkName}. Find trail details, maps, and more.`,
    openGraph: {
      title: `${trail.name} Trail - ${parkName}`,
      description: trail.description || `Explore ${trail.name} trail in ${parkName}`,
      type: 'website',
    },
  };
}

/**
 * Fetch trail data on the server
 */
async function getTrailData(trailId) {
  const supabase = createAnonClient();

  const { data: trail, error } = await supabase
    .from('trails')
    .select(`
      id,
      name,
      slug,
      description,
      difficulty,
      length_meters,
      elevation_gain_m,
      surface,
      trail_type,
      sac_scale,
      trail_visibility,
      source,
      source_id,
      osm_tags,
      park_id,
      park_source,
      geometry,
      created_at,
      updated_at
    `)
    .eq('id', trailId)
    .single();

  if (error || !trail) {
    return null;
  }

  return trail;
}

/**
 * Fetch park data on the server
 */
async function getParkData(parkId) {
  const supabase = createAnonClient();

  const { data: park, error } = await supabase
    .from('all_parks')
    .select(`
      id,
      park_code,
      full_name,
      states,
      latitude,
      longitude,
      designation
    `)
    .eq('id', parkId)
    .single();

  if (error || !park) {
    return null;
  }

  return park;
}

/**
 * Trail detail page - Server Component
 * URL: /park/{parkId}/trails/{trailId}
 */
export default async function TrailDetailPage({ params }) {
  const { id: parkId, trailId } = await params;

  // Fetch trail and park data
  const [trail, park] = await Promise.all([
    getTrailData(trailId),
    getParkData(parkId),
  ]);

  if (!trail) {
    notFound();
  }

  // Park is optional - trail can exist without a park association
  const hasCoordinates = park?.latitude && park?.longitude;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-4xl mx-auto px-4 py-4">
          {/* Breadcrumb */}
          <nav className="flex items-center text-sm text-gray-500 dark:text-gray-400 mb-4">
            <Link href="/search" className="hover:text-green-600">
              Parks
            </Link>
            <svg className="w-4 h-4 mx-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
            {park ? (
              <>
                <Link href={`/park/${park.id}`} className="hover:text-green-600">
                  {park.full_name}
                </Link>
                <svg className="w-4 h-4 mx-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
                <Link href={`/park/${park.id}/trails`} className="hover:text-green-600">
                  Trails
                </Link>
                <svg className="w-4 h-4 mx-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </>
            ) : (
              <>
                <Link href="/trails" className="hover:text-green-600">
                  Trails
                </Link>
                <svg className="w-4 h-4 mx-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </>
            )}
            <span className="text-gray-900 dark:text-white">{trail.name}</span>
          </nav>

          {/* Back button */}
          <Link
            href={park ? `/park/${park.id}/trails` : '/trails'}
            className="inline-flex items-center text-gray-600 dark:text-gray-400 hover:text-green-600 dark:hover:text-green-400 mb-4"
          >
            <svg className="w-5 h-5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Back to {park ? 'Park Trails' : 'Trails'}
          </Link>

          {/* Trail title */}
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white">
            {trail.name || 'Unnamed Trail'}
          </h1>
          {park && (
            <p className="text-gray-600 dark:text-gray-400 mt-1">
              {park.full_name} • {park.states}
            </p>
          )}
        </div>
      </div>

      {/* Content */}
      <TrailDetailClient
        trail={trail}
        park={park}
        hasCoordinates={hasCoordinates}
      />
    </div>
  );
}
