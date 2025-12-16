import { createServiceClient } from '@/lib/supabase/server';
import Link from 'next/link';

/**
 * Force dynamic rendering to avoid build-time Supabase client issues
 */
export const dynamic = 'force-dynamic';

/**
 * US States with BLM land (western states primarily)
 */
const BLM_STATES = [
  { code: 'AK', name: 'Alaska' },
  { code: 'AZ', name: 'Arizona' },
  { code: 'CA', name: 'California' },
  { code: 'CO', name: 'Colorado' },
  { code: 'ID', name: 'Idaho' },
  { code: 'MT', name: 'Montana' },
  { code: 'NV', name: 'Nevada' },
  { code: 'NM', name: 'New Mexico' },
  { code: 'OR', name: 'Oregon' },
  { code: 'UT', name: 'Utah' },
  { code: 'WA', name: 'Washington' },
  { code: 'WY', name: 'Wyoming' },
];

/**
 * Generate metadata for SEO
 */
export const metadata = {
  title: 'BLM Land - Bureau of Land Management Public Lands | ParkLookup',
  description:
    'Explore millions of acres of BLM (Bureau of Land Management) public lands for dispersed camping, hiking, off-road recreation, and outdoor adventures. Find free camping and recreation areas near you.',
  keywords: [
    'BLM land',
    'Bureau of Land Management',
    'public lands',
    'dispersed camping',
    'free camping',
    'off-grid camping',
    'OHV recreation',
    'hunting land',
    'fishing access',
    'boondocking',
  ],
  openGraph: {
    title: 'BLM Land - Bureau of Land Management Public Lands',
    description:
      'Explore millions of acres of BLM public lands for dispersed camping, hiking, and outdoor recreation.',
    type: 'website',
  },
};

/**
 * Fetch BLM land statistics
 */
async function getBLMStats() {
  const supabase = createServiceClient();

  // Get total count
  const { count: totalCount } = await supabase
    .from('blm_lands')
    .select('*', { count: 'exact', head: true });

  // Get count by state
  const { data: stateCounts } = await supabase
    .from('blm_lands')
    .select('state')
    .not('state', 'is', null);

  // Calculate state statistics
  const stateStats = {};
  stateCounts?.forEach((row) => {
    const state = row.state;
    stateStats[state] = (stateStats[state] || 0) + 1;
  });

  // Get total area
  const { data: areaData } = await supabase
    .from('blm_lands')
    .select('area_acres')
    .not('area_acres', 'is', null);

  const totalAcres = areaData?.reduce((sum, row) => sum + (row.area_acres || 0), 0) || 0;

  return {
    totalCount: totalCount || 0,
    totalAcres,
    stateStats,
  };
}

/**
 * Fetch featured BLM lands
 */
async function getFeaturedBLMLands() {
  const supabase = createServiceClient();

  const { data } = await supabase
    .from('blm_lands')
    .select('id, unit_name, state, area_acres, centroid_lat, centroid_lng')
    .not('unit_name', 'is', null)
    .not('area_acres', 'is', null)
    .order('area_acres', { ascending: false })
    .limit(12);

  return data || [];
}

/**
 * BLM Landing Page
 */
