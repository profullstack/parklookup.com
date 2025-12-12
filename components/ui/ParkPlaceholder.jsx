'use client';

/**
 * Park type specific colors and icons
 */
const PARK_STYLES = {
  county: {
    bgColor: 'bg-blue-50 dark:bg-blue-900/20',
    iconColor: 'text-blue-300 dark:text-blue-700',
  },
  city: {
    bgColor: 'bg-purple-50 dark:bg-purple-900/20',
    iconColor: 'text-purple-300 dark:text-purple-700',
  },
  regional: {
    bgColor: 'bg-teal-50 dark:bg-teal-900/20',
    iconColor: 'text-teal-300 dark:text-teal-700',
  },
  municipal: {
    bgColor: 'bg-indigo-50 dark:bg-indigo-900/20',
    iconColor: 'text-indigo-300 dark:text-indigo-700',
  },
  national: {
    bgColor: 'bg-green-50 dark:bg-green-900/20',
    iconColor: 'text-green-300 dark:text-green-700',
  },
  state: {
    bgColor: 'bg-amber-50 dark:bg-amber-900/20',
    iconColor: 'text-amber-300 dark:text-amber-700',
  },
  default: {
    bgColor: 'bg-gray-50 dark:bg-gray-800',
    iconColor: 'text-gray-300 dark:text-gray-600',
  },
};

/**
 * Tree icon SVG
 */
const TreeIcon = ({ className }) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    fill="currentColor"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path d="M12 2L4 12h3v8h2v-6h6v6h2v-8h3L12 2z" />
    <path d="M12 6l-4 5h2v3h4v-3h2l-4-5z" opacity="0.5" />
  </svg>
);

/**
 * Mountain icon SVG
 */
const MountainIcon = ({ className }) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    fill="currentColor"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path d="M12 4L2 20h20L12 4zm0 4l5.5 10h-11L12 8z" opacity="0.3" />
    <path d="M12 4L2 20h20L12 4z" />
  </svg>
);

/**
 * Park bench icon SVG
 */
const BenchIcon = ({ className }) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    fill="currentColor"
    xmlns="http://www.w3.org/2000/svg"
  >
    <rect x="3" y="12" width="18" height="3" rx="1" />
    <rect x="5" y="15" width="2" height="5" />
    <rect x="17" y="15" width="2" height="5" />
    <rect x="4" y="9" width="16" height="2" rx="1" opacity="0.5" />
  </svg>
);

/**
 * Landscape icon SVG (generic park)
 */
const LandscapeIcon = ({ className }) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    fill="currentColor"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path d="M14 6l-3.75 5 2.85 3.8-1.6 1.2C9.81 13.75 7 10 7 10l-6 8h22L14 6z" />
    <circle cx="6" cy="6" r="2" opacity="0.5" />
  </svg>
);

/**
 * Gets the appropriate icon component for a park type
 */
const getIconForType = (parkType) => {
  switch (parkType) {
    case 'county':
    case 'regional':
      return TreeIcon;
    case 'national':
    case 'state':
      return MountainIcon;
    case 'city':
    case 'municipal':
      return BenchIcon;
    default:
      return LandscapeIcon;
  }
};

/**
 * ParkPlaceholder Component
 *
 * Displays a placeholder image for parks without photos.
 * Uses different colors and icons based on park type.
 *
 * @param {Object} props
 * @param {string} [props.parkType='default'] - Type of park (county, city, regional, etc.)
 * @param {string} [props.className] - Additional CSS classes
 * @param {string} [props.size='full'] - Size variant ('sm', 'md', 'lg', 'full')
 */
export function ParkPlaceholder({ parkType = 'default', className = '', size = 'full' }) {
  const styles = PARK_STYLES[parkType] || PARK_STYLES.default;
  const IconComponent = getIconForType(parkType);

  const sizeClasses = {
    sm: 'w-8 h-8',
    md: 'w-12 h-12',
    lg: 'w-16 h-16',
    full: 'w-1/3 h-1/3 max-w-[80px] max-h-[80px]',
  };

  const iconSize = sizeClasses[size] || sizeClasses.full;

  return (
    <div
      className={`absolute inset-0 flex items-center justify-center ${styles.bgColor} ${className}`}
    >
      <IconComponent className={`${iconSize} ${styles.iconColor}`} />
    </div>
  );
}

/**
 * ParkPlaceholderInline Component
 *
 * Inline version of the placeholder for use in non-absolute contexts.
 *
 * @param {Object} props
 * @param {string} [props.parkType='default'] - Type of park
 * @param {string} [props.className] - Additional CSS classes
 * @param {string} [props.aspectRatio='4/3'] - Aspect ratio class
 */
export function ParkPlaceholderInline({
  parkType = 'default',
  className = '',
  aspectRatio = 'aspect-[4/3]',
}) {
  const styles = PARK_STYLES[parkType] || PARK_STYLES.default;
  const IconComponent = getIconForType(parkType);

  return (
    <div
      className={`relative ${aspectRatio} flex items-center justify-center ${styles.bgColor} rounded-lg ${className}`}
    >
      <IconComponent className={`w-1/4 h-1/4 ${styles.iconColor}`} />
    </div>
  );
}

export default ParkPlaceholder;