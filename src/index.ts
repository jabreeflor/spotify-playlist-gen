#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import { registerAuthCommands } from './commands/auth';
import { registerAnalyzeCommand } from './commands/analyze';
import { registerPlaylistCommand } from './commands/playlist';

const program = new Command();

program
  .name('spotify-gen')
  .description('🎵 Smart Spotify playlist generator that analyzes your music taste')
  .version('1.0.0');

// Register all commands
registerAuthCommands(program);
registerAnalyzeCommand(program);
registerPlaylistCommand(program);

// Default help with examples
program.on('--help', () => {
  console.log('');
  console.log(chalk.bold('Examples:'));
  console.log('');
  console.log('  $ spotify-gen auth                          # Log in to Spotify');
  console.log('  $ spotify-gen analyze                       # Show your taste profile');
  console.log('  $ spotify-gen playlist mood happy           # Happy playlist');
  console.log('  $ spotify-gen playlist workout --duration 60m');
  console.log('  $ spotify-gen playlist discover --based-on "artist:Tame Impala"');
  console.log('  $ spotify-gen playlist vibe "late night coding session"');
  console.log('  $ spotify-gen playlist like "Daft Punk"');
  console.log('  $ spotify-gen playlist time morning');
  console.log('');
  console.log(chalk.dim('For detailed help on a command: spotify-gen <command> --help'));
});

// Handle no command
if (process.argv.length === 2) {
  console.log(chalk.cyan(`
  ╔════════════════════════════════════════╗
  ║  🎵 Spotify Playlist Generator         ║
  ║     Smart playlists from your taste    ║
  ╚════════════════════════════════════════╝
`));
  program.outputHelp();
  process.exit(0);
}

program.parse(process.argv);