export default async function BLMPage() {
  const [stats, featuredLands] = await Promise.all([getBLMStats(), getFeaturedBLMLands()]);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Hero Section */}
      <div className="bg-gradient-to-br from-amber-600 to-amber-800 text-white">
        <div className="max-w-7xl mx-auto px-4 py-16 sm:py-24">
          <div className="text-center">
            <h1 className="text-4xl sm:text-5xl font-bold mb-4">
              Bureau of Land Management Lands
            </h1>
            <p className="text-xl sm:text-2xl text-amber-100 max-w-3xl mx-auto mb-8">
              Explore millions of acres of public land for dispersed camping, hiking, off-road
              recreation, and outdoor adventures
            </p>

            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-6 max-w-2xl mx-auto mt-12">
              <div className="bg-white/10 backdrop-blur rounded-lg p-4">
                <p className="text-3xl font-bold">{stats.totalCount.toLocaleString()}</p>
                <p className="text-amber-200 text-sm">BLM Areas</p>
              </div>
              <div className="bg-white/10 backdrop-blur rounded-lg p-4">
                <p className="text-3xl font-bold">
                  {Math.round(stats.totalAcres / 1000000).toLocaleString()}M
                </p>
                <p className="text-amber-200 text-sm">Acres</p>
              </div>
              <div className="bg-white/10 backdrop-blur rounded-lg p-4 col-span-2 md:col-span-1">
                <p className="text-3xl font-bold">{Object.keys(stats.stateStats).length}</p>
                <p className="text-amber-200 text-sm">States</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 py-12">
        {/* What is BLM Land Section */}
        <section className="mb-16">
          <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-6">
            What is BLM Land?
          </h2>
          <div className="grid md:grid-cols-2 gap-8">
            <div className="prose dark:prose-invert max-w-none">
              <p className="text-gray-600 dark:text-gray-400 text-lg leading-relaxed">
                The Bureau of Land Management (BLM) manages approximately 245 million acres of
                public lands, primarily located in 12 western states. These lands are open for
                multiple uses including recreation, grazing, mining, and conservation.
              </p>
              <p className="text-gray-600 dark:text-gray-400 text-lg leading-relaxed">
                Unlike national parks, most BLM land allows <strong>dispersed camping</strong> —
                camping outside of designated campgrounds, often for free. This makes BLM land
                popular for:
              </p>
              <ul className="text-gray-600 dark:text-gray-400">
                <li>Free camping and boondocking</li>
                <li>Off-highway vehicle (OHV) recreation</li>
                <li>Hunting and fishing</li>
                <li>Hiking and backpacking</li>
                <li>Rock climbing and mountaineering</li>
                <li>Wildlife viewing</li>
              </ul>
            </div>
            <div className="bg-amber-50 dark:bg-amber-900/20 rounded-lg p-6">
              <h3 className="text-xl font-semibold text-amber-800 dark:text-amber-400 mb-4">
                ⚠️ Important Guidelines
              </h3>
              <ul className="space-y-3 text-gray-700 dark:text-gray-300">
                <li className="flex items-start gap-2">
                  <span className="text-amber-600">•</span>
                  <span>
                    <strong>Stay limit:</strong> Generally 14 days within a 28-day period
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-amber-600">•</span>
                  <span>
                    <strong>Fire restrictions:</strong> Check local fire conditions before camping
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-amber-600">•</span>
                  <span>
                    <strong>Leave No Trace:</strong> Pack out all trash and waste
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-amber-600">•</span>
                  <span>
                    <strong>Road conditions:</strong> Many areas require high-clearance vehicles
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-amber-600">•</span>
                  <span>
                    <strong>No facilities:</strong> Bring your own water, supplies, and waste
                    disposal
                  </span>
                </li>
              </ul>
            </div>
          </div>
        </section>

        {/* Browse by State */}
        <section className="mb-16">
          <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-6">
            Browse BLM Land by State
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {BLM_STATES.map((state) => (
              <Link
                key={state.code}
                href={`/blm/${state.code.toLowerCase()}`}
                className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm hover:shadow-md transition-shadow text-center group"
              >
                <p className="text-2xl font-bold text-amber-600 group-hover:text-amber-700 transition-colors">
                  {state.code}
                </p>
                <p className="text-sm text-gray-600 dark:text-gray-400">{state.name}</p>
                {stats.stateStats[state.code] && (
                  <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                    {stats.stateStats[state.code].toLocaleString()} areas
                  </p>
                )}
              </Link>
            ))}
          </div>
        </section>

        {/* Featured BLM Lands */}
        {featuredLands.length > 0 && (
          <section className="mb-16">
            <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-6">
              Largest BLM Areas
            </h2>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {featuredLands.map((land) => (
                <div
                  key={land.id}
                  className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm hover:shadow-md transition-shadow"
                >
                  <div className="flex items-start justify-between mb-2">
                    <h3 className="font-semibold text-gray-900 dark:text-white">
                      {land.unit_name}
                    </h3>
                    <span className="text-xs bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 px-2 py-1 rounded">
                      {land.state}
                    </span>
                  </div>
                  <p className="text-gray-600 dark:text-gray-400 text-sm">
                    {Math.round(land.area_acres).toLocaleString()} acres
                  </p>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* SEO Content */}
        <section className="mb-16">
          <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-6">
            Finding Free Camping on BLM Land
          </h2>
          <div className="prose dark:prose-invert max-w-none">
            <p className="text-gray-600 dark:text-gray-400 text-lg leading-relaxed">
              BLM land offers some of the best opportunities for free camping in the United States.
              Unlike developed campgrounds in national parks, dispersed camping on BLM land is
              typically free and doesn&apos;t require reservations.
            </p>
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white mt-6 mb-3">
              Tips for Dispersed Camping
            </h3>
            <ol className="text-gray-600 dark:text-gray-400 space-y-2">
              <li>
                <strong>Research before you go:</strong> Check the local BLM field office website
                for specific regulations and closures.
              </li>
              <li>
                <strong>Bring everything you need:</strong> There are no facilities on dispersed
                camping sites — no water, restrooms, or trash service.
              </li>
              <li>
                <strong>Check road conditions:</strong> Many BLM roads are unpaved and may require
                4WD or high-clearance vehicles.
              </li>
              <li>
                <strong>Be fire safe:</strong> Check fire restrictions and always have a way to
                fully extinguish your campfire.
              </li>
              <li>
                <strong>Respect the land:</strong> Camp on previously disturbed areas and avoid
                creating new campsites.
              </li>
            </ol>
          </div>
        </section>

        {/* Related Links */}
        <section className="bg-gray-100 dark:bg-gray-800 rounded-lg p-8">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">
            Explore More Public Lands
          </h2>
          <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-4">
            <Link
              href="/parks"
              className="bg-white dark:bg-gray-700 rounded-lg p-4 hover:shadow-md transition-shadow"
            >
              <h3 className="font-semibold text-gray-900 dark:text-white mb-1">National Parks</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Explore America&apos;s national parks
              </p>
            </Link>
            <Link
              href="/states"
              className="bg-white dark:bg-gray-700 rounded-lg p-4 hover:shadow-md transition-shadow"
            >
              <h3 className="font-semibold text-gray-900 dark:text-white mb-1">State Parks</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Find state parks near you
              </p>
            </Link>
            <Link
              href="/map"
              className="bg-white dark:bg-gray-700 rounded-lg p-4 hover:shadow-md transition-shadow"
            >
              <h3 className="font-semibold text-gray-900 dark:text-white mb-1">Interactive Map</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                View all parks on a map
              </p>
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
}