import * as THREE from 'three';

// Scene setup
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x000000);

const camera = new THREE.PerspectiveCamera(
    75,
    window.innerWidth / window.innerHeight,
    0.1,
    1000
);
camera.position.z = 50;

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio);
document.body.appendChild(renderer.domElement);

// Wind state
const windState = {
    active: false,
    direction: new THREE.Vector3(0, 0, 0),
    strength: 0,
    targetStrength: 0,
    keys: {
        ArrowUp: false,
        ArrowDown: false,
        ArrowLeft: false,
        ArrowRight: false
    }
};

// Particle Network Class
class ParticleNet {
    constructor(position, size, density) {
        this.basePosition = position.clone();
        this.size = size;
        this.density = density;
        this.time = Math.random() * 1000;

        // Idle animation parameters
        this.driftSpeed = new THREE.Vector3(
            (Math.random() - 0.5) * 0.02,
            (Math.random() - 0.5) * 0.02,
            (Math.random() - 0.5) * 0.02
        );
        this.oscillationSpeed = 0.3 + Math.random() * 0.5;
        this.oscillationAmplitude = 0.5 + Math.random() * 1.0;
        this.rotationSpeed = new THREE.Vector3(
            (Math.random() - 0.5) * 0.005,
            (Math.random() - 0.5) * 0.005,
            (Math.random() - 0.5) * 0.005
        );

        // Create mesh structure
        this.createMesh();

        // Wind physics
        this.velocities = [];
        this.originalPositions = [];
        const positions = this.geometry.attributes.position;
        for (let i = 0; i < positions.count; i++) {
            this.velocities.push(new THREE.Vector3(0, 0, 0));
            this.originalPositions.push(new THREE.Vector3(
                positions.getX(i),
                positions.getY(i),
                positions.getZ(i)
            ));
        }
    }

    createMesh() {
        const geometry = new THREE.BufferGeometry();
        const vertices = [];
        const indices = [];

        // Create grid of vertices
        const gridSize = Math.floor(4 + this.density * 3);
        const step = this.size / gridSize;
        const vertexMap = new Map();

        let vertexIndex = 0;

        // Generate vertices in a spherical/blob shape
        for (let i = 0; i <= gridSize; i++) {
            for (let j = 0; j <= gridSize; j++) {
                for (let k = 0; k <= gridSize; k++) {
                    const x = (i - gridSize / 2) * step;
                    const y = (j - gridSize / 2) * step;
                    const z = (k - gridSize / 2) * step;

                    // Add some randomness and spherical shaping
                    const dist = Math.sqrt(x * x + y * y + z * z);
                    const maxDist = this.size * 0.6;

                    if (dist < maxDist) {
                        const noise = (Math.random() - 0.5) * 0.3;
                        vertices.push(x + noise, y + noise, z + noise);
                        vertexMap.set(`${i},${j},${k}`, vertexIndex);
                        vertexIndex++;
                    }
                }
            }
        }

        // Create connections between nearby vertices
        // OPTIMIZED: Use spatial grid to avoid O(n²) comparisons
        const positions = new Float32Array(vertices);
        const numVertices = positions.length / 3;
        const maxConnectionDist = step * 2.0;
        const maxConnectionDistSq = maxConnectionDist * maxConnectionDist;

        // Build spatial hash grid for efficient neighbor finding
        const cellSize = maxConnectionDist;
        const spatialGrid = new Map();

        const getCellKey = (x, y, z) => {
            const cx = Math.floor(x / cellSize);
            const cy = Math.floor(y / cellSize);
            const cz = Math.floor(z / cellSize);
            return `${cx},${cy},${cz}`;
        };

        // Populate spatial grid
        for (let i = 0; i < numVertices; i++) {
            const x = positions[i * 3];
            const y = positions[i * 3 + 1];
            const z = positions[i * 3 + 2];
            const key = getCellKey(x, y, z);

            if (!spatialGrid.has(key)) {
                spatialGrid.set(key, []);
            }
            spatialGrid.get(key).push(i);
        }

        // Find connections only within nearby cells
        const checked = new Set();
        for (let i = 0; i < numVertices; i++) {
            const x1 = positions[i * 3];
            const y1 = positions[i * 3 + 1];
            const z1 = positions[i * 3 + 2];

            const cx = Math.floor(x1 / cellSize);
            const cy = Math.floor(y1 / cellSize);
            const cz = Math.floor(z1 / cellSize);

            // Check current cell and adjacent cells (27 cells total)
            for (let dx = -1; dx <= 1; dx++) {
                for (let dy = -1; dy <= 1; dy++) {
                    for (let dz = -1; dz <= 1; dz++) {
                        const neighborKey = `${cx + dx},${cy + dy},${cz + dz}`;
                        const neighbors = spatialGrid.get(neighborKey);

                        if (neighbors) {
                            for (const j of neighbors) {
                                if (j <= i) continue; // Skip already checked pairs

                                const pairKey = `${i}-${j}`;
                                if (checked.has(pairKey)) continue;
                                checked.add(pairKey);

                                const x2 = positions[j * 3];
                                const y2 = positions[j * 3 + 1];
                                const z2 = positions[j * 3 + 2];

                                // Use squared distance to avoid sqrt
                                const dx = x2 - x1;
                                const dy = y2 - y1;
                                const dz = z2 - z1;
                                const distSq = dx * dx + dy * dy + dz * dz;

                                if (distSq < maxConnectionDistSq) {
                                    indices.push(i, j);
                                }
                            }
                        }
                    }
                }
            }
        }

        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        geometry.setIndex(indices);

        // Create material with thin lines
        const material = new THREE.LineBasicMaterial({
            color: 0x00ffff,
            transparent: true,
            opacity: 0.6,
            linewidth: 1
        });

        // Create mesh
        this.mesh = new THREE.LineSegments(geometry, material);
        this.mesh.position.copy(this.basePosition);
        this.geometry = geometry;
        this.material = material;
    }

