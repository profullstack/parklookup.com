# Trip Tracker Feature Implementation Plan

## Overview

Add a live GPS trip tracker for paid users that allows them to record their path while driving, walking, or biking through parks and trails. The feature includes real-time map visualization, automatic activity detection, and the ability to save and share completed tracks in the social feed.

## Requirements Summary

- **Pro users only** - Requires `is_pro = true` in profiles
- **Background tracking** - Works when app is minimized (with user permission)
- **Auto-detect activity type** - Based on speed (walking < 6 mph, biking 6-20 mph, driving > 20 mph)
- **Interactive map preview** - Shared tracks show interactive maps in feed
- **Park/Trail association** - Tracks must be linked to a park or trail

## Architecture

```mermaid
flowchart TB
    subgraph Client [Frontend - PWA]
        UI[Track UI Components]
        GEO[Geolocation API]
        SW[Service Worker]
        IDB[IndexedDB Cache]
    end
    
    subgraph API [Next.js API Routes]
        TRACK_API[/api/tracks]
        POINTS_API[/api/tracks/points]
        SHARE_API[/api/tracks/share]
    end
    
    subgraph DB [Supabase]
        TRACKS[user_tracks table]
        POINTS[track_points table]
        FEED[Feed integration]
    end
    
    UI --> GEO
    GEO --> SW
    SW --> IDB
    IDB --> POINTS_API
    UI --> TRACK_API
    TRACK_API --> TRACKS
    POINTS_API --> POINTS
    SHARE_API --> FEED
```

## Database Schema

### Table: user_tracks

Stores metadata about each recorded track.

