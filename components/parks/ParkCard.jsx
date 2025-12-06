/**
 * ParkCard Component
 * Displays a park in a card format
 */

'use client';

import Link from 'next/link';
import Card, { CardImage, CardContent, CardTitle, CardDescription, CardFooter } from '../ui/Card';
import FavoriteButton from './FavoriteButton';

export function ParkCard({ park, showFavorite = true }) {
  const imageUrl = park.images?.[0]?.url || park.wikidata_image || null;
  const states = park.states?.split(',').join(', ') || '';

  return (
    <Card hoverable className="h-full flex flex-col">
      <Link href={`/parks/${park.park_code}`}>
        <CardImage src={imageUrl} alt={park.full_name} />
      </Link>

      <CardContent className="flex-1">
        <Link href={`/parks/${park.park_code}`}>
          <CardTitle className="hover:text-green-600 transition-colors">
            {park.full_name}
          </CardTitle>
        </Link>

        {states && <p className="text-xs text-gray-500 mt-1">{states}</p>}

        {park.designation && (
          <span className="inline-block mt-2 px-2 py-1 text-xs bg-green-100 text-green-800 rounded-full">
            {park.designation}
          </span>
        )}

        <CardDescription>{park.description}</CardDescription>
      </CardContent>

      <CardFooter className="flex items-center justify-between">
        <Link
          href={`/parks/${park.park_code}`}
          className="text-sm text-green-600 hover:text-green-700 font-medium"
        >
          View Details →
        </Link>

        {showFavorite && <FavoriteButton parkId={park.id} parkCode={park.park_code} />}
      </CardFooter>
    </Card>
  );
}

export default ParkCard;