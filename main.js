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

// Screen shake state
const screenShakeState = {
    intensity: 0,
    decay: 0.95
};

// Raycaster for click detection
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();

// Geometry tracking for uniqueness
const geometryTracker = {
    usedGeometries: new Map(), // meshId -> geometryType
    availableTypes: []
};

// Procedural geometry generators
const geometryGenerators = {
    sphere: (size) => {
        const geometry = new THREE.IcosahedronGeometry(size, 1);
        return geometry;
    },

    cube: (size) => {
        const geometry = new THREE.BoxGeometry(size, size, size, 2, 2, 2);
        // Add some randomness to vertices
        const positions = geometry.attributes.position;
        for (let i = 0; i < positions.count; i++) {
            const noise = (Math.random() - 0.5) * 0.2;
            positions.setXYZ(
                i,
                positions.getX(i) * (1 + noise),
                positions.getY(i) * (1 + noise),
                positions.getZ(i) * (1 + noise)
            );
        }
        return geometry;
    },

    torus: (size) => {
        const geometry = new THREE.TorusGeometry(size * 0.6, size * 0.3, 8, 12);
        return geometry;
    },

    cone: (size) => {
        const geometry = new THREE.ConeGeometry(size * 0.7, size * 1.5, 8, 3);
        return geometry;
    },

    cylinder: (size) => {
        const geometry = new THREE.CylinderGeometry(size * 0.6, size * 0.6, size * 1.2, 8, 3);
        return geometry;
    },

    octahedron: (size) => {
        const geometry = new THREE.OctahedronGeometry(size, 1);
        return geometry;
    },

    torusKnot: (size) => {
        const geometry = new THREE.TorusKnotGeometry(size * 0.5, size * 0.2, 50, 8);
        return geometry;
    },

    dodecahedron: (size) => {
        const geometry = new THREE.DodecahedronGeometry(size, 0);
        return geometry;
    },

    tetrahedron: (size) => {
        const geometry = new THREE.TetrahedronGeometry(size, 0);
        return geometry;
    },

    blob: (size) => {
        const geometry = new THREE.IcosahedronGeometry(size, 1);
        const positions = geometry.attributes.position;
        for (let i = 0; i < positions.count; i++) {
            const noise = Math.random() * 0.5 + 0.7;
            positions.setXYZ(
                i,
                positions.getX(i) * noise,
                positions.getY(i) * noise,
                positions.getZ(i) * noise
            );
        }
        return geometry;
    }
};

// Initialize available geometry types
geometryTracker.availableTypes = Object.keys(geometryGenerators);

// Get random color
function getRandomColor() {
    const colors = [
        0x00ffff, // cyan
        0xff00ff, // magenta
        0xffff00, // yellow
        0x00ff00, // green
        0xff0000, // red
        0x0000ff, // blue
        0xff8800, // orange
        0x8800ff, // purple
        0x00ff88, // mint
        0xff0088  // pink
    ];
    return colors[Math.floor(Math.random() * colors.length)];
}

