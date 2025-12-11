/**
 * Tests for WeatherAlerts Component
 * Using Vitest for testing
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';

// Sample alert data for testing
const mockAlertsResponse = {
  features: [
    {
      id: 'alert-1',
      properties: {
        event: 'Winter Storm Warning',
        headline: 'Winter Storm Warning in effect from Friday evening to Saturday afternoon',
        severity: 'Severe',
        certainty: 'Likely',
        effective: '2024-01-15T18:00:00-05:00',
        expires: '2024-01-16T15:00:00-05:00',
        description: 'Heavy snow expected. Total snow accumulations of 8 to 12 inches.',
        instruction: 'Travel should be restricted to emergencies only.',
        senderName: 'NWS State College PA',
      },
    },
    {
      id: 'alert-2',
      properties: {
        event: 'Wind Advisory',
        headline: 'Wind Advisory in effect until 6 PM EST this evening',
        severity: 'Moderate',
        certainty: 'Observed',
        effective: '2024-01-15T06:00:00-05:00',
        expires: '2024-01-15T18:00:00-05:00',
        description: 'Southwest winds 25 to 35 mph with gusts up to 50 mph.',
        instruction: 'Secure outdoor objects.',
        senderName: 'NWS Philadelphia PA',
      },
    },
  ],
};

const mockEmptyAlertsResponse = {
  features: [],
};

describe('WeatherAlerts Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetModules();
  });

  describe('Loading state', () => {
    it('should show loading skeleton while fetching alerts', async () => {
      // Mock fetch to never resolve
      global.fetch = vi.fn(() => new Promise(() => {}));

      const WeatherAlerts = (await import('@/components/weather/WeatherAlerts')).default;

      render(<WeatherAlerts latitude={38.9807} longitude={-76.9373} />);

      // Should show loading animation
      expect(document.querySelector('.animate-pulse')).toBeInTheDocument();
    });
  });

  describe('No coordinates', () => {
    it('should show message when latitude is missing', async () => {
      const WeatherAlerts = (await import('@/components/weather/WeatherAlerts')).default;

      render(<WeatherAlerts latitude={null} longitude={-76.9373} />);

      expect(
        screen.getByText('Location coordinates not available for weather alerts')
      ).toBeInTheDocument();
    });

    it('should show message when longitude is missing', async () => {
      const WeatherAlerts = (await import('@/components/weather/WeatherAlerts')).default;

      render(<WeatherAlerts latitude={38.9807} longitude={null} />);

      expect(
        screen.getByText('Location coordinates not available for weather alerts')
      ).toBeInTheDocument();
    });

    it('should show message when both coordinates are missing', async () => {
      const WeatherAlerts = (await import('@/components/weather/WeatherAlerts')).default;

      render(<WeatherAlerts />);

      expect(
        screen.getByText('Location coordinates not available for weather alerts')
      ).toBeInTheDocument();
    });
  });

  describe('No active alerts', () => {
    it('should show "No Active Weather Alerts" message when no alerts exist', async () => {
      global.fetch = vi.fn(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockEmptyAlertsResponse),
        })
      );

      const WeatherAlerts = (await import('@/components/weather/WeatherAlerts')).default;

      render(<WeatherAlerts latitude={38.9807} longitude={-76.9373} />);

      await waitFor(() => {
        expect(screen.getByText('No Active Weather Alerts')).toBeInTheDocument();
      });
    });

    it('should display park name in no alerts message when provided', async () => {
      global.fetch = vi.fn(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockEmptyAlertsResponse),
        })
      );

      const WeatherAlerts = (await import('@/components/weather/WeatherAlerts')).default;

      render(
        <WeatherAlerts latitude={38.9807} longitude={-76.9373} parkName="Yosemite National Park" />
      );

      await waitFor(() => {
        expect(
          screen.getByText(/Yosemite National Park currently has no active weather alerts/)
        ).toBeInTheDocument();
      });
    });
  });

  describe('Displaying alerts', () => {
    beforeEach(() => {
      global.fetch = vi.fn(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockAlertsResponse),
        })
      );
    });

    it('should display alert count', async () => {
      const WeatherAlerts = (await import('@/components/weather/WeatherAlerts')).default;

      render(<WeatherAlerts latitude={38.9807} longitude={-76.9373} />);

      await waitFor(() => {
        expect(screen.getByText('2 active alerts for this area')).toBeInTheDocument();
      });
    });

    it('should display singular "alert" for single alert', async () => {
      global.fetch = vi.fn(() =>
        Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              features: [mockAlertsResponse.features[0]],
            }),
        })
      );

      const WeatherAlerts = (await import('@/components/weather/WeatherAlerts')).default;

      render(<WeatherAlerts latitude={38.9807} longitude={-76.9373} />);

      await waitFor(() => {
        expect(screen.getByText('1 active alert for this area')).toBeInTheDocument();
      });
    });

    it('should display alert event names', async () => {
      const WeatherAlerts = (await import('@/components/weather/WeatherAlerts')).default;

      render(<WeatherAlerts latitude={38.9807} longitude={-76.9373} />);

      await waitFor(() => {
        expect(screen.getByText('Winter Storm Warning')).toBeInTheDocument();
        expect(screen.getByText('Wind Advisory')).toBeInTheDocument();
      });
    });

    it('should display alert headlines', async () => {
      const WeatherAlerts = (await import('@/components/weather/WeatherAlerts')).default;

      render(<WeatherAlerts latitude={38.9807} longitude={-76.9373} />);

      await waitFor(() => {
        expect(
          screen.getByText(
            'Winter Storm Warning in effect from Friday evening to Saturday afternoon'
          )
        ).toBeInTheDocument();
      });
    });

    it('should display severity badges', async () => {
      const WeatherAlerts = (await import('@/components/weather/WeatherAlerts')).default;

      render(<WeatherAlerts latitude={38.9807} longitude={-76.9373} />);

      await waitFor(() => {
        expect(screen.getByText('Severe')).toBeInTheDocument();
        expect(screen.getByText('Moderate')).toBeInTheDocument();
      });
    });

    it('should display certainty information', async () => {
      const WeatherAlerts = (await import('@/components/weather/WeatherAlerts')).default;

      render(<WeatherAlerts latitude={38.9807} longitude={-76.9373} />);

      await waitFor(() => {
        expect(screen.getByText('Likely certainty')).toBeInTheDocument();
        expect(screen.getByText('Observed certainty')).toBeInTheDocument();
      });
    });
  });

  describe('Expandable alerts', () => {
    beforeEach(() => {
      global.fetch = vi.fn(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockAlertsResponse),
        })
      );
    });

    it('should expand alert to show description when clicked', async () => {
      const WeatherAlerts = (await import('@/components/weather/WeatherAlerts')).default;
      const user = userEvent.setup();

      render(<WeatherAlerts latitude={38.9807} longitude={-76.9373} />);

      await waitFor(() => {
        expect(screen.getByText('Winter Storm Warning')).toBeInTheDocument();
      });

      // Description should not be visible initially
      expect(
        screen.queryByText('Heavy snow expected. Total snow accumulations of 8 to 12 inches.')
      ).not.toBeInTheDocument();

      // Click to expand
      const alertButton = screen.getByText('Winter Storm Warning').closest('button');
      await user.click(alertButton);

      // Description should now be visible
      expect(
        screen.getByText('Heavy snow expected. Total snow accumulations of 8 to 12 inches.')
      ).toBeInTheDocument();
    });

    it('should show instructions when alert is expanded', async () => {
      const WeatherAlerts = (await import('@/components/weather/WeatherAlerts')).default;
      const user = userEvent.setup();

      render(<WeatherAlerts latitude={38.9807} longitude={-76.9373} />);

      await waitFor(() => {
        expect(screen.getByText('Winter Storm Warning')).toBeInTheDocument();
      });

      const alertButton = screen.getByText('Winter Storm Warning').closest('button');
      await user.click(alertButton);

      expect(
        screen.getByText('Travel should be restricted to emergencies only.')
      ).toBeInTheDocument();
    });

    it('should show sender name when alert is expanded', async () => {
      const WeatherAlerts = (await import('@/components/weather/WeatherAlerts')).default;
      const user = userEvent.setup();

      render(<WeatherAlerts latitude={38.9807} longitude={-76.9373} />);

      await waitFor(() => {
        expect(screen.getByText('Winter Storm Warning')).toBeInTheDocument();
      });

      const alertButton = screen.getByText('Winter Storm Warning').closest('button');
      await user.click(alertButton);

      expect(screen.getByText(/NWS State College PA/)).toBeInTheDocument();
    });

    it('should collapse alert when clicked again', async () => {
      const WeatherAlerts = (await import('@/components/weather/WeatherAlerts')).default;
      const user = userEvent.setup();

      render(<WeatherAlerts latitude={38.9807} longitude={-76.9373} />);

      await waitFor(() => {
        expect(screen.getByText('Winter Storm Warning')).toBeInTheDocument();
      });

      const alertButton = screen.getByText('Winter Storm Warning').closest('button');

      // Expand
      await user.click(alertButton);
      expect(
        screen.getByText('Heavy snow expected. Total snow accumulations of 8 to 12 inches.')
      ).toBeInTheDocument();

      // Collapse
      await user.click(alertButton);
      expect(
        screen.queryByText('Heavy snow expected. Total snow accumulations of 8 to 12 inches.')
      ).not.toBeInTheDocument();
    });
  });

  describe('API integration', () => {
    it('should call weather.gov API with correct coordinates', async () => {
      global.fetch = vi.fn(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockEmptyAlertsResponse),
        })
      );

      const WeatherAlerts = (await import('@/components/weather/WeatherAlerts')).default;

      render(<WeatherAlerts latitude={38.9807} longitude={-76.9373} />);

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          'https://api.weather.gov/alerts/active?point=38.9807,-76.9373',
          expect.objectContaining({
            headers: expect.objectContaining({
              'User-Agent': expect.stringContaining('ParkLookup'),
              Accept: 'application/geo+json',
            }),
          })
        );
      });
    });

    it('should include link to weather.gov', async () => {
      global.fetch = vi.fn(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockAlertsResponse),
        })
      );

      const WeatherAlerts = (await import('@/components/weather/WeatherAlerts')).default;

      render(<WeatherAlerts latitude={38.9807} longitude={-76.9373} />);

      await waitFor(() => {
        const link = screen.getByText('View all alerts on weather.gov →');
        expect(link).toHaveAttribute('href', 'https://www.weather.gov/alerts');
      });
    });
  });

  describe('Error handling', () => {
    it('should display error message when API call fails', async () => {
      global.fetch = vi.fn(() =>
        Promise.resolve({
          ok: false,
          status: 500,
        })
      );

      const WeatherAlerts = (await import('@/components/weather/WeatherAlerts')).default;

      render(<WeatherAlerts latitude={38.9807} longitude={-76.9373} />);

      await waitFor(() => {
        expect(screen.getByText(/Failed to load weather alerts/)).toBeInTheDocument();
      });
    });

    it('should display error message when fetch throws', async () => {
      global.fetch = vi.fn(() => Promise.reject(new Error('Network error')));

      const WeatherAlerts = (await import('@/components/weather/WeatherAlerts')).default;

      render(<WeatherAlerts latitude={38.9807} longitude={-76.9373} />);

      await waitFor(() => {
        expect(screen.getByText(/Failed to load weather alerts/)).toBeInTheDocument();
      });
    });
  });

  describe('Severity colors', () => {
    it('should apply correct color classes for Extreme severity', async () => {
      global.fetch = vi.fn(() =>
        Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              features: [
                {
                  id: 'extreme-alert',
                  properties: {
                    event: 'Tornado Warning',
                    headline: 'Tornado Warning',
                    severity: 'Extreme',
                  },
                },
              ],
            }),
        })
      );

      const WeatherAlerts = (await import('@/components/weather/WeatherAlerts')).default;

      render(<WeatherAlerts latitude={38.9807} longitude={-76.9373} />);

      await waitFor(() => {
        const badge = screen.getByText('Extreme');
        expect(badge).toHaveClass('bg-red-600');
      });
    });

    it('should apply correct color classes for Minor severity', async () => {
      global.fetch = vi.fn(() =>
        Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              features: [
                {
                  id: 'minor-alert',
                  properties: {
                    event: 'Frost Advisory',
                    headline: 'Frost Advisory',
                    severity: 'Minor',
                  },
                },
              ],
            }),
        })
      );

      const WeatherAlerts = (await import('@/components/weather/WeatherAlerts')).default;

      render(<WeatherAlerts latitude={38.9807} longitude={-76.9373} />);

      await waitFor(() => {
        const badge = screen.getByText('Minor');
        expect(badge).toHaveClass('bg-blue-500');
      });
    });
  });
});
