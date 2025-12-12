/**
 * Trip PDF Generator
 * Generates PDF documents for travel plans (Pro feature)
 */

import PDFDocument from 'pdfkit';

// Color palette
const COLORS = {
  primary: '#16a34a', // green-600
  secondary: '#059669', // emerald-600
  text: '#1f2937', // gray-800
  textLight: '#6b7280', // gray-500
  accent: '#f59e0b', // amber-500
  danger: '#dc2626', // red-600
  background: '#f9fafb', // gray-50
};

// Font sizes
const FONT_SIZES = {
  title: 24,
  subtitle: 18,
  heading: 14,
  body: 11,
  small: 9,
};

/**
 * Format a date string for display
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
 * Format a date range for display
 * @param {string} startDate - Start date ISO string
 * @param {string} endDate - End date ISO string
 * @returns {string} Formatted date range
 */
const formatDateRange = (startDate, endDate) => {
  if (!startDate || !endDate) return '';

  const start = new Date(startDate);
  const end = new Date(endDate);

  const startMonth = start.toLocaleDateString('en-US', { month: 'long' });
  const endMonth = end.toLocaleDateString('en-US', { month: 'long' });
  const year = start.getFullYear();

  if (startMonth === endMonth) {
    return `${startMonth} ${start.getDate()} - ${end.getDate()}, ${year}`;
  }

  return `${startMonth} ${start.getDate()} - ${endMonth} ${end.getDate()}, ${year}`;
};

/**
 * Calculate trip duration in days
 * @param {string} startDate - Start date ISO string
 * @param {string} endDate - End date ISO string
 * @returns {number} Number of days
 */
const calculateDuration = (startDate, endDate) => {
  if (!startDate || !endDate) return 0;

  const start = new Date(startDate);
  const end = new Date(endDate);
  const diffTime = Math.abs(end - start);
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;

  return diffDays;
};

/**
 * Generate a URL-friendly slug from a string
 * @param {string} text - Text to slugify
 * @returns {string} Slugified text
 */
const slugify = (text) => {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim();
};

/**
 * Format trip data for PDF generation
 * @param {Object} trip - Raw trip data
 * @returns {Object} Formatted trip data
 */
export const formatTripForPdf = (trip) => {
  const duration = calculateDuration(trip.startDate, trip.endDate);

  return {
    title: trip.title || 'Untitled Trip',
    origin: trip.origin || '',
    dateRange: formatDateRange(trip.startDate, trip.endDate),
    duration: `${duration} day${duration !== 1 ? 's' : ''}`,
    difficulty: trip.difficulty || null,
    radiusMiles: trip.radiusMiles || null,
    summary: trip.summary || null,
    interests: trip.interests || [],
    packingList: trip.packingList || null,
    safetyNotes: trip.safetyNotes || [],
    bestPhotoSpots: trip.bestPhotoSpots || [],
    estimatedBudget: trip.estimatedBudget || null,
    stops: (trip.stops || []).map((stop) => ({
      dayNumber: stop.dayNumber,
      parkName: stop.park?.name || stop.parkCode || 'Unknown Park',
      parkDescription: stop.park?.description || '',
      designation: stop.park?.designation || '',
      states: stop.park?.states || '',
      activities: stop.activities || [],
      schedule: {
        morning: stop.morningPlan || null,
        afternoon: stop.afternoonPlan || null,
        evening: stop.eveningPlan || null,
      },
      drivingNotes: stop.drivingNotes || null,
      highlights: stop.highlights || null,
    })),
  };
};

/**
 * Add a section header to the PDF
 * @param {PDFDocument} doc - PDF document
 * @param {string} title - Section title
 * @param {string} emoji - Emoji icon
 */
const addSectionHeader = (doc, title, emoji = '') => {
  doc.moveDown(0.5);
  doc
    .fontSize(FONT_SIZES.heading)
    .fillColor(COLORS.primary)
    .font('Helvetica-Bold')
    .text(`${emoji} ${title}`.trim(), { continued: false });
  doc.moveDown(0.3);
  doc.fillColor(COLORS.text).font('Helvetica');
};

/**
 * Add a bullet list to the PDF
 * @param {PDFDocument} doc - PDF document
 * @param {string[]} items - List items
 */
