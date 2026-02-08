# 🎵 Spotify Playlist Generator

A smart CLI tool that analyzes your Spotify listening history and creates personalized playlists based on your music taste.

## Features

- **Taste Analysis** — Understands your music preferences from listening history
- **Mood-based playlists** — Happy, sad, energetic, chill, angry, romantic
- **Activity playlists** — Workout, focus, party, sleep, commute, cooking
- **Natural language vibes** — Describe the vibe you want in plain English
- **Discovery mode** — Find new music that matches your taste
- **Similar to** — Create playlists like your favorite artists/tracks
- **Time-based** — Morning, afternoon, evening, night moods

## Installation

```bash
# Clone the repo
git clone https://github.com/yourusername/spotify-playlist-gen
cd spotify-playlist-gen

# Install dependencies
npm install

# Build
npm run build

# Link globally (optional)
npm link
```

## Spotify Developer Setup

Before using, you need to create a Spotify Developer application:

1. Go to [Spotify Developer Dashboard](https://developer.spotify.com/dashboard)
2. Log in with your Spotify account
3. Click **Create App**
4. Fill in:
   - App name: `Playlist Generator`
   - App description: `Personal playlist generator`
   - Redirect URI: `http://localhost:8888/callback`
5. Click **Save**
6. Go to **Settings** and copy your **Client ID** and **Client Secret**

Set your credentials:

```bash
export SPOTIFY_CLIENT_ID="your_client_id"
export SPOTIFY_CLIENT_SECRET="your_client_secret"
```

Or add them to a `.env` file in the project directory.

## Usage

### Authentication

```bash
# Log in to Spotify
spotify-gen auth

# Check status
spotify-gen auth --status

# Log out
spotify-gen auth --logout
```

### Analyze Your Taste

```bash
# Show your music taste profile
spotify-gen analyze

# Output as JSON
spotify-gen analyze --json
```

This shows:
- Your top genres
- Audio feature preferences (danceability, energy, mood, etc.)
- Listening patterns
- Top artists and tracks

### Generate Playlists

#### By Mood

```bash
spotify-gen playlist mood happy
spotify-gen playlist mood sad --tracks 30
spotify-gen playlist mood energetic --discover  # Include hidden gems
spotify-gen playlist mood chill --public        # Make it public
```

Moods: `happy`, `sad`, `energetic`, `chill`, `angry`, `romantic`

#### By Activity

```bash
spotify-gen playlist workout --duration 60      # 60-minute workout
spotify-gen playlist focus --tracks 40
spotify-gen playlist party
spotify-gen playlist sleep
spotify-gen playlist commute
spotify-gen playlist cooking
```

Activities: `workout`, `focus`, `party`, `sleep`, `commute`, `cooking`

#### Natural Language Vibes

Describe the vibe you want:

```bash
spotify-gen playlist vibe "late night coding session"
spotify-gen playlist vibe "chill sunday morning coffee"
spotify-gen playlist vibe "road trip through the desert"
spotify-gen playlist vibe "intense gym session with heavy beats"
spotify-gen playlist vibe "romantic dinner date"
spotify-gen playlist vibe "rainy day melancholy"
```

The tool parses your description and maps it to audio features.

#### Discovery Mode

Find new music that matches your taste:

```bash
spotify-gen playlist discover
spotify-gen playlist discover --based-on "artist:Tame Impala"
spotify-gen playlist discover --based-on "track:Blinding Lights"
```

#### Similar To

```bash
spotify-gen playlist like "Daft Punk"
spotify-gen playlist like "artist:Radiohead"
spotify-gen playlist like "track:Bohemian Rhapsody"
```

#### Time of Day

```bash
spotify-gen playlist time morning
spotify-gen playlist time afternoon
spotify-gen playlist time evening
spotify-gen playlist time night
```

### Common Options

All playlist commands support:

- `-t, --tracks <number>` — Number of tracks (default: 25)
- `--duration <minutes>` — Target duration instead of track count
- `-n, --name <name>` — Custom playlist name
- `-d, --discover` — Include less popular tracks
- `--public` — Make the playlist public

## How It Works

### Taste Analysis

The tool fetches:
- Your top tracks (short, medium, long term)
- Your top artists
- Recently played tracks
- Audio features for all tracks

It then builds a profile:
- Weighted genre preferences
- Average audio feature values
- Feature ranges (your min/max preferences)
- Listening patterns

### Playlist Generation

1. **Seeds** — Uses your top artists/tracks as recommendation seeds
2. **Target Features** — Maps mood/activity/vibe to audio feature targets
3. **Personalization** — Blends preset targets with your personal taste
4. **Spotify Recommendations API** — Generates tracks matching criteria
5. **Creates Playlist** — Saves directly to your Spotify account

### Audio Features Used

| Feature | Description |
|---------|-------------|
| Danceability | How suitable for dancing (rhythm, tempo, beat) |
| Energy | Intensity and activity level |
| Valence | Musical positiveness (happy vs sad) |
| Acousticness | Likelihood of being acoustic |
| Instrumentalness | Predicts if track has no vocals |
| Tempo | Beats per minute |
| Loudness | Overall loudness in dB |

## Examples

```bash
# Happy 30-track playlist for a party
spotify-gen playlist mood happy --tracks 30 --name "Good Vibes Party"

# 90-minute workout playlist
spotify-gen playlist workout --duration 90 --name "Beast Mode"

# Discover new indie music
spotify-gen playlist discover --based-on "artist:Mac DeMarco" --tracks 50

# Late night coding session
spotify-gen playlist vibe "electronic ambient focus beats for late night coding"

# Similar to multiple influences
spotify-gen playlist like "artist:The Strokes"
```

## Configuration

Config is stored at `~/.config/spotify-playlist-gen/config.json`

```bash
# View config path
spotify-gen auth --status
```

## Development

```bash
# Install deps
npm install

# Run in dev mode
npm run dev -- auth

# Build
npm run build

# Run built version
node dist/index.js analyze
```

## License

MIT

---

Made with 🎵 by music lovers, for music lovers.