// Get unique geometry type
function getUniqueGeometryType(excludeTypes = []) {
    const available = geometryTracker.availableTypes.filter(
        type => !excludeTypes.includes(type)
    );

    if (available.length === 0) {
        // If all types used, allow reuse
        return geometryTracker.availableTypes[
            Math.floor(Math.random() * geometryTracker.availableTypes.length)
        ];
    }

    return available[Math.floor(Math.random() * available.length)];
}

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
    constructor(position, size, density, geometryType, meshId, initialColor = 0xffffff) {
        this.basePosition = position.clone();
        this.size = size;
        this.density = density;
        this.time = Math.random() * 1000;
        this.meshId = meshId;

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

        // Geometry and color
        this.currentGeometryType = geometryType;
        this.currentColor = initialColor;
        this.hasBeenClicked = false; // Track if mesh has been interacted with

        // Morphing state
        this.isMorphing = false;
        this.morphProgress = 0;
        this.morphDuration = 1.0; // seconds
        this.sourcePositions = null;
        this.targetPositions = null;
        this.sourceColor = null;
        this.targetColor = null;

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
        // Generate geometry based on type
        const baseGeometry = geometryGenerators[this.currentGeometryType](this.size);

        // Create wireframe geometry
        const geometry = new THREE.WireframeGeometry(baseGeometry);

        // Create material
        const material = new THREE.LineBasicMaterial({
            color: this.currentColor,
            transparent: true,
            opacity: 0.6,
            linewidth: 1
        });

        // Create mesh
        this.mesh = new THREE.LineSegments(geometry, material);
        this.mesh.position.copy(this.basePosition);
        this.mesh.userData.particleNet = this;
        this.geometry = geometry;
        this.material = material;

        // Store in tracker
        geometryTracker.usedGeometries.set(this.meshId, this.currentGeometryType);
    }

    morphToNewShape(newGeometryType, newColor) {
        if (this.isMorphing) {
            console.log(`Mesh ${this.meshId} is already morphing, ignoring click`);
            return; // Already morphing, prevent concurrent morphs
        }

        // Get currently used geometry types (excluding this mesh)
        const usedTypes = Array.from(geometryTracker.usedGeometries.values())
            .filter((type, index) => {
                const keys = Array.from(geometryTracker.usedGeometries.keys());
                return keys[index] !== this.meshId;
            });

        // Get unique geometry type
        const finalGeometryType = newGeometryType || getUniqueGeometryType(usedTypes);

        // Don't morph to the same geometry type
        if (finalGeometryType === this.currentGeometryType) {
            console.log(`Mesh ${this.meshId} already has geometry type ${finalGeometryType}, selecting different type`);
            const otherTypes = geometryTracker.availableTypes.filter(t => t !== this.currentGeometryType);
            if (otherTypes.length === 0) return; // Only one geometry type exists
            const randomType = otherTypes[Math.floor(Math.random() * otherTypes.length)];
            return this.morphToNewShape(randomType, newColor); // Recursive call with different type
        }

        // Start morphing
        this.isMorphing = true;
        this.morphProgress = 0;
        this.sourceColor = new THREE.Color(this.material.color);
        this.targetColor = new THREE.Color(newColor);

        // Store the current geometry type before morphing
        const previousGeometryType = this.currentGeometryType;

        // PERFORMANCE FIX: Generate target geometry and extract positions, then immediately dispose
        const targetBaseGeometry = geometryGenerators[finalGeometryType](this.size);
        const targetWireframe = new THREE.WireframeGeometry(targetBaseGeometry);
        const targetPositions = targetWireframe.attributes.position.array;

        // CRITICAL: Validate geometry structure BEFORE accessing attributes
        if (!this.geometry || !this.geometry.attributes || !this.geometry.attributes.position) {
            console.error(`Mesh ${this.meshId} has invalid geometry structure, aborting morph`);
            targetBaseGeometry.dispose();
            targetWireframe.dispose();
            this.isMorphing = false;
            return;
        }

        // Get source positions (safe after validation)
        const sourcePositions = this.geometry.attributes.position.array;

        // Enhanced safety checks for geometry validation
        if (!sourcePositions || sourcePositions.length === 0 || !targetPositions || targetPositions.length === 0) {
            console.error(`Mesh ${this.meshId} has empty geometry, aborting morph`);
            // Clean up temporary geometries
            targetBaseGeometry.dispose();
            targetWireframe.dispose();
            this.isMorphing = false;
            return;
        }

        // PERFORMANCE FIX: Use actual vertex count, not padded arrays
        // This reduces memory usage and update loops
        const sourceCount = sourcePositions.length;
        const targetCount = targetPositions.length;

        // Store vertex counts for optimization
        this.morphSourceCount = sourceCount;
        this.morphTargetCount = targetCount;

        // Allocate arrays based on actual max count
        const maxCount = Math.max(sourceCount, targetCount);
        this.sourcePositions = new Float32Array(maxCount);
        this.targetPositions = new Float32Array(maxCount);

        // Copy source positions
        for (let i = 0; i < sourceCount; i++) {
            this.sourcePositions[i] = sourcePositions[i];
        }

        // Fill remaining with last position if source is smaller
        if (sourceCount < maxCount && sourceCount > 0) {
            const lastValue = sourcePositions[sourceCount - 1];
            for (let i = sourceCount; i < maxCount; i++) {
                this.sourcePositions[i] = lastValue;
            }
        }

        // Copy target positions
        for (let i = 0; i < targetCount; i++) {
            this.targetPositions[i] = targetPositions[i];
        }

        // Fill remaining with last position if target is smaller
        if (targetCount < maxCount && targetCount > 0) {
            const lastValue = targetPositions[targetCount - 1];
            for (let i = targetCount; i < maxCount; i++) {
                this.targetPositions[i] = lastValue;
            }
        }

        // CRITICAL: Dispose temporary geometries immediately to prevent memory leak
        targetBaseGeometry.dispose();
        targetWireframe.dispose();

        // Update geometry type tracker
        geometryTracker.usedGeometries.set(this.meshId, finalGeometryType);
        this.currentGeometryType = finalGeometryType;

        console.log(`Morphing mesh ${this.meshId} from ${previousGeometryType} to ${finalGeometryType} (${sourceCount} → ${targetCount} vertices)`);
    }

    updateMorphing(deltaTime) {
        if (!this.isMorphing) return;

        this.morphProgress += deltaTime / this.morphDuration;

        if (this.morphProgress >= 1.0) {
            // Morphing complete
            this.morphProgress = 1.0;
            this.isMorphing = false;

            // PERFORMANCE FIX: Generate final geometry and dispose base geometry
            const finalBaseGeometry = geometryGenerators[this.currentGeometryType](this.size);
            const finalWireframe = new THREE.WireframeGeometry(finalBaseGeometry);

            // CRITICAL: Dispose base geometry immediately after wireframe creation
            finalBaseGeometry.dispose();

            // Dispose old geometry
            this.geometry.dispose();

            // Update geometry
            this.geometry = finalWireframe;
            this.mesh.geometry = this.geometry;

            // Update material color
            this.material.color.copy(this.targetColor);
            this.currentColor = this.targetColor.getHex();

            // Update original positions for wind physics
            this.originalPositions = [];
            const positions = this.geometry.attributes.position;
            for (let i = 0; i < positions.count; i++) {
                this.originalPositions.push(new THREE.Vector3(
                    positions.getX(i),
                    positions.getY(i),
                    positions.getZ(i)
                ));
            }

            // Clear morphing data to free memory
            this.sourcePositions = null;
            this.targetPositions = null;
            this.sourceColor = null;
            this.targetColor = null;
            this.morphSourceCount = 0;
            this.morphTargetCount = 0;

            console.log(`Morphing complete for mesh ${this.meshId}`);
        } else {
            // PERFORMANCE OPTIMIZATION: Only update the actual vertex count, not padded values
            const eased = this.easeInOutCubic(this.morphProgress);
            const positions = this.geometry.attributes.position;

            // CRITICAL FIX: Ensure we don't write beyond the actual geometry buffer
            // Use the minimum of sourcePositions length and actual buffer length
            const arrayLength = Math.min(this.sourcePositions.length, positions.array.length);

            // Update positions in place (safe bounds)
            for (let i = 0; i < arrayLength; i++) {
                positions.array[i] = this.sourcePositions[i] +
                    (this.targetPositions[i] - this.sourcePositions[i]) * eased;
            }

            // Mark buffer as needing update
            positions.needsUpdate = true;

            // Interpolate color
            this.material.color.lerpColors(this.sourceColor, this.targetColor, eased);
        }
    }

    easeInOutCubic(t) {
        return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
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

    updateVibration(intensity) {
        // Apply rapid vibration to mesh position
        const vibrationAmount = intensity * 0.5;
        this.mesh.position.x += (Math.random() - 0.5) * vibrationAmount;
        this.mesh.position.y += (Math.random() - 0.5) * vibrationAmount;
        this.mesh.position.z += (Math.random() - 0.5) * vibrationAmount * 0.3;

        // Vibrate vertices for more dramatic effect
        const positions = this.geometry.attributes.position;
        for (let i = 0; i < positions.count; i++) {
            const original = this.originalPositions[i];
            const shake = intensity * 0.1;
            positions.setXYZ(
                i,
                original.x + (Math.random() - 0.5) * shake,
                original.y + (Math.random() - 0.5) * shake,
                original.z + (Math.random() - 0.5) * shake
            );
        }
        positions.needsUpdate = true;
    }
}

