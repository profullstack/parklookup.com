/**
 * ParkCard Component
 * Displays a park in a card format
 * Supports NPS parks, Wikidata parks, and Local parks (county/city)
 */

'use client';

import Link from 'next/link';
import Card, { CardImage, CardContent, CardTitle, CardDescription, CardFooter } from '../ui/Card';
import FavoriteButton from './FavoriteButton';

/**
 * Get the appropriate URL for a park based on its source
 * All parks now use the same URL structure: /parks/[park_code]
 * @param {Object} park - Park data
 * @returns {string} URL path for the park
 */
function getParkUrl(park) {
  return `/parks/${park.park_code}`;
}

/**
 * Get badge color based on park source/type
 * @param {string} source - Park source (nps, wikidata, local)
 * @param {string} designation - Park designation
 * @returns {string} Tailwind CSS classes for badge
 */
function getBadgeClasses(source, designation) {
  if (source === 'local') {
    if (designation?.toLowerCase().includes('county')) {
      return 'bg-blue-100 text-blue-800';
    } else if (designation?.toLowerCase().includes('city') || designation?.toLowerCase().includes('municipal')) {
      return 'bg-purple-100 text-purple-800';
    }
    return 'bg-orange-100 text-orange-800';
  }
  if (source === 'wikidata') {
    return 'bg-yellow-100 text-yellow-800';
  }
  return 'bg-green-100 text-green-800';
}

export function ParkCard({ park, showFavorite = true }) {
  const imageUrl = park.images?.[0]?.url || park.wikidata_image || null;
  const states = park.states?.split(',').join(', ') || '';
  const parkUrl = getParkUrl(park);
  const badgeClasses = getBadgeClasses(park.source, park.designation);

  return (
    <Card hoverable className="h-full flex flex-col">
      <Link href={parkUrl}>
        <CardImage src={imageUrl} alt={park.full_name} />
      </Link>

      <CardContent className="flex-1">
        <Link href={parkUrl}>
          <CardTitle className="hover:text-green-600 transition-colors">
            {park.full_name}
          </CardTitle>
        </Link>

        {states && <p className="text-xs text-gray-500 mt-1">{states}</p>}

        {park.designation && (
          <span className={`inline-block mt-2 px-2 py-1 text-xs rounded-full ${badgeClasses}`}>
            {park.designation}
          </span>
        )}

        <CardDescription>{park.description}</CardDescription>
      </CardContent>

      <CardFooter className="flex items-center justify-between">
        <Link
          href={parkUrl}
          className="text-sm text-green-600 hover:text-green-700 font-medium"
        >
          View Details →
        </Link>

        {showFavorite && park.source !== 'local' && (
          <FavoriteButton parkId={park.id} parkCode={park.park_code} />
        )}
      </CardFooter>
    </Card>
  );
}

export default ParkCard;