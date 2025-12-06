# ParkLookup.com

A Progressive Web App (PWA) for discovering and exploring U.S. National Parks. Built with Next.js, Tailwind CSS, and Supabase, deployed on Railway.

## Features

- 🔍 **Search & Filter**: Find parks by name, state, or other criteria
- 📍 **Interactive Maps**: View park locations with integrated mapping
- ❤️ **Favorites**: Save your favorite parks (requires account)
- 📱 **Mobile First**: Responsive design optimized for all devices
- 🔄 **Offline Support**: Full PWA with background sync
- 🌐 **Cross-Browser**: Works on all major browsers

## Tech Stack

- **Frontend**: Next.js 14+ with App Router
- **Styling**: Tailwind CSS
- **Database**: Supabase (PostgreSQL)
- **Authentication**: Supabase Auth
- **Deployment**: Railway
- **Data Sources**: 
  - [NPS API](https://www.nps.gov/subjects/developer/api-documentation.htm)
  - [Wikidata SPARQL](https://query.wikidata.org/)

## Documentation

- [Architecture Overview](./docs/ARCHITECTURE.md)
- [Database Schema](./docs/DATABASE.md)
- [API & Data Import](./docs/API.md)
- [PWA Implementation](./docs/PWA.md)
- [Deployment Guide](./docs/DEPLOYMENT.md)

## Quick Start

### Prerequisites

- Node.js 18+
- npm or yarn
- Supabase account
- Railway account

### Installation

```bash
# Clone the repository
git clone https://github.com/yourusername/parklookup.com.git
cd parklookup.com

# Install dependencies
npm install

# Copy environment variables
cp .env.example .env.local

# Start development server
npm run dev
```

### Environment Variables

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# NPS API
NPS_API_KEY=your_nps_api_key

# App
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

## Project Structure

```
parklookup.com/
├── app/                    # Next.js App Router
│   ├── (auth)/            # Authentication routes
│   ├── (main)/            # Main app routes
│   ├── api/               # API routes
│   └── layout.tsx         # Root layout
├── components/            # React components
│   ├── ui/               # UI primitives
│   ├── parks/            # Park-related components
│   └── maps/             # Map components
├── lib/                   # Utility functions
│   ├── supabase/         # Supabase client
│   └── hooks/            # Custom hooks
├── public/               # Static assets
├── supabase/             # Supabase config
│   ├── functions/        # Edge Functions
│   └── migrations/       # Database migrations
├── docs/                 # Documentation
└── styles/               # Global styles
```

## Scripts

```bash
npm run dev          # Start development server
npm run build        # Build for production
npm run start        # Start production server
npm run lint         # Run ESLint
npm run test         # Run tests
npm run import:nps   # Import NPS data (via Edge Function)
npm run import:wiki  # Import Wikidata (via Edge Function)
```

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

MIT License - see [LICENSE](LICENSE) for details.