// Anomalous mesh state
const anomalousState = {
    mesh: null,
    meshId: -1,
    isVibrating: false,
    vibrationStartTime: 0,
    vibrationIntensity: 1.0,
    blackHoleSpawned: false,
    blackHoleSpawnTime: 0,
    delayDuration: 3.0 // seconds
};

// Black Hole class
class BlackHole {
    constructor(position) {
        this.position = position.clone();
        this.radius = 3.0;
        this.attractionRadius = 30.0;
        this.attractionForce = 15.0;
        this.isDragging = false;

        // Create visual representation
        this.createVisual();
    }

    createVisual() {
        // Black core
        const coreGeometry = new THREE.SphereGeometry(this.radius, 32, 32);
        const coreMaterial = new THREE.MeshBasicMaterial({
            color: 0x000000,
            transparent: true,
            opacity: 0.9
        });
        this.core = new THREE.Mesh(coreGeometry, coreMaterial);
        this.core.position.copy(this.position);

        // Purple glow
        const glowGeometry = new THREE.SphereGeometry(this.radius * 1.5, 32, 32);
        const glowMaterial = new THREE.MeshBasicMaterial({
            color: 0x8800ff,
            transparent: true,
            opacity: 0.3,
            side: THREE.BackSide
        });
        this.glow = new THREE.Mesh(glowGeometry, glowMaterial);
        this.glow.position.copy(this.position);

        // Outer glow
        const outerGlowGeometry = new THREE.SphereGeometry(this.radius * 2.5, 32, 32);
        const outerGlowMaterial = new THREE.MeshBasicMaterial({
            color: 0x4400aa,
            transparent: true,
            opacity: 0.15,
            side: THREE.BackSide
        });
        this.outerGlow = new THREE.Mesh(outerGlowGeometry, outerGlowMaterial);
        this.outerGlow.position.copy(this.position);

        // Group for userData
        this.mesh = new THREE.Group();
        this.mesh.add(this.core);
        this.mesh.add(this.glow);
        this.mesh.add(this.outerGlow);
        this.mesh.position.copy(this.position);
        this.mesh.userData.blackHole = this;
    }

    update(deltaTime) {
        // Animate glow pulsing
        const time = performance.now() / 1000;
        const pulse = Math.sin(time * 3) * 0.1 + 1.0;
        this.glow.scale.setScalar(pulse);
        this.outerGlow.scale.setScalar(pulse * 1.2);

        // Rotate core
        this.core.rotation.y += deltaTime * 0.5;
        this.core.rotation.z += deltaTime * 0.3;
    }

    applyAttractionToMesh(particleNet, deltaTime) {
        const meshPos = particleNet.mesh.position;
        const toBlackHole = new THREE.Vector3().subVectors(this.position, meshPos);
        const distance = toBlackHole.length();

        if (distance < this.attractionRadius && distance > 0.1) {
            const strength = this.attractionForce * (1 - distance / this.attractionRadius);
            const force = toBlackHole.normalize().multiplyScalar(strength * deltaTime);
            particleNet.mesh.position.add(force);
        }
    }

    checkCollision(particleNet) {
        const meshPos = particleNet.mesh.position;
        const distance = this.position.distanceTo(meshPos);
        return distance < this.radius + 2.0; // Collision threshold
    }

    remove() {
        if (this.mesh.parent) {
            this.mesh.parent.remove(this.mesh);
        }
        this.core.geometry.dispose();
        this.core.material.dispose();
        this.glow.geometry.dispose();
        this.glow.material.dispose();
        this.outerGlow.geometry.dispose();
        this.outerGlow.material.dispose();
    }
}

let blackHole = null;

// Create particle networks with unique geometries
const particleNets = [];
const numNets = 30;

// Track which geometry types are used
const usedGeometryTypes = [];

// Default geometry and color for all meshes before interaction
const defaultGeometry = 'sphere';
const defaultColor = 0x00ff00; // Fluorescent green

