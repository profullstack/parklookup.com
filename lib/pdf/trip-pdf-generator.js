/**
 * Trip PDF Generator
 * Generates PDF documents for trip plans using pdf-lib
 *
 * pdf-lib is used because:
 * - Works in both browser and Node.js environments
 * - Supports custom font embedding for Unicode characters
 * - Works well in serverless/edge environments like Vercel
 */

import { PDFDocument, rgb } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import { readFile } from 'fs/promises';
import { join } from 'path';

// PDF Configuration
const PAGE_WIDTH = 612; // Letter size width in points
const PAGE_HEIGHT = 792; // Letter size height in points
const MARGIN = 50;
const CONTENT_WIDTH = PAGE_WIDTH - 2 * MARGIN;

// Colors
const COLORS = {
  primary: rgb(0.133, 0.545, 0.133), // Forest green
  secondary: rgb(0.4, 0.4, 0.4),
  text: rgb(0.2, 0.2, 0.2),
  lightText: rgb(0.5, 0.5, 0.5),
  accent: rgb(0.8, 0.4, 0.0), // Orange for highlights
};

/**
 * Format date for display
 * @param {string} dateString - ISO date string
 * @returns {string} Formatted date
 */
const formatDate = (dateString) => {
  if (!dateString) return '';
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
};

/**
 * Format trip data for PDF generation
 * @param {Object} trip - Trip data from API
 * @returns {Object} Formatted trip data
 */
export const formatTripForPdf = (trip) => {
  return {
    title: trip.title || 'Trip Plan',
    origin: trip.origin || 'Unknown',
    startDate: formatDate(trip.startDate),
    endDate: formatDate(trip.endDate),
    difficulty: trip.difficulty || 'moderate',
    radiusMiles: trip.radiusMiles || 100,
    summary: trip.summary || '',
    stops: (trip.stops || []).map((stop) => ({
      dayNumber: stop.dayNumber,
      parkName: stop.park?.name || stop.parkCode || 'Unknown Park',
      parkDescription: stop.park?.description || '',
      activities: stop.activities || [],
      morningPlan: stop.morningPlan || '',
      afternoonPlan: stop.afternoonPlan || '',
      eveningPlan: stop.eveningPlan || '',
      drivingNotes: stop.drivingNotes || '',
      highlights: stop.highlights || '',
    })),
    packingList: trip.packingList || null,
    safetyNotes: trip.safetyNotes || [],
    bestPhotoSpots: trip.bestPhotoSpots || [],
    estimatedBudget: trip.estimatedBudget || null,
  };
};

/**
 * Load custom fonts for Unicode support
 * @param {Object} pdfDoc - PDF document
 * @returns {Promise<{regular: Object, bold: Object}>} Font objects
 */
const loadFonts = async (pdfDoc) => {
  // Register fontkit for custom font support
  pdfDoc.registerFontkit(fontkit);

  try {
    // Try to load custom fonts from the public directory
    const fontDir = join(process.cwd(), 'public', 'fonts');
    const regularFontBytes = await readFile(join(fontDir, 'NotoSans-Regular.ttf'));
    const boldFontBytes = await readFile(join(fontDir, 'NotoSans-Bold.ttf'));

    const regular = await pdfDoc.embedFont(regularFontBytes);
    const bold = await pdfDoc.embedFont(boldFontBytes);

    return { regular, bold, hasUnicode: true };
  } catch {
    // Fallback to standard fonts if custom fonts are not available
    console.warn('Custom fonts not found, falling back to standard fonts (no Unicode support)');
    const { StandardFonts } = await import('pdf-lib');
    const regular = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    return { regular, bold, hasUnicode: false };
  }
};

/**
 * Wrap text to fit within a given width
 * @param {string} text - Text to wrap
 * @param {Object} font - PDF font object
 * @param {number} fontSize - Font size
 * @param {number} maxWidth - Maximum width in points
 * @returns {string[]} Array of lines
 */
