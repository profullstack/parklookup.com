/**
 * SEO Canonical URL Utilities
 *
 * Provides helper functions for generating canonical URLs
 * to prevent duplicate content issues in search engines.
 */

/**
 * Base URL for the site - used for generating absolute canonical URLs
 * Uses the existing NEXT_PUBLIC_APP_URL environment variable
 */
export const SITE_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://parklookup.com';

/**
 * Generates a canonical URL for a given path
 * @param {string} path - The path to generate a canonical URL for
 * @returns {string} The full canonical URL
 */
export const getCanonicalUrl = (path = '') => {
  // Remove leading slash if present to avoid double slashes
  const cleanPath = path.startsWith('/') ? path.slice(1) : path;

  // Remove trailing slash for consistency (except for root)
  const normalizedPath = cleanPath.endsWith('/') && cleanPath.length > 0 ? cleanPath.slice(0, -1) : cleanPath;

  // Return the full URL
  return normalizedPath ? `${SITE_URL}/${normalizedPath}` : SITE_URL;
};

/**
 * Generates metadata object with canonical URL
 * @param {Object} options - Metadata options
 * @param {string} options.path - The canonical path
 * @param {string} options.title - Page title
 * @param {string} options.description - Page description
 * @param {Object} options.openGraph - Additional OpenGraph properties
 * @returns {Object} Metadata object with canonical URL
 */
export const generateMetadataWithCanonical = ({ path, title, description, openGraph = {} }) => {
  const canonicalUrl = getCanonicalUrl(path);

  return {
    title,
    description,
    alternates: {
      canonical: canonicalUrl,
    },
    openGraph: {
      title: openGraph.title || title,
      description: openGraph.description || description,
      url: canonicalUrl,
      type: openGraph.type || 'website',
      ...openGraph,
    },
  };
};
