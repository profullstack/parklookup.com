/**
 * Static Map Generator
 * Generates static map images by compositing OpenStreetMap tiles
 *
 * Uses sharp for image processing (has prebuilt binaries for most platforms)
 */

import sharp from 'sharp';

// OSM tile server
const TILE_SERVER = 'https://tile.openstreetmap.org';
const TILE_SIZE = 256;

/**
 * Convert latitude/longitude to tile coordinates
 * @param {number} lat - Latitude
 * @param {number} lng - Longitude
 * @param {number} zoom - Zoom level
 * @returns {{x: number, y: number}} Tile coordinates
 */
const latLngToTile = (lat, lng, zoom) => {
  const n = Math.pow(2, zoom);
  const x = Math.floor(((lng + 180) / 360) * n);
  const latRad = (lat * Math.PI) / 180;
  const y = Math.floor(((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n);
  return { x, y };
};

/**
 * Convert latitude/longitude to pixel coordinates within a tile
 * @param {number} lat - Latitude
 * @param {number} lng - Longitude
 * @param {number} zoom - Zoom level
 * @returns {{x: number, y: number}} Pixel coordinates
 */
const latLngToPixel = (lat, lng, zoom) => {
  const n = Math.pow(2, zoom);
  const x = ((lng + 180) / 360) * n * TILE_SIZE;
  const latRad = (lat * Math.PI) / 180;
  const y = ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n * TILE_SIZE;
  return { x, y };
};

/**
 * Calculate zoom level to fit bounds
 * @param {number} minLat - Minimum latitude
 * @param {number} maxLat - Maximum latitude
 * @param {number} minLng - Minimum longitude
 * @param {number} maxLng - Maximum longitude
 * @param {number} width - Map width in pixels
 * @param {number} height - Map height in pixels
 * @returns {number} Zoom level
 */
const calculateZoom = (minLat, maxLat, minLng, maxLng, width, height) => {
  const latDiff = maxLat - minLat;
  const lngDiff = maxLng - minLng;

  // Calculate zoom for latitude
  const latZoom = Math.log2((height * 360) / (latDiff * TILE_SIZE * 2));

  // Calculate zoom for longitude
  const lngZoom = Math.log2((width * 360) / (lngDiff * TILE_SIZE));

  // Use the smaller zoom to ensure all points fit
  const zoom = Math.floor(Math.min(latZoom, lngZoom, 18));
  return Math.max(1, zoom);
};

/**
 * Fetch a tile image
 * @param {number} x - Tile X coordinate
 * @param {number} y - Tile Y coordinate
 * @param {number} zoom - Zoom level
 * @returns {Promise<Buffer|null>} Tile image buffer or null on error
 */
const fetchTile = async (x, y, zoom) => {
  const url = `${TILE_SERVER}/${zoom}/${x}/${y}.png`;
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'ParkLookup/1.0 (https://parklookup.com; contact@parklookup.com)',
      },
    });

    if (!response.ok) {
      console.warn(`Failed to fetch tile ${url}: ${response.status}`);
      return null;
    }

    const buffer = await response.arrayBuffer();
    return Buffer.from(buffer);
  } catch (error) {
    console.warn(`Error fetching tile ${url}:`, error.message);
    return null;
  }
};

/**
 * Create an SVG marker
 * @param {string} label - Marker label
 * @param {string} color - Marker color (hex)
 * @returns {string} SVG string
 */
const createMarkerSvg = (label, color) => {
  return `<svg width="28" height="28" xmlns="http://www.w3.org/2000/svg">
    <circle cx="14" cy="14" r="12" fill="${color}" stroke="white" stroke-width="2"/>
    <text x="14" y="18" text-anchor="middle" fill="white" font-family="Arial, sans-serif" font-size="11" font-weight="bold">${label}</text>
  </svg>`;
};

/**
 * Create an SVG route line
 * @param {Array<{x: number, y: number}>} points - Points in pixel coordinates
 * @param {number} width - Canvas width
 * @param {number} height - Canvas height
 * @param {boolean} dashed - Whether to use dashed line
 * @returns {string} SVG string
 */
const createRouteSvg = (points, width, height, dashed = false) => {
  if (points.length < 2) return '';

  const pathData = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
  const dashArray = dashed ? 'stroke-dasharray="10,5"' : '';

  return `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
    <path d="${pathData}" fill="none" stroke="#059669" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" ${dashArray}/>
  </svg>`;
};

/**
 * Create attribution SVG
 * @param {number} width - Canvas width
 * @param {number} height - Canvas height
 * @returns {string} SVG string
 */
const createAttributionSvg = (width, height) => {
  return `<svg width="${width}" height="20" xmlns="http://www.w3.org/2000/svg">
    <rect x="0" y="0" width="${width}" height="20" fill="rgba(255,255,255,0.8)"/>
    <text x="${width - 5}" y="14" text-anchor="end" fill="#666" font-family="Arial, sans-serif" font-size="10">© OpenStreetMap contributors</text>
  </svg>`;
};

/**
 * Generate a static map image
 * @param {Object} options - Map options
 * @param {Array<{lat: number, lng: number, label: string, isOrigin?: boolean}>} options.points - Points to display
 * @param {Array<[number, number]>} options.routeCoordinates - Route coordinates as [lat, lng] pairs
 * @param {number} options.width - Map width in pixels
 * @param {number} options.height - Map height in pixels
 * @returns {Promise<Buffer|null>} PNG image buffer or null on error
 */
