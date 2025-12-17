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
                if (distance < step * 2.0) {
                    indices.push(i, j);
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

// Create particle networks
const particleNets = [];
const numNets = 30;

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

    const deltaTime = clock.getDelta();

    // Smooth wind strength transition
    const strengthDelta = windState.targetStrength - windState.strength;
    windState.strength += strengthDelta * deltaTime * 5;

    // Update all particle networks
    particleNets.forEach(net => {
        if (windState.strength > 0.01) {
            net.applyWind(windState.direction, windState.strength, deltaTime);
        } else {
            net.recover(deltaTime);
        }

        // Always apply idle animation
        if (windState.strength < 0.5) {
            net.updateIdle(deltaTime);
        }
    });

    // Gentle camera movement
    camera.position.x = Math.sin(clock.elapsedTime * 0.1) * 5;
    camera.position.y = Math.cos(clock.elapsedTime * 0.15) * 3;
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
        statusElement.textContent = 'Camera active';

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

// Clean up camera when page is closed
window.addEventListener('beforeunload', () => {
    if (cameraState.isActive) {
        stopCamera();
    }
});

// Start animation
animate();
