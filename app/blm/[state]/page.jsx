import { createClient } from '@supabase/supabase-js';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import BLMCard from '@/components/blm/BLMCard';
import BLMMap from '@/components/blm/BLMMap';

/**
 * US States with BLM land
 */
/**
 * Force dynamic rendering to avoid build-time Supabase client issues
 */
export const dynamic = 'force-dynamic';

const STATE_INFO = {
  ak: { code: 'AK', name: 'Alaska', fullName: 'Alaska' },
  az: { code: 'AZ', name: 'Arizona', fullName: 'Arizona' },
  ca: { code: 'CA', name: 'California', fullName: 'California' },
  co: { code: 'CO', name: 'Colorado', fullName: 'Colorado' },
  id: { code: 'ID', name: 'Idaho', fullName: 'Idaho' },
  mt: { code: 'MT', name: 'Montana', fullName: 'Montana' },
  nv: { code: 'NV', name: 'Nevada', fullName: 'Nevada' },
  nm: { code: 'NM', name: 'New Mexico', fullName: 'New Mexico' },
  or: { code: 'OR', name: 'Oregon', fullName: 'Oregon' },
  ut: { code: 'UT', name: 'Utah', fullName: 'Utah' },
  wa: { code: 'WA', name: 'Washington', fullName: 'Washington' },
  wy: { code: 'WY', name: 'Wyoming', fullName: 'Wyoming' },
};

/**
 * Generate metadata for SEO
 */
export async function generateMetadata({ params }) {
  const { state } = await params;
  const stateInfo = STATE_INFO[state.toLowerCase()];

  if (!stateInfo) {
    return {
      title: 'State Not Found | ParkLookup',
    };
  }

  return {
    title: `BLM Land in ${stateInfo.fullName} - Free Camping & Recreation | ParkLookup`,
    description: `Explore BLM (Bureau of Land Management) public lands in ${stateInfo.fullName}. Find free dispersed camping, hiking, OHV trails, and outdoor recreation areas.`,
    keywords: [
      `BLM land ${stateInfo.fullName}`,
      `free camping ${stateInfo.fullName}`,
      `dispersed camping ${stateInfo.fullName}`,
      `public lands ${stateInfo.fullName}`,
      `boondocking ${stateInfo.fullName}`,
      `OHV ${stateInfo.fullName}`,
    ],
    openGraph: {
      title: `BLM Land in ${stateInfo.fullName}`,
      description: `Explore BLM public lands in ${stateInfo.fullName} for free camping and outdoor recreation.`,
      type: 'website',
    },
  };
}

/**
 * Fetch BLM lands for a state
 */
async function getStateBLMLands(stateCode) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );

  const { data, error, count } = await supabase
    .from('blm_lands')
    .select('id, unit_name, state, area_acres, centroid_lat, centroid_lng', { count: 'exact' })
    .eq('state', stateCode)
    .order('area_acres', { ascending: false })
    .limit(100);

  if (error) {
    console.error('Error fetching BLM lands:', error);
    return { lands: [], total: 0 };
  }

  return { lands: data || [], total: count || 0 };
}

/**
 * Fetch state statistics
 */
async function getStateStats(stateCode) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );

  // Get total area
  const { data: areaData } = await supabase
    .from('blm_lands')
    .select('area_acres')
    .eq('state', stateCode)
    .not('area_acres', 'is', null);

  const totalAcres = areaData?.reduce((sum, row) => sum + (row.area_acres || 0), 0) || 0;

  return { totalAcres };
}

/**
 * Fetch BLM lands with geometry for map
 */
async function getStateBLMLandsWithGeometry(stateCode) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );

  // Get simplified geometry for map display
  const { data } = await supabase.rpc('get_state_blm_geojson', { p_state: stateCode });

  return data || [];
}

/**
 * State BLM Land Page
 */
