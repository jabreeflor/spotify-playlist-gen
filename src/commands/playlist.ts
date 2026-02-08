import { Command } from 'commander';
import ora from 'ora';
import chalk from 'chalk';
import { spotifyClient } from '../lib/spotify-client';
import { generatePlaylist, formatTrackList } from '../lib/playlist-generator';
import { PlaylistOptions } from '../types/spotify';

const MOODS = ['happy', 'sad', 'energetic', 'chill', 'angry', 'romantic'] as const;
const ACTIVITIES = ['workout', 'focus', 'party', 'sleep', 'commute', 'cooking'] as const;
const TIMES = ['morning', 'afternoon', 'evening', 'night'] as const;

export function registerPlaylistCommand(program: Command): void {
  const playlist = program
    .command('playlist')
    .description('Generate a personalized playlist');

  // Mood-based playlist
  playlist
    .command('mood <mood>')
    .description(`Generate playlist by mood (${MOODS.join(', ')})`)
    .option('-t, --tracks <number>', 'Number of tracks', '25')
    .option('-n, --name <name>', 'Playlist name')
    .option('-d, --discover', 'Include less popular tracks')
    .option('--public', 'Make playlist public')
    .action(async (mood, options) => {
      if (!MOODS.includes(mood)) {
        console.log(chalk.red(`Invalid mood. Choose from: ${MOODS.join(', ')}`));
        process.exit(1);
      }

      await createPlaylist({
        mood: mood as any,
        trackCount: parseInt(options.tracks),
        name: options.name,
        discover: options.discover,
        public: options.public
      });
    });

  // Activity-based playlist
  playlist
    .command('activity <activity>')
    .alias(ACTIVITIES.join('|'))
    .description(`Generate playlist for activity (${ACTIVITIES.join(', ')})`)
    .option('-t, --tracks <number>', 'Number of tracks', '25')
    .option('--duration <minutes>', 'Target duration in minutes')
    .option('-n, --name <name>', 'Playlist name')
    .option('-d, --discover', 'Include less popular tracks')
    .option('--public', 'Make playlist public')
    .action(async (activity, options) => {
      if (!ACTIVITIES.includes(activity)) {
        console.log(chalk.red(`Invalid activity. Choose from: ${ACTIVITIES.join(', ')}`));
        process.exit(1);
      }

      await createPlaylist({
        activity: activity as any,
        trackCount: options.duration ? undefined : parseInt(options.tracks),
        duration: options.duration ? parseInt(options.duration) : undefined,
        name: options.name,
        discover: options.discover,
        public: options.public
      });
    });

  // Shortcut commands for common activities
  for (const activity of ACTIVITIES) {
    playlist
      .command(activity)
      .description(`Generate ${activity} playlist`)
      .option('-t, --tracks <number>', 'Number of tracks', '25')
      .option('--duration <minutes>', 'Target duration in minutes')
      .option('-d, --discover', 'Include less popular tracks')
      .option('--public', 'Make playlist public')
      .action(async (options) => {
        await createPlaylist({
          activity: activity as any,
          trackCount: options.duration ? undefined : parseInt(options.tracks),
          duration: options.duration ? parseInt(options.duration) : undefined,
          discover: options.discover,
          public: options.public
        });
      });
  }

  // Discovery mode
  playlist
    .command('discover')
    .description('Discover new music matching your taste')
    .option('-t, --tracks <number>', 'Number of tracks', '30')
    .option('--based-on <query>', 'Base on artist or track (e.g., "artist:Radiohead")')
    .option('-n, --name <name>', 'Playlist name')
    .option('--public', 'Make playlist public')
    .action(async (options) => {
      await createPlaylist({
        discover: true,
        trackCount: parseInt(options.tracks),
        basedOn: options.basedOn,
        name: options.name || 'Discovery Mix',
        public: options.public
      });
    });

  // "Vibe" - natural language description
  playlist
    .command('vibe <description...>')
    .description('Generate playlist from natural language description')
    .option('-t, --tracks <number>', 'Number of tracks', '25')
    .option('-n, --name <name>', 'Playlist name')
    .option('-d, --discover', 'Include less popular tracks')
    .option('--public', 'Make playlist public')
    .action(async (description, options) => {
      const vibe = description.join(' ');
      await createPlaylist({
        vibe,
        trackCount: parseInt(options.tracks),
        name: options.name,
        discover: options.discover,
        public: options.public
      });
    });

  // Time-based playlist
  playlist
    .command('time <timeOfDay>')
    .description(`Generate playlist for time of day (${TIMES.join(', ')})`)
    .option('-t, --tracks <number>', 'Number of tracks', '25')
    .option('-n, --name <name>', 'Playlist name')
    .option('-d, --discover', 'Include less popular tracks')
    .option('--public', 'Make playlist public')
    .action(async (timeOfDay, options) => {
      if (!TIMES.includes(timeOfDay)) {
        console.log(chalk.red(`Invalid time. Choose from: ${TIMES.join(', ')}`));
        process.exit(1);
      }

      await createPlaylist({
        timeOfDay: timeOfDay as any,
        trackCount: parseInt(options.tracks),
        name: options.name,
        discover: options.discover,
        public: options.public
      });
    });

  // Similar to artist/track
  playlist
    .command('like <query>')
    .description('Generate playlist similar to an artist or track')
    .option('-t, --tracks <number>', 'Number of tracks', '25')
    .option('-n, --name <name>', 'Playlist name')
    .option('-d, --discover', 'Include less popular tracks')
    .option('--public', 'Make playlist public')
    .action(async (query, options) => {
      // Try to determine if it's an artist or track
      let basedOn = query;
      if (!query.includes(':')) {
        // Default to artist if no prefix
        basedOn = `artist:${query}`;
      }

      await createPlaylist({
        basedOn,
        trackCount: parseInt(options.tracks),
        name: options.name,
        discover: options.discover,
        public: options.public
      });
    });
}

async function createPlaylist(options: PlaylistOptions): Promise<void> {
  const spinner = ora('Connecting to Spotify...').start();

  try {
    const initialized = await spotifyClient.init();
    if (!initialized) {
      spinner.fail('Not authenticated');
      console.log(chalk.dim('Run: spotify-gen auth'));
      process.exit(1);
    }

    spinner.text = 'Analyzing your music taste...';
    
    // Small delay for effect
    await new Promise(r => setTimeout(r, 500));
    
    spinner.text = 'Generating personalized playlist...';

    const result = await generatePlaylist(options);

    spinner.succeed(`Created playlist: ${chalk.bold(result.playlistName)}`);

    console.log('');
    console.log(formatTrackList(result.tracks));
    console.log('');

    if (result.playlistUrl) {
      console.log(chalk.green('✓ Playlist saved to your Spotify library'));
      console.log(chalk.cyan(`  ${result.playlistUrl}`));
    }

  } catch (err: any) {
    spinner.fail('Failed to create playlist');
    console.error(chalk.red(err.message));
    if (process.env.DEBUG) {
      console.error(err.stack);
    }
    process.exit(1);
  }
}