    updateIdle(deltaTime) {
        this.time += deltaTime;

        // Gentle drift
        this.mesh.position.x = this.basePosition.x +
            Math.sin(this.time * this.driftSpeed.x * 100) * this.oscillationAmplitude;
        this.mesh.position.y = this.basePosition.y +
            Math.cos(this.time * this.driftSpeed.y * 100) * this.oscillationAmplitude;
        this.mesh.position.z = this.basePosition.z +
            Math.sin(this.time * this.driftSpeed.z * 100) * this.oscillationAmplitude * 0.5;

        // Slow rotation
        this.mesh.rotation.x += this.rotationSpeed.x;
        this.mesh.rotation.y += this.rotationSpeed.y;
        this.mesh.rotation.z += this.rotationSpeed.z;

        // Subtle mesh deformation
        const positions = this.geometry.attributes.position;
        for (let i = 0; i < positions.count; i++) {
            const original = this.originalPositions[i];
            const deformAmount = 0.1;
            const wave1 = Math.sin(this.time * this.oscillationSpeed + i * 0.1) * deformAmount;
            const wave2 = Math.cos(this.time * this.oscillationSpeed * 0.7 + i * 0.15) * deformAmount;

            positions.setXYZ(
                i,
                original.x + wave1,
                original.y + wave2,
                original.z + wave1 * 0.5
            );
        }
        positions.needsUpdate = true;
    }

    applyWind(windDirection, windStrength, deltaTime) {
        const positions = this.geometry.attributes.position;

        for (let i = 0; i < positions.count; i++) {
            const pos = new THREE.Vector3(
                positions.getX(i),
                positions.getY(i),
                positions.getZ(i)
            );

            // Calculate world position
            const worldPos = pos.clone().applyMatrix4(this.mesh.matrixWorld);

            // Wind force with turbulence
            const turbulence = new THREE.Vector3(
                Math.sin(this.time * 2 + worldPos.x * 0.1) * 0.3,
                Math.cos(this.time * 2 + worldPos.y * 0.1) * 0.3,
                Math.sin(this.time * 2 + worldPos.z * 0.1) * 0.3
            );

            const windForce = windDirection.clone()
                .multiplyScalar(windStrength * 2.0)
                .add(turbulence);

            // Apply force to velocity
            this.velocities[i].add(windForce.multiplyScalar(deltaTime));

            // Damping
            this.velocities[i].multiplyScalar(0.95);

            // Update position
            pos.add(this.velocities[i].clone().multiplyScalar(deltaTime));

            positions.setXYZ(i, pos.x, pos.y, pos.z);
        }

        positions.needsUpdate = true;

        // Apply force to mesh position
        const meshForce = windDirection.clone().multiplyScalar(windStrength * deltaTime * 5);
        this.mesh.position.add(meshForce);
    }