const wrapText = (text, font, fontSize, maxWidth) => {
  if (!text) return [];

  const words = text.split(' ');
  const lines = [];
  let currentLine = '';

  for (const word of words) {
    const testLine = currentLine ? `${currentLine} ${word}` : word;
    const width = font.widthOfTextAtSize(testLine, fontSize);

    if (width > maxWidth && currentLine) {
      lines.push(currentLine);
      currentLine = word;
    } else {
      currentLine = testLine;
    }
  }

  if (currentLine) {
    lines.push(currentLine);
  }

  return lines;
};

/**
 * Draw text with automatic wrapping and return new Y position
 * @param {Object} page - PDF page
 * @param {string} text - Text to draw
 * @param {Object} options - Drawing options
 * @returns {number} New Y position after drawing
 */
const drawWrappedText = (page, text, { x, y, font, fontSize, color, maxWidth, lineHeight }) => {
  const lines = wrapText(text, font, fontSize, maxWidth);
  let currentY = y;

  for (const line of lines) {
    page.drawText(line, {
      x,
      y: currentY,
      size: fontSize,
      font,
      color,
    });
    currentY -= lineHeight;
  }

  return currentY;
};

/**
 * Add a new page if needed
 * @param {Object} pdfDoc - PDF document
 * @param {Object} currentPage - Current page
 * @param {number} y - Current Y position
 * @param {number} minSpace - Minimum space needed
 * @param {Object} fonts - Font objects
 * @returns {Object} { page, y } - Current or new page and Y position
 */
const ensureSpace = async (pdfDoc, currentPage, y, minSpace, fonts) => {
  if (y < MARGIN + minSpace) {
    const newPage = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    return { page: newPage, y: PAGE_HEIGHT - MARGIN };
  }
  return { page: currentPage, y };
};

/**
 * Generate PDF buffer for a trip
 * @param {Object} trip - Trip data
 * @returns {Promise<{buffer: Buffer, filename: string}>} PDF buffer and filename
 */
