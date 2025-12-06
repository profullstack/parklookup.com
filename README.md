# ParkLookup.com

A Progressive Web App (PWA) for discovering and exploring U.S. National and State Parks. Built with Next.js, Tailwind CSS, and Supabase, deployed on Railway with Railpack.

## Features

- 🔍 **Search & Filter**: Find parks by name, state, or other criteria
- 📍 **Interactive Maps**: View park locations with integrated mapping
- ❤️ **Favorites**: Save your favorite parks (requires account)
- 📱 **Mobile First**: Responsive design optimized for all devices
- 🔄 **Offline Support**: Full PWA with background sync
- 🌐 **Cross-Browser**: Works on all major browsers

## Tech Stack

- **Runtime**: Node.js 20+
- **Package Manager**: pnpm
- **Frontend**: Next.js 14+ with App Router
- **Styling**: Tailwind CSS
- **Database**: Supabase (PostgreSQL)
- **Authentication**: Supabase Auth
- **Testing**: Vitest
- **Deployment**: Railway with Railpack
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

- Node.js 20+
- pnpm (`npm install -g pnpm`)
- Supabase account
- Railway account

### Installation

```bash
# Clone the repository
git clone https://github.com/yourusername/parklookup.com.git
cd parklookup.com

# Install dependencies
pnpm install

# Copy environment variables
cp .env.example .env.local

# Start development server
pnpm dev
```

### Environment Variables

```env
# Server Configuration
PORT=8080

# Supabase
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# NPS API
NPS_API_KEY=your_nps_api_key

# App
NEXT_PUBLIC_APP_URL=http://localhost:8080
```

## Project Structure

```
parklookup.com/
├── app/                    # Next.js App Router
│   ├── (auth)/            # Authentication routes
│   ├── (main)/            # Main app routes
│   ├── api/               # API routes
│   └── layout.jsx         # Root layout
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
├── test/                 # Test files
│   └── setup.js          # Vitest setup
├── docs/                 # Documentation
├── styles/               # Global styles
├── vitest.config.js      # Vitest configuration
├── railpack.json         # Railpack configuration
└── pnpm-lock.yaml        # pnpm lockfile
```

## Scripts

```bash
pnpm dev              # Start development server
pnpm build            # Build for production
pnpm start            # Start production server
pnpm lint             # Run ESLint
pnpm lint:fix         # Run ESLint with auto-fix
pnpm test             # Run tests with Vitest
pnpm test:watch       # Run tests in watch mode
pnpm test:coverage    # Run tests with coverage report
pnpm format           # Format code with Prettier
```

## Testing

This project uses [Vitest](https://vitest.dev/) for testing with the following features:

- Fast execution with native ESM support
- Jest-compatible API
- Built-in coverage reporting
- React Testing Library integration

```bash
# Run all tests
pnpm test

# Run tests in watch mode
pnpm test:watch

# Generate coverage report
pnpm test:coverage
```

## Deployment

This project uses [Railpack](https://railpack.io/) for optimized Railway deployments:

- Automatic Node.js and pnpm detection
- Layer caching for faster builds
- Optimized production images

See the [Deployment Guide](./docs/DEPLOYMENT.md) for detailed instructions.

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Write tests for your changes
4. Commit your changes (`git commit -m 'Add amazing feature'`)
5. Push to the branch (`git push origin feature/amazing-feature`)
6. Open a Pull Request

### Development Guidelines

- Use pnpm for package management
- Write tests before implementing features (TDD)
- Follow ESLint and Prettier configurations
- Use ES modules (ESM) syntax
- Target Node.js 20+

## License

MIT License - see [LICENSE](LICENSE) for details.