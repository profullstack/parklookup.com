/**
 * c0mpute-first routing for the trip generator.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const run = vi.fn();
const generateObjectOn = vi.fn();

vi.mock('server-only', () => ({}));
vi.mock('openai', () => ({ default: vi.fn() }));
vi.mock('@profullstack/ai-providers', () => ({
  getAi: () => ({ run }),
  generateObjectOn: (...args) => generateObjectOn(...args),
}));

const { generateTripStream, coarseOrigin } = await import('@/lib/ai/trip-generator');

const parks = [{ park_code: 'yose', full_name: 'Yosemite' }];
const trip = {
  title: 'T',
  overall_summary: 'S',
  daily_schedule: [{ day: 1, park_code: 'yose', park_name: 'Yosemite', activities: ['hike'] }],
  packing_list: {},
  safety_notes: [],
};
const options = {
  origin: 'Fresno, CA',
  startDate: '2026-06-01',
  endDate: '2026-06-01',
  interests: ['hiking'],
  difficulty: 'easy',
  radiusMiles: 100,
  parks,
};

describe('trip generator on c0mpute', () => {
  beforeEach(() => {
    run.mockReset();
    generateObjectOn.mockReset();
  });

  it('asks c0mpute first and reports the whole itinerary at once', async () => {
    generateObjectOn.mockResolvedValue({ object: trip, text: JSON.stringify(trip) });
    run.mockImplementation(async (task) => ({ provider: 'c0mpute', value: await task({ name: 'c0mpute' }) }));
    const onChunk = vi.fn();
    const onDay = vi.fn();

    const result = await generateTripStream(options, onChunk, onDay);

    expect(result).toEqual(trip);
    const req = generateObjectOn.mock.calls[0][1];
    expect(req.system).toMatch(/trip planner/);
    expect(req.user).toMatch(/Fresno, CA/);
    expect(req.timeoutMs).toBeGreaterThanOrEqual(600_000);
    expect(() => req.schema({ title: 'x' })).toThrow(/Invalid trip data/);
    expect(onChunk).toHaveBeenCalledWith(JSON.stringify(trip));
    expect(onDay).toHaveBeenCalledWith({ day: 1, park_name: 'Yosemite' });
  });

  it('surfaces the last provider error when every provider fails', async () => {
    const err = new Error('all failed');
    err.attempts = [{ error: { message: 'c0mpute: no node' } }, { error: { message: 'openai: 401' } }];
    run.mockRejectedValue(err);
    await expect(generateTripStream(options)).rejects.toThrow('openai: 401');
  });
});

describe('coarseOrigin', () => {
  it('keeps city and state and drops the street', () => {
    expect(
      coarseOrigin({ formattedAddress: '1 Main St, Denver, CO 80202', city: 'Denver', stateCode: 'CO' })
    ).toBe('Denver, CO');
  });
  it('falls back to the state', () => {
    expect(coarseOrigin({ state: 'Utah' })).toBe('Utah');
    expect(coarseOrigin({})).toBe('the United States');
  });
});
