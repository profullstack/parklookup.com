/**
 * Static Map Generator
 * Generates static map images by compositing OpenStreetMap tiles
 *
 * Uses node-canvas to stitch tiles together and draw markers/routes
 */

import { createCanvas, loadImage } from 'canvas';

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
 * @returns {Promise<Image|null>} Tile image or null on error
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
    return await loadImage(Buffer.from(buffer));
  } catch (error) {
    console.warn(`Error fetching tile ${url}:`, error.message);
    return null;
  }
};

/**
 * Draw a marker on the canvas
 * @param {CanvasRenderingContext2D} ctx - Canvas context
 * @param {number} x - X position
 * @param {number} y - Y position
 * @param {string} label - Marker label
 * @param {string} color - Marker color
 */
const drawMarker = (ctx, x, y, label, color) => {
  const radius = 14;

  // Draw circle
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, 2 * Math.PI);
  ctx.fillStyle = color;
  ctx.fill();
  ctx.strokeStyle = 'white';
  ctx.lineWidth = 2;
  ctx.stroke();

  // Draw label
  ctx.fillStyle = 'white';
  ctx.font = 'bold 12px Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, x, y);
};

/**
 * Draw a route line on the canvas
 * @param {CanvasRenderingContext2D} ctx - Canvas context
 * @param {Array<{x: number, y: number}>} points - Route points in pixel coordinates
 * @param {string} color - Line color
 * @param {boolean} dashed - Whether to use dashed line
 */
const drawRoute = (ctx, points, color = '#059669', dashed = false) => {
  if (points.length < 2) return;

  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);

  for (let i = 1; i < points.length; i++) {
    ctx.lineTo(points[i].x, points[i].y);
  }

  ctx.strokeStyle = color;
  ctx.lineWidth = 3;
  if (dashed) {
    ctx.setLineDash([10, 5]);
  } else {
    ctx.setLineDash([]);
  }
  ctx.stroke();
  ctx.setLineDash([]);
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

    // Add padding (10%)
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

    // Create canvas
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');

    // Fill background
    ctx.fillStyle = '#e5e7eb';
    ctx.fillRect(0, 0, width, height);

    // Fetch and draw tiles
    const tilePromises = [];
    for (let tileY = startTileY; tileY <= endTileY; tileY++) {
      for (let tileX = startTileX; tileX <= endTileX; tileX++) {
        tilePromises.push(
          fetchTile(tileX, tileY, zoom).then((img) => ({
            img,
            tileX,
            tileY,
          }))
        );
      }
    }

    const tiles = await Promise.all(tilePromises);

    // Draw tiles
    for (const { img, tileX, tileY } of tiles) {
      if (img) {
        const drawX = tileX * TILE_SIZE - topLeftPixel.x;
        const drawY = tileY * TILE_SIZE - topLeftPixel.y;
        ctx.drawImage(img, drawX, drawY, TILE_SIZE, TILE_SIZE);
      }
    }

    // Convert route coordinates to pixel positions
    if (routeCoordinates.length > 1) {
      const routePixels = routeCoordinates.map(([lat, lng]) => {
        const pixel = latLngToPixel(lat, lng, zoom);
        return {
          x: pixel.x - topLeftPixel.x,
          y: pixel.y - topLeftPixel.y,
        };
      });
      drawRoute(ctx, routePixels, '#059669', false);
    } else if (points.length > 1) {
      // Draw straight lines between points as fallback
      const pointPixels = points.map((p) => {
        const pixel = latLngToPixel(p.lat, p.lng, zoom);
        return {
          x: pixel.x - topLeftPixel.x,
          y: pixel.y - topLeftPixel.y,
        };
      });
      drawRoute(ctx, pointPixels, '#059669', true);
    }

    // Draw markers
    for (const point of points) {
      const pixel = latLngToPixel(point.lat, point.lng, zoom);
      const x = pixel.x - topLeftPixel.x;
      const y = pixel.y - topLeftPixel.y;
      const color = point.isOrigin ? '#3B82F6' : '#059669';
      drawMarker(ctx, x, y, point.label, color);
    }

    // Add attribution
    ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
    ctx.fillRect(width - 200, height - 20, 200, 20);
    ctx.fillStyle = '#666';
    ctx.font = '10px Arial, sans-serif';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'bottom';
    ctx.fillText('© OpenStreetMap contributors', width - 5, height - 5);

    // Return PNG buffer
    return canvas.toBuffer('image/png');
  } catch (error) {
    console.error('Error generating static map:', error);
    return null;
  }
};

export default {
  generateStaticMap,
};