# Audio Setup Guide

This guide explains how to add background music and wind sounds to your 3D Particle Network System.

## Audio Files Needed

You need two audio files:
1. **ambient-music.mp3** - Soothing, mysterious background music
2. **wind-ambient.mp3** - Gentle wind sound effects

## File Structure

Create an `audio` directory in your project root and add the files:

```
new-wind/
├── audio/
│   ├── ambient-music.mp3
│   ├── ambient-music.ogg (optional, for better browser support)
│   ├── wind-ambient.mp3
│   └── wind-ambient.ogg (optional, for better browser support)
├── index.html
├── main.js
├── style.css
└── README.md
```

## Where to Find Free Audio

### Recommended Free Music Sources

1. **Pixabay Audio** (https://pixabay.com/music/)
   - Free for commercial use
   - No attribution required
   - Search for: "ambient", "mysterious", "meditation", "space"
   - Recommended tracks:
     - "Deep Space" - Dark ambient soundscape
     - "Ethereal Meditation" - Peaceful ambient
     - "Cosmic Winds" - Space ambient

2. **Freesound** (https://freesound.org/)
   - Free sound effects and music
   - Creative Commons licenses
   - Search for: "ambient drone", "wind atmosphere"

3. **YouTube Audio Library** (https://www.youtube.com/audiolibrary)
   - Free music and sound effects
   - No attribution required for most tracks
   - Filter by Genre: "Ambient"

### Recommended Wind Sound Sources

1. **Freesound.org**
   - Search: "wind gentle", "wind ambient", "wind soft"
   - Good examples:
     - "Gentle Wind Loop"
     - "Soft Wind Ambience"
     - "Wind Howling Soft"

2. **ZapSplat** (https://www.zapsplat.com/)
   - Free for non-commercial use
   - Search: "wind loop ambient"

3. **BBC Sound Effects** (https://sound-effects.bbcrewind.co.uk/)
   - Free sound effects library
   - Search: "wind"

## Audio Specifications

### Background Music
- **Duration**: 2-5 minutes (will loop automatically)
- **Style**: Ambient, atmospheric, minimal
- **Tempo**: Slow (60-80 BPM)
- **Mood**: Mysterious, ethereal, peaceful, meditative
- **Instruments**: Pads, drones, gentle synths, nature sounds
- **Format**: MP3 (128-320 kbps) or OGG

### Wind Sound
- **Duration**: 10-30 seconds (short loop is better)
- **Type**: Gentle breeze, not storm
- **Volume**: Medium-low intensity
- **Format**: MP3 or OGG
- **Note**: Should be seamless when looping

## Quick Setup with Placeholder URLs

If you want to test quickly without downloading files, you can use royalty-free URLs:

### Option 1: Using Pixabay (Recommended)
1. Visit https://pixabay.com/music/
2. Find suitable ambient music
3. Download MP3
4. Save to `audio/ambient-music.mp3`

### Option 2: Using Free Music Archive
1. Visit https://freemusicarchive.org/
2. Search for "ambient" with Creative Commons license
3. Download and save

## Converting Audio Files

If you have audio in other formats, convert to MP3:

### Using FFmpeg (Command Line)
```bash
# Convert to MP3
ffmpeg -i input.wav -codec:a libmp3lame -qscale:a 2 ambient-music.mp3

# Create loopable wind sound
ffmpeg -i wind.wav -af "afade=t=in:d=0.5,afade=t=out:st=9.5:d=0.5" wind-ambient.mp3
```

### Online Converters
- CloudConvert (https://cloudconvert.com/)
- Online-Convert (https://audio.online-convert.com/)

## Creating Your Own Wind Sound

You can create a simple wind sound using audio software:

1. **Audacity** (Free)
   - Generate > Noise (White or Pink)
   - Effect > Low Pass Filter (1000 Hz)
   - Effect > Normalize
   - Effect > Fade In/Out
   - Export as MP3

2. **Online Tone Generator**
   - Generate brown noise
   - Apply low-pass filter
   - Loop and crossfade

## Testing Audio

1. Create the `audio` directory:
   ```bash
   mkdir audio
   ```

2. Add your audio files to the directory

3. Open `index.html` in a browser

4. Look for the audio controls in the bottom-right corner

5. Click the speaker icon to enable audio

6. Use the volume sliders to adjust music and wind levels

## Troubleshooting

### Audio Doesn't Play
- **Browser autoplay policy**: Click anywhere on the page first
- **File path**: Make sure files are in `audio/` directory
- **File format**: Try both MP3 and OGG formats
- **Console errors**: Check browser console (F12) for error messages

### Wind Sound Not Changing Volume
- Make sure you're pressing arrow keys to activate wind
- Check that wind volume slider isn't at 0
- Wind volume increases when arrow keys are pressed

### Audio Button Not Responding
- Check browser console for JavaScript errors
- Make sure audio files exist in the correct location
- Try refreshing the page

## Recommended Settings

For the best experience:
- **Music Volume**: 60% (default)
- **Wind Volume**: 40% (default)
- Wind volume automatically increases when pressing arrow keys

## Alternative: Web Audio API Synthesis

If you don't want to use audio files, you can generate sounds using Web Audio API. See `AUDIO_SYNTHESIS.md` for details on generating procedural ambient sounds.

## License Considerations

When using free audio:
- Check the license (CC0, CC BY, etc.)
- Some require attribution
- Keep license info for your records
- For commercial projects, ensure commercial use is allowed

## Recommended Track Suggestions

### Ambient Music (from Pixabay)
1. "Meditation" by Olexy
2. "Ambient Piano" by Ashot-Danielyan
3. "Deep Meditation" by Prabajithk

### Wind Sounds (from Freesound)
1. "Wind Gentle Loop" (search on Freesound.org)
2. "Soft Breeze"
3. "Wind Ambient Medium"

---

Once you've added the audio files, the visualization will have a complete atmospheric experience with gentle background music and reactive wind sounds!