```sql
CREATE TABLE user_tracks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Association (one required)
  park_id UUID REFERENCES nps_parks(id) ON DELETE SET NULL,
  park_code VARCHAR(10),
  trail_id UUID REFERENCES trails(id) ON DELETE SET NULL,
  local_park_id UUID REFERENCES local_parks(id) ON DELETE SET NULL,
  
  -- Track metadata
  title VARCHAR(255),
  description TEXT,
  activity_type VARCHAR(20) NOT NULL CHECK (activity_type IN ('walking', 'hiking', 'biking', 'driving')),
  
  -- Computed stats
  distance_meters DECIMAL(12, 2),
  duration_seconds INTEGER,
  elevation_gain_m DECIMAL(8, 2),
  elevation_loss_m DECIMAL(8, 2),
  avg_speed_mps DECIMAL(8, 4),
  max_speed_mps DECIMAL(8, 4),
  
  -- Bounding box for quick spatial queries
  min_lat DECIMAL(10, 8),
  max_lat DECIMAL(10, 8),
  min_lng DECIMAL(11, 8),
  max_lng DECIMAL(11, 8),
  
  -- Geometry (LineString for the full track)
  geometry GEOMETRY(LineString, 4326),
  
  -- Status
  status VARCHAR(20) DEFAULT 'recording' CHECK (status IN ('recording', 'paused', 'completed', 'shared', 'deleted')),
  
  -- Sharing
  is_public BOOLEAN DEFAULT FALSE,
  shared_at TIMESTAMPTZ,
  
  -- Timestamps
  started_at TIMESTAMPTZ NOT NULL,
  ended_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Table: track_points

Stores individual GPS points for each track.

```sql
CREATE TABLE track_points (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  track_id UUID NOT NULL REFERENCES user_tracks(id) ON DELETE CASCADE,
  
  -- Position
  latitude DECIMAL(10, 8) NOT NULL,
  longitude DECIMAL(11, 8) NOT NULL,
  altitude_m DECIMAL(8, 2),
  
  -- Accuracy
  accuracy_m DECIMAL(8, 2),
  altitude_accuracy_m DECIMAL(8, 2),
  
  -- Motion
  speed_mps DECIMAL(8, 4),
  heading DECIMAL(6, 2),
  
  -- Sequence
  sequence_num INTEGER NOT NULL,
  recorded_at TIMESTAMPTZ NOT NULL,
  
  -- Geometry point
  geometry GEOMETRY(Point, 4326),
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Table: track_likes

Likes on shared tracks (similar to media_likes).

```sql
CREATE TABLE track_likes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  track_id UUID NOT NULL REFERENCES user_tracks(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(track_id, user_id)
);
```

### Table: track_comments

Comments on shared tracks (similar to media_comments).

```sql
CREATE TABLE track_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  track_id UUID NOT NULL REFERENCES user_tracks(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  parent_id UUID REFERENCES track_comments(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

## API Endpoints

### Track Management

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/tracks` | Start a new track |
| GET | `/api/tracks` | List user's tracks |
| GET | `/api/tracks/[id]` | Get track details |
| PATCH | `/api/tracks/[id]` | Update track (title, description, status) |
| DELETE | `/api/tracks/[id]` | Delete a track |

### Track Points

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/tracks/[id]/points` | Add GPS points (batch) |
| GET | `/api/tracks/[id]/points` | Get all points for a track |

### Sharing & Social

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/tracks/[id]/share` | Share track to feed |
| POST | `/api/tracks/[id]/likes` | Like a track |
| DELETE | `/api/tracks/[id]/likes` | Unlike a track |
| GET | `/api/tracks/[id]/comments` | Get track comments |
| POST | `/api/tracks/[id]/comments` | Add comment |
| DELETE | `/api/tracks/[id]/comments/[commentId]` | Delete comment |

### Feed Integration

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/feed` | Modified to include shared tracks |

## Frontend Components

### New Components

```
components/
  tracking/
    TrackingProvider.jsx      # Context for tracking state
    TrackingControls.jsx      # Start/pause/stop buttons
    LiveTrackMap.jsx          # Real-time map with current position
    TrackStats.jsx            # Live stats (distance, time, speed)
    ActivityIndicator.jsx     # Shows detected activity type
    TrackCard.jsx             # Card for displaying saved tracks
    TrackDetailMap.jsx        # Interactive map for viewing tracks
    TrackShareModal.jsx       # Modal for sharing to feed
    ParkTrailSelector.jsx     # Select park/trail to associate
    ElevationProfile.jsx      # SVG elevation chart component
```

### New Pages

```
app/
  tracking/
    page.jsx                  # Main tracking page
    [id]/
      page.jsx                # Track detail page
  my-tracks/
    page.jsx                  # List of user's tracks
```

### Hooks

```
hooks/
  useGeolocation.js           # Geolocation API wrapper
  useTracking.js              # Tracking state management
  useBackgroundTracking.js    # Service worker communication
```

## Activity Detection Algorithm

```javascript
const detectActivityType = (speedMps) => {
  const speedMph = speedMps * 2.237; // Convert m/s to mph
  
  if (speedMph < 1) return 'stationary';
  if (speedMph < 6) return 'walking';
  if (speedMph < 20) return 'biking';
  return 'driving';
};

// Use rolling average of last 10 points for stability
const getActivityType = (recentSpeeds) => {
  const avgSpeed = recentSpeeds.reduce((a, b) => a + b, 0) / recentSpeeds.length;
  return detectActivityType(avgSpeed);
};
```

## Track Profile Charts

The profile charts display elevation and speed changes over the course of a track, helping users visualize their performance and terrain.

### Data Sources

- **Elevation**: `altitude_m` field in `track_points` (from device barometer or GPS)
- **Speed**: `speed_mps` field in `track_points` (from Geolocation API)

### Components

```
components/
  tracking/
    ElevationProfile.jsx      # Elevation-only chart
    SpeedProfile.jsx          # Speed-only chart
    TrackProfileChart.jsx     # Combined dual-axis chart
    ProfileTooltip.jsx        # Shared hover tooltip component
```

### TrackProfileChart Component (Combined View)

```javascript
// components/tracking/TrackProfileChart.jsx
// Renders a dual-axis SVG chart showing both elevation and speed

const TrackProfileChart = ({
  points,
  width = 600,
  height = 250,
  showElevation = true,
  showSpeed = true,
  interactive = true
}) => {
  // X-axis: cumulative distance
  // Left Y-axis: elevation (meters/feet)
  // Right Y-axis: speed (mph/kph)
  // Two overlaid area charts with different colors
};
```

### Chart Features

**Elevation Profile (Green)**
- Gradient fill from light to dark green
- Shows min/max elevation markers
- Displays total elevation gain/loss

**Speed Profile (Blue)**
- Semi-transparent blue overlay
- Shows average and max speed
- Color-coded by activity zones (walking/biking/driving)

**Interactive Features**
- **Hover tooltip** - Shows elevation, speed, and distance at cursor
- **Click to sync** - Clicking chart highlights corresponding point on map
- **Zoom/pan** - For long tracks, allow horizontal scrolling
- **Toggle layers** - Show/hide elevation or speed independently

### Speed Calculation & Zones

```javascript
const calculateSpeedStats = (points) => {
  const speeds = points.filter(p => p.speed_mps != null).map(p => p.speed_mps);
  
  return {
    avgSpeed: speeds.reduce((a, b) => a + b, 0) / speeds.length,
    maxSpeed: Math.max(...speeds),
    minSpeed: Math.min(...speeds.filter(s => s > 0)),
  };
};

// Speed zone colors for visual feedback
const getSpeedZoneColor = (speedMph) => {
  if (speedMph < 4) return '#22c55e';   // Walking - green
  if (speedMph < 15) return '#3b82f6';  // Biking - blue
  return '#f59e0b';                      // Driving - amber
};
```

### Elevation Calculation

```javascript
const calculateElevationStats = (points) => {
  let gain = 0;
  let loss = 0;
  let minElevation = Infinity;
  let maxElevation = -Infinity;
  
  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1].altitude_m;
    const curr = points[i].altitude_m;
    
    if (prev != null && curr != null) {
      const diff = curr - prev;
      if (diff > 0) gain += diff;
      else loss += Math.abs(diff);
      
      minElevation = Math.min(minElevation, curr);
      maxElevation = Math.max(maxElevation, curr);
    }
  }
  
  return { gain, loss, minElevation, maxElevation };
};
```

### Display Locations

1. **Track Detail Page** - Full-width combined chart below the map
2. **Feed Item** - Compact elevation-only version when track is shared
3. **Live Tracking** - Real-time dual chart during recording (updates every point)

### Unit Preferences

Support both metric and imperial units based on user preference:
- Elevation: meters / feet
- Speed: km/h / mph
- Distance: km / miles

## Background Tracking

### Service Worker Integration

The PWA already has service worker support via `next-pwa`. We'll extend it to:

1. Register for background sync
2. Cache GPS points in IndexedDB when offline
3. Sync points to server when connection restored

```javascript
// In service worker
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-track-points') {
    event.waitUntil(syncTrackPoints());
  }
});
```

### Permissions Required

- `geolocation` - For GPS access
- `background-sync` - For syncing when back online
- Notification permission (optional) - For tracking status updates

## Feed Integration

Shared tracks will appear in the feed alongside photos/videos. The feed API will be modified to:

1. Query both `user_media` and `user_tracks` (where `is_public = true`)
2. Union results ordered by `created_at`
3. Return track data with geometry for interactive map rendering

### Feed Item Types

```typescript
type FeedItem = {
  type: 'media' | 'track';
  id: string;
  user_id: string;
  created_at: string;
  // ... type-specific fields
};
```

## Security Considerations

1. **Pro-only access** - All tracking endpoints check `is_pro` status
2. **RLS policies** - Users can only access their own tracks (unless shared)
3. **Rate limiting** - Limit point uploads to prevent abuse
4. **Data validation** - Validate GPS coordinates are within reasonable bounds
5. **Privacy** - Tracks are private by default, explicit share action required

## Implementation Phases

### Phase 1: Database & API Foundation
- Create database migration for tracks tables
- Implement basic CRUD API endpoints
- Add pro-user validation middleware

### Phase 2: Core Tracking UI
- Create TrackingProvider context
- Implement useGeolocation hook
- Build LiveTrackMap component
- Create TrackingControls component

### Phase 3: Background Tracking
- Extend service worker for background sync
- Implement IndexedDB caching
- Add offline support for point recording

### Phase 4: Track Management
- Build my-tracks page
- Create TrackCard component
- Implement track detail page with TrackDetailMap

### Phase 5: Social Features
- Add track sharing functionality
- Integrate tracks into feed
- Implement likes and comments for tracks

### Phase 6: Polish & Optimization
- Add activity auto-detection
- Optimize map rendering for long tracks
- Add track statistics and analytics
- Performance testing and optimization

## File Structure Summary

```
supabase/migrations/
  20240101000043_user_tracks.sql

