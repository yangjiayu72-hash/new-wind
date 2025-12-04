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
    constructor(position, size, density, shapeType) {
        this.basePosition = position.clone();
        this.size = size;
        this.density = density;
        this.shapeType = shapeType;
        this.time = Math.random() * 1000;

        // Idle animation parameters - slower and smoother
        this.driftSpeed = new THREE.Vector3(
            (Math.random() - 0.5) * 0.008,
            (Math.random() - 0.5) * 0.008,
            (Math.random() - 0.5) * 0.008
        );
        this.oscillationSpeed = 0.15 + Math.random() * 0.25;
        this.oscillationAmplitude = 1.5 + Math.random() * 2.5;
        this.rotationSpeed = new THREE.Vector3(
            (Math.random() - 0.5) * 0.002,
            (Math.random() - 0.5) * 0.002,
            (Math.random() - 0.5) * 0.002
        );

        // Smooth random offset for organic movement
        this.noiseOffset = new THREE.Vector3(
            Math.random() * 100,
            Math.random() * 100,
            Math.random() * 100
        );

        // Create mesh structure
        this.createMesh();

        // Wind physics
        this.velocities = [];
        this.originalPositions = [];
        this.windAccumulator = new THREE.Vector3(0, 0, 0);
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
        const gridSize = Math.floor(5 + this.density * 4);
        const step = this.size / gridSize;

        let vertexIndex = 0;

        // Generate vertices based on shape type
        for (let i = 0; i <= gridSize; i++) {
            for (let j = 0; j <= gridSize; j++) {
                for (let k = 0; k <= gridSize; k++) {
                    let x = (i - gridSize / 2) * step;
                    let y = (j - gridSize / 2) * step;
                    let z = (k - gridSize / 2) * step;

                    let shouldInclude = false;
                    let shapeScale = { x: 1, y: 1, z: 1 };

                    // Different shape types
                    switch (this.shapeType) {
                        case 'sphere':
                            const sphereDist = Math.sqrt(x * x + y * y + z * z);
                            shouldInclude = sphereDist < this.size * 0.55;
                            break;

                        case 'elongated':
                            shapeScale = { x: 0.6, y: 1.8, z: 0.6 };
                            const elongatedDist = Math.sqrt(
                                (x * x) / (shapeScale.x * shapeScale.x) +
                                (y * y) / (shapeScale.y * shapeScale.y) +
                                (z * z) / (shapeScale.z * shapeScale.z)
                            );
                            shouldInclude = elongatedDist < this.size * 0.5;
                            y *= shapeScale.y;
                            x *= shapeScale.x;
                            z *= shapeScale.z;
                            break;

                        case 'flat':
                            shapeScale = { x: 1.5, y: 0.3, z: 1.5 };
                            const flatDist = Math.sqrt(
                                (x * x) / (shapeScale.x * shapeScale.x) +
                                (y * y) / (shapeScale.y * shapeScale.y) +
                                (z * z) / (shapeScale.z * shapeScale.z)
                            );
                            shouldInclude = flatDist < this.size * 0.5;
                            y *= shapeScale.y;
                            x *= shapeScale.x;
                            z *= shapeScale.z;
                            break;

                        case 'tube':
                            const tubeRadialDist = Math.sqrt(x * x + z * z);
                            shouldInclude = tubeRadialDist < this.size * 0.35 && Math.abs(y) < this.size * 0.8;
                            break;

                        case 'cluster':
                            const clusterDist = Math.sqrt(x * x + y * y + z * z);
                            const clusterNoise = Math.sin(x * 2) * Math.cos(y * 2) * Math.sin(z * 2);
                            shouldInclude = clusterDist < this.size * 0.6 && clusterNoise > -0.3;
                            break;

                        case 'irregular':
                            const irregularDist = Math.sqrt(x * x + y * y + z * z);
                            const irregularNoise =
                                Math.sin(x * 1.5) * 0.3 +
                                Math.cos(y * 1.8) * 0.3 +
                                Math.sin(z * 1.3) * 0.3;
                            shouldInclude = irregularDist < this.size * (0.5 + irregularNoise);
                            break;
                    }

                    if (shouldInclude) {
                        // Add organic noise
                        const noise = (Math.random() - 0.5) * 0.25;
                        vertices.push(x + noise, y + noise, z + noise);
                        vertexIndex++;
                    }
                }
            }
        }

        // Create connections between nearby vertices
        const positions = new Float32Array(vertices);
        const tempGeometry = new THREE.BufferGeometry();
        tempGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

        for (let i = 0; i < positions.length / 3; i++) {
            const p1 = new THREE.Vector3(
                positions[i * 3],
                positions[i * 3 + 1],
                positions[i * 3 + 2]
            );

            for (let j = i + 1; j < positions.length / 3; j++) {
                const p2 = new THREE.Vector3(
                    positions[j * 3],
                    positions[j * 3 + 1],
                    positions[j * 3 + 2]
                );

                const distance = p1.distanceTo(p2);
                if (distance < step * 2.2) {
                    indices.push(i, j);
                }
            }
        }

        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        geometry.setIndex(indices);

        // Vary colors slightly
        const colors = [0x00ffff, 0x00ccff, 0x0099ff, 0x00ffcc, 0x33ffff];
        const color = colors[Math.floor(Math.random() * colors.length)];

        // Create material with thin lines
        const material = new THREE.LineBasicMaterial({
            color: color,
            transparent: true,
            opacity: 0.5 + Math.random() * 0.2,
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

        // Smooth easing function
        const easeInOutSine = (t) => -(Math.cos(Math.PI * t) - 1) / 2;

        // Multi-layered gentle drift with smooth transitions
        const driftX =
            Math.sin(this.time * this.oscillationSpeed * 0.5 + this.noiseOffset.x) * this.oscillationAmplitude * 0.7 +
            Math.sin(this.time * this.oscillationSpeed * 0.2 + this.noiseOffset.x * 0.5) * this.oscillationAmplitude * 0.3;

        const driftY =
            Math.cos(this.time * this.oscillationSpeed * 0.4 + this.noiseOffset.y) * this.oscillationAmplitude * 0.6 +
            Math.sin(this.time * this.oscillationSpeed * 0.15 + this.noiseOffset.y * 0.7) * this.oscillationAmplitude * 0.4;

        const driftZ =
            Math.sin(this.time * this.oscillationSpeed * 0.3 + this.noiseOffset.z) * this.oscillationAmplitude * 0.4 +
            Math.cos(this.time * this.oscillationSpeed * 0.18 + this.noiseOffset.z * 0.6) * this.oscillationAmplitude * 0.3;

        // Smooth interpolation to position
        this.mesh.position.x += (this.basePosition.x + driftX - this.mesh.position.x) * deltaTime * 0.5;
        this.mesh.position.y += (this.basePosition.y + driftY - this.mesh.position.y) * deltaTime * 0.5;
        this.mesh.position.z += (this.basePosition.z + driftZ - this.mesh.position.z) * deltaTime * 0.5;

        // Slow, smooth rotation
        this.mesh.rotation.x += this.rotationSpeed.x * easeInOutSine(Math.sin(this.time * 0.1) * 0.5 + 0.5);
        this.mesh.rotation.y += this.rotationSpeed.y * easeInOutSine(Math.cos(this.time * 0.12) * 0.5 + 0.5);
        this.mesh.rotation.z += this.rotationSpeed.z * easeInOutSine(Math.sin(this.time * 0.08) * 0.5 + 0.5);

        // Subtle, flowing mesh deformation
        const positions = this.geometry.attributes.position;
        for (let i = 0; i < positions.count; i++) {
            const original = this.originalPositions[i];
            const deformAmount = 0.08;

            // Multiple wave layers for organic movement
            const wave1 = Math.sin(this.time * this.oscillationSpeed * 0.6 + i * 0.05 + original.x * 0.1) * deformAmount;
            const wave2 = Math.cos(this.time * this.oscillationSpeed * 0.4 + i * 0.08 + original.y * 0.1) * deformAmount;
            const wave3 = Math.sin(this.time * this.oscillationSpeed * 0.5 + i * 0.06 + original.z * 0.1) * deformAmount * 0.5;

            positions.setXYZ(
                i,
                original.x + wave1 + wave3,
                original.y + wave2 + wave3,
                original.z + wave1 * 0.3 + wave2 * 0.3
            );
        }
        positions.needsUpdate = true;
    }

    applyWind(windDirection, windStrength, deltaTime) {
        const positions = this.geometry.attributes.position;

        // Smooth wind accumulator for gentle transitions
        this.windAccumulator.lerp(windDirection.clone().multiplyScalar(windStrength), deltaTime * 1.5);

        for (let i = 0; i < positions.count; i++) {
            const pos = new THREE.Vector3(
                positions.getX(i),
                positions.getY(i),
                positions.getZ(i)
            );

            // Calculate world position
            const worldPos = pos.clone().applyMatrix4(this.mesh.matrixWorld);

            // Smooth, flowing turbulence with multiple frequency layers
            const turbulenceX =
                Math.sin(this.time * 0.8 + worldPos.x * 0.08 + worldPos.y * 0.05) * 0.15 +
                Math.sin(this.time * 1.3 + worldPos.x * 0.12) * 0.08;

            const turbulenceY =
                Math.cos(this.time * 0.7 + worldPos.y * 0.08 + worldPos.z * 0.05) * 0.15 +
                Math.cos(this.time * 1.1 + worldPos.y * 0.1) * 0.08;

            const turbulenceZ =
                Math.sin(this.time * 0.9 + worldPos.z * 0.08 + worldPos.x * 0.05) * 0.15 +
                Math.sin(this.time * 1.2 + worldPos.z * 0.11) * 0.08;

            const turbulence = new THREE.Vector3(turbulenceX, turbulenceY, turbulenceZ);

            // Gentle wind force with smooth accumulation
            const windForce = this.windAccumulator.clone()
                .multiplyScalar(0.8)
                .add(turbulence);

            // Apply force to velocity with smooth acceleration
            this.velocities[i].add(windForce.multiplyScalar(deltaTime * 0.5));

            // Stronger damping for smoother motion
            this.velocities[i].multiplyScalar(0.92);

            // Update position with smooth interpolation
            const targetPos = pos.clone().add(this.velocities[i].clone().multiplyScalar(deltaTime * 2));
            pos.lerp(targetPos, 0.3);

            positions.setXYZ(i, pos.x, pos.y, pos.z);
        }

        positions.needsUpdate = true;

        // Apply gentle force to mesh position
        const meshForce = this.windAccumulator.clone().multiplyScalar(deltaTime * 2);
        this.mesh.position.add(meshForce);
    }

    recover(deltaTime) {
        const positions = this.geometry.attributes.position;
        const recoverySpeed = 1.2;

        // Smooth ease-out for recovery
        const easeOut = (t) => 1 - Math.pow(1 - t, 3);

        for (let i = 0; i < positions.count; i++) {
            const current = new THREE.Vector3(
                positions.getX(i),
                positions.getY(i),
                positions.getZ(i)
            );

            const target = this.originalPositions[i].clone();

            // Smooth lerp back to original position with easing
            const lerpAmount = easeOut(deltaTime * recoverySpeed);
            current.lerp(target, lerpAmount);

            positions.setXYZ(i, current.x, current.y, current.z);

            // Gentle velocity dampening
            this.velocities[i].multiplyScalar(0.85);
        }

        positions.needsUpdate = true;

        // Smooth wind accumulator decay
        this.windAccumulator.multiplyScalar(0.9);

        // Recover mesh position with smooth easing
        const meshLerpAmount = easeOut(deltaTime * recoverySpeed * 0.8);
        this.mesh.position.lerp(this.basePosition, meshLerpAmount);
    }
}

// Create particle networks
const particleNets = [];
const numNets = 40;
const shapeTypes = ['sphere', 'elongated', 'flat', 'tube', 'cluster', 'irregular'];

for (let i = 0; i < numNets; i++) {
    const position = new THREE.Vector3(
        (Math.random() - 0.5) * 100,
        (Math.random() - 0.5) * 100,
        (Math.random() - 0.5) * 80
    );

    const size = 2.5 + Math.random() * 3.5;
    const density = 0.4 + Math.random() * 0.6;
    const shapeType = shapeTypes[Math.floor(Math.random() * shapeTypes.length)];

    const net = new ParticleNet(position, size, density, shapeType);
    particleNets.push(net);
    scene.add(net.mesh);
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

    const deltaTime = Math.min(clock.getDelta(), 0.1); // Cap delta time for stability

    // Very smooth wind strength transition with easing
    const strengthDelta = windState.targetStrength - windState.strength;
    const easeInOut = Math.abs(strengthDelta) < 0.5 ? strengthDelta * 0.5 : strengthDelta;
    windState.strength += easeInOut * deltaTime * 2.5;

    // Update all particle networks
    particleNets.forEach(net => {
        if (windState.strength > 0.01) {
            net.applyWind(windState.direction, windState.strength, deltaTime);
        } else {
            net.recover(deltaTime);
        }

        // Always apply idle animation for continuous organic movement
        if (windState.strength < 0.7) {
            net.updateIdle(deltaTime);
        }
    });

    // Very gentle camera movement - like floating in space
    const cameraTime = clock.elapsedTime;
    camera.position.x = Math.sin(cameraTime * 0.08) * 8 + Math.sin(cameraTime * 0.05) * 3;
    camera.position.y = Math.cos(cameraTime * 0.1) * 5 + Math.cos(cameraTime * 0.06) * 2;
    camera.position.z = 50 + Math.sin(cameraTime * 0.07) * 4;
    camera.lookAt(0, 0, 0);

    renderer.render(scene, camera);
}

// Handle window resize
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

// Start animation
animate();
