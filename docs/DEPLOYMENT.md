# Deployment Guide

This document describes how to deploy ParkLookup.com using Supabase Cloud and Railway.

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
        RAILWAY[Railway]
        SUPABASE[Supabase Cloud]
    end
    
    LOCAL --> GH
    GH --> ACTIONS
    ACTIONS --> RAILWAY
    ACTIONS --> SUPABASE
```

## Prerequisites

- GitHub account
- Supabase account (free tier available)
- Railway account (free tier available)
- Node.js 18+ installed locally
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
# Install Supabase CLI
npm install -g supabase

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

## Railway Setup

### 1. Create Project

1. Go to [railway.app](https://railway.app)
2. Click "New Project"
3. Select "Deploy from GitHub repo"
4. Connect your GitHub account
5. Select the `parklookup.com` repository

### 2. Configure Environment Variables

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

### 3. Configure Build Settings

Railway auto-detects Next.js, but verify:

- **Build Command**: `npm run build`
- **Start Command**: `npm start`
- **Install Command**: `npm install`

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
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Run linter
        run: npm run lint
      
      - name: Run tests
        run: npm test
      
      - name: Build
        run: npm run build

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

  # Railway deploys automatically via GitHub integration
```

### GitHub Secrets

Configure in GitHub > Settings > Secrets:

| Secret | Description |
|--------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key |
| `SUPABASE_ACCESS_TOKEN` | Supabase CLI access token |
| `SUPABASE_PROJECT_REF` | Supabase project reference |

## Environment Configuration

### Development (.env.local)

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=http://localhost:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_local_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_local_service_role_key

# NPS API
NPS_API_KEY=your_nps_api_key

# App
NEXT_PUBLIC_APP_URL=http://localhost:3000
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

### Supabase Dashboard

- Database size
- API requests
- Auth users
- Edge Function invocations

### Recommended Monitoring Tools

- **Sentry**: Error tracking
- **Vercel Analytics**: Web vitals (if using Vercel)
- **LogRocket**: Session replay

## Scaling

### Railway

- Upgrade to Pro plan for more resources
- Configure auto-scaling in settings
- Add more replicas if needed

### Supabase

- Upgrade plan for more database connections
- Enable connection pooling (PgBouncer)
- Add read replicas for high traffic

## Troubleshooting

### Common Issues

#### Build Fails on Railway

1. Check build logs in Railway dashboard
2. Verify environment variables are set
3. Ensure `package.json` scripts are correct

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

## Cost Optimization

### Railway Free Tier

- 500 hours/month execution
- 100 GB bandwidth
- Sleeps after inactivity

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

## Related Documentation

- [Architecture Overview](./ARCHITECTURE.md)
- [Database Schema](./DATABASE.md)
- [API Documentation](./API.md)
- [PWA Implementation](./PWA.md)