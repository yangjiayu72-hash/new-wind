# 3D Particle Network System

An interactive 3D visualization featuring particle-based network structures that respond to wind forces, mouse interactions, and touch gestures. Experience fluid, organic motion as particles drift, flow, and react to your every movement.

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

### Interactive Controls

#### Keyboard Wind Control
Control wind forces using arrow keys:
- **↑ Up Arrow**: Wind from bottom to top
- **↓ Down Arrow**: Wind from top to bottom
- **← Left Arrow**: Wind from right to left
- **→ Right Arrow**: Wind from left to right
- Multiple keys can be pressed simultaneously for diagonal wind

#### Mouse Interactions
- **Mouse Movement**: Particles are gently attracted to your cursor
  - Creates smooth, flowing movement toward mouse position
  - Influence radius: ~25 units with distance-based falloff
  - Individual vertices respond with organic deformation
- **Mouse Hover**: Particles near cursor glow and brighten
  - Opacity increases based on proximity
  - Subtle color shift to brighter cyan
  - Smooth fade transitions
- **Click**: Creates an explosive burst effect
  - Pushes particles away from click point
  - Burst radius: ~25 units
  - Strength: 2.0 force units
- **Click + Drag**: Creates a stronger swirling burst
  - Enhanced burst radius: ~35 units
  - Increased strength: 3.0 force units
  - Perfect for creating dramatic effects

#### Touch Support (Mobile/Tablet)
- **Touch Move**: Same as mouse movement - attracts particles
- **Tap**: Creates burst effect like mouse click
- **Touch Drag**: Creates enhanced burst like mouse drag
- Full touch gesture support for all interactions

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
- `ParticleNet` class: Individual network structures with interactive methods
- Wind physics system: Force application and deformation
- Mouse interaction system: Attraction, hover effects, and burst mechanics
- Touch event handlers: Full mobile device support
- Animation loop: 60fps rendering with multi-layer interaction
- Event handlers: Keyboard, mouse, and touch input processing

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

### Keyboard
| Key | Action |
|-----|--------|
| ↑ | Apply upward wind force |
| ↓ | Apply downward wind force |
| ← | Apply leftward wind force |
| → | Apply rightward wind force |

Multiple keys can be pressed simultaneously to create diagonal wind directions.

### Mouse
| Action | Effect |
|--------|--------|
| Move | Attract particles to cursor with smooth falloff |
| Hover | Glow and brighten nearby particles |
| Click | Create explosive burst pushing particles away |
| Click + Drag | Enhanced burst with larger radius and strength |

### Touch (Mobile/Tablet)
| Gesture | Effect |
|---------|--------|
| Touch Move | Attract particles to touch point |
| Tap | Create burst effect |
| Touch Drag | Enhanced burst effect |

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

### Customize Mouse Interactions
In the `mouseState` object:
```javascript
influenceRadius: 25,        // Distance of mouse attraction
influenceStrength: 1.5      // Strength of attraction force
```

In mouse click handler:
```javascript
strength: 2.0,              // Normal click burst strength
radius: 25,                 // Normal click burst radius
// Drag values
strength: 3.0,              // Enhanced drag burst strength
radius: 35                  // Enhanced drag burst radius
```

## Performance

- Optimized for 40 particle networks with varied shapes
- Each network contains 60-200 vertices depending on shape complexity
- Runs at 60fps on modern hardware
- GPU-accelerated rendering via WebGL
- Smooth interpolation and easing for fluid motion
- Delta time capping prevents performance spikes
