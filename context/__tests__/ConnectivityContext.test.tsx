jest.mock('@react-native-community/netinfo', () => ({
  __esModule: true,
  default: {
    fetch: jest.fn(),
    addEventListener: jest.fn(),
  },
}));

import { checkRealInternet } from '../ConnectivityContext';

describe('checkRealInternet', () => {
  const fetchMock = jest.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    global.fetch = fetchMock;
  });

  it('consulta o endpoint de saúde do Supabase com GET', async () => {
    fetchMock.mockResolvedValue({ status: 200 });

    await expect(checkRealInternet()).resolves.toBe(true);

    expect(fetchMock).toHaveBeenCalledWith(
      'https://vobcapzssxchdckazfnr.supabase.co/auth/v1/health',
      expect.objectContaining({ method: 'GET' }),
    );
  });
});
