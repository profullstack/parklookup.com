# Deployment Guide

This document describes how to deploy ParkLookup.com using Supabase Cloud and Railway with Railpack.

## Overview

```mermaid
graph LR
    subgraph Development
        LOCAL[Local Dev]
    end
    
    subgraph CI/CD
        GH[GitHub]
        ACTIONS[GitHub Actions]
    end
    
    subgraph Production
        RAILPACK[Railpack Builder]
        RAILWAY[Railway]
        SUPABASE[Supabase Cloud]
    end
    
    LOCAL --> GH
    GH --> ACTIONS
    ACTIONS --> RAILPACK
    RAILPACK --> RAILWAY
    ACTIONS --> SUPABASE
```

## Tech Stack

- **Runtime**: Node.js 20+
- **Package Manager**: pnpm
- **Build Tool**: Railpack (Railway's optimized builder)
- **Testing**: Vitest
- **Framework**: Next.js 14+

## Prerequisites

- GitHub account
- Supabase account (free tier available)
- Railway account (free tier available)
- Node.js 20+ installed locally
- pnpm installed (`npm install -g pnpm`)
- Supabase CLI installed

## Supabase Setup

### 1. Create Project

1. Go to [supabase.com](https://supabase.com)
2. Click "New Project"
3. Fill in project details:
   - Name: `parklookup`
   - Database Password: (generate strong password)
   - Region: Choose closest to your users
4. Click "Create new project"

### 2. Get API Keys

After project creation, go to Settings > API:

- **Project URL**: `https://xxxxx.supabase.co`
- **anon/public key**: For client-side requests
- **service_role key**: For server-side/admin requests (keep secret!)

### 3. Configure Database

#### Run Migrations

```bash
# Install Supabase CLI globally
pnpm add -g supabase

# Login to Supabase
supabase login

# Link to your project
supabase link --project-ref your-project-ref

# Push migrations
supabase db push
```

#### Enable Extensions

In Supabase Dashboard > Database > Extensions, enable:
- `pg_cron` - For scheduled jobs
- `pg_net` - For HTTP requests from database
- `postgis` - For geospatial queries (optional)

### 4. Configure Authentication

1. Go to Authentication > Providers
2. Enable Email provider
3. Configure email templates (optional)
4. Set up OAuth providers if needed (Google, GitHub, etc.)

### 5. Deploy Edge Functions

```bash
# Deploy all functions
supabase functions deploy import-nps-parks
supabase functions deploy import-wikidata-parks
supabase functions deploy link-parks

# Set secrets
supabase secrets set NPS_API_KEY=your_nps_api_key
```

### 6. Configure Scheduled Jobs

In Supabase Dashboard > Database > SQL Editor:

```sql
-- Enable pg_cron
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Schedule NPS import daily at 2 AM UTC
SELECT cron.schedule(
  'import-nps-parks',
  '0 2 * * *',
  $$
  SELECT net.http_post(
    url := 'https://YOUR_PROJECT.supabase.co/functions/v1/import-nps-parks',
    headers := jsonb_build_object(
      'Authorization', 'Bearer YOUR_SERVICE_ROLE_KEY',
      'Content-Type', 'application/json'
    )
  );
  $$
);

-- Schedule Wikidata import daily at 3 AM UTC
SELECT cron.schedule(
  'import-wikidata-parks',
  '0 3 * * *',
  $$
  SELECT net.http_post(
    url := 'https://YOUR_PROJECT.supabase.co/functions/v1/import-wikidata-parks',
    headers := jsonb_build_object(
      'Authorization', 'Bearer YOUR_SERVICE_ROLE_KEY',
      'Content-Type', 'application/json'
    )
  );
  $$
);

-- Schedule park linking daily at 4 AM UTC
SELECT cron.schedule(
  'link-parks',
  '0 4 * * *',
  $$
  SELECT net.http_post(
    url := 'https://YOUR_PROJECT.supabase.co/functions/v1/link-parks',
    headers := jsonb_build_object(
      'Authorization', 'Bearer YOUR_SERVICE_ROLE_KEY',
      'Content-Type', 'application/json'
    )
  );
  $$
);
```

## Railway Setup with Railpack

### What is Railpack?

Railpack is Railway's optimized build system that automatically detects your project type and creates efficient, cached builds. It provides:

- **Automatic detection** of Node.js, pnpm, and Next.js
- **Layer caching** for faster subsequent builds
- **Optimized Docker images** for production
- **Zero configuration** for most projects

### 1. Create Project

1. Go to [railway.app](https://railway.app)
2. Click "New Project"
3. Select "Deploy from GitHub repo"
4. Connect your GitHub account
5. Select the `parklookup.com` repository

### 2. Configure Railpack

Railway automatically uses Railpack when it detects a supported project. For Next.js with pnpm, create a `railpack.json` in your project root:

```json
{
  "$schema": "https://railpack.io/schema.json",
  "builder": "nodejs",
  "runtime": "nodejs",
  "packageManager": "pnpm",
  "nodeVersion": "20",
  "buildCommand": "pnpm run build",
  "startCommand": "pnpm start",
  "installCommand": "pnpm install --frozen-lockfile",
  "cacheDirectories": [
    "node_modules",
    ".next/cache"
  ]
}
```

Alternatively, you can use a `railway.toml` file:

```toml
[build]
builder = "railpack"

[build.railpack]
packageManager = "pnpm"
nodeVersion = "20"

[deploy]
startCommand = "pnpm start"
healthcheckPath = "/api/health"
healthcheckTimeout = 30
```

### 3. Configure Environment Variables

In Railway Dashboard > Variables:

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# NPS API
NPS_API_KEY=your_nps_api_key

# App
NEXT_PUBLIC_APP_URL=https://your-app.railway.app
NODE_ENV=production
```

### 4. Configure Domain

1. Go to Settings > Domains
2. Add custom domain or use Railway subdomain
3. Configure DNS if using custom domain:
   ```
   CNAME your-app.railway.app
   ```

### 5. Enable Auto-Deploy

Railway automatically deploys on push to main branch. Configure in Settings:

- **Auto-Deploy**: Enabled
- **Branch**: `main`

## GitHub Actions CI/CD

### Workflow Configuration

**Location:** `.github/workflows/deploy.yml`

```yaml
name: Deploy

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

env:
  NEXT_PUBLIC_SUPABASE_URL: ${{ secrets.NEXT_PUBLIC_SUPABASE_URL }}
  NEXT_PUBLIC_SUPABASE_ANON_KEY: ${{ secrets.NEXT_PUBLIC_SUPABASE_ANON_KEY }}

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Install pnpm
        uses: pnpm/action-setup@v2
        with:
          version: 9
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'pnpm'
      
      - name: Install dependencies
        run: pnpm install --frozen-lockfile
      
      - name: Run linter
        run: pnpm lint
      
      - name: Run tests
        run: pnpm test
      
      - name: Build
        run: pnpm build

  deploy-supabase:
    needs: test
    if: github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Supabase CLI
        uses: supabase/setup-cli@v1
        with:
          version: latest
      
      - name: Deploy migrations
        run: |
          supabase link --project-ref ${{ secrets.SUPABASE_PROJECT_REF }}
          supabase db push
        env:
          SUPABASE_ACCESS_TOKEN: ${{ secrets.SUPABASE_ACCESS_TOKEN }}
      
      - name: Deploy Edge Functions
        run: |
          supabase functions deploy import-nps-parks
          supabase functions deploy import-wikidata-parks
          supabase functions deploy link-parks
        env:
          SUPABASE_ACCESS_TOKEN: ${{ secrets.SUPABASE_ACCESS_TOKEN }}

  # Railway deploys automatically via GitHub integration using Railpack
```

### GitHub Secrets

Configure in GitHub > Settings > Secrets:

| Secret | Description |
|--------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key |
| `SUPABASE_ACCESS_TOKEN` | Supabase CLI access token |
| `SUPABASE_PROJECT_REF` | Supabase project reference |

## Project Configuration Files

### package.json

```json
{
  "name": "parklookup",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "eslint . --ext .js,.jsx",
    "lint:fix": "eslint . --ext .js,.jsx --fix",
    "test": "vitest",
    "test:watch": "vitest --watch",
    "test:coverage": "vitest --coverage",
    "format": "prettier --write ."
  },
  "engines": {
    "node": ">=20.0.0",
    "pnpm": ">=9.0.0"
  },
  "packageManager": "pnpm@9.14.2"
}
```

### vitest.config.js

```javascript
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./test/setup.js'],
    include: ['**/*.{test,spec}.{js,jsx}'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'test/',
        '**/*.config.js'
      ]
    }
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './'),
    }
  }
})
```

### .npmrc (for pnpm)

```ini
engine-strict=true
auto-install-peers=true
shamefully-hoist=true
```

## Environment Configuration

### Development (.env.local)

```env
# Server Configuration
PORT=8080

