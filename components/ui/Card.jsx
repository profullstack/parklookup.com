/**
 * Card Component
 * Reusable card container
 */

'use client';

export default function Card({ children, className = '', onClick, hoverable = false }) {
  return (
    <div
      className={`
        bg-white rounded-xl shadow-md overflow-hidden
        ${hoverable ? 'hover:shadow-lg transition-shadow duration-200 cursor-pointer' : ''}
        ${className}
      `}
      onClick={onClick}
    >
      {children}
    </div>
  );
}

export function CardImage({ src, alt, className = '' }) {
  return (
    <div className={`relative h-48 w-full ${className}`}>
      {src ? (
        <img src={src} alt={alt} className="w-full h-full object-cover" />
      ) : (
        <div className="w-full h-full bg-gray-200 flex items-center justify-center">
          <svg
            className="w-12 h-12 text-gray-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
            />
          </svg>
        </div>
      )}
    </div>
  );
}

export function CardContent({ children, className = '' }) {
  return <div className={`p-4 ${className}`}>{children}</div>;
}

export function CardTitle({ children, className = '' }) {
  return <h3 className={`text-lg font-semibold text-gray-900 ${className}`}>{children}</h3>;
}

export function CardDescription({ children, className = '' }) {
  return <p className={`text-sm text-gray-600 mt-1 line-clamp-2 ${className}`}>{children}</p>;
}

export function CardFooter({ children, className = '' }) {
  return (
    <div className={`px-4 py-3 bg-gray-50 border-t border-gray-100 ${className}`}>{children}</div>
  );
}