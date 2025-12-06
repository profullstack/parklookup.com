# API & Data Import Documentation

This document describes the API endpoints and data import processes for ParkLookup.com.

## External Data Sources

### NPS API

The National Park Service API provides comprehensive data about U.S. National Parks.

**Base URL:** `https://developer.nps.gov/api/v1`

**Endpoint:** `/parks`

**Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `api_key` | string | Required API key |
| `limit` | number | Results per page (max 50) |
| `start` | number | Pagination offset |
| `parkCode` | string | Filter by park code |
| `stateCode` | string | Filter by state |
| `q` | string | Search query |

**Example Request:**
```bash
curl "https://developer.nps.gov/api/v1/parks?limit=50&start=0&api_key=YOUR_API_KEY"
```

**Response Structure:**
```json
{
  "total": "471",
  "limit": "50",
  "start": "0",
  "data": [
    {
      "id": "77E0D7F0-1942-494A-ACE2-9004D2BDC59E",
      "parkCode": "acad",
      "fullName": "Acadia National Park",
      "description": "Acadia National Park protects...",
      "states": "ME",
      "designation": "National Park",
      "latitude": "44.409286",
      "longitude": "-68.247501",
      "url": "https://www.nps.gov/acad/index.htm",
      "weatherInfo": "Located on Mount Desert Island...",
      "images": [...],
      "activities": [...],
      "topics": [...],
      "contacts": {...},
      "entranceFees": [...],
      "operatingHours": [...],
      "addresses": [...]
    }
  ]
}
```

### Wikidata SPARQL

Wikidata provides supplementary information about national parks.

**Endpoint:** `https://query.wikidata.org/sparql`

**SPARQL Query:**
```sparql
SELECT ?park ?parkLabel ?image ?stateLabel ?coord ?website 
       ?area ?areaUnitLabel ?elev ?elevUnitLabel ?inception 
       ?managingOrgLabel ?commonsCat 
WHERE {
  ?park wdt:P31 wd:Q46169.        # Instance of national park
  ?park wdt:P17 wd:Q30.           # Country: USA
  
  OPTIONAL { ?park wdt:P18 ?image. }
  OPTIONAL { ?park wdt:P131 ?state. }
  OPTIONAL { ?park wdt:P625 ?coord. }
  OPTIONAL { ?park wdt:P856 ?website. }
  OPTIONAL { 
    ?park wdt:P2046 ?areaNode.
    ?areaNode wikibase:quantityAmount ?area;
              wikibase:quantityUnit ?areaUnit.
  }
  OPTIONAL { 
    ?park wdt:P2044 ?elevNode.
    ?elevNode wikibase:quantityAmount ?elev;
              wikibase:quantityUnit ?elevUnit.
  }
  OPTIONAL { ?park wdt:P571 ?inception. }
  OPTIONAL { ?park wdt:P137 ?managingOrg. }
  OPTIONAL { ?park wdt:P373 ?commonsCat. }
  
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
}
LIMIT 50 OFFSET 0
```

**Example Request:**
```bash
curl -G "https://query.wikidata.org/sparql" \
  --data-urlencode "format=json" \
  --data-urlencode "query=SELECT ?park ?parkLabel WHERE { ?park wdt:P31 wd:Q46169. ?park wdt:P17 wd:Q30. SERVICE wikibase:label { bd:serviceParam wikibase:language \"en\". } } LIMIT 10"
```

## Supabase Edge Functions

### import-nps-parks

Imports all parks from the NPS API with pagination.

**Location:** `supabase/functions/import-nps-parks/index.ts`

