import { Command } from 'commander';
import ora from 'ora';
import { spotifyClient } from '../lib/spotify-client';
import { gatherListeningData, buildTasteProfile, formatTasteProfile } from '../lib/taste-analyzer';
import chalk from 'chalk';

export function registerAnalyzeCommand(program: Command): void {
  program
    .command('analyze')
    .description('Analyze your music taste and show your listening profile')
    .option('--json', 'Output as JSON')
    .action(async (options) => {
      const spinner = ora('Connecting to Spotify...').start();

      try {
        const initialized = await spotifyClient.init();
        if (!initialized) {
          spinner.fail('Not authenticated');
          console.log(chalk.dim('Run: spotify-gen auth'));
          process.exit(1);
        }

        spinner.text = 'Fetching your listening history...';
        const data = await gatherListeningData();

        spinner.text = 'Analyzing your music taste...';
        const profile = buildTasteProfile(data);

        spinner.succeed('Analysis complete!');

        if (options.json) {
          console.log(JSON.stringify(profile, null, 2));
        } else {
          console.log(formatTasteProfile(profile, data));
        }

      } catch (err: any) {
        spinner.fail('Analysis failed');
        console.error(chalk.red(err.message));
        process.exit(1);
      }
    });
}
