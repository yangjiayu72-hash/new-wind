# 3D Particle Network System

An interactive 3D visualization featuring particle-based network structures that respond to wind forces controlled by keyboard input.

## Features

### Visual Elements
- **Black 3D Space**: Empty void with no background distractions
- **Particle Networks**: 30 unique net-like structures composed of interconnected points and lines
- **Varying Properties**: Each network has different size, spacing, and density
- **Cyan Wireframe**: Semi-transparent connections creating ethereal mesh structures

### Idle Behavior
When no interaction is occurring, all particle networks exhibit:
- **Gentle Drifting**: Smooth positional movement through space
- **Slow Oscillation**: Sinusoidal motion patterns
- **Subtle Rotation**: Continuous rotation on all axes
- **Mesh Deformation**: Organic wave-like surface deformations

### Wind Interaction
Control wind forces using arrow keys:
- **↑ Up Arrow**: Wind from bottom to top
- **↓ Down Arrow**: Wind from top to bottom
- **← Left Arrow**: Wind from right to left
- **→ Right Arrow**: Wind from left to right

#### Wind Effects
- Force field applied across entire 3D space
- All particles respond simultaneously
- Movement shifts in wind direction
- Mesh surfaces stretch and bend
- Local turbulence creates secondary motion
- Trailing regions exhibit folding behavior

#### Recovery
- Release arrow keys to stop wind
- Particles gradually return to original shapes
- Smooth interpolation back to idle state
- Physics-based damping for natural movement

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
const numNets = 30; // Change this value
```

### Modify Wind Strength
In `main.js`, adjust:
```javascript
windState.targetStrength = 1.0; // Increase for stronger wind
```

### Change Colors
In `ParticleNet.createMesh()`:
```javascript
color: 0x00ffff, // Hex color code
```

## Performance

- Optimized for 30 particle networks
- Each network contains 50-150 vertices
- Runs at 60fps on modern hardware
- GPU-accelerated rendering via WebGL
