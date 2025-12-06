import Link from 'next/link';
import { notFound } from 'next/navigation';
import ParkCard from '@/components/parks/ParkCard';

/**
 * Converts an activity name to a URL-friendly slug
 * @param {string} name - Activity name
 * @returns {string} URL-friendly slug
 */
function activityToSlug(name) {
  return name.toLowerCase().replace(/\s+/g, '-');
}

/**
 * Converts a slug back to a display name
 * @param {string} slug - URL slug
 * @returns {string} Display name with proper capitalization
 */
function slugToDisplayName(slug) {
  return slug
    .replace(/-/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

/**
 * Fetches parks by activity from the API
 * @param {string} activity - Activity slug
 * @returns {Promise<Object>} Parks data
 */
async function getParksByActivity(activity) {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';

  try {
    const response = await fetch(`${baseUrl}/api/activities/${encodeURIComponent(activity)}`, {
      cache: 'no-store',
    });

    if (!response.ok) {
      return null;
    }

    return response.json();
  } catch (error) {
    console.error('Error fetching parks by activity:', error);
    return null;
  }
}

/**
 * Generate metadata for the activity page
 */
export async function generateMetadata({ params }) {
  const { activity } = await params;
  const displayName = slugToDisplayName(activity);

  return {
    title: `${displayName} Parks | ParkLookup`,
    description: `Discover national parks and campgrounds where you can enjoy ${displayName.toLowerCase()}. Find the perfect destination for your next outdoor adventure.`,
    openGraph: {
      title: `${displayName} Parks | ParkLookup`,
      description: `Discover national parks and campgrounds where you can enjoy ${displayName.toLowerCase()}.`,
    },
  };
}

/**
 * Activity page component - displays all parks with a specific activity
 */
export default async function ActivityPage({ params }) {
  const { activity } = await params;
  const displayName = slugToDisplayName(activity);

  const data = await getParksByActivity(activity);

  if (!data) {
    notFound();
  }

  const { parks, count } = data;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header Section */}
      <div className="bg-green-700 dark:bg-green-800 text-white py-12">
        <div className="container mx-auto px-4">
          <nav className="mb-4">
            <Link
              href="/"
              className="text-green-200 hover:text-white transition-colors"
            >
              ← Back to Home
            </Link>
          </nav>
          <h1 className="text-4xl font-bold mb-2">{displayName}</h1>
          <p className="text-green-100 text-lg">
            {count} {count === 1 ? 'park' : 'parks'} with this activity
          </p>
        </div>
      </div>

      {/* Parks Grid */}
      <div className="container mx-auto px-4 py-8">
        {parks.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-6xl mb-4">🏕️</div>
            <h2 className="text-2xl font-semibold text-gray-700 dark:text-gray-300 mb-2">
              No Parks Found
            </h2>
            <p className="text-gray-500 dark:text-gray-400 mb-6">
              We couldn&apos;t find any parks with {displayName.toLowerCase()} activities.
            </p>
            <Link
              href="/search"
              className="inline-block bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-lg transition-colors"
            >
              Search All Parks
            </Link>
          </div>
        ) : (
          <>
            <div className="mb-6">
              <p className="text-gray-600 dark:text-gray-400">
                Explore these {count} national parks and sites where you can enjoy{' '}
                <span className="font-semibold text-green-600 dark:text-green-400">
                  {displayName.toLowerCase()}
                </span>
                .
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {parks.map((park) => (
                <ParkCard key={park.id || park.park_code} park={park} />
              ))}
            </div>
          </>
        )}
      </div>

      {/* Related Activities Section */}
      <div className="bg-gray-100 dark:bg-gray-800 py-12">
        <div className="container mx-auto px-4">
          <h2 className="text-2xl font-bold text-gray-800 dark:text-white mb-6">
            Explore More Activities
          </h2>
          <div className="flex flex-wrap gap-3">
            {[
              'Hiking',
              'Camping',
              'Fishing',
              'Wildlife Watching',
              'Photography',
              'Stargazing',
              'Kayaking',
              'Rock Climbing',
              'Birdwatching',
              'Swimming',
            ].map((activityName) => {
              const slug = activityToSlug(activityName);
              const isCurrentActivity = slug === activity;

              return (
                <Link
                  key={activityName}
                  href={`/activities/${slug}`}
                  className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                    isCurrentActivity
                      ? 'bg-green-600 text-white cursor-default'
                      : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-green-100 dark:hover:bg-green-900/30 hover:text-green-700 dark:hover:text-green-400'
                  }`}
                >
                  {activityName}
                </Link>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}