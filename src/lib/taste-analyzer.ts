import { spotifyClient } from './spotify-client';
import { SpotifyTrack, SpotifyArtist, AudioFeatures, TasteProfile } from '../types/spotify';
import chalk from 'chalk';

export interface AnalysisData {
  topTracks: {
    shortTerm: SpotifyTrack[];
    mediumTerm: SpotifyTrack[];
    longTerm: SpotifyTrack[];
  };
  topArtists: {
    shortTerm: SpotifyArtist[];
    mediumTerm: SpotifyArtist[];
    longTerm: SpotifyArtist[];
  };
  recentlyPlayed: SpotifyTrack[];
  audioFeatures: Map<string, AudioFeatures>;
}

export async function gatherListeningData(): Promise<AnalysisData> {
  // Fetch all data in parallel where possible
  const [
    topTracksShort,
    topTracksMedium,
    topTracksLong,
    topArtistsShort,
    topArtistsMedium,
    topArtistsLong,
    recentlyPlayedData
  ] = await Promise.all([
    spotifyClient.getTopTracks('short_term', 50),
    spotifyClient.getTopTracks('medium_term', 50),
    spotifyClient.getTopTracks('long_term', 50),
    spotifyClient.getTopArtists('short_term', 50),
    spotifyClient.getTopArtists('medium_term', 50),
    spotifyClient.getTopArtists('long_term', 50),
    spotifyClient.getRecentlyPlayed(50)
  ]);

  const recentlyPlayed = recentlyPlayedData.map(item => item.track);

  // Get unique track IDs for audio features
  const allTracks = [
    ...topTracksShort,
    ...topTracksMedium,
    ...topTracksLong,
    ...recentlyPlayed
  ];
  const uniqueTrackIds = [...new Set(allTracks.map(t => t.id))];

  // Fetch audio features
  const audioFeaturesArray = await spotifyClient.getAudioFeatures(uniqueTrackIds);
  const audioFeatures = new Map<string, AudioFeatures>();
  for (const af of audioFeaturesArray) {
    audioFeatures.set(af.id, af);
  }

  return {
    topTracks: {
      shortTerm: topTracksShort,
      mediumTerm: topTracksMedium,
      longTerm: topTracksLong
    },
    topArtists: {
      shortTerm: topArtistsShort,
      mediumTerm: topArtistsMedium,
      longTerm: topArtistsLong
    },
    recentlyPlayed,
    audioFeatures
  };
}