const addBulletList = (doc, items) => {
  doc.fontSize(FONT_SIZES.body).fillColor(COLORS.text).font('Helvetica');

  items.forEach((item) => {
    doc.text(`• ${item}`, { indent: 10 });
  });
};

/**
 * Check if we need a new page
 * @param {PDFDocument} doc - PDF document
 * @param {number} requiredSpace - Required space in points
 */
const checkPageBreak = (doc, requiredSpace = 100) => {
  const bottomMargin = 50;
  const availableSpace = doc.page.height - doc.y - bottomMargin;

  if (availableSpace < requiredSpace) {
    doc.addPage();
  }
};

/**
 * Generate PDF document for a trip
 * @param {Object} trip - Trip data
 * @returns {Promise<{buffer: Buffer, filename: string}>} PDF buffer and filename
 */
export const generateTripPdf = async (trip) => {
  // Validate trip data
  if (!trip || typeof trip !== 'object' || !trip.title) {
    throw new Error('Invalid trip data');
  }

  const formattedTrip = formatTripForPdf(trip);
  const filename = `${slugify(formattedTrip.title)}-trip-plan.pdf`;

  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: 'LETTER',
        margins: { top: 50, bottom: 50, left: 50, right: 50 },
        info: {
          Title: formattedTrip.title,
          Author: 'ParkLookup.com',
          Subject: 'Travel Plan',
          Creator: 'ParkLookup Trip Planner',
        },
      });

      const chunks = [];

      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => {
        const buffer = Buffer.concat(chunks);
        resolve({ buffer, filename });
      });
      doc.on('error', reject);

      // === HEADER ===
      doc
        .fontSize(FONT_SIZES.title)
        .fillColor(COLORS.primary)
        .font('Helvetica-Bold')
        .text(formattedTrip.title, { align: 'center' });

      doc.moveDown(0.5);

      // Trip metadata
      doc
        .fontSize(FONT_SIZES.body)
        .fillColor(COLORS.textLight)
        .font('Helvetica')
        .text(`📍 Starting from ${formattedTrip.origin}`, { align: 'center' })
        .text(`📅 ${formattedTrip.dateRange} (${formattedTrip.duration})`, {
          align: 'center',
        });

      if (formattedTrip.difficulty || formattedTrip.radiusMiles) {
        const meta = [];
        if (formattedTrip.difficulty) {
          meta.push(`Difficulty: ${formattedTrip.difficulty}`);
        }
        if (formattedTrip.radiusMiles) {
          meta.push(`${formattedTrip.radiusMiles} mile radius`);
        }
        doc.text(meta.join(' • '), { align: 'center' });
      }

      doc.moveDown(1);

      // === SUMMARY ===
      if (formattedTrip.summary) {
        doc
          .fontSize(FONT_SIZES.body)
          .fillColor(COLORS.text)
          .font('Helvetica')
          .text(formattedTrip.summary, { align: 'justify' });
        doc.moveDown(1);
      }

      // === INTERESTS ===
      if (formattedTrip.interests.length > 0) {
        doc
          .fontSize(FONT_SIZES.small)
          .fillColor(COLORS.textLight)
          .text(`Interests: ${formattedTrip.interests.join(', ')}`);
        doc.moveDown(1);
      }

      // === DAY-BY-DAY ITINERARY ===
      if (formattedTrip.stops.length > 0) {
        addSectionHeader(doc, 'Day-by-Day Itinerary', '📅');

        formattedTrip.stops.forEach((stop, index) => {
          checkPageBreak(doc, 150);

          // Day header
          doc
            .fontSize(FONT_SIZES.subtitle)
            .fillColor(COLORS.secondary)
            .font('Helvetica-Bold')
            .text(`Day ${stop.dayNumber}: ${stop.parkName}`);

          if (stop.designation) {
            doc
              .fontSize(FONT_SIZES.small)
              .fillColor(COLORS.textLight)
              .font('Helvetica')
              .text(stop.designation);
          }

          doc.moveDown(0.3);

          // Driving notes
          if (stop.drivingNotes) {
            doc
              .fontSize(FONT_SIZES.body)
              .fillColor(COLORS.text)
              .font('Helvetica-Bold')
              .text('🚗 Getting There: ', { continued: true })
              .font('Helvetica')
              .text(stop.drivingNotes);
          }

          // Highlights
          if (stop.highlights) {
            doc
              .fontSize(FONT_SIZES.body)
              .fillColor(COLORS.text)
              .font('Helvetica-Bold')
              .text('⭐ Highlights: ', { continued: true })
              .font('Helvetica')
              .text(stop.highlights);
          }

          // Schedule
          doc.moveDown(0.3);
          doc
            .fontSize(FONT_SIZES.body)
            .fillColor(COLORS.text)
            .font('Helvetica-Bold')
            .text('Schedule:');

          if (stop.schedule.morning) {
            doc
              .font('Helvetica-Bold')
              .text('  Morning: ', { continued: true })
              .font('Helvetica')
              .text(stop.schedule.morning);
          }
          if (stop.schedule.afternoon) {
            doc
              .font('Helvetica-Bold')
              .text('  Afternoon: ', { continued: true })
              .font('Helvetica')
              .text(stop.schedule.afternoon);
          }
          if (stop.schedule.evening) {
            doc
              .font('Helvetica-Bold')
              .text('  Evening: ', { continued: true })
              .font('Helvetica')
              .text(stop.schedule.evening);
          }

          // Activities
          if (stop.activities.length > 0) {
            doc.moveDown(0.3);
            doc
              .fontSize(FONT_SIZES.small)
              .fillColor(COLORS.textLight)
              .text(`Activities: ${stop.activities.join(', ')}`);
          }

          if (index < formattedTrip.stops.length - 1) {
            doc.moveDown(1);
          }
        });
      }

      // === PACKING LIST ===
      if (formattedTrip.packingList) {
        checkPageBreak(doc, 150);
        addSectionHeader(doc, 'Packing List', '📦');

        const sections = [
          { key: 'essentials', label: 'Essentials', icon: '✅' },
          { key: 'clothing', label: 'Clothing', icon: '👕' },
          { key: 'gear', label: 'Gear', icon: '🎒' },
          { key: 'optional', label: 'Optional', icon: '💡' },
        ];

        sections.forEach((section) => {
          const items = formattedTrip.packingList[section.key];
          if (items && items.length > 0) {
            doc
              .fontSize(FONT_SIZES.body)
              .fillColor(COLORS.text)
              .font('Helvetica-Bold')
              .text(`${section.icon} ${section.label}:`);
            addBulletList(doc, items);
            doc.moveDown(0.3);
          }
        });
      }

      // === SAFETY NOTES ===
      if (formattedTrip.safetyNotes.length > 0) {
        checkPageBreak(doc, 100);
        addSectionHeader(doc, 'Safety Notes', '⚠️');
        addBulletList(doc, formattedTrip.safetyNotes);
      }

      // === PHOTO SPOTS ===
      if (formattedTrip.bestPhotoSpots.length > 0) {
        checkPageBreak(doc, 100);
        addSectionHeader(doc, 'Best Photo Spots', '📷');
        addBulletList(doc, formattedTrip.bestPhotoSpots);
      }

      // === BUDGET ===
      if (formattedTrip.estimatedBudget) {
        checkPageBreak(doc, 100);
        addSectionHeader(doc, 'Estimated Budget', '💰');

        const budget = formattedTrip.estimatedBudget;
        doc.fontSize(FONT_SIZES.body).fillColor(COLORS.text).font('Helvetica');

        if (budget.entrance_fees) {
          doc.text(`Entrance Fees: ${budget.entrance_fees}`);
        }
        if (budget.fuel_estimate) {
          doc.text(`Fuel Estimate: ${budget.fuel_estimate}`);
        }
        if (budget.total_range) {
          doc.font('Helvetica-Bold').text(`Total Range: ${budget.total_range}`);
        }
      }

      // === FOOTER ===
      doc.moveDown(2);
      doc
        .fontSize(FONT_SIZES.small)
        .fillColor(COLORS.textLight)
        .font('Helvetica')
        .text('Generated by ParkLookup.com - Your National Parks Trip Planner', {
          align: 'center',
        })
        .text(`Generated on ${new Date().toLocaleDateString('en-US')}`, {
          align: 'center',
        });

      doc.end();
    } catch (error) {
      reject(error);
    }
  });
};

export default { generateTripPdf, formatTripForPdf };