# Supabase
NEXT_PUBLIC_SUPABASE_URL=http://localhost:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_local_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_local_service_role_key

# NPS API
NPS_API_KEY=your_nps_api_key

# App
NEXT_PUBLIC_APP_URL=http://localhost:8080
```

### Production

Set via Railway dashboard or GitHub secrets.

## Initial Data Import

After deployment, run initial data imports:

```bash
# Via Supabase CLI
supabase functions invoke import-nps-parks
supabase functions invoke import-wikidata-parks
supabase functions invoke link-parks

# Or via curl
curl -X POST https://YOUR_PROJECT.supabase.co/functions/v1/import-nps-parks \
  -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY"
```

## Monitoring

### Railway Metrics

- CPU usage
- Memory usage
- Request count
- Response times
- Build times (Railpack optimizations)

### Supabase Dashboard

- Database size
- API requests
- Auth users
- Edge Function invocations

### Recommended Monitoring Tools

- **Sentry**: Error tracking
- **Railway Observability**: Built-in metrics
- **LogRocket**: Session replay

## Scaling

### Railway

- Upgrade to Pro plan for more resources
- Configure auto-scaling in settings
- Add more replicas if needed
- Railpack caching improves build times

### Supabase

- Upgrade plan for more database connections
- Enable connection pooling (PgBouncer)
- Add read replicas for high traffic

## Troubleshooting

### Common Issues

#### Build Fails on Railway with Railpack

1. Check build logs in Railway dashboard
2. Verify `pnpm-lock.yaml` is committed
3. Ensure `engines` field in package.json matches Node version
4. Check `railpack.json` or `railway.toml` configuration

#### pnpm Install Fails

1. Ensure `pnpm-lock.yaml` is up to date
2. Run `pnpm install --frozen-lockfile` locally to verify
3. Check for peer dependency issues

#### Vitest Tests Fail

1. Check test environment configuration
2. Verify `jsdom` environment for React components
3. Check for missing test setup files

#### Database Connection Issues

1. Check Supabase project status
2. Verify connection string
3. Check RLS policies

#### Edge Function Timeouts

1. Increase timeout in function config
2. Optimize pagination batch size
3. Add retry logic

### Debug Commands

```bash
# Check Railway logs
railway logs