    recover(deltaTime) {
        const positions = this.geometry.attributes.position;
        const recoverySpeed = 2.0;

        for (let i = 0; i < positions.count; i++) {
            const current = new THREE.Vector3(
                positions.getX(i),
                positions.getY(i),
                positions.getZ(i)
            );

            const target = this.originalPositions[i].clone();

            // Lerp back to original position
            current.lerp(target, deltaTime * recoverySpeed);

            positions.setXYZ(i, current.x, current.y, current.z);

            // Dampen velocity
            this.velocities[i].multiplyScalar(0.9);
        }

        positions.needsUpdate = true;

        // Recover mesh position
        this.mesh.position.lerp(this.basePosition, deltaTime * recoverySpeed);
    }
}

// Create particle networks with error handling
const particleNets = [];
const numNets = 30;

try {
    // Show loading state
    console.log('Initializing particle networks...');

    for (let i = 0; i < numNets; i++) {
        const position = new THREE.Vector3(
            (Math.random() - 0.5) * 80,
            (Math.random() - 0.5) * 80,
            (Math.random() - 0.5) * 60
        );

        const size = 2 + Math.random() * 4;
        const density = 0.3 + Math.random() * 0.7;

        const net = new ParticleNet(position, size, density);
        particleNets.push(net);
        scene.add(net.mesh);
    }

    console.log('Particle networks initialized successfully!');
} catch (error) {
    console.error('Error initializing particle networks:', error);
    // Show error to user
    const instructions = document.getElementById('instructions');
    if (instructions) {
        instructions.textContent = 'Error loading scene. Please refresh the page.';
        instructions.style.color = 'rgba(255, 100, 100, 0.9)';
    }
}

// Keyboard controls
document.addEventListener('keydown', (e) => {
    if (e.code in windState.keys) {
        e.preventDefault();
        windState.keys[e.code] = true;
        updateWindDirection();
    }
});

document.addEventListener('keyup', (e) => {
    if (e.code in windState.keys) {
        e.preventDefault();
        windState.keys[e.code] = false;
        updateWindDirection();
    }
});

function updateWindDirection() {
    const direction = new THREE.Vector3(0, 0, 0);
    let hasWind = false;

    if (windState.keys.ArrowUp) {
        direction.y += 1;
        hasWind = true;
    }
    if (windState.keys.ArrowDown) {
        direction.y -= 1;
        hasWind = true;
    }
    if (windState.keys.ArrowLeft) {
        direction.x += 1;
        hasWind = true;
    }
    if (windState.keys.ArrowRight) {
        direction.x -= 1;
        hasWind = true;
    }

    if (hasWind) {
        direction.normalize();
        windState.direction.copy(direction);
        windState.targetStrength = 1.0;
        windState.active = true;
    } else {
        windState.targetStrength = 0;
        windState.active = false;
    }
}

// Animation loop
const clock = new THREE.Clock();

function animate() {
    requestAnimationFrame(animate);

    try {
        const deltaTime = clock.getDelta();

        // Smooth wind strength transition
        const strengthDelta = windState.targetStrength - windState.strength;
        windState.strength += strengthDelta * deltaTime * 5;

        // Update all particle networks with blended behaviors
        particleNets.forEach(net => {
            try {
                if (windState.strength > 0.01) {
                    net.applyWind(windState.direction, windState.strength, deltaTime);
                } else {
                    net.recover(deltaTime);
                }

                // Always apply idle animation for smooth blending
                if (windState.strength < 0.5) {
                    net.updateIdle(deltaTime);
                }
            } catch (error) {
                // Log error but continue with other networks
                console.error('Error updating particle network:', error);
            }
        });

        // Gentle camera movement
        camera.position.x = Math.sin(clock.elapsedTime * 0.1) * 5;
        camera.position.y = Math.cos(clock.elapsedTime * 0.15) * 3;
        camera.lookAt(0, 0, 0);

        renderer.render(scene, camera);
    } catch (error) {
        // Log error but keep animation loop running
        console.error('Error in animation loop:', error);
    }
}

// Handle window resize
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

// Start animation (always start, even if initialization had errors)
// This ensures the interface never completely freezes
try {
    animate();
    console.log('Animation loop started');
} catch (error) {
    console.error('Error starting animation loop:', error);
    const instructions = document.getElementById('instructions');
    if (instructions) {
        instructions.textContent = 'Critical error. Please refresh the page.';
        instructions.style.color = 'rgba(255, 50, 50, 1.0)';
    }
}
