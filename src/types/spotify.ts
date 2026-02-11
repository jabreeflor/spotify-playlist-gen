// Spotify API Types

export interface SpotifyTokens {
  access_token: string;
  refresh_token: string;
  expires_at: number;
}

export interface SpotifyUser {
  id: string;
  display_name: string;
  email?: string;
  images?: { url: string }[];
}

export interface SpotifyArtist {
  id: string;
  name: string;
  genres: string[];
  popularity: number;
  images?: { url: string }[];
}

export interface SpotifyTrack {
  id: string;
  name: string;
  artists: SpotifyArtist[];
  album: {
    id: string;
    name: string;
    images?: { url: string }[];
  };
  duration_ms: number;
  popularity: number;
  uri: string;
}

export interface AudioFeatures {
  id: string;
  danceability: number;      // 0.0 - 1.0
  energy: number;            // 0.0 - 1.0
  key: number;               // 0-11 (pitch class)
  loudness: number;          // dB (-60 to 0)
  mode: number;              // 0 = minor, 1 = major
  speechiness: number;       // 0.0 - 1.0
  acousticness: number;      // 0.0 - 1.0
  instrumentalness: number;  // 0.0 - 1.0
  liveness: number;          // 0.0 - 1.0
  valence: number;           // 0.0 - 1.0 (happiness)
  tempo: number;             // BPM
  duration_ms: number;
  time_signature: number;
}

export interface TasteProfile {
  topGenres: { genre: string; count: number }[];
  avgFeatures: {
    danceability: number;
    energy: number;
    valence: number;
    acousticness: number;
    instrumentalness: number;
    tempo: number;
    loudness: number;
  };
  featureRanges: {
    danceability: { min: number; max: number };
    energy: { min: number; max: number };
    valence: { min: number; max: number };
    tempo: { min: number; max: number };
  };
  topArtistIds: string[];
  topTrackIds: string[];
  listeningPatterns: {
    prefersMajorKey: boolean;
    prefersHighEnergy: boolean;
    prefersAcoustic: boolean;
    avgPopularity: number;
  };
}

export interface PlaylistOptions {
  name?: string;
  description?: string;
  trackCount?: number;
  duration?: number;  // minutes
  mood?: 'happy' | 'sad' | 'energetic' | 'chill' | 'angry' | 'romantic';
  activity?: 'workout' | 'focus' | 'party' | 'sleep' | 'commute' | 'cooking';
  timeOfDay?: 'morning' | 'afternoon' | 'evening' | 'night';
  basedOn?: string;  // artist:Name or track:Name
  vibe?: string;     // Natural language description
  discover?: boolean; // Find new music
  public?: boolean;
  // Blend feature
  blendWith?: string[];  // Artist names to blend taste with
  // Time machine feature
  birthYear?: number;
  targetYear?: number;   // Specific year for time machine
  // Genre deep dive feature
  genre?: string;
  deepCuts?: boolean;    // Find obscure tracks in genre
}

export interface RecommendationParams {
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
}

export interface SpotifyPlaylist {
  id: string;
  name: string;
  description: string;
  public: boolean;
  tracks: { total: number };
  external_urls: { spotify: string };
}