# Check Supabase function logs
supabase functions logs import-nps-parks

# Test database connection
supabase db ping

# Run tests locally
pnpm test

# Check pnpm store
pnpm store status
```

## Rollback Procedures

### Railway

1. Go to Deployments
2. Find previous successful deployment
3. Click "Rollback"

### Supabase Migrations

```bash
# List migrations
supabase migration list

# Rollback last migration
supabase db reset --linked
```

## Security Checklist

- [ ] Environment variables not committed to git
- [ ] Service role key only used server-side
- [ ] RLS policies enabled on all tables
- [ ] CORS configured correctly
- [ ] Rate limiting enabled
- [ ] SSL/TLS enabled (automatic on Railway/Supabase)
- [ ] pnpm-lock.yaml committed for reproducible builds

## Cost Optimization

### Railway Free Tier

- 500 hours/month execution
- 100 GB bandwidth
- Sleeps after inactivity
- Railpack caching reduces build minutes

### Supabase Free Tier

- 500 MB database
- 2 GB bandwidth
- 50,000 monthly active users
- 500,000 Edge Function invocations

### Tips

1. Use caching to reduce database queries
2. Optimize images before upload
3. Use CDN for static assets
4. Monitor usage in dashboards
5. Leverage Railpack caching for faster builds

## Related Documentation

- [Architecture Overview](./ARCHITECTURE.md)
- [Database Schema](./DATABASE.md)
- [API Documentation](./API.md)
- [PWA Implementation](./PWA.md)