```typescript
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const NPS_API_KEY = Deno.env.get("NPS_API_KEY")
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")

const BATCH_SIZE = 50

serve(async (req) => {
  const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!)
  
  let start = 0
  let total = Infinity
  let imported = 0
  
  while (start < total) {
    const response = await fetch(
      `https://developer.nps.gov/api/v1/parks?limit=${BATCH_SIZE}&start=${start}&api_key=${NPS_API_KEY}`
    )
    const data = await response.json()
    
    total = parseInt(data.total)
    
    for (const park of data.data) {
      const { error } = await supabase
        .from("nps_parks")
        .upsert({
          park_code: park.parkCode,
          full_name: park.fullName,
          description: park.description,
          states: park.states,
          designation: park.designation,
          latitude: parseFloat(park.latitude) || null,
          longitude: parseFloat(park.longitude) || null,
          url: park.url,
          weather_info: park.weatherInfo,
          images: park.images,
          activities: park.activities,
          topics: park.topics,
          contacts: park.contacts,
          entrance_fees: park.entranceFees,
          operating_hours: park.operatingHours,
          addresses: park.addresses,
          updated_at: new Date().toISOString()
        }, { onConflict: "park_code" })
      
      if (!error) imported++
    }
    
    start += BATCH_SIZE
  }
  
  return new Response(
    JSON.stringify({ success: true, imported, total }),
    { headers: { "Content-Type": "application/json" } }
  )
})
```

### import-wikidata-parks

Imports park data from Wikidata SPARQL endpoint.

**Location:** `supabase/functions/import-wikidata-parks/index.ts`

```typescript
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")

const BATCH_SIZE = 50

const SPARQL_QUERY = `
SELECT ?park ?parkLabel ?image ?stateLabel ?coord ?website 
       ?area ?areaUnitLabel ?elev ?elevUnitLabel ?inception 
       ?managingOrgLabel ?commonsCat 
WHERE {
  ?park wdt:P31 wd:Q46169.
  ?park wdt:P17 wd:Q30.
  OPTIONAL { ?park wdt:P18 ?image. }
  OPTIONAL { ?park wdt:P131 ?state. }
  OPTIONAL { ?park wdt:P625 ?coord. }
  OPTIONAL { ?park wdt:P856 ?website. }
  OPTIONAL { 
    ?park wdt:P2046 ?areaNode.
    ?areaNode wikibase:quantityAmount ?area;
              wikibase:quantityUnit ?areaUnit.
  }
  OPTIONAL { 
    ?park wdt:P2044 ?elevNode.
    ?elevNode wikibase:quantityAmount ?elev;
              wikibase:quantityUnit ?elevUnit.
  }
  OPTIONAL { ?park wdt:P571 ?inception. }
  OPTIONAL { ?park wdt:P137 ?managingOrg. }
  OPTIONAL { ?park wdt:P373 ?commonsCat. }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
}
LIMIT ${BATCH_SIZE} OFFSET `

function parseCoordinates(coord: string): { lat: number; lng: number } | null {
  const match = coord?.match(/Point\(([^ ]+) ([^)]+)\)/)
  if (match) {
    return { lat: parseFloat(match[2]), lng: parseFloat(match[1]) }
  }
  return null
}

function extractWikidataId(uri: string): string {
  return uri.split("/").pop() || ""
}

serve(async (req) => {
  const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!)
  
  let offset = 0
  let imported = 0
  let hasMore = true
  
  while (hasMore) {
    const query = SPARQL_QUERY + offset
    const response = await fetch(
      `https://query.wikidata.org/sparql?format=json&query=${encodeURIComponent(query)}`
    )
    const data = await response.json()
    
    if (data.results.bindings.length === 0) {
      hasMore = false
      break
    }
    
    for (const result of data.results.bindings) {
      const coords = parseCoordinates(result.coord?.value)
      const wikidataId = extractWikidataId(result.park.value)
      
      const { error } = await supabase
        .from("wikidata_parks")
        .upsert({
          wikidata_id: wikidataId,
          label: result.parkLabel?.value,
          image_url: result.image?.value,
          state: result.stateLabel?.value,
          latitude: coords?.lat,
          longitude: coords?.lng,
          website: result.website?.value,
          area: result.area?.value ? parseFloat(result.area.value) : null,
          area_unit: result.areaUnitLabel?.value,
          elevation: result.elev?.value ? parseFloat(result.elev.value) : null,
          elevation_unit: result.elevUnitLabel?.value,
          inception: result.inception?.value?.split("T")[0],
          managing_org: result.managingOrgLabel?.value,
          commons_category: result.commonsCat?.value,
          updated_at: new Date().toISOString()
        }, { onConflict: "wikidata_id" })
      
      if (!error) imported++
    }
    
    offset += BATCH_SIZE
  }
  
  return new Response(
    JSON.stringify({ success: true, imported }),
    { headers: { "Content-Type": "application/json" } }
  )
})
```

### link-parks

Links NPS parks to Wikidata records based on name matching.

**Location:** `supabase/functions/link-parks/index.ts`

```typescript
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")

