import { Command } from 'commander';
import { authenticate, logout, setupCredentials } from '../lib/auth';
import { isAuthenticated, isConfigured, getConfigPath } from '../lib/config';
import { spotifyClient } from '../lib/spotify-client';
import chalk from 'chalk';

export function registerAuthCommands(program: Command): void {
  program
    .command('auth')
    .description('Authenticate with Spotify')
    .option('--status', 'Check authentication status')
    .option('--logout', 'Log out and clear tokens')
    .option('--setup', 'Configure Spotify API credentials')
    .action(async (options) => {
      if (options.status) {
        console.log(chalk.bold('\n🔐 Authentication Status\n'));
        
        if (!isConfigured()) {
          console.log(chalk.yellow('⚠ Spotify credentials not configured'));
          console.log(chalk.dim('Run: spotify-gen auth --setup'));
          return;
        }

        if (!isAuthenticated()) {
          console.log(chalk.yellow('⚠ Not authenticated'));
          console.log(chalk.dim('Run: spotify-gen auth'));
          return;
        }

        try {
          await spotifyClient.init();
          const user = await spotifyClient.getMe();
          console.log(chalk.green('✓ Authenticated'));
          console.log(`  User: ${user.display_name || user.id}`);
          if (user.email) {
            console.log(`  Email: ${user.email}`);
          }
        } catch (err) {
          console.log(chalk.red('✗ Token expired or invalid'));
          console.log(chalk.dim('Run: spotify-gen auth'));
        }

        console.log(`\n${chalk.dim('Config file:')} ${getConfigPath()}`);
        return;
      }

      if (options.logout) {
        await logout();
        return;
      }

      if (options.setup) {
        await setupCredentials();
        return;
      }

      // Default: authenticate
      const success = await authenticate();
      if (!success) {
        process.exit(1);
      }
    });
}
