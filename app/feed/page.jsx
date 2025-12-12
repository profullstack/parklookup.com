import FeedClient from './FeedClient';

/**
 * Generate metadata for the feed page
 */
export const metadata = {
  title: 'Feed | ParkLookup',
  description: 'See photos and videos from park visitors you follow',
};

/**
 * Feed Page
 * Shows personalized feed of photos/videos from followed users
 */
export default function FeedPage() {
  return <FeedClient />;
}