for (let i = 0; i < numNets; i++) {
    const position = new THREE.Vector3(
        (Math.random() - 0.5) * 80,
        (Math.random() - 0.5) * 80,
        (Math.random() - 0.5) * 60
    );

    const size = 2 + Math.random() * 4;
    const density = 0.3 + Math.random() * 0.7;

    // All meshes start with default geometry and white color
    const net = new ParticleNet(position, size, density, defaultGeometry, i, defaultColor);
    particleNets.push(net);
    scene.add(net.mesh);
}

console.log(`Created ${numNets} meshes with default fluorescent green spheres (no color/shape variation)`);

// Create one anomalous mesh with distinct appearance
const anomalousMeshId = numNets;
const anomalousPosition = new THREE.Vector3(
    (Math.random() - 0.5) * 60,
    (Math.random() - 0.5) * 60,
    (Math.random() - 0.5) * 40
);
const anomalousSize = 5; // Larger than normal meshes
const anomalousGeometryType = getUniqueGeometryType(usedGeometryTypes);
const anomalousColor = 0xffff00; // Bright yellow
const anomalousNet = new ParticleNet(anomalousPosition, anomalousSize, 0.5, anomalousGeometryType, anomalousMeshId, anomalousColor);

// Make it fully opaque to stand out
anomalousNet.material.opacity = 1.0;
anomalousNet.hasBeenClicked = true; // Mark as already "interacted" to preserve its state

particleNets.push(anomalousNet);
scene.add(anomalousNet.mesh);

// Store reference to anomalous mesh
anomalousState.mesh = anomalousNet;
anomalousState.meshId = anomalousMeshId;

console.log(`Created anomalous mesh at ID ${anomalousMeshId} (yellow, larger size)`);


// Grid and black hole removed - only 3D particle meshes remain

// Click detection for mesh morphing and anomalous mesh
document.addEventListener('click', (event) => {
    // Update mouse position
    const rect = renderer.domElement.getBoundingClientRect();
    mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    // Raycast to detect clicked mesh
    raycaster.setFromCamera(mouse, camera);
    const meshes = particleNets.map(net => net.mesh);
    const intersects = raycaster.intersectObjects(meshes);

    if (intersects.length > 0) {
        const clickedMesh = intersects[0].object;
        const particleNet = clickedMesh.userData.particleNet;

        if (particleNet) {
            // Check if anomalous mesh was clicked
            if (particleNet.meshId === anomalousState.meshId &&
                !anomalousState.isVibrating &&
                !anomalousState.blackHoleSpawned) {
                // Start vibration sequence (only once)
                anomalousState.isVibrating = true;
                anomalousState.vibrationStartTime = performance.now() / 1000;
                console.log('Anomalous mesh clicked! Starting vibration sequence...');
            } else if (!particleNet.isMorphing && particleNet.meshId !== anomalousState.meshId) {
                // Normal mesh interaction
                if (!particleNet.hasBeenClicked) {
                    // First click: Apply both color and geometry change
                    const newColor = getRandomColor();
                    particleNet.morphToNewShape(null, newColor);
                    particleNet.hasBeenClicked = true;
                    console.log(`Clicked mesh ${particleNet.meshId} for first time - applying color and geometry`);
                } else {
                    // Subsequent clicks: Only change geometry, keep current color
                    particleNet.morphToNewShape(null, particleNet.currentColor);
                    console.log(`Clicked mesh ${particleNet.meshId} again - morphing to new geometry`);
                }
            }
        }
    }
});

// Black hole drag controls
let isDraggingBlackHole = false;
const dragPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
const dragIntersection = new THREE.Vector3();

document.addEventListener('mousedown', (event) => {
    if (!blackHole) return;

    const rect = renderer.domElement.getBoundingClientRect();
    mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    raycaster.setFromCamera(mouse, camera);

    // Check if black hole was clicked
    const intersects = raycaster.intersectObject(blackHole.mesh, true);
    if (intersects.length > 0) {
        isDraggingBlackHole = true;
        blackHole.isDragging = true;
        console.log('Started dragging black hole');
    }
});

document.addEventListener('mousemove', (event) => {
    if (!isDraggingBlackHole || !blackHole) return;

    const rect = renderer.domElement.getBoundingClientRect();
    mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    raycaster.setFromCamera(mouse, camera);

    // Project mouse position onto plane at black hole's Z depth
    dragPlane.constant = -blackHole.position.z;
    raycaster.ray.intersectPlane(dragPlane, dragIntersection);

    if (dragIntersection) {
        blackHole.position.copy(dragIntersection);
        blackHole.mesh.position.copy(dragIntersection);
    }
});

document.addEventListener('mouseup', () => {
    if (isDraggingBlackHole) {
        isDraggingBlackHole = false;
        if (blackHole) {
            blackHole.isDragging = false;
        }
        console.log('Stopped dragging black hole');
    }
});

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

// Mouse/Touch event handlers removed - grid interaction removed

// Animation loop
const clock = new THREE.Clock();

