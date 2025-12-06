# ParkLookup.com - Pre-Launch Checklist

## ✅ Completed Tasks

- [x] Project documentation and architecture diagrams
- [x] Next.js project setup with pnpm
- [x] Vitest testing configuration
- [x] ESLint and Prettier configuration
- [x] Tailwind CSS setup
- [x] Supabase client configuration
- [x] NPS API data fetcher with pagination
- [x] Wikidata SPARQL fetcher with pagination
- [x] Park linking algorithm (name + geolocation matching)
- [x] Database migrations pushed to Supabase Cloud
- [x] Supabase Edge Functions created
- [x] API routes for parks, search, nearby, favorites
- [x] Authentication module with Supabase Auth
- [x] Favorites functionality with offline sync
- [x] UI components (Header, ParkCard, SearchBar, etc.)
- [x] PWA with Service Worker and caching
- [x] Railway/Railpack deployment configuration
- [x] Environment variables configured

---

## 🚀 Pre-Launch Tasks

### Data Import
- [ ] Deploy Edge Functions to Supabase: `pnpx supabase functions deploy`
- [ ] Import NPS park data (call import-nps Edge Function)
- [ ] Import Wikidata park data (call import-wikidata Edge Function)
- [ ] Run park linking algorithm (call link-parks Edge Function)
- [ ] Verify data integrity in Supabase dashboard

### Testing
- [ ] Run test suite: `pnpm test`
- [ ] Fix any failing tests
- [ ] Test authentication flow (sign up, sign in, sign out)
- [ ] Test favorites functionality (add, remove, sync)
- [ ] Test search functionality
- [ ] Test nearby parks (geolocation)
- [ ] Test PWA offline mode
- [ ] Cross-browser testing (Chrome, Firefox, Safari, Edge)
- [ ] Mobile responsiveness testing

### UI/UX Polish
- [ ] Create app icons (192x192, 512x512) for PWA
- [ ] Design and add favicon
- [ ] Add loading states/skeletons
- [ ] Add error boundaries and error pages
- [ ] Implement toast notifications for user feedback
- [ ] Add empty states for no results
- [ ] Review and improve accessibility (a11y)

### Pages to Build
- [ ] Home page with featured parks
- [ ] Parks listing page with filters
- [ ] Individual park detail page
- [ ] Search results page
- [ ] Favorites page
- [ ] User profile/settings page
- [ ] Sign in / Sign up pages
- [ ] About page
- [ ] 404 page

### SEO & Performance
- [ ] Add meta tags and Open Graph tags
- [ ] Create sitemap.xml
- [ ] Create robots.txt
- [ ] Optimize images (use Next.js Image component)
- [ ] Run Lighthouse audit and fix issues
- [ ] Implement structured data (JSON-LD) for parks

### Deployment
- [ ] Create Railway project
- [ ] Configure environment variables in Railway
- [ ] Deploy to Railway staging environment
- [ ] Test staging deployment
- [ ] Configure custom domain (parklookup.com)
- [ ] Set up SSL certificate
- [ ] Deploy to production

### Post-Launch
- [ ] Set up monitoring/error tracking (Sentry, etc.)
- [ ] Configure analytics (Plausible, Umami, etc.)
- [ ] Set up cron job for periodic data imports
- [ ] Create backup strategy for database
- [ ] Document API endpoints
- [ ] Create user documentation/help pages

---

## 📝 Notes

### Quick Commands
```bash
# Development
pnpm dev                    # Start dev server on port 8080
pnpm test                   # Run tests
pnpm lint                   # Run ESLint
pnpm format                 # Run Prettier

# Supabase
pnpx supabase functions deploy              # Deploy all Edge Functions
pnpx supabase functions deploy import-nps   # Deploy specific function
pnpx supabase db push --linked              # Push migrations

# Railway
railway login               # Login to Railway
railway link                # Link to project
railway up                  # Deploy
```

### Environment Variables Needed for Railway
- `PORT=8080`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `NPS_API_KEY`
- `NEXT_PUBLIC_APP_URL`