function calculateSimilarity(str1: string, str2: string): number {
  const s1 = str1.toLowerCase().replace(/[^a-z0-9]/g, "")
  const s2 = str2.toLowerCase().replace(/[^a-z0-9]/g, "")
  
  if (s1 === s2) return 1.0
  if (s1.includes(s2) || s2.includes(s1)) return 0.9
  
  // Levenshtein distance based similarity
  const matrix: number[][] = []
  for (let i = 0; i <= s1.length; i++) {
    matrix[i] = [i]
  }
  for (let j = 0; j <= s2.length; j++) {
    matrix[0][j] = j
  }
  for (let i = 1; i <= s1.length; i++) {
    for (let j = 1; j <= s2.length; j++) {
      const cost = s1[i - 1] === s2[j - 1] ? 0 : 1
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost
      )
    }
  }
  
  const maxLen = Math.max(s1.length, s2.length)
  return 1 - matrix[s1.length][s2.length] / maxLen
}

serve(async (req) => {
  const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!)
  
  const { data: npsParks } = await supabase.from("nps_parks").select("id, full_name")
  const { data: wikiParks } = await supabase.from("wikidata_parks").select("id, label")
  
  let linked = 0
  const THRESHOLD = 0.8
  
  for (const nps of npsParks || []) {
    let bestMatch = null
    let bestScore = 0
    
    for (const wiki of wikiParks || []) {
      const score = calculateSimilarity(nps.full_name, wiki.label)
      if (score > bestScore && score >= THRESHOLD) {
        bestScore = score
        bestMatch = wiki
      }
    }
    
    if (bestMatch) {
      const { error } = await supabase
        .from("park_links")
        .upsert({
          nps_park_id: nps.id,
          wikidata_park_id: bestMatch.id,
          confidence_score: bestScore,
          match_method: "name_similarity"
        }, { onConflict: "nps_park_id,wikidata_park_id" })
      
      if (!error) linked++
    }
  }
  
  return new Response(
    JSON.stringify({ success: true, linked }),
    { headers: { "Content-Type": "application/json" } }
  )
})
```

## Scheduled Imports

Configure scheduled imports using Supabase pg_cron:

```sql
-- Enable pg_cron extension
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Schedule NPS import daily at 2 AM UTC
SELECT cron.schedule(
  'import-nps-parks',
  '0 2 * * *',
  $$
  SELECT net.http_post(
    url := 'https://YOUR_PROJECT.supabase.co/functions/v1/import-nps-parks',
    headers := '{"Authorization": "Bearer YOUR_SERVICE_ROLE_KEY"}'::jsonb
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
    headers := '{"Authorization": "Bearer YOUR_SERVICE_ROLE_KEY"}'::jsonb
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
    headers := '{"Authorization": "Bearer YOUR_SERVICE_ROLE_KEY"}'::jsonb
  );
  $$
);
```

## Next.js API Routes

### GET /api/parks

Fetch parks with optional filtering.

```typescript
// app/api/parks/route.ts
import { createClient } from "@/lib/supabase/server"
import { NextRequest, NextResponse } from "next/server"

