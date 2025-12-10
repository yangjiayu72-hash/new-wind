# 3D Particle Network System

An interactive 3D visualization featuring particle-based network structures that move like soft, flowing fabric in the wind. Watch as delicate meshes flutter, ripple, and billow in response to wind forces, mouse interactions, and touch gestures. Experience the mesmerizing beauty of silk scarves dancing through space, reacting to your every movement with organic, physics-based motion.

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
- **Fabric-like Flutter**: Soft rippling and billowing like silk scarves in a gentle breeze
- **Wave Propagation**: Waves flow through the mesh creating organic deformation
- **Trailing Motion**: Outer vertices lag behind center, creating natural follow-through
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
  - Creates smooth, flowing movement toward mouse position like fabric being pulled
  - Influence radius: ~25 units with distance-based falloff
  - Individual vertices respond with organic, fabric-like deformation
  - Wave effects propagate through the mesh structure
- **Mouse Hover**: Particles near cursor glow and brighten
  - Opacity increases based on proximity
  - Subtle color shift to brighter cyan
  - Smooth fade transitions
- **Click**: Creates an explosive burst effect with ripples
  - Pushes particles away from click point
  - Ripple waves spread through the mesh like dropping a stone in water
  - Burst radius: ~25 units
  - Strength: 2.0 force units
- **Click + Drag**: Creates a stronger swirling burst
  - Enhanced burst radius: ~35 units with fabric rippling
  - Increased strength: 3.0 force units
  - Perfect for creating dramatic wave effects

#### Touch Support (Mobile/Tablet)
- **Touch Move**: Same as mouse movement - attracts particles
- **Tap**: Creates burst effect like mouse click
- **Touch Drag**: Creates enhanced burst like mouse drag
- Full touch gesture support for all interactions

#### Wind Effects
- Smooth force field applied across entire 3D space with gradual transitions
- All particles respond simultaneously with individual turbulence
- Fabric-like rippling and waving like scarves in the wind
- Mesh surfaces stretch, bend, and billow with soft, flowing deformation
- Wave propagation spreads through the mesh structure
- Outer vertices trail behind center, creating natural fabric motion
- Multi-layered turbulence creates natural, flowing secondary motion
- Gentle sway and flutter effects enhance the organic feel
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
- `ParticleNet` class: Individual network structures with fabric-like physics
- Fabric simulation: Flutter, billowing, wave propagation, and trailing behavior
- Wind physics system: Soft force application with ripple effects
- Mouse interaction system: Attraction, hover effects, and burst mechanics with wave propagation
- Touch event handlers: Full mobile device support
- Animation loop: 60fps rendering with multi-layer interaction
- Event handlers: Keyboard, mouse, and touch input processing

### Fabric-Like Physics
The particle networks simulate soft, flowing fabric behavior:
- **Flutter**: Each mesh oscillates with unique phase offsets creating natural variation
- **Billowing**: Multi-frequency sine waves combine for organic puffing motion
- **Wave Propagation**: Disturbances ripple outward from center to edges
- **Trailing Behavior**: Outer vertices lag behind center, mimicking fabric inertia
- **Soft Damping**: Reduced velocity damping (0.88) allows flowing, continued motion
- **Ripple Effects**: Click and wind forces create waves that spread through the mesh
- **Distance-based Response**: Vertices farther from center respond more dramatically

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