lib/
  tracking/
    tracking-client.js        # Client-side tracking utilities
    activity-detection.js     # Speed-based activity detection
    track-stats.js            # Calculate track statistics

hooks/
  useGeolocation.js
  useTracking.js
  useBackgroundTracking.js

components/tracking/
  TrackingProvider.jsx
  TrackingControls.jsx
  LiveTrackMap.jsx
  TrackStats.jsx
  ActivityIndicator.jsx
  TrackCard.jsx
  TrackDetailMap.jsx
  TrackShareModal.jsx
  ParkTrailSelector.jsx

app/
  tracking/
    page.jsx
    TrackingClient.jsx
    [id]/
      page.jsx
      TrackDetailClient.jsx
  my-tracks/
    page.jsx
    MyTracksClient.jsx
  api/tracks/
    route.js
    [id]/
      route.js
      points/
        route.js
      share/
        route.js
      likes/
        route.js
      comments/
        route.js
        [commentId]/
          route.js
```

## Dependencies

No new dependencies required. The project already has:
- `react-leaflet` for maps
- `@supabase/supabase-js` for database
- `next-pwa` for service worker support

## Testing Considerations

1. Mock geolocation API for unit tests
2. Test activity detection with various speed profiles
3. Test offline/online sync scenarios
4. Test RLS policies for track access
5. Performance test with tracks containing 10,000+ points
