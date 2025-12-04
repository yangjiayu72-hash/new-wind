# 3D Particle Network System

An interactive 3D visualization featuring particle-based network structures that respond to wind forces controlled by keyboard input.

## Features

### Visual Elements
- **Black 3D Space**: Empty void with no background distractions
- **Particle Networks**: 40 unique net-like structures composed of interconnected points and lines
- **Varying Shapes**: Six distinct geometric forms - spheres, elongated ellipsoids, flat discs, tubes, clusters, and irregular shapes
- **Varying Properties**: Each network has different size, spacing, density, and color
- **Color Palette**: Multiple shades of cyan and blue with varied opacity for depth
- **Dynamic Wireframe**: Semi-transparent connections creating ethereal mesh structures

### Idle Behavior
When no interaction is occurring, all particle networks exhibit:
- **Gentle Drifting**: Multi-layered smooth positional movement with organic flow
- **Slow Oscillation**: Sinusoidal motion patterns at varying frequencies
- **Subtle Rotation**: Continuous rotation with easing for natural movement
- **Mesh Deformation**: Multiple wave layers creating flowing, organic surface deformations
- **Smooth Interpolation**: All movements use easing functions for fluid transitions

### Wind Interaction
Control wind forces using arrow keys:
- **↑ Up Arrow**: Wind from bottom to top
- **↓ Down Arrow**: Wind from top to bottom
- **← Left Arrow**: Wind from right to left
- **→ Right Arrow**: Wind from left to right

#### Wind Effects
- Smooth force field applied across entire 3D space with gradual transitions
- All particles respond simultaneously with individual turbulence
- Gentle movement shifts in wind direction
- Mesh surfaces stretch and bend with fluid deformation
- Multi-layered turbulence creates natural, flowing secondary motion
- Trailing regions exhibit organic folding and wave behavior
- Wind accumulator provides smooth acceleration and deceleration

#### Recovery
- Release arrow keys to stop wind
- Particles gradually return to original shapes with ease-out easing
- Smooth interpolation back to idle state over time
- Physics-based damping with gradual velocity decay
- Wind accumulator smoothly dissipates for natural transitions

## Technical Implementation

### Technologies
- **Three.js**: 3D graphics rendering
- **ES6 Modules**: Modern JavaScript architecture
- **WebGL**: Hardware-accelerated graphics

### Key Components
- `ParticleNet` class: Individual network structures
- Wind physics system: Force application and deformation
- Animation loop: 60fps rendering
- Keyboard event handlers: Real-time input processing

## Running the Project

### Option 1: Local Development Server
```bash
# Using Python
python -m http.server 8000

# Using Node.js
npx serve
```

Then open `http://localhost:8000` in your browser.

### Option 2: Direct File Access
Simply open `index.html` in a modern web browser that supports ES6 modules.

## Controls

| Key | Action |
|-----|--------|
| ↑ | Apply upward wind force |
| ↓ | Apply downward wind force |
| ← | Apply leftward wind force |
| → | Apply rightward wind force |

Multiple keys can be pressed simultaneously to create diagonal wind directions.

## Browser Requirements

- Modern browser with WebGL support
- ES6 module support
- Tested on: Chrome, Firefox, Safari, Edge

## Customization

### Adjust Number of Particles
In `main.js`, modify:
```javascript
const numNets = 40; // Change this value
```

### Modify Wind Strength
In `main.js`, adjust:
```javascript
windState.targetStrength = 1.0; // Increase for stronger wind
```

### Change Colors
In `ParticleNet.createMesh()`:
```javascript
const colors = [0x00ffff, 0x00ccff, 0x0099ff, 0x00ffcc, 0x33ffff];
```

### Adjust Shape Distribution
In `main.js`, modify:
```javascript
const shapeTypes = ['sphere', 'elongated', 'flat', 'tube', 'cluster', 'irregular'];
```

### Fine-tune Movement Smoothness
Adjust oscillation speeds and amplitudes in the `ParticleNet` constructor:
```javascript
this.oscillationSpeed = 0.15 + Math.random() * 0.25; // Lower = slower
this.oscillationAmplitude = 1.5 + Math.random() * 2.5; // Drift distance
```

## Performance

- Optimized for 40 particle networks with varied shapes
- Each network contains 60-200 vertices depending on shape complexity
- Runs at 60fps on modern hardware
- GPU-accelerated rendering via WebGL
- Smooth interpolation and easing for fluid motion
- Delta time capping prevents performance spikes