export async function GET(request: NextRequest) {
  const supabase = createClient()
  const { searchParams } = new URL(request.url)
  
  const page = parseInt(searchParams.get("page") || "1")
  const limit = parseInt(searchParams.get("limit") || "20")
  const state = searchParams.get("state")
  const search = searchParams.get("search")
  
  let query = supabase
    .from("parks_with_wikidata")
    .select("*", { count: "exact" })
  
  if (state) {
    query = query.ilike("states", `%${state}%`)
  }
  
  if (search) {
    query = query.or(`full_name.ilike.%${search}%,description.ilike.%${search}%`)
  }
  
  const { data, count, error } = await query
    .range((page - 1) * limit, page * limit - 1)
    .order("full_name")
  
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  
  return NextResponse.json({
    data,
    pagination: {
      page,
      limit,
      total: count,
      totalPages: Math.ceil((count || 0) / limit)
    }
  })
}
```

### GET /api/parks/[id]

Fetch a single park by ID.

```typescript
// app/api/parks/[id]/route.ts
import { createClient } from "@/lib/supabase/server"
import { NextRequest, NextResponse } from "next/server"

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createClient()
  
  const { data, error } = await supabase
    .from("parks_with_wikidata")
    .select("*")
    .eq("id", params.id)
    .single()
  
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 404 })
  }
  
  return NextResponse.json(data)
}
```

### POST /api/favorites

Toggle favorite status.

```typescript
// app/api/favorites/route.ts
import { createClient } from "@/lib/supabase/server"
import { NextRequest, NextResponse } from "next/server"

export async function POST(request: NextRequest) {
  const supabase = createClient()
  const { parkId } = await request.json()
  
  const { data, error } = await supabase
    .rpc("toggle_favorite", { p_park_id: parkId })
  
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  
  return NextResponse.json({ isFavorite: data })
}
```

### GET /api/favorites

Get user's favorite parks.

```typescript
// app/api/favorites/route.ts
import { createClient } from "@/lib/supabase/server"
import { NextRequest, NextResponse } from "next/server"

export async function GET(request: NextRequest) {
  const supabase = createClient()
  
  const { data, error } = await supabase
    .from("user_favorites_with_parks")
    .select("*")
    .order("favorited_at", { ascending: false })
  
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  
  return NextResponse.json(data)
}
```

## Data Import Flow

```mermaid
sequenceDiagram
    participant Cron as pg_cron
    participant NPS_Fn as import-nps-parks
    participant Wiki_Fn as import-wikidata-parks
    participant Link_Fn as link-parks
    participant NPS_API as NPS API
    participant Wiki_API as Wikidata
    participant DB as PostgreSQL
    
    Cron->>NPS_Fn: Trigger at 2 AM
    loop Paginate
        NPS_Fn->>NPS_API: GET /parks?limit=50&start=N
        NPS_API-->>NPS_Fn: Park data
        NPS_Fn->>DB: UPSERT nps_parks
    end
    NPS_Fn-->>Cron: Complete
    
    Cron->>Wiki_Fn: Trigger at 3 AM
    loop Paginate
        Wiki_Fn->>Wiki_API: SPARQL query OFFSET N
        Wiki_API-->>Wiki_Fn: Park data
        Wiki_Fn->>DB: UPSERT wikidata_parks
    end
    Wiki_Fn-->>Cron: Complete
    
    Cron->>Link_Fn: Trigger at 4 AM
    Link_Fn->>DB: SELECT nps_parks
    Link_Fn->>DB: SELECT wikidata_parks
    Link_Fn->>Link_Fn: Calculate similarities
    Link_Fn->>DB: UPSERT park_links
    Link_Fn-->>Cron: Complete
```

## Related Documentation

- [Architecture Overview](./ARCHITECTURE.md)
- [Database Schema](./DATABASE.md)
- [Deployment Guide](./DEPLOYMENT.md)