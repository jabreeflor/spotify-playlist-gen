import express from 'express';
import open from 'open';
import fetch from 'node-fetch';
import crypto from 'crypto';
import { getConfig, setCredentials, saveTokens, clearAuth } from './config';
import chalk from 'chalk';

const REDIRECT_PORT = 8888;
const REDIRECT_URI = `http://localhost:${REDIRECT_PORT}/callback`;
const SCOPES = [
  'user-read-private',
  'user-read-email',
  'user-top-read',
  'user-read-recently-played',
  'playlist-modify-public',
  'playlist-modify-private',
  'playlist-read-private'
].join(' ');

// Generate PKCE code verifier and challenge
function generatePKCE(): { verifier: string; challenge: string } {
  const verifier = crypto.randomBytes(32).toString('base64url');
  const challenge = crypto
    .createHash('sha256')
    .update(verifier)
    .digest('base64url');
  return { verifier, challenge };
}

export async function setupCredentials(): Promise<boolean> {
  console.log(chalk.cyan('\n🔧 Spotify API Setup\n'));
  console.log('To use this tool, you need to create a Spotify Developer application.');
  console.log('Follow these steps:\n');
  console.log('1. Go to https://developer.spotify.com/dashboard');
  console.log('2. Log in with your Spotify account');
  console.log('3. Click "Create App"');
  console.log('4. Fill in:');
  console.log('   - App name: "Playlist Generator" (or anything you like)');
  console.log('   - App description: "Personal playlist generator"');
  console.log('   - Redirect URI: http://localhost:8888/callback');
  console.log('5. Click "Save"');
  console.log('6. Go to Settings and note your Client ID and Client Secret\n');

  // In a real CLI, we'd use inquirer or similar for input
  // For now, check environment variables
  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;

  if (clientId && clientSecret) {
    setCredentials(clientId, clientSecret);
    console.log(chalk.green('✓ Credentials loaded from environment variables'));
    return true;
  }

  console.log(chalk.yellow('Set these environment variables:'));
  console.log('  export SPOTIFY_CLIENT_ID="your_client_id"');
  console.log('  export SPOTIFY_CLIENT_SECRET="your_client_secret"');
  console.log('\nOr add them to your .env file.');

  return false;
}

export async function authenticate(): Promise<boolean> {
  const config = getConfig();

  if (!config.clientId || !config.clientSecret) {
    console.log(chalk.yellow('No Spotify credentials found.'));
    const setup = await setupCredentials();
    if (!setup) return false;
  }

  const { clientId, clientSecret } = getConfig();

  return new Promise((resolve) => {
    const app = express();
    let server: any;

    const state = crypto.randomBytes(16).toString('hex');
    const { verifier, challenge } = generatePKCE();

    app.get('/callback', async (req, res) => {
      const code = req.query.code as string;
      const returnedState = req.query.state as string;
      const error = req.query.error as string;

      if (error) {
        res.send(`
          <html>
            <body style="font-family: sans-serif; display: flex; justify-content: center; align-items: center; height: 100vh; background: #121212; color: #fff;">
              <div style="text-align: center;">
                <h1>❌ Authentication Failed</h1>
                <p>${error}</p>
                <p>You can close this window.</p>
              </div>
            </body>
          </html>
        `);
        server.close();
        resolve(false);
        return;
      }

      if (returnedState !== state) {
        res.send('State mismatch - possible CSRF attack');
        server.close();
        resolve(false);
        return;
      }

      try {
        // Exchange code for tokens
        const tokenResponse = await fetch('https://accounts.spotify.com/api/token', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Authorization': `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`
          },
          body: new URLSearchParams({
            grant_type: 'authorization_code',
            code,
            redirect_uri: REDIRECT_URI,
            code_verifier: verifier
          })
        });

        if (!tokenResponse.ok) {
          throw new Error(`Token exchange failed: ${tokenResponse.statusText}`);
        }

        const tokenData = await tokenResponse.json() as any;

        saveTokens({
          access_token: tokenData.access_token,
          refresh_token: tokenData.refresh_token,
          expires_at: Date.now() + (tokenData.expires_in * 1000)
        });

        res.send(`
          <html>
            <body style="font-family: sans-serif; display: flex; justify-content: center; align-items: center; height: 100vh; background: #1DB954; color: #fff;">
              <div style="text-align: center;">
                <h1>✅ Authenticated!</h1>
                <p>You can close this window and return to the terminal.</p>
              </div>
            </body>
          </html>
        `);

        console.log(chalk.green('\n✓ Successfully authenticated with Spotify!'));
        server.close();
        resolve(true);

      } catch (err) {
        console.error(chalk.red('Authentication error:'), err);
        res.send('Authentication failed. Check the terminal for details.');
        server.close();
        resolve(false);
      }
    });

    server = app.listen(REDIRECT_PORT, async () => {
      const authUrl = new URL('https://accounts.spotify.com/authorize');
      authUrl.searchParams.set('client_id', clientId);
      authUrl.searchParams.set('response_type', 'code');
      authUrl.searchParams.set('redirect_uri', REDIRECT_URI);
      authUrl.searchParams.set('state', state);
      authUrl.searchParams.set('scope', SCOPES);
      authUrl.searchParams.set('code_challenge_method', 'S256');
      authUrl.searchParams.set('code_challenge', challenge);

      console.log(chalk.cyan('\n🔐 Opening Spotify login in your browser...'));
      console.log(chalk.dim('If the browser doesn\'t open, visit this URL:\n'));
      console.log(chalk.underline(authUrl.toString()));
      console.log('');

      await open(authUrl.toString());
    });

    // Timeout after 5 minutes
    setTimeout(() => {
      console.log(chalk.yellow('\n⏰ Authentication timed out.'));
      server.close();
      resolve(false);
    }, 5 * 60 * 1000);
  });
}

export async function logout(): Promise<void> {
  clearAuth();
  console.log(chalk.green('✓ Logged out successfully'));
}