export const generateTripPdf = async (trip) => {
  const data = formatTripForPdf(trip);

  // Create PDF document
  const pdfDoc = await PDFDocument.create();

  // Load fonts (with Unicode support if available)
  const fonts = await loadFonts(pdfDoc);
  const { regular: helvetica, bold: helveticaBold, hasUnicode } = fonts;

  // Unicode symbols (fallback to ASCII if no Unicode support)
  const symbols = hasUnicode
    ? { checkbox: '☐', pin: '📍', bullet: '•' }
    : { checkbox: '[ ]', pin: '*', bullet: '-' };

  // Add first page
  let page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  let y = PAGE_HEIGHT - MARGIN;

  // Title
  page.drawText(data.title, {
    x: MARGIN,
    y,
    size: 24,
    font: helveticaBold,
    color: COLORS.primary,
  });
  y -= 35;

  // Trip details - use bullet instead of special character
  const detailsText = `${data.origin} - ${data.startDate} to ${data.endDate}`;
  page.drawText(detailsText, {
    x: MARGIN,
    y,
    size: 11,
    font: helvetica,
    color: COLORS.secondary,
  });
  y -= 20;

  // Tags line
  const tagsText = `${data.difficulty.charAt(0).toUpperCase() + data.difficulty.slice(1)} | ${data.radiusMiles} mile radius | ${data.stops.length} park${data.stops.length !== 1 ? 's' : ''}`;
  page.drawText(tagsText, {
    x: MARGIN,
    y,
    size: 10,
    font: helvetica,
    color: COLORS.lightText,
  });
  y -= 25;

  // Summary
  if (data.summary) {
    y = drawWrappedText(page, data.summary, {
      x: MARGIN,
      y,
      font: helvetica,
      fontSize: 11,
      color: COLORS.text,
      maxWidth: CONTENT_WIDTH,
      lineHeight: 16,
    });
    y -= 20;
  }

  // Horizontal line
  page.drawLine({
    start: { x: MARGIN, y },
    end: { x: PAGE_WIDTH - MARGIN, y },
    thickness: 1,
    color: rgb(0.85, 0.85, 0.85),
  });
  y -= 25;

  // Day-by-Day Itinerary
  page.drawText('Day-by-Day Itinerary', {
    x: MARGIN,
    y,
    size: 16,
    font: helveticaBold,
    color: COLORS.primary,
  });
  y -= 25;

  // Stops
  for (const stop of data.stops) {
    // Check if we need a new page
    ({ page, y } = await ensureSpace(pdfDoc, page, y, 150, fonts));

    // Day header
    page.drawText(`Day ${stop.dayNumber}: ${stop.parkName}`, {
      x: MARGIN,
      y,
      size: 14,
      font: helveticaBold,
      color: COLORS.text,
    });
    y -= 20;

    // Driving notes
    if (stop.drivingNotes) {
      page.drawText('Getting There:', {
        x: MARGIN,
        y,
        size: 10,
        font: helveticaBold,
        color: COLORS.secondary,
      });
      y -= 14;
      y = drawWrappedText(page, stop.drivingNotes, {
        x: MARGIN,
        y,
        font: helvetica,
        fontSize: 10,
        color: COLORS.text,
        maxWidth: CONTENT_WIDTH,
        lineHeight: 14,
      });
      y -= 10;
    }

    // Highlights
    if (stop.highlights) {
      ({ page, y } = await ensureSpace(pdfDoc, page, y, 50, fonts));
      page.drawText('Highlights:', {
        x: MARGIN,
        y,
        size: 10,
        font: helveticaBold,
        color: COLORS.accent,
      });
      y -= 14;
      y = drawWrappedText(page, stop.highlights, {
        x: MARGIN,
        y,
        font: helvetica,
        fontSize: 10,
        color: COLORS.text,
        maxWidth: CONTENT_WIDTH,
        lineHeight: 14,
      });
      y -= 10;
    }

    // Schedule
    const scheduleItems = [
      { label: 'Morning', value: stop.morningPlan },
      { label: 'Afternoon', value: stop.afternoonPlan },
      { label: 'Evening', value: stop.eveningPlan },
    ].filter((item) => item.value);

    if (scheduleItems.length > 0) {
      ({ page, y } = await ensureSpace(pdfDoc, page, y, 60, fonts));
      page.drawText('Schedule:', {
        x: MARGIN,
        y,
        size: 10,
        font: helveticaBold,
        color: COLORS.secondary,
      });
      y -= 14;

      for (const item of scheduleItems) {
        ({ page, y } = await ensureSpace(pdfDoc, page, y, 30, fonts));
        page.drawText(`${item.label}:`, {
          x: MARGIN + 10,
          y,
          size: 9,
          font: helveticaBold,
          color: COLORS.lightText,
        });
        y = drawWrappedText(page, item.value, {
          x: MARGIN + 70,
          y,
          font: helvetica,
          fontSize: 9,
          color: COLORS.text,
          maxWidth: CONTENT_WIDTH - 70,
          lineHeight: 13,
        });
        y -= 5;
      }
    }

    // Activities
    if (stop.activities && stop.activities.length > 0) {
      ({ page, y } = await ensureSpace(pdfDoc, page, y, 30, fonts));
      const activitiesText = `Activities: ${stop.activities.join(', ')}`;
      y = drawWrappedText(page, activitiesText, {
        x: MARGIN,
        y,
        font: helvetica,
        fontSize: 9,
        color: COLORS.lightText,
        maxWidth: CONTENT_WIDTH,
        lineHeight: 13,
      });
    }

    y -= 20;
  }

  // Packing List
  if (data.packingList) {
    ({ page, y } = await ensureSpace(pdfDoc, page, y, 100, fonts));

    page.drawText('Packing List', {
      x: MARGIN,
      y,
      size: 14,
      font: helveticaBold,
      color: COLORS.primary,
    });
    y -= 20;

    const categories = [
      { key: 'essentials', label: 'Essentials' },
      { key: 'clothing', label: 'Clothing' },
      { key: 'gear', label: 'Gear' },
      { key: 'optional', label: 'Optional' },
    ];

    for (const cat of categories) {
      const items = data.packingList[cat.key];
      if (items && items.length > 0) {
        ({ page, y } = await ensureSpace(pdfDoc, page, y, 40, fonts));
        page.drawText(`${cat.label}:`, {
          x: MARGIN,
          y,
          size: 10,
          font: helveticaBold,
          color: COLORS.secondary,
        });
        y -= 14;

        for (const item of items) {
          ({ page, y } = await ensureSpace(pdfDoc, page, y, 15, fonts));
          page.drawText(`${symbols.checkbox} ${item}`, {
            x: MARGIN + 10,
            y,
            size: 9,
            font: helvetica,
            color: COLORS.text,
          });
          y -= 13;
        }
        y -= 5;
      }
    }
    y -= 10;
  }

  // Safety Notes
  if (data.safetyNotes && data.safetyNotes.length > 0) {
    ({ page, y } = await ensureSpace(pdfDoc, page, y, 80, fonts));

    page.drawText('Safety Notes', {
      x: MARGIN,
      y,
      size: 14,
      font: helveticaBold,
      color: COLORS.accent,
    });
    y -= 20;

    for (const note of data.safetyNotes) {
      ({ page, y } = await ensureSpace(pdfDoc, page, y, 20, fonts));
      y = drawWrappedText(page, `${symbols.bullet} ${note}`, {
        x: MARGIN,
        y,
        font: helvetica,
        fontSize: 10,
        color: COLORS.text,
        maxWidth: CONTENT_WIDTH,
        lineHeight: 14,
      });
      y -= 5;
    }
    y -= 10;
  }

  // Best Photo Spots
  if (data.bestPhotoSpots && data.bestPhotoSpots.length > 0) {
    ({ page, y } = await ensureSpace(pdfDoc, page, y, 80, fonts));

    page.drawText('Best Photo Spots', {
      x: MARGIN,
      y,
      size: 14,
      font: helveticaBold,
      color: COLORS.primary,
    });
    y -= 20;

    for (const spot of data.bestPhotoSpots) {
      ({ page, y } = await ensureSpace(pdfDoc, page, y, 20, fonts));
      y = drawWrappedText(page, `${symbols.pin} ${spot}`, {
        x: MARGIN,
        y,
        font: helvetica,
        fontSize: 10,
        color: COLORS.text,
        maxWidth: CONTENT_WIDTH,
        lineHeight: 14,
      });
      y -= 5;
    }
    y -= 10;
  }

  // Budget
  if (data.estimatedBudget) {
    ({ page, y } = await ensureSpace(pdfDoc, page, y, 80, fonts));

    page.drawText('Estimated Budget', {
      x: MARGIN,
      y,
      size: 14,
      font: helveticaBold,
      color: COLORS.primary,
    });
    y -= 20;

    const budgetItems = [
      { label: 'Entrance Fees', value: data.estimatedBudget.entrance_fees },
      { label: 'Fuel Estimate', value: data.estimatedBudget.fuel_estimate },
      { label: 'Total Range', value: data.estimatedBudget.total_range },
    ].filter((item) => item.value);

    for (const item of budgetItems) {
      page.drawText(`${item.label}: ${item.value}`, {
        x: MARGIN,
        y,
        size: 10,
        font: helvetica,
        color: COLORS.text,
      });
      y -= 15;
    }
  }

  // Footer on last page
  const pageCount = pdfDoc.getPageCount();
  const lastPage = pdfDoc.getPage(pageCount - 1);
  lastPage.drawText(`Generated by ParkLookup.com - ${new Date().toLocaleDateString()}`, {
    x: MARGIN,
    y: 30,
    size: 8,
    font: helvetica,
    color: COLORS.lightText,
  });

  // Generate PDF bytes
  const pdfBytes = await pdfDoc.save();

  // Generate filename
  const safeTitle = (data.title || 'trip')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  const filename = `${safeTitle}-${new Date().toISOString().split('T')[0]}.pdf`;

  return {
    buffer: Buffer.from(pdfBytes),
    filename,
  };
};

export default {
  formatTripForPdf,
  generateTripPdf,
};