function animate() {
    requestAnimationFrame(animate);

    const deltaTime = clock.getDelta();
    const currentTime = clock.elapsedTime;

    // Update vortex animation (overrides other forces)
    updateVortexAnimation(currentTime, deltaTime);

    // Update anomalous mesh vibration sequence
    if (anomalousState.isVibrating) {
        const elapsed = currentTime - anomalousState.vibrationStartTime;

        if (elapsed < anomalousState.delayDuration) {
            // Apply vibration to all meshes during delay period only
            particleNets.forEach(net => {
                net.updateVibration(anomalousState.vibrationIntensity);
            });
            // Reduced logging: only log once per second
            if (Math.floor(elapsed * 2) !== Math.floor((elapsed - deltaTime) * 2)) {
                console.log(`Vibration: ${elapsed.toFixed(1)}s / ${anomalousState.delayDuration}s`);
            }
        } else if (!anomalousState.blackHoleSpawned) {
            // Spawn black hole after 3 seconds and STOP vibration
            const spawnPosition = new THREE.Vector3(0, 0, 10);
            blackHole = new BlackHole(spawnPosition);
            scene.add(blackHole.mesh);
            anomalousState.blackHoleSpawned = true;
            anomalousState.isVibrating = false; // CRITICAL: Stop vibration to unblock normal physics
            anomalousState.blackHoleSpawnTime = currentTime;

            // Reset mesh positions to prevent accumulated displacement issues
            particleNets.forEach(net => {
                // Smoothly return meshes to their base positions
                net.mesh.position.lerp(net.basePosition, 0.5);
            });

            console.log('Black hole spawned! Vibration stopped. Drag black hole to absorb anomalous mesh.');
        }
    }

    // Update black hole if it exists
    if (blackHole) {
        blackHole.update(deltaTime);

        // Apply attraction force to all meshes
        particleNets.forEach(net => {
            blackHole.applyAttractionToMesh(net, deltaTime);
        });

        // Check collision with anomalous mesh
        if (anomalousState.mesh && blackHole.checkCollision(anomalousState.mesh)) {
            console.log('Anomalous mesh absorbed by black hole! Restoring normal state...');

            // Remove anomalous mesh
            scene.remove(anomalousState.mesh.mesh);
            anomalousState.mesh.geometry.dispose();
            anomalousState.mesh.material.dispose();
            const index = particleNets.indexOf(anomalousState.mesh);
            if (index > -1) {
                particleNets.splice(index, 1);
            }

            // Remove black hole
            blackHole.remove();
            blackHole = null;

            // Reset anomalous state
            anomalousState.isVibrating = false;
            anomalousState.blackHoleSpawned = false;
            anomalousState.mesh = null;

            console.log('Scene restored to normal. Anomalous mesh removed.');
        }
    }

    // Only apply normal physics if vortex is not active
    if (!vortexState.active && !anomalousState.isVibrating) {
        // Update gesture persistence system
        updateGestureForces(currentTime);

        // Smooth wind strength transition
        const strengthDelta = windState.targetStrength - windState.strength;
        windState.strength += strengthDelta * deltaTime * 5;

        // Apply hand gesture forces with improved responsiveness
        const hasGestureForce = handTrackingState.gestureForce.length() > 0.01;

        // Update all particle networks
        particleNets.forEach(net => {
            // Update morphing animation
            net.updateMorphing(deltaTime);

            // Prioritize hand gestures over keyboard wind
            if (hasGestureForce) {
                const gestureDirection = handTrackingState.gestureForce.clone().normalize();
                // Increased gesture strength multiplier for more responsive interaction
                const gestureStrength = Math.min(handTrackingState.gestureForce.length() * 0.5, 3.0);
                net.applyWind(gestureDirection, gestureStrength, deltaTime);
            } else if (windState.strength > 0.01) {
                net.applyWind(windState.direction, windState.strength, deltaTime);
            } else {
                net.recover(deltaTime);
            }

            // Always apply idle animation when no strong forces
            if (windState.strength < 0.5 && !hasGestureForce) {
                net.updateIdle(deltaTime);
            }
        });

        // Decay gesture force
        handTrackingState.gestureForce.multiplyScalar(handTrackingState.forceDecay);
    }

    // Screen shake effect
    let cameraOffsetX = 0;
    let cameraOffsetY = 0;

    if (screenShakeState.intensity > 0.1) {
        cameraOffsetX = (Math.random() - 0.5) * screenShakeState.intensity;
        cameraOffsetY = (Math.random() - 0.5) * screenShakeState.intensity;
        screenShakeState.intensity *= screenShakeState.decay;
    } else {
        screenShakeState.intensity = 0;
    }

    // Gentle camera movement with screen shake
    const baseCameraX = Math.sin(clock.elapsedTime * 0.1) * 5;
    const baseCameraY = Math.cos(clock.elapsedTime * 0.15) * 3;

    camera.position.x = baseCameraX + cameraOffsetX;
    camera.position.y = baseCameraY + cameraOffsetY;
    camera.lookAt(0, 0, 0);

    renderer.render(scene, camera);
}

// Handle window resize
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

// Camera functionality
const cameraState = {
    stream: null,
    isActive: false
};

const videoElement = document.getElementById('camera-video');
const toggleButton = document.getElementById('toggle-camera');
const statusElement = document.getElementById('camera-status');
const handCanvas = document.getElementById('hand-canvas');
const handCanvasCtx = handCanvas.getContext('2d');
const gestureIndicator = document.getElementById('gesture-indicator');

// Hand tracking state
const handTrackingState = {
    hands: null,
    camera: null,
    isActive: false,
    lastHandPosition: null,
    currentHandPosition: null,
    gestureForce: new THREE.Vector3(0, 0, 0),
    forceDecay: 0.95,  // Slower decay for smoother feel
    forceSensitivity: 12.0,  // Increased sensitivity for more responsive interaction
    currentGesture: null,
    isFist: false,
    fistDetected: false,
    // Gesture persistence system
    activeGesture: null,
    gestureStartTime: 0,
    gestureDuration: 3.0,  // 3 seconds persistence
    gestureTargetForce: new THREE.Vector3(0, 0, 0),
    detectionThreshold: 0.005,  // Lower threshold for more sensitive detection
    lastUIUpdate: 0  // Timestamp for throttling UI updates
};

