import { beforeEach, describe, expect, it, vi } from 'vitest';

const exchangeCodeForSessionMock = vi.fn();

vi.mock('@/lib/supabase/client', () => ({
  createServerClient: () => ({
    auth: {
      exchangeCodeForSession: exchangeCodeForSessionMock,
    },
  }),
}));

describe('GET /auth/callback', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    exchangeCodeForSessionMock.mockResolvedValue({ error: null });
  });

  it('keeps successful callback redirects on the application origin', async () => {
    const { GET } = await import('@/app/auth/callback/route.js');
    const request = new Request(
      'https://parklookup.com/auth/callback?code=test-code&next=%40evil.example%2Fphish'
    );

    const response = await GET(request);
    const location = new URL(response.headers.get('location'));

    expect(exchangeCodeForSessionMock).toHaveBeenCalledWith('test-code');
    expect(location.origin).toBe('https://parklookup.com');
    expect(location.pathname).toBe('/@evil.example/phish');
  });

  it('falls back to home for absolute external redirect targets', async () => {
    const { GET } = await import('@/app/auth/callback/route.js');
    const next = encodeURIComponent('https://evil.example/phish');
    const request = new Request(`https://parklookup.com/auth/callback?code=test-code&next=${next}`);

    const response = await GET(request);

    expect(response.headers.get('location')).toBe('https://parklookup.com/');
  });

  it('preserves safe application paths', async () => {
    const { GET } = await import('@/app/auth/callback/route.js');
    const next = encodeURIComponent('/parks?state=CA');
    const request = new Request(`https://parklookup.com/auth/callback?code=test-code&next=${next}`);

    const response = await GET(request);

    expect(response.headers.get('location')).toBe('https://parklookup.com/parks?state=CA');
  });
});