export function buildTasteProfile(data: AnalysisData): TasteProfile {
  // Weight tracks by time range (recent matters more)
  const weightedTracks: { track: SpotifyTrack; weight: number }[] = [
    ...data.topTracks.shortTerm.map((t, i) => ({ track: t, weight: 3 * (50 - i) / 50 })),
    ...data.topTracks.mediumTerm.map((t, i) => ({ track: t, weight: 2 * (50 - i) / 50 })),
    ...data.topTracks.longTerm.map((t, i) => ({ track: t, weight: 1 * (50 - i) / 50 })),
    ...data.recentlyPlayed.map((t, i) => ({ track: t, weight: 2.5 * (50 - i) / 50 }))
  ];

  // Aggregate genres from artists
  const genreCounts = new Map<string, number>();
  const allArtists = [
    ...data.topArtists.shortTerm.map(a => ({ artist: a, weight: 3 })),
    ...data.topArtists.mediumTerm.map(a => ({ artist: a, weight: 2 })),
    ...data.topArtists.longTerm.map(a => ({ artist: a, weight: 1 }))
  ];

  for (const { artist, weight } of allArtists) {
    for (const genre of artist.genres) {
      genreCounts.set(genre, (genreCounts.get(genre) || 0) + weight);
    }
  }

  const topGenres = [...genreCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20)
    .map(([genre, count]) => ({ genre, count }));

  // Calculate weighted average audio features
  let totalWeight = 0;
  const featureSums = {
    danceability: 0,
    energy: 0,
    valence: 0,
    acousticness: 0,
    instrumentalness: 0,
    tempo: 0,
    loudness: 0
  };

  const featureMins = { danceability: 1, energy: 1, valence: 1, tempo: 300 };
  const featureMaxs = { danceability: 0, energy: 0, valence: 0, tempo: 0 };

  let majorCount = 0;
  let minorCount = 0;
  let totalPopularity = 0;
  let trackCount = 0;

  for (const { track, weight } of weightedTracks) {
    const features = data.audioFeatures.get(track.id);
    if (!features) continue;

    totalWeight += weight;
    featureSums.danceability += features.danceability * weight;
    featureSums.energy += features.energy * weight;
    featureSums.valence += features.valence * weight;
    featureSums.acousticness += features.acousticness * weight;
    featureSums.instrumentalness += features.instrumentalness * weight;
    featureSums.tempo += features.tempo * weight;
    featureSums.loudness += features.loudness * weight;

    // Track ranges
    featureMins.danceability = Math.min(featureMins.danceability, features.danceability);
    featureMins.energy = Math.min(featureMins.energy, features.energy);
    featureMins.valence = Math.min(featureMins.valence, features.valence);
    featureMins.tempo = Math.min(featureMins.tempo, features.tempo);

    featureMaxs.danceability = Math.max(featureMaxs.danceability, features.danceability);
    featureMaxs.energy = Math.max(featureMaxs.energy, features.energy);
    featureMaxs.valence = Math.max(featureMaxs.valence, features.valence);
    featureMaxs.tempo = Math.max(featureMaxs.tempo, features.tempo);

    // Key analysis
    if (features.mode === 1) majorCount++;
    else minorCount++;

    totalPopularity += track.popularity;
    trackCount++;
  }

  const avgFeatures = {
    danceability: featureSums.danceability / totalWeight,
    energy: featureSums.energy / totalWeight,
    valence: featureSums.valence / totalWeight,
    acousticness: featureSums.acousticness / totalWeight,
    instrumentalness: featureSums.instrumentalness / totalWeight,
    tempo: featureSums.tempo / totalWeight,
    loudness: featureSums.loudness / totalWeight
  };

  // Get top artist and track IDs for seeding recommendations
  const topArtistIds = data.topArtists.shortTerm.slice(0, 10).map(a => a.id);
  const topTrackIds = data.topTracks.shortTerm.slice(0, 10).map(t => t.id);

  return {
    topGenres,
    avgFeatures,
    featureRanges: {
      danceability: { min: featureMins.danceability, max: featureMaxs.danceability },
      energy: { min: featureMins.energy, max: featureMaxs.energy },
      valence: { min: featureMins.valence, max: featureMaxs.valence },
      tempo: { min: featureMins.tempo, max: featureMaxs.tempo }
    },
    topArtistIds,
    topTrackIds,
    listeningPatterns: {
      prefersMajorKey: majorCount > minorCount,
      prefersHighEnergy: avgFeatures.energy > 0.6,
      prefersAcoustic: avgFeatures.acousticness > 0.4,
      avgPopularity: totalPopularity / trackCount
    }
  };
}

