import Conf from 'conf';
import { SpotifyTokens } from '../types/spotify';

interface ConfigSchema {
  clientId: string;
  clientSecret: string;
  tokens?: SpotifyTokens;
}

const config = new Conf<ConfigSchema>({
  projectName: 'spotify-playlist-gen',
  schema: {
    clientId: { type: 'string', default: '' },
    clientSecret: { type: 'string', default: '' },
    tokens: {
      type: 'object',
      properties: {
        access_token: { type: 'string' },
        refresh_token: { type: 'string' },
        expires_at: { type: 'number' }
      }
    }
  }
});

export function getConfig(): ConfigSchema {
  return {
    clientId: config.get('clientId') || process.env.SPOTIFY_CLIENT_ID || '',
    clientSecret: config.get('clientSecret') || process.env.SPOTIFY_CLIENT_SECRET || '',
    tokens: config.get('tokens')
  };
}

export function setCredentials(clientId: string, clientSecret: string): void {
  config.set('clientId', clientId);
  config.set('clientSecret', clientSecret);
}

export function saveTokens(tokens: SpotifyTokens): void {
  config.set('tokens', tokens);
}

export function clearAuth(): void {
  config.delete('tokens');
}

export function isConfigured(): boolean {
  const cfg = getConfig();
  return !!(cfg.clientId && cfg.clientSecret);
}

export function isAuthenticated(): boolean {
  const cfg = getConfig();
  return !!(cfg.tokens?.access_token);
}

export function getConfigPath(): string {
  return config.path;
}
