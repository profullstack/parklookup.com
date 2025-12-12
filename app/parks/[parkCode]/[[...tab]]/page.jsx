import { notFound } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { createAnonClient } from '@/lib/supabase/server';
import ParkDetailClient from './ParkDetailClient';

/**
 * Valid tab names for park detail pages
 */
const VALID_TABS = ['overview', 'map', 'weather', 'activities', 'reviews', 'info', 'photos'];
const DEFAULT_TAB = 'overview';

/**
 * Converts Wikimedia Commons URLs to use HTTPS
 * @param {string} url - Image URL
 * @returns {string} Normalized URL with HTTPS
 */
const normalizeImageUrl = (url) => {
  if (!url) {
    return url;
  }
  return url.replace(/^http:\/\//i, 'https://');
};

/**
 * Normalizes image data to ensure consistent structure across NPS and Wikidata parks
 * @param {Object} park - Park data from database
 * @returns {Array} Normalized images array with {url, altText} objects
 */
const normalizeImages = (park) => {
  const images = [];

  if (park.images && Array.isArray(park.images)) {
    for (const img of park.images) {
      if (img && img.url) {
        images.push({
          url: normalizeImageUrl(img.url),
          altText: img.altText || img.title || park.full_name,
        });
      }
    }
  }

  if (images.length === 0 && park.wikidata_image) {
    images.push({
      url: normalizeImageUrl(park.wikidata_image),
      altText: park.full_name,
    });
  }

  return images;
};

/**
 * Generate metadata for SEO
 */
export async function generateMetadata({ params }) {
  const { parkCode, tab } = await params;
  const activeTab = tab?.[0] || DEFAULT_TAB;

  const supabase = createAnonClient();
  const { data: park } = await supabase
    .from('all_parks')
    .select('full_name, description, states, designation')
    .eq('park_code', parkCode)
    .single();

  if (!park) {
    return {
      title: 'Park Not Found | ParkLookup',
    };
  }

  const tabTitles = {
    overview: '',
    map: ' - Map & Location',
    weather: ' - Weather Events',
    activities: ' - Activities & Nearby Places',
    reviews: ' - Reviews & Ratings',
    info: ' - Park Information',
    photos: ' - User Photos & Videos',
  };

  const tabDescriptions = {
    overview: park.description || `Explore ${park.full_name} - ${park.designation || 'Park'} in ${park.states}`,
    map: `View the map and location of ${park.full_name} in ${park.states}`,
    weather: `Check current weather alerts and conditions for ${park.full_name}`,
    activities: `Discover activities and nearby places at ${park.full_name}`,
    reviews: `Read reviews and ratings for ${park.full_name}`,
    info: `Get entrance fees, operating hours, and contact information for ${park.full_name}`,
    photos: `View user-contributed photos and videos of ${park.full_name}`,
  };

  return {
    title: `${park.full_name}${tabTitles[activeTab] || ''} | ParkLookup`,
    description: tabDescriptions[activeTab] || park.description,
    openGraph: {
      title: `${park.full_name}${tabTitles[activeTab] || ''}`,
      description: tabDescriptions[activeTab] || park.description,
      type: 'website',
    },
  };
}

/**
 * Fetch park data on the server
 */
async function getParkData(parkCode) {
  const supabase = createAnonClient();

  const { data: park, error } = await supabase
    .from('all_parks')
    .select(`
      id,
      park_code,
      full_name,
      description,
      states,
      latitude,
      longitude,
      designation,
      url,
      weather_info,
      images,
      activities,
      operating_hours,
      entrance_fees,
      wikidata_id,
      wikidata_image,
      area,
      area_unit,
      elevation,
      elevation_unit,
      inception,
      managing_org,
      commons_category,
      link_confidence,
      source
    `)
    .eq('park_code', parkCode)
    .single();

  if (error || !park) {
    return null;
  }

  // Normalize images
  return {
    ...park,
    images: normalizeImages(park),
  };
}

/**
 * Fetch products for the overview tab
 */
async function getProducts() {
  try {
    const supabase = createAnonClient();
    const { data: products } = await supabase
      .from('products')
      .select('*')
      .limit(5);
    return products || [];
  } catch {
    return [];
  }
}

/**
 * Park detail page - Server Component with SSR support for tabs
 */
export default async function ParkDetailPage({ params }) {
  const { parkCode, tab } = await params;
  const activeTab = tab?.[0] || DEFAULT_TAB;

  // Validate tab
  if (tab && tab.length > 0 && !VALID_TABS.includes(activeTab)) {
    notFound();
  }

  // Fetch park data on server
  const park = await getParkData(parkCode);

  if (!park) {
    notFound();
  }

  // Fetch products for overview tab
  const products = activeTab === 'overview' ? await getProducts() : [];

  const hasCoordinates = park.latitude && park.longitude;
  const images = park.images || [];
  const activities = park.activities || [];
  const entranceFees = park.entrance_fees || [];
  const operatingHours = park.operating_hours || [];

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Hero Image */}
      <div className="relative h-64 md:h-96 bg-gray-800">
        {images.length > 0 ? (
          <Image
            src={images[0].url}
            alt={images[0].altText || park.full_name}
            fill
            className="object-cover"
            priority
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center bg-green-800">
            <svg
              className="w-24 h-24 text-green-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1}
                d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z"
              />
            </svg>
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />

        {/* Back button */}
        <Link
          href="/search"
          className="absolute top-4 left-4 p-2 bg-white/90 dark:bg-gray-800/90 rounded-full shadow-md hover:bg-white dark:hover:bg-gray-800 transition-colors"
        >
          <svg
            className="w-6 h-6 text-gray-700 dark:text-gray-300"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M10 19l-7-7m0 0l7-7m-7 7h18"
            />
          </svg>
        </Link>

        {/* Park name overlay */}
        <div className="absolute bottom-0 left-0 right-0 p-4 md:p-6">
          <div className="max-w-4xl mx-auto">
            <h1 className="text-2xl md:text-4xl font-bold text-white mb-2">{park.full_name}</h1>
            <p className="text-white/90 text-sm md:text-base">
              {park.states} • {park.designation || 'National Park'}
            </p>
          </div>
        </div>
      </div>

      {/* Content - Client component handles interactive parts */}
      <ParkDetailClient
        park={park}
        activeTab={activeTab}
        products={products}
        hasCoordinates={hasCoordinates}
        images={images}
        activities={activities}
        entranceFees={entranceFees}
        operatingHours={operatingHours}
      />
    </div>
  );
}