export function formatTasteProfile(profile: TasteProfile, data: AnalysisData): string {
  const lines: string[] = [];
  
  lines.push(chalk.bold.cyan('\n🎵 Your Music Taste Profile\n'));
  lines.push(chalk.dim('─'.repeat(50)));

  // Top Genres
  lines.push(chalk.bold('\n📊 Top Genres:'));
  const maxGenreCount = profile.topGenres[0]?.count || 1;
  for (const { genre, count } of profile.topGenres.slice(0, 10)) {
    const barLength = Math.round((count / maxGenreCount) * 20);
    const bar = chalk.green('█'.repeat(barLength)) + chalk.dim('░'.repeat(20 - barLength));
    lines.push(`  ${bar} ${genre}`);
  }

  // Audio Feature Profile
  lines.push(chalk.bold('\n🎚️ Audio Profile:'));
  const featureDescriptions = {
    danceability: { emoji: '💃', label: 'Danceability', desc: getDanceabilityDesc(profile.avgFeatures.danceability) },
    energy: { emoji: '⚡', label: 'Energy', desc: getEnergyDesc(profile.avgFeatures.energy) },
    valence: { emoji: '😊', label: 'Mood (Valence)', desc: getValenceDesc(profile.avgFeatures.valence) },
    acousticness: { emoji: '🎸', label: 'Acousticness', desc: getAcousticDesc(profile.avgFeatures.acousticness) },
    tempo: { emoji: '🥁', label: 'Avg Tempo', desc: `${Math.round(profile.avgFeatures.tempo)} BPM` }
  };

  for (const [key, info] of Object.entries(featureDescriptions)) {
    if (key === 'tempo') {
      lines.push(`  ${info.emoji} ${info.label}: ${info.desc}`);
    } else {
      const value = (profile.avgFeatures as any)[key];
      const barLength = Math.round(value * 20);
      const bar = chalk.blue('█'.repeat(barLength)) + chalk.dim('░'.repeat(20 - barLength));
      lines.push(`  ${info.emoji} ${info.label}: ${bar} ${info.desc}`);
    }
  }

  // Listening Patterns
  lines.push(chalk.bold('\n🔍 Listening Patterns:'));
  const patterns = profile.listeningPatterns;
  lines.push(`  • ${patterns.prefersMajorKey ? 'Prefers major keys (uplifting)' : 'Prefers minor keys (introspective)'}`);
  lines.push(`  • ${patterns.prefersHighEnergy ? 'High energy listener' : 'Moderate/chill energy preference'}`);
  lines.push(`  • ${patterns.prefersAcoustic ? 'Appreciates acoustic sounds' : 'Prefers produced/electronic sounds'}`);
  lines.push(`  • Average track popularity: ${Math.round(patterns.avgPopularity)}/100 ${getPopularityDesc(patterns.avgPopularity)}`);

  // Top Artists
  lines.push(chalk.bold('\n🎤 Top Artists (Last 4 Weeks):'));
  for (const artist of data.topArtists.shortTerm.slice(0, 5)) {
    lines.push(`  • ${artist.name}`);
  }

  // Top Tracks  
  lines.push(chalk.bold('\n🎵 Top Tracks (Last 4 Weeks):'));
  for (const track of data.topTracks.shortTerm.slice(0, 5)) {
    const artists = track.artists.map(a => a.name).join(', ');
    lines.push(`  • ${track.name} - ${chalk.dim(artists)}`);
  }

  lines.push(chalk.dim('\n─'.repeat(50)));
  lines.push(chalk.dim('Based on your Spotify listening history\n'));

  return lines.join('\n');
}

function getDanceabilityDesc(value: number): string {
  if (value >= 0.8) return 'Dance floor ready';
  if (value >= 0.6) return 'Groovy';
  if (value >= 0.4) return 'Moderate rhythm';
  return 'Low dance factor';
}

function getEnergyDesc(value: number): string {
  if (value >= 0.8) return 'High octane';
  if (value >= 0.6) return 'Energetic';
  if (value >= 0.4) return 'Balanced';
  return 'Mellow';
}

function getValenceDesc(value: number): string {
  if (value >= 0.8) return 'Very happy/upbeat';
  if (value >= 0.6) return 'Positive vibes';
  if (value >= 0.4) return 'Mixed emotions';
  if (value >= 0.2) return 'Melancholic';
  return 'Dark/introspective';
}

function getAcousticDesc(value: number): string {
  if (value >= 0.7) return 'Very acoustic';
  if (value >= 0.4) return 'Some acoustic';
  return 'Mostly electronic/produced';
}

function getPopularityDesc(value: number): string {
  if (value >= 70) return '(mainstream)';
  if (value >= 50) return '(balanced)';
  if (value >= 30) return '(indie leaning)';
  return '(deep cuts)';
}