export const generateStaticMap = async ({ points = [], routeCoordinates = [], width = 800, height = 400 }) => {
  if (points.length === 0) {
    return null;
  }

  try {
    // Calculate bounds
    const lats = points.map((p) => p.lat);
    const lngs = points.map((p) => p.lng);
    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);
    const minLng = Math.min(...lngs);
    const maxLng = Math.max(...lngs);

    // Add padding (15%)
    const latPadding = (maxLat - minLat) * 0.15 || 0.5;
    const lngPadding = (maxLng - minLng) * 0.15 || 0.5;

    const paddedMinLat = minLat - latPadding;
    const paddedMaxLat = maxLat + latPadding;
    const paddedMinLng = minLng - lngPadding;
    const paddedMaxLng = maxLng + lngPadding;

    // Calculate zoom level
    const zoom = calculateZoom(paddedMinLat, paddedMaxLat, paddedMinLng, paddedMaxLng, width, height);

    // Calculate center
    const centerLat = (paddedMinLat + paddedMaxLat) / 2;
    const centerLng = (paddedMinLng + paddedMaxLng) / 2;

    // Get center pixel coordinates
    const centerPixel = latLngToPixel(centerLat, centerLng, zoom);

    // Calculate tile range needed
    const topLeftPixel = {
      x: centerPixel.x - width / 2,
      y: centerPixel.y - height / 2,
    };

    const startTileX = Math.floor(topLeftPixel.x / TILE_SIZE);
    const startTileY = Math.floor(topLeftPixel.y / TILE_SIZE);
    const endTileX = Math.ceil((topLeftPixel.x + width) / TILE_SIZE);
    const endTileY = Math.ceil((topLeftPixel.y + height) / TILE_SIZE);

    // Fetch tiles
    const tilePromises = [];
    for (let tileY = startTileY; tileY <= endTileY; tileY++) {
      for (let tileX = startTileX; tileX <= endTileX; tileX++) {
        tilePromises.push(
          fetchTile(tileX, tileY, zoom).then((buffer) => ({
            buffer,
            tileX,
            tileY,
          }))
        );
      }
    }

    const tiles = await Promise.all(tilePromises);

    // Create composite operations for tiles
    const compositeOps = [];

    for (const { buffer, tileX, tileY } of tiles) {
      if (buffer) {
        const drawX = Math.round(tileX * TILE_SIZE - topLeftPixel.x);
        const drawY = Math.round(tileY * TILE_SIZE - topLeftPixel.y);
        compositeOps.push({
          input: buffer,
          left: drawX,
          top: drawY,
        });
      }
    }

    // Create base image with gray background
    let image = sharp({
      create: {
        width,
        height,
        channels: 4,
        background: { r: 229, g: 231, b: 235, alpha: 1 }, // gray-200
      },
    });

    // Composite tiles
    if (compositeOps.length > 0) {
      image = image.composite(compositeOps);
    }

    // Convert to buffer for further compositing
    let imageBuffer = await image.png().toBuffer();

    // Add route line
    const hasRouteCoords = routeCoordinates && routeCoordinates.length > 1;
    if (hasRouteCoords || points.length > 1) {
      const routePoints = hasRouteCoords
        ? routeCoordinates.map(([lat, lng]) => {
            const pixel = latLngToPixel(lat, lng, zoom);
            return {
              x: Math.round(pixel.x - topLeftPixel.x),
              y: Math.round(pixel.y - topLeftPixel.y),
            };
          })
        : points.map((p) => {
            const pixel = latLngToPixel(p.lat, p.lng, zoom);
            return {
              x: Math.round(pixel.x - topLeftPixel.x),
              y: Math.round(pixel.y - topLeftPixel.y),
            };
          });

      const routeSvg = createRouteSvg(routePoints, width, height, !hasRouteCoords);
      if (routeSvg) {
        imageBuffer = await sharp(imageBuffer)
          .composite([{ input: Buffer.from(routeSvg), top: 0, left: 0 }])
          .png()
          .toBuffer();
      }
    }

    // Add markers
    const markerOps = [];
    for (const point of points) {
      const pixel = latLngToPixel(point.lat, point.lng, zoom);
      const x = Math.round(pixel.x - topLeftPixel.x - 14); // Center marker (28px wide)
      const y = Math.round(pixel.y - topLeftPixel.y - 14); // Center marker (28px tall)
      const color = point.isOrigin ? '#3B82F6' : '#059669';
      const markerSvg = createMarkerSvg(point.label, color);

      markerOps.push({
        input: Buffer.from(markerSvg),
        left: Math.max(0, Math.min(width - 28, x)),
        top: Math.max(0, Math.min(height - 28, y)),
      });
    }

    if (markerOps.length > 0) {
      imageBuffer = await sharp(imageBuffer).composite(markerOps).png().toBuffer();
    }

    // Add attribution
    const attributionSvg = createAttributionSvg(width, height);
    imageBuffer = await sharp(imageBuffer)
      .composite([{ input: Buffer.from(attributionSvg), top: height - 20, left: 0 }])
      .png()
      .toBuffer();

    return imageBuffer;
  } catch (error) {
    console.error('Error generating static map:', error);
    return null;
  }
};

export default {
  generateStaticMap,
};