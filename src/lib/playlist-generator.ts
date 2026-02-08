import { spotifyClient } from './spotify-client';
import { TasteProfile, PlaylistOptions, SpotifyTrack, RecommendationParams } from '../types/spotify';
import { gatherListeningData, buildTasteProfile } from './taste-analyzer';
import chalk from 'chalk';

// Mood presets - maps mood to target audio features
const MOOD_PRESETS: Record<string, Partial<RecommendationParams>> = {
  happy: {
    target_valence: 0.8,
    target_energy: 0.7,
    target_danceability: 0.65
  },
  sad: {
    target_valence: 0.2,
    target_energy: 0.3,
    target_acousticness: 0.6
  },
  energetic: {
    target_energy: 0.9,
    target_danceability: 0.8,
    target_valence: 0.7
  },
  chill: {
    target_energy: 0.3,
    target_danceability: 0.4,
    target_acousticness: 0.5,
    target_valence: 0.5
  },
  angry: {
    target_energy: 0.9,
    target_valence: 0.2,
    target_danceability: 0.5
  },
  romantic: {
    target_valence: 0.6,
    target_energy: 0.4,
    target_acousticness: 0.5,
    target_danceability: 0.5
  }
};

// Activity presets
const ACTIVITY_PRESETS: Record<string, Partial<RecommendationParams>> = {
  workout: {
    target_energy: 0.9,
    target_danceability: 0.75,
    target_valence: 0.7,
    target_tempo: 140
  },
  focus: {
    target_energy: 0.4,
    target_instrumentalness: 0.7,
    target_valence: 0.5,
    target_acousticness: 0.3
  },
  party: {
    target_energy: 0.85,
    target_danceability: 0.9,
    target_valence: 0.8,
    min_popularity: 50
  },
  sleep: {
    target_energy: 0.15,
    target_acousticness: 0.7,
    target_instrumentalness: 0.5,
    target_tempo: 70
  },
  commute: {
    target_energy: 0.6,
    target_valence: 0.6,
    target_danceability: 0.6
  },
  cooking: {
    target_energy: 0.6,
    target_valence: 0.7,
    target_danceability: 0.65
  }
};

// Time of day presets
const TIME_PRESETS: Record<string, Partial<RecommendationParams>> = {
  morning: {
    target_energy: 0.5,
    target_valence: 0.7,
    target_acousticness: 0.4
  },
  afternoon: {
    target_energy: 0.65,
    target_valence: 0.65,
    target_danceability: 0.6
  },
  evening: {
    target_energy: 0.55,
    target_valence: 0.55,
    target_danceability: 0.5
  },
  night: {
    target_energy: 0.35,
    target_valence: 0.4,
    target_acousticness: 0.5
  }
};

// Natural language vibe parsing
function parseVibe(vibe: string): Partial<RecommendationParams> {
  const params: Partial<RecommendationParams> = {};
  const lowerVibe = vibe.toLowerCase();

  // Energy keywords
  if (/\b(hype|pump|intense|powerful|explosive|wild)\b/.test(lowerVibe)) {
    params.target_energy = 0.9;
  } else if (/\b(energetic|upbeat|lively|dynamic)\b/.test(lowerVibe)) {
    params.target_energy = 0.75;
  } else if (/\b(chill|relaxed|mellow|calm|peaceful|soft)\b/.test(lowerVibe)) {
    params.target_energy = 0.3;
  } else if (/\b(ambient|dreamy|floating)\b/.test(lowerVibe)) {
    params.target_energy = 0.2;
  }

  // Mood/valence keywords
  if (/\b(happy|joy|euphoric|celebrat|cheerful|bright)\b/.test(lowerVibe)) {
    params.target_valence = 0.8;
  } else if (/\b(sad|melanchol|depress|lonely|heartbreak|cry)\b/.test(lowerVibe)) {
    params.target_valence = 0.2;
  } else if (/\b(angry|rage|furious|aggressive)\b/.test(lowerVibe)) {
    params.target_valence = 0.2;
    params.target_energy = 0.9;
  } else if (/\b(romantic|love|sensual|intimate)\b/.test(lowerVibe)) {
    params.target_valence = 0.6;
    params.target_energy = 0.4;
  }

  // Danceability
  if (/\b(dance|dancing|groove|groovy|funky|disco)\b/.test(lowerVibe)) {
    params.target_danceability = 0.85;
  } else if (/\b(sway|bob|movement)\b/.test(lowerVibe)) {
    params.target_danceability = 0.65;
  }

  // Acoustic/Electronic
  if (/\b(acoustic|unplugged|folk|organic)\b/.test(lowerVibe)) {
    params.target_acousticness = 0.8;
  } else if (/\b(electronic|synth|techno|house|edm)\b/.test(lowerVibe)) {
    params.target_acousticness = 0.1;
    params.target_energy = (params.target_energy || 0.5) + 0.2;
  }

  // Instrumental
  if (/\b(instrumental|no vocals|without words|background)\b/.test(lowerVibe)) {
    params.target_instrumentalness = 0.8;
  }

  // Tempo hints
  if (/\b(fast|quick|rapid|racing)\b/.test(lowerVibe)) {
    params.target_tempo = 140;
  } else if (/\b(slow|slowdown|laid back)\b/.test(lowerVibe)) {
    params.target_tempo = 80;
  }

  // Time-specific
  if (/\b(morning|sunrise|wake up|breakfast)\b/.test(lowerVibe)) {
    return { ...TIME_PRESETS.morning, ...params };
  } else if (/\b(late night|midnight|2am|3am|after hours|coding session)\b/.test(lowerVibe)) {
    return { 
      target_energy: 0.45, 
      target_valence: 0.4, 
      target_instrumentalness: 0.4,
      ...params 
    };
  } else if (/\b(sunset|golden hour|evening)\b/.test(lowerVibe)) {
    return { ...TIME_PRESETS.evening, ...params };
  }

  // Activity specific
  if (/\b(workout|gym|running|exercise|training)\b/.test(lowerVibe)) {
    return { ...ACTIVITY_PRESETS.workout, ...params };
  } else if (/\b(study|focus|concentrate|work|productivity)\b/.test(lowerVibe)) {
    return { ...ACTIVITY_PRESETS.focus, ...params };
  } else if (/\b(party|club|pregame)\b/.test(lowerVibe)) {
    return { ...ACTIVITY_PRESETS.party, ...params };
  } else if (/\b(sleep|bedtime|rest|wind down)\b/.test(lowerVibe)) {
    return { ...ACTIVITY_PRESETS.sleep, ...params };
  } else if (/\b(road trip|driving|drive)\b/.test(lowerVibe)) {
    return { target_energy: 0.7, target_valence: 0.7, target_danceability: 0.6, ...params };
  } else if (/\b(coffee|cafe|jazz)\b/.test(lowerVibe)) {
    return { target_energy: 0.4, target_acousticness: 0.6, target_instrumentalness: 0.4, ...params };
  }

  return params;
}

