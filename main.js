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

// Grid and black hole removed - only 3D particle meshes remain

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

    // Only apply normal physics if vortex is not active
    if (!vortexState.active) {
        // Smooth wind strength transition
        const strengthDelta = windState.targetStrength - windState.strength;
        windState.strength += strengthDelta * deltaTime * 5;

        // Apply hand gesture forces
        const hasGestureForce = handTrackingState.gestureForce.length() > 0.01;

        // Update all particle networks
        particleNets.forEach(net => {
            // Prioritize hand gestures over keyboard wind
            if (hasGestureForce) {
                const gestureDirection = handTrackingState.gestureForce.clone().normalize();
                const gestureStrength = Math.min(handTrackingState.gestureForce.length() * 0.3, 2.0);
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
    forceDecay: 0.92,
    forceSensitivity: 8.0,
    currentGesture: null,
    isFist: false,
    fistDetected: false
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

    const dx = handTrackingState.currentHandPosition.x - handTrackingState.lastHandPosition.x;
    const dy = handTrackingState.currentHandPosition.y - handTrackingState.lastHandPosition.y;

    // Threshold for gesture detection
    const threshold = 0.01;

    let gesture = null;
    let forceVector = new THREE.Vector3(0, 0, 0);

    if (Math.abs(dx) > threshold || Math.abs(dy) > threshold) {
        // Determine primary direction
        if (Math.abs(dx) > Math.abs(dy)) {
            if (dx > threshold) {
                gesture = 'RIGHT';
                forceVector.x = -dx * handTrackingState.forceSensitivity;
            } else if (dx < -threshold) {
                gesture = 'LEFT';
                forceVector.x = -dx * handTrackingState.forceSensitivity;
            }
        } else {
            if (dy > threshold) {
                gesture = 'DOWN';
                forceVector.y = dy * handTrackingState.forceSensitivity;
            } else if (dy < -threshold) {
                gesture = 'UP';
                forceVector.y = dy * handTrackingState.forceSensitivity;
            }
        }

        if (gesture) {
            handTrackingState.currentGesture = gesture;
            handTrackingState.gestureForce.add(forceVector);

            // Update UI
            gestureIndicator.textContent = `Gesture: ${gesture}`;
            gestureIndicator.classList.add('active');
        }
    } else {
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
