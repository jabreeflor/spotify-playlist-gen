import fetch from 'node-fetch';
import { SpotifyTokens, SpotifyUser, SpotifyTrack, SpotifyArtist, AudioFeatures, SpotifyPlaylist } from '../types/spotify';
import { getConfig, saveTokens } from './config';

const SPOTIFY_API_BASE = 'https://api.spotify.com/v1';

class SpotifyClient {
  private tokens: SpotifyTokens | null = null;

  async init(): Promise<boolean> {
    const config = getConfig();
    if (config.tokens) {
      this.tokens = config.tokens;
      // Check if token needs refresh
      if (Date.now() >= this.tokens.expires_at - 60000) {
        await this.refreshToken();
      }
      return true;
    }
    return false;
  }

  private async refreshToken(): Promise<void> {
    if (!this.tokens?.refresh_token) {
      throw new Error('No refresh token available');
    }

    const config = getConfig();
    const response = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${Buffer.from(`${config.clientId}:${config.clientSecret}`).toString('base64')}`
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: this.tokens.refresh_token
      })
    });

    if (!response.ok) {
      throw new Error(`Token refresh failed: ${response.statusText}`);
    }

    const data = await response.json() as any;
    this.tokens = {
      access_token: data.access_token,
      refresh_token: data.refresh_token || this.tokens.refresh_token,
      expires_at: Date.now() + (data.expires_in * 1000)
    };
    saveTokens(this.tokens);
  }

  private async request<T>(endpoint: string, options: any = {}): Promise<T> {
    if (!this.tokens) {
      throw new Error('Not authenticated. Run: spotify-gen auth');
    }

    // Check token expiry
    if (Date.now() >= this.tokens.expires_at - 60000) {
      await this.refreshToken();
    }

    const response = await fetch(`${SPOTIFY_API_BASE}${endpoint}`, {
      ...options,
      headers: {
        'Authorization': `Bearer ${this.tokens.access_token}`,
        'Content-Type': 'application/json',
        ...options.headers
      }
    });

    if (response.status === 401) {
      await this.refreshToken();
      return this.request<T>(endpoint, options);
    }

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Spotify API error: ${response.status} - ${error}`);
    }

    if (response.status === 204) {
      return {} as T;
    }

    return response.json() as Promise<T>;
  }

  // User endpoints
  async getMe(): Promise<SpotifyUser> {
    return this.request<SpotifyUser>('/me');
  }

  // Top items
  async getTopTracks(timeRange: 'short_term' | 'medium_term' | 'long_term' = 'medium_term', limit = 50): Promise<SpotifyTrack[]> {
    const response = await this.request<{ items: SpotifyTrack[] }>(
      `/me/top/tracks?time_range=${timeRange}&limit=${limit}`
    );
    return response.items;
  }

  async getTopArtists(timeRange: 'short_term' | 'medium_term' | 'long_term' = 'medium_term', limit = 50): Promise<SpotifyArtist[]> {
    const response = await this.request<{ items: SpotifyArtist[] }>(
      `/me/top/artists?time_range=${timeRange}&limit=${limit}`
    );
    return response.items;
  }

  async getRecentlyPlayed(limit = 50): Promise<{ track: SpotifyTrack; played_at: string }[]> {
    const response = await this.request<{ items: { track: SpotifyTrack; played_at: string }[] }>(
      `/me/player/recently-played?limit=${limit}`
    );
    return response.items;
  }

  // Audio features
  async getAudioFeatures(trackIds: string[]): Promise<AudioFeatures[]> {
    if (trackIds.length === 0) return [];
    
    // API limit is 100 tracks at a time
    const chunks: string[][] = [];
    for (let i = 0; i < trackIds.length; i += 100) {
      chunks.push(trackIds.slice(i, i + 100));
    }

    const allFeatures: AudioFeatures[] = [];
    for (const chunk of chunks) {
      const response = await this.request<{ audio_features: (AudioFeatures | null)[] }>(
        `/audio-features?ids=${chunk.join(',')}`
      );
      allFeatures.push(...response.audio_features.filter((f): f is AudioFeatures => f !== null));
    }

    return allFeatures;
  }

  // Recommendations
  async getRecommendations(params: {
    seed_artists?: string[];
    seed_tracks?: string[];
    seed_genres?: string[];
    limit?: number;
    target_danceability?: number;
    target_energy?: number;
    target_valence?: number;
    target_tempo?: number;
    target_acousticness?: number;
    target_instrumentalness?: number;
    min_popularity?: number;
    max_popularity?: number;
  }): Promise<SpotifyTrack[]> {
    const queryParams = new URLSearchParams();
    
    if (params.seed_artists?.length) {
      queryParams.set('seed_artists', params.seed_artists.slice(0, 5).join(','));
    }
    if (params.seed_tracks?.length) {
      queryParams.set('seed_tracks', params.seed_tracks.slice(0, 5).join(','));
    }
    if (params.seed_genres?.length) {
      queryParams.set('seed_genres', params.seed_genres.slice(0, 5).join(','));
    }
    
    queryParams.set('limit', String(params.limit || 20));

    // Target values
    if (params.target_danceability !== undefined) {
      queryParams.set('target_danceability', String(params.target_danceability));
    }
    if (params.target_energy !== undefined) {
      queryParams.set('target_energy', String(params.target_energy));
    }
    if (params.target_valence !== undefined) {
      queryParams.set('target_valence', String(params.target_valence));
    }
    if (params.target_tempo !== undefined) {
      queryParams.set('target_tempo', String(params.target_tempo));
    }
    if (params.target_acousticness !== undefined) {
      queryParams.set('target_acousticness', String(params.target_acousticness));
    }
    if (params.target_instrumentalness !== undefined) {
      queryParams.set('target_instrumentalness', String(params.target_instrumentalness));
    }
    if (params.min_popularity !== undefined) {
      queryParams.set('min_popularity', String(params.min_popularity));
    }
    if (params.max_popularity !== undefined) {
      queryParams.set('max_popularity', String(params.max_popularity));
    }

    const response = await this.request<{ tracks: SpotifyTrack[] }>(
      `/recommendations?${queryParams.toString()}`
    );
    return response.tracks;
  }

  // Search
  async search(query: string, types: ('artist' | 'track' | 'album')[] = ['artist', 'track'], limit = 10): Promise<{
    artists?: { items: SpotifyArtist[] };
    tracks?: { items: SpotifyTrack[] };
  }> {
    const response = await this.request<any>(
      `/search?q=${encodeURIComponent(query)}&type=${types.join(',')}&limit=${limit}`
    );
    return response;
  }

  // Playlist management
  async createPlaylist(userId: string, name: string, description: string, isPublic = false): Promise<SpotifyPlaylist> {
    return this.request<SpotifyPlaylist>(`/users/${userId}/playlists`, {
      method: 'POST',
      body: JSON.stringify({
        name,
        description,
        public: isPublic
      })
    });
  }

  async addTracksToPlaylist(playlistId: string, trackUris: string[]): Promise<void> {
    // API limit is 100 tracks at a time
    const chunks: string[][] = [];
    for (let i = 0; i < trackUris.length; i += 100) {
      chunks.push(trackUris.slice(i, i + 100));
    }

    for (const chunk of chunks) {
      await this.request(`/playlists/${playlistId}/tracks`, {
        method: 'POST',
        body: JSON.stringify({ uris: chunk })
      });
    }
  }

  // Get available genre seeds
  async getAvailableGenres(): Promise<string[]> {
    const response = await this.request<{ genres: string[] }>('/recommendations/available-genre-seeds');
    return response.genres;
  }
}

export const spotifyClient = new SpotifyClient();