export async function generatePlaylist(options: PlaylistOptions): Promise<{
  tracks: SpotifyTrack[];
  playlistUrl?: string;
  playlistName: string;
}> {
  // Gather user's listening data for personalization
  const data = await gatherListeningData();
  const tasteProfile = buildTasteProfile(data);

  // Build recommendation parameters
  let recParams: RecommendationParams = {
    limit: options.trackCount || 25
  };

  // Apply presets based on options
  if (options.mood && MOOD_PRESETS[options.mood]) {
    recParams = { ...recParams, ...MOOD_PRESETS[options.mood] };
  }

  if (options.activity && ACTIVITY_PRESETS[options.activity]) {
    recParams = { ...recParams, ...ACTIVITY_PRESETS[options.activity] };
  }

  if (options.timeOfDay && TIME_PRESETS[options.timeOfDay]) {
    recParams = { ...recParams, ...TIME_PRESETS[options.timeOfDay] };
  }

  if (options.vibe) {
    const vibeParams = parseVibe(options.vibe);
    recParams = { ...recParams, ...vibeParams };
  }

  // Handle "based on" option
  if (options.basedOn) {
    const [type, ...nameParts] = options.basedOn.split(':');
    const name = nameParts.join(':');

    if (type === 'artist') {
      const searchResults = await spotifyClient.search(name, ['artist'], 1);
      if (searchResults.artists?.items.length) {
        recParams.seed_artists = [searchResults.artists.items[0].id];
      }
    } else if (type === 'track') {
      const searchResults = await spotifyClient.search(name, ['track'], 1);
      if (searchResults.tracks?.items.length) {
        recParams.seed_tracks = [searchResults.tracks.items[0].id];
      }
    }
  }

  // Set seeds from user's taste if not already set
  if (!recParams.seed_artists?.length && !recParams.seed_tracks?.length) {
    // Use a mix of user's top artists and tracks as seeds
    // Randomly select to add variety
    const seedArtists = tasteProfile.topArtistIds
      .sort(() => Math.random() - 0.5)
      .slice(0, 2);
    const seedTracks = tasteProfile.topTrackIds
      .sort(() => Math.random() - 0.5)
      .slice(0, 2);
    
    recParams.seed_artists = seedArtists;
    recParams.seed_tracks = seedTracks;
  }

  // For discovery mode, lower popularity and add genre seeds
  if (options.discover) {
    recParams.max_popularity = 50;
    
    // Add a genre seed from user's top genres
    if (tasteProfile.topGenres.length > 0) {
      const availableGenres = await spotifyClient.getAvailableGenres();
      const matchingGenre = tasteProfile.topGenres.find(g => 
        availableGenres.includes(g.genre)
      );
      if (matchingGenre) {
        recParams.seed_genres = [matchingGenre.genre];
        // Keep only one artist and one track seed for discovery
        recParams.seed_artists = recParams.seed_artists?.slice(0, 1);
        recParams.seed_tracks = recParams.seed_tracks?.slice(0, 1);
      }
    }
  }

  // Blend with user's taste profile for personalization
  // If no explicit targets are set, use user's baseline
  if (recParams.target_energy === undefined) {
    recParams.target_energy = tasteProfile.avgFeatures.energy;
  }
  if (recParams.target_valence === undefined) {
    recParams.target_valence = tasteProfile.avgFeatures.valence;
  }
  if (recParams.target_danceability === undefined) {
    recParams.target_danceability = tasteProfile.avgFeatures.danceability;
  }

  // If duration is specified instead of track count, estimate tracks
  if (options.duration && !options.trackCount) {
    // Average song is about 3.5 minutes
    recParams.limit = Math.ceil(options.duration / 3.5);
  }

  // Get recommendations
  let tracks = await spotifyClient.getRecommendations(recParams);

  // If we need more tracks (for duration), keep fetching
  if (options.duration) {
    const targetDurationMs = options.duration * 60 * 1000;
    let currentDuration = tracks.reduce((sum, t) => sum + t.duration_ms, 0);
    
    while (currentDuration < targetDurationMs && tracks.length < 100) {
      // Shuffle seeds for variety
      if (recParams.seed_artists) {
        recParams.seed_artists = recParams.seed_artists.sort(() => Math.random() - 0.5);
      }
      if (recParams.seed_tracks) {
        recParams.seed_tracks = recParams.seed_tracks.sort(() => Math.random() - 0.5);
      }
      
      const moreTracks = await spotifyClient.getRecommendations({
        ...recParams,
        limit: 20
      });
      
      // Filter out duplicates
      const existingIds = new Set(tracks.map(t => t.id));
      const newTracks = moreTracks.filter(t => !existingIds.has(t.id));
      
      if (newTracks.length === 0) break;
      
      tracks.push(...newTracks);
      currentDuration = tracks.reduce((sum, t) => sum + t.duration_ms, 0);
    }
    
    // Trim to target duration
    let accumulatedDuration = 0;
    tracks = tracks.filter(t => {
      if (accumulatedDuration >= targetDurationMs) return false;
      accumulatedDuration += t.duration_ms;
      return true;
    });
  }

  // Generate playlist name if not provided
  let playlistName = options.name;
  if (!playlistName) {
    const parts: string[] = [];
    if (options.mood) parts.push(capitalize(options.mood));
    if (options.activity) parts.push(capitalize(options.activity));
    if (options.timeOfDay) parts.push(capitalize(options.timeOfDay));
    if (options.vibe) parts.push(`"${options.vibe}"`);
    if (options.discover) parts.push('Discovery');
    if (options.basedOn) {
      const [, ...name] = options.basedOn.split(':');
      parts.push(`Like ${name.join(':')}`);
    }
    
    playlistName = parts.length > 0 
      ? `${parts.join(' ')} Mix` 
      : 'Generated Playlist';
  }

  // Create playlist on Spotify
  const user = await spotifyClient.getMe();
  const description = options.description || generateDescription(options, tracks.length);
  
  const playlist = await spotifyClient.createPlaylist(
    user.id,
    playlistName,
    description,
    options.public ?? false
  );

  // Add tracks to playlist
  await spotifyClient.addTracksToPlaylist(
    playlist.id,
    tracks.map(t => t.uri)
  );

  return {
    tracks,
    playlistUrl: playlist.external_urls.spotify,
    playlistName
  };
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function generateDescription(options: PlaylistOptions, trackCount: number): string {
  const parts = ['Generated by spotify-gen 🎵'];
  
  if (options.mood) parts.push(`Mood: ${options.mood}`);
  if (options.activity) parts.push(`Activity: ${options.activity}`);
  if (options.vibe) parts.push(`Vibe: "${options.vibe}"`);
  if (options.discover) parts.push('Discovery mode enabled');
  
  parts.push(`${trackCount} tracks`);
  
  return parts.join(' | ');
}

export function formatTrackList(tracks: SpotifyTrack[]): string {
  const lines: string[] = [];
  let totalDuration = 0;

  for (let i = 0; i < tracks.length; i++) {
    const track = tracks[i];
    const artists = track.artists.map(a => a.name).join(', ');
    const duration = Math.floor(track.duration_ms / 1000);
    const minutes = Math.floor(duration / 60);
    const seconds = duration % 60;
    
    lines.push(
      `${chalk.dim(String(i + 1).padStart(2, ' '))}. ${chalk.white(track.name)} ${chalk.dim('-')} ${chalk.cyan(artists)} ${chalk.dim(`[${minutes}:${String(seconds).padStart(2, '0')}]`)}`
    );
    
    totalDuration += track.duration_ms;
  }

  const totalMinutes = Math.floor(totalDuration / 60000);
  const totalSeconds = Math.floor((totalDuration % 60000) / 1000);

  lines.push('');
  lines.push(chalk.dim(`Total: ${tracks.length} tracks, ${totalMinutes}:${String(totalSeconds).padStart(2, '0')}`));

  return lines.join('\n');
}