// Vortex animation state
const vortexState = {
    active: false,
    startTime: 0,
    duration: 6.0, // seconds - extended tornado duration
    vortexCenter: new THREE.Vector3(0, 0, 0),
    rotationSpeed: 5.0,
    explosionForce: 50.0,
    meshTargetPositions: []
};

const flashOverlay = document.getElementById('flash-overlay');

async function startCamera() {
    try {
        statusElement.textContent = 'Requesting camera access...';

        const stream = await navigator.mediaDevices.getUserMedia({
            video: {
                width: { ideal: 640 },
                height: { ideal: 480 },
                facingMode: 'user'
            },
            audio: false
        });

        cameraState.stream = stream;
        cameraState.isActive = true;

        videoElement.srcObject = stream;
        videoElement.classList.add('active');

        toggleButton.textContent = '📷 Stop Camera';
        statusElement.textContent = 'Camera active - Hand tracking enabled';

        // Start hand tracking after a short delay to ensure video is ready
        setTimeout(() => {
            startHandTracking();
        }, 1000);

        console.log('Camera started successfully');
    } catch (error) {
        console.error('Error accessing camera:', error);

        let errorMessage = 'Failed to access camera';

        if (error.name === 'NotAllowedError') {
            errorMessage = 'Camera permission denied';
        } else if (error.name === 'NotFoundError') {
            errorMessage = 'No camera found';
        } else if (error.name === 'NotReadableError') {
            errorMessage = 'Camera is in use';
        }

        statusElement.textContent = errorMessage;
        statusElement.style.color = '#ff6b6b';

        setTimeout(() => {
            statusElement.textContent = '';
            statusElement.style.color = '';
        }, 3000);
    }
}

function stopCamera() {
    if (cameraState.stream) {
        // Stop hand tracking first
        stopHandTracking();

        const tracks = cameraState.stream.getTracks();
        tracks.forEach(track => track.stop());

        videoElement.srcObject = null;
        videoElement.classList.remove('active');

        cameraState.stream = null;
        cameraState.isActive = false;

        toggleButton.textContent = '📷 Start Camera';
        statusElement.textContent = '';

        console.log('Camera stopped');
    }
}

toggleButton.addEventListener('click', () => {
    if (cameraState.isActive) {
        stopCamera();
    } else {
        startCamera();
    }
});

// Initialize MediaPipe Hands
function initializeHandTracking() {
    if (typeof Hands === 'undefined') {
        console.warn('MediaPipe Hands not loaded yet');
        return;
    }

    handTrackingState.hands = new Hands({
        locateFile: (file) => {
            return `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`;
        }
    });

    handTrackingState.hands.setOptions({
        maxNumHands: 1,
        modelComplexity: 1,
        minDetectionConfidence: 0.5,
        minTrackingConfidence: 0.5
    });

    handTrackingState.hands.onResults(onHandResults);
    console.log('Hand tracking initialized');
}

// Process hand detection results
function onHandResults(results) {
    // Clear canvas
    handCanvasCtx.save();
    handCanvasCtx.clearRect(0, 0, handCanvas.width, handCanvas.height);

    if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
        const landmarks = results.multiHandLandmarks[0];

        // Draw hand landmarks
        drawConnectors(handCanvasCtx, landmarks, HAND_CONNECTIONS, {
            color: '#00FF00',
            lineWidth: 2
        });
        drawLandmarks(handCanvasCtx, landmarks, {
            color: '#FF0000',
            lineWidth: 1,
            radius: 3
        });

        // Get palm center (using wrist and middle finger base)
        const wrist = landmarks[0];
        const middleFingerBase = landmarks[9];
        const palmCenter = {
            x: (wrist.x + middleFingerBase.x) / 2,
            y: (wrist.y + middleFingerBase.y) / 2,
            z: (wrist.z + middleFingerBase.z) / 2
        };

        // Update hand position
        handTrackingState.lastHandPosition = handTrackingState.currentHandPosition;
        handTrackingState.currentHandPosition = palmCenter;

        // Detect fist gesture
        const isFist = detectFist(landmarks);
        handTrackingState.isFist = isFist;

        if (isFist && !handTrackingState.fistDetected && !vortexState.active) {
            // Trigger vortex sequence
            handTrackingState.fistDetected = true;
            startVortexSequence();
            gestureIndicator.textContent = 'FIST - VORTEX ACTIVATED!';
            gestureIndicator.classList.add('active');
            console.log('Fist detected! Starting vortex sequence...');
        } else if (!isFist) {
            handTrackingState.fistDetected = false;
            if (!vortexState.active) {
                // Calculate movement vector and detect gesture
                if (handTrackingState.lastHandPosition) {
                    detectGesture();
                }
            }
        }

        handTrackingState.isActive = true;
    } else {
        handTrackingState.isActive = false;
        handTrackingState.lastHandPosition = null;
        handTrackingState.currentHandPosition = null;
        handTrackingState.currentGesture = null;
        gestureIndicator.classList.remove('active');
    }

    handCanvasCtx.restore();
}