export default async function StateBLMPage({ params }) {
  const { state } = await params;
  const stateInfo = STATE_INFO[state.toLowerCase()];

  if (!stateInfo) {
    notFound();
  }

  const [{ lands, total }, stats] = await Promise.all([
    getStateBLMLands(stateInfo.code),
    getStateStats(stateInfo.code),
  ]);

  // Calculate center from lands
  const landsWithCoords = lands.filter((l) => l.centroid_lat && l.centroid_lng);
  const centerLat =
    landsWithCoords.length > 0
      ? landsWithCoords.reduce((sum, l) => sum + l.centroid_lat, 0) / landsWithCoords.length
      : 39.8283;
  const centerLng =
    landsWithCoords.length > 0
      ? landsWithCoords.reduce((sum, l) => sum + l.centroid_lng, 0) / landsWithCoords.length
      : -98.5795;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Hero Section */}
      <div className="bg-gradient-to-br from-amber-600 to-amber-800 text-white">
        <div className="max-w-7xl mx-auto px-4 py-12 sm:py-16">
          {/* Breadcrumb */}
          <nav className="mb-6">
            <ol className="flex items-center gap-2 text-amber-200 text-sm">
              <li>
                <Link href="/" className="hover:text-white transition-colors">
                  Home
                </Link>
              </li>
              <li>/</li>
              <li>
                <Link href="/blm" className="hover:text-white transition-colors">
                  BLM Land
                </Link>
              </li>
              <li>/</li>
              <li className="text-white">{stateInfo.fullName}</li>
            </ol>
          </nav>

          <div className="text-center">
            <h1 className="text-3xl sm:text-4xl font-bold mb-4">
              BLM Land in {stateInfo.fullName}
            </h1>
            <p className="text-lg text-amber-100 max-w-2xl mx-auto mb-8">
              Explore Bureau of Land Management public lands for dispersed camping, hiking, and
              outdoor recreation
            </p>

            {/* Stats */}
            <div className="flex justify-center gap-8">
              <div className="bg-white/10 backdrop-blur rounded-lg px-6 py-3">
                <p className="text-2xl font-bold">{total.toLocaleString()}</p>
                <p className="text-amber-200 text-sm">BLM Areas</p>
              </div>
              <div className="bg-white/10 backdrop-blur rounded-lg px-6 py-3">
                <p className="text-2xl font-bold">
                  {stats.totalAcres > 1000000
                    ? `${(stats.totalAcres / 1000000).toFixed(1)}M`
                    : `${Math.round(stats.totalAcres / 1000)}K`}
                </p>
                <p className="text-amber-200 text-sm">Acres</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Map Section */}
        {landsWithCoords.length > 0 && (
          <section className="mb-12">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
              BLM Land Map - {stateInfo.fullName}
            </h2>
            <div className="rounded-lg overflow-hidden shadow-lg h-[400px] md:h-[500px]">
              <BLMMap
                blmLands={lands.map((land) => ({
                  id: land.id,
                  unitName: land.unit_name,
                  state: land.state,
                  areaAcres: land.area_acres,
                  centroidLat: land.centroid_lat,
                  centroidLng: land.centroid_lng,
                }))}
                center={{ lat: centerLat, lng: centerLng }}
                zoom={6}
              />
            </div>
          </section>
        )}

        {/* Guidelines */}
        <section className="mb-12">
          <div className="bg-amber-50 dark:bg-amber-900/20 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-amber-800 dark:text-amber-400 mb-3">
              Camping on BLM Land in {stateInfo.fullName}
            </h3>
            <p className="text-gray-700 dark:text-gray-300 mb-4">
              Most BLM land in {stateInfo.fullName} allows dispersed camping for up to 14 days.
              Always check with the local BLM field office for specific regulations, fire
              restrictions, and seasonal closures.
            </p>
            <div className="flex flex-wrap gap-4">
              <a
                href={`https://www.blm.gov/office/${stateInfo.name.toLowerCase().replace(' ', '-')}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-amber-700 dark:text-amber-400 hover:underline"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                  />
                </svg>
                {stateInfo.fullName} BLM Office
              </a>
            </div>
          </div>
        </section>

        {/* BLM Lands List */}
        <section>
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
              BLM Areas in {stateInfo.fullName}
            </h2>
            <span className="text-gray-500 dark:text-gray-400">
              Showing {lands.length} of {total.toLocaleString()}
            </span>
          </div>

          {lands.length === 0 ? (
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
                No BLM land data available for {stateInfo.fullName} yet
              </p>
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {lands.map((land) => (
                <BLMCard
                  key={land.id}
                  blmLand={{
                    id: land.id,
                    unitName: land.unit_name,
                    state: land.state,
                    areaAcres: land.area_acres,
                    centroidLat: land.centroid_lat,
                    centroidLng: land.centroid_lng,
                  }}
                />
              ))}
            </div>
          )}
        </section>

        {/* SEO Content */}
        <section className="mt-16">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
            About BLM Land in {stateInfo.fullName}
          </h2>
          <div className="prose dark:prose-invert max-w-none">
            <p className="text-gray-600 dark:text-gray-400">
              {stateInfo.fullName} is home to extensive Bureau of Land Management public lands
              offering diverse recreational opportunities. From high desert landscapes to mountain
              terrain, BLM land in {stateInfo.fullName} provides access to some of the most scenic
              and remote areas in the American West.
            </p>
            <p className="text-gray-600 dark:text-gray-400">
              Popular activities on {stateInfo.fullName} BLM land include dispersed camping,
              off-highway vehicle (OHV) riding, hiking, hunting, fishing, rock climbing, and
              wildlife viewing. Many areas are accessible year-round, though some high-elevation
              locations may be seasonal.
            </p>
          </div>
        </section>

        {/* Other States */}
        <section className="mt-16">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">
            Explore Other States
          </h2>
          <div className="flex flex-wrap gap-3">
            {Object.entries(STATE_INFO)
              .filter(([key]) => key !== state.toLowerCase())
              .map(([key, info]) => (
                <Link
                  key={key}
                  href={`/blm/${key}`}
                  className="px-4 py-2 bg-white dark:bg-gray-800 rounded-lg shadow-sm hover:shadow-md transition-shadow text-gray-700 dark:text-gray-300"
                >
                  {info.fullName}
                </Link>
              ))}
          </div>
        </section>
      </div>
    </div>
  );
}