// Detect if hand is making a fist
function detectFist(landmarks) {
    // Landmark indices for fingertips and palm
    const thumbTip = landmarks[4];
    const indexTip = landmarks[8];
    const middleTip = landmarks[12];
    const ringTip = landmarks[16];
    const pinkyTip = landmarks[20];
    const wrist = landmarks[0];
    const palmBase = landmarks[9]; // Middle finger base

    // Calculate distances from fingertips to palm
    const indexDist = Math.sqrt(
        Math.pow(indexTip.x - palmBase.x, 2) +
        Math.pow(indexTip.y - palmBase.y, 2) +
        Math.pow(indexTip.z - palmBase.z, 2)
    );

    const middleDist = Math.sqrt(
        Math.pow(middleTip.x - palmBase.x, 2) +
        Math.pow(middleTip.y - palmBase.y, 2) +
        Math.pow(middleTip.z - palmBase.z, 2)
    );

    const ringDist = Math.sqrt(
        Math.pow(ringTip.x - palmBase.x, 2) +
        Math.pow(ringTip.y - palmBase.y, 2) +
        Math.pow(ringTip.z - palmBase.z, 2)
    );

    const pinkyDist = Math.sqrt(
        Math.pow(pinkyTip.x - palmBase.x, 2) +
        Math.pow(pinkyTip.y - palmBase.y, 2) +
        Math.pow(pinkyTip.z - palmBase.z, 2)
    );

    // Hand size reference (wrist to middle finger base)
    const handSize = Math.sqrt(
        Math.pow(palmBase.x - wrist.x, 2) +
        Math.pow(palmBase.y - wrist.y, 2) +
        Math.pow(palmBase.z - wrist.z, 2)
    );

    // Fist is detected when all fingers are curled (close to palm)
    // Normalized threshold relative to hand size
    const threshold = handSize * 0.6;

    return indexDist < threshold &&
           middleDist < threshold &&
           ringDist < threshold &&
           pinkyDist < threshold;
}

// Detect gesture from hand movement
function detectGesture() {
    if (!handTrackingState.lastHandPosition || !handTrackingState.currentHandPosition) {
        return;
    }

    const currentTime = performance.now() / 1000;
    const dx = handTrackingState.currentHandPosition.x - handTrackingState.lastHandPosition.x;
    const dy = handTrackingState.currentHandPosition.y - handTrackingState.lastHandPosition.y;

    // More sensitive threshold for responsive detection
    const threshold = handTrackingState.detectionThreshold;
    const movement = Math.sqrt(dx * dx + dy * dy);

    let detectedGesture = null;
    let forceVector = new THREE.Vector3(0, 0, 0);

    // Detect gesture if movement exceeds threshold
    if (movement > threshold) {
        // Determine primary direction with improved sensitivity
        if (Math.abs(dx) > Math.abs(dy)) {
            // Horizontal movement
            if (dx > threshold) {
                detectedGesture = 'RIGHT';
                forceVector.x = -dx * handTrackingState.forceSensitivity;
            } else if (dx < -threshold) {
                detectedGesture = 'LEFT';
                forceVector.x = -dx * handTrackingState.forceSensitivity;
            }
        } else {
            // Vertical movement
            if (dy > threshold) {
                detectedGesture = 'DOWN';
                forceVector.y = dy * handTrackingState.forceSensitivity;
            } else if (dy < -threshold) {
                detectedGesture = 'UP';
                forceVector.y = dy * handTrackingState.forceSensitivity;
            }
        }

        // If a gesture is detected, activate it for 3 seconds
        // CRITICAL: Only activate if no gesture is currently active (prevent timer reset)
        if (detectedGesture && !handTrackingState.activeGesture) {
            handTrackingState.currentGesture = detectedGesture;
            handTrackingState.activeGesture = detectedGesture;
            handTrackingState.gestureStartTime = currentTime;
            handTrackingState.gestureTargetForce.copy(forceVector);

            console.log(`Gesture detected: ${detectedGesture} - Active for ${handTrackingState.gestureDuration}s`);

            // Update UI immediately
            gestureIndicator.textContent = `Gesture: ${detectedGesture}`;
            gestureIndicator.classList.add('active');
        }
    }
}

// Update gesture forces with persistence system
function updateGestureForces(currentTime) {
    // Check if we have an active gesture
    if (handTrackingState.activeGesture && handTrackingState.gestureStartTime > 0) {
        const elapsed = currentTime - handTrackingState.gestureStartTime;

        if (elapsed < handTrackingState.gestureDuration) {
            // Gesture is still active - maintain force
            // Use easing for smooth force application
            const progress = elapsed / handTrackingState.gestureDuration;
            const easing = 1 - Math.pow(progress, 2); // Ease-out quadratic

            // CRITICAL FIX: Set force instead of adding (prevent infinite accumulation)
            // Add a small sustained force each frame instead of accumulating
            const sustainedForce = handTrackingState.gestureTargetForce.clone().multiplyScalar(easing * 0.15);
            handTrackingState.gestureForce.add(sustainedForce);

            // Safety check: Limit maximum force magnitude to prevent runaway
            const maxForce = 50.0;
            if (handTrackingState.gestureForce.length() > maxForce) {
                handTrackingState.gestureForce.normalize().multiplyScalar(maxForce);
            }

            // Throttled UI update: only update 10 times per second to prevent DOM thrashing
            const updateInterval = 0.1; // 100ms
            if (!handTrackingState.lastUIUpdate || (currentTime - handTrackingState.lastUIUpdate) >= updateInterval) {
                gestureIndicator.textContent = `Gesture: ${handTrackingState.activeGesture} (${(handTrackingState.gestureDuration - elapsed).toFixed(1)}s)`;
                gestureIndicator.classList.add('active');
                handTrackingState.lastUIUpdate = currentTime;
            }
        } else {
            // Gesture duration expired - clear active gesture
            handTrackingState.activeGesture = null;
            handTrackingState.gestureStartTime = 0;
            handTrackingState.gestureTargetForce.set(0, 0, 0);
            gestureIndicator.classList.remove('active');
            console.log('Gesture persistence ended - returning to default state');
        }
    } else {
        // No active gesture - remove UI indicator
        gestureIndicator.classList.remove('active');
    }
}

// Start vortex sequence
function startVortexSequence() {
    vortexState.active = true;
    vortexState.startTime = performance.now() / 1000; // Convert to seconds
    vortexState.vortexCenter.set(0, 0, 0);

    console.log('Vortex sequence started at:', vortexState.startTime);
}

// Update vortex animation
function updateVortexAnimation(currentTime, deltaTime) {
    if (!vortexState.active) return;

    const elapsed = currentTime - vortexState.startTime;
    const progress = elapsed / vortexState.duration;

    if (elapsed < vortexState.duration) {
        // Phase 1: Vortex (0-6 seconds) - high-speed tornado rotation
        applyVortexForce(deltaTime, progress);
    } else if (elapsed >= vortexState.duration && elapsed < vortexState.duration + 0.01) {
        // Phase 2: Explosion at exactly 6 seconds
        triggerExplosion();
    } else if (elapsed > vortexState.duration + 0.3) {
        // Phase 3: Reset after flash
        vortexState.active = false;
        console.log('Vortex sequence complete');
    }
}

// Apply vortex rotational force
function applyVortexForce(deltaTime, progress) {
    const center = vortexState.vortexCenter;
    const rotationSpeed = vortexState.rotationSpeed * (1 + progress * 2); // Accelerate

    particleNets.forEach(net => {
        const meshPos = net.mesh.position;

        // Vector from center to mesh
        const offset = new THREE.Vector3().subVectors(meshPos, center);
        const distance = offset.length();

        if (distance > 0.1) {
            // Tangential force (perpendicular to radius)
            const tangent = new THREE.Vector3(-offset.y, offset.x, 0).normalize();

            // Pull toward center while rotating
            const pullForce = offset.clone().normalize().multiplyScalar(-0.5 * progress);
            const rotationForce = tangent.multiplyScalar(rotationSpeed);

            // Combine forces
            const totalForce = pullForce.add(rotationForce);

            // Apply to mesh
            net.mesh.position.add(totalForce.multiplyScalar(deltaTime));

            // Apply rotation to mesh itself
            net.mesh.rotation.z += rotationSpeed * deltaTime * 0.5;
        }
    });
}

// Trigger explosion
function triggerExplosion() {
    console.log('EXPLOSION!');

    // Flash effect
    flashOverlay.classList.add('active');
    setTimeout(() => {
        flashOverlay.classList.remove('active');
    }, 200);

    const center = vortexState.vortexCenter;
    const explosionForce = vortexState.explosionForce;

    // Apply explosion force to particle networks
    particleNets.forEach(net => {
        const offset = new THREE.Vector3().subVectors(net.mesh.position, center);
        const direction = offset.normalize();
        const force = direction.multiplyScalar(explosionForce);

        // Apply instant velocity
        net.mesh.position.add(force.multiplyScalar(0.1));

        // Randomize new target position
        const newPos = new THREE.Vector3(
            (Math.random() - 0.5) * 80,
            (Math.random() - 0.5) * 80,
            (Math.random() - 0.5) * 60
        );

        // Smooth transition to new position
        const startPos = net.mesh.position.clone();
        const targetPos = newPos;

        // Animate to new position over next 300ms
        animateMeshToPosition(net.mesh, startPos, targetPos, 0.3);

        // Reset rotation
        net.mesh.rotation.set(0, 0, 0);

        // Update base position for future idle animation
        net.basePosition.copy(targetPos);
    });
}

// Animate mesh to new position smoothly
function animateMeshToPosition(mesh, startPos, targetPos, duration, onUpdate = null) {
    const startTime = performance.now() / 1000;

    function animate(currentTime) {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1.0);

        // Ease out cubic
        const eased = 1 - Math.pow(1 - progress, 3);

        mesh.position.lerpVectors(startPos, targetPos, eased);

        if (onUpdate) onUpdate();

        if (progress < 1.0) {
            requestAnimationFrame(() => animate(performance.now() / 1000));
        }
    }

    requestAnimationFrame(() => animate(performance.now() / 1000));
}

// Start hand tracking camera
async function startHandTracking() {
    if (!handTrackingState.hands) {
        initializeHandTracking();
    }

    if (handTrackingState.hands && videoElement.srcObject) {
        // Set canvas size to match video
        handCanvas.width = videoElement.videoWidth || 640;
        handCanvas.height = videoElement.videoHeight || 480;

        handCanvas.classList.add('active');

        // Create camera for hand tracking
        if (typeof Camera !== 'undefined') {
            handTrackingState.camera = new Camera(videoElement, {
                onFrame: async () => {
                    await handTrackingState.hands.send({ image: videoElement });
                },
                width: 640,
                height: 480
            });

            handTrackingState.camera.start();
            console.log('Hand tracking camera started');
        }
    }
}

// Stop hand tracking
function stopHandTracking() {
    if (handTrackingState.camera) {
        handTrackingState.camera.stop();
        handTrackingState.camera = null;
    }

    handCanvas.classList.remove('active');
    gestureIndicator.classList.remove('active');
    handTrackingState.isActive = false;
    handTrackingState.lastHandPosition = null;
    handTrackingState.currentHandPosition = null;
    handTrackingState.gestureForce.set(0, 0, 0);
}

// Clean up camera when page is closed
window.addEventListener('beforeunload', () => {
    if (cameraState.isActive) {
        stopCamera();
    }
    if (handTrackingState.isActive) {
        stopHandTracking();
    }
});

// Start animation
animate();
