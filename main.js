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

// ANIMATION SYSTEM: Time-based, non-blocking easing functions
const EasingFunctions = {
    // Linear (no easing)
    linear: (t) => t,

    // Ease in/out cubic (smooth)
    easeInOutCubic: (t) => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2,

    // Ease out quadratic (decelerate)
    easeOutQuad: (t) => 1 - (1 - t) * (1 - t),

    // Ease in quadratic (accelerate)
    easeInQuad: (t) => t * t,

    // Ease out exponential (smooth stop)
    easeOutExpo: (t) => t === 1 ? 1 : 1 - Math.pow(2, -10 * t),

    // Ease in exponential (smooth start)
    easeInExpo: (t) => t === 0 ? 0 : Math.pow(2, 10 * t - 10),

    // Bounce (playful)
    easeOutBounce: (t) => {
        const n1 = 7.5625;
        const d1 = 2.75;
        if (t < 1 / d1) {
            return n1 * t * t;
        } else if (t < 2 / d1) {
            return n1 * (t -= 1.5 / d1) * t + 0.75;
        } else if (t < 2.5 / d1) {
            return n1 * (t -= 2.25 / d1) * t + 0.9375;
        } else {
            return n1 * (t -= 2.625 / d1) * t + 0.984375;
        }
    }
};

// ANIMATION SYSTEM: Animation controller for safe, interruptible animations
const animationController = {
    activeAnimations: new Map(), // animationId -> animationData
    nextId: 0,

    // Create new animation
    create(config) {
        const id = this.nextId++;
        const animation = {
            id,
            startTime: performance.now() / 1000,
            duration: config.duration || 1.0,
            easing: config.easing || EasingFunctions.linear,
            onUpdate: config.onUpdate || (() => {}),
            onComplete: config.onComplete || (() => {}),
            isActive: true,
            canInterrupt: config.canInterrupt !== false
        };

        this.activeAnimations.set(id, animation);
        return id;
    },

    // Update animation (call every frame)
    update(id, currentTime) {
        const anim = this.activeAnimations.get(id);
        if (!anim || !anim.isActive) return false;

        const elapsed = currentTime - anim.startTime;
        const progress = Math.min(elapsed / anim.duration, 1.0);
        const easedProgress = anim.easing(progress);

        try {
            anim.onUpdate(easedProgress, progress);

            if (progress >= 1.0) {
                anim.onComplete();
                this.remove(id);
                return false; // Animation complete
            }

            return true; // Animation ongoing
        } catch (error) {
            console.warn(`Animation ${id} error:`, error);
            this.remove(id);
            return false;
        }
    },

    // Interrupt and remove animation
    interrupt(id) {
        const anim = this.activeAnimations.get(id);
        if (anim && anim.canInterrupt) {
            anim.isActive = false;
            this.activeAnimations.delete(id);
            return true;
        }
        return false;
    },

    // Remove animation
    remove(id) {
        this.activeAnimations.delete(id);
    },

    // Update all active animations
    updateAll(currentTime) {
        for (const [id, anim] of this.activeAnimations) {
            this.update(id, currentTime);
        }
    },

    // Clear all animations
    clearAll() {
        this.activeAnimations.clear();
    },

    // Clear animations by filter
    clearWhere(filter) {
        for (const [id, anim] of this.activeAnimations) {
            if (filter(anim)) {
                this.interrupt(id);
            }
        }
    }
};

// STATE MACHINE: Interaction state management for clean, non-overlapping states
const InteractionState = {
    IDLE: 'idle',
    CLICK_INTERACTION: 'click_interaction',
    GESTURE_INTERACTION: 'gesture_interaction',
    GLOBAL_EVENT: 'global_event',
    RESET: 'reset'
};

// COOLDOWN SYSTEM: Prevent interaction overload with debouncing
const cooldownSystem = {
    // Click cooldowns (per-mesh tracking)
    lastClickTime: 0,
    clickCooldown: 0.8, // 800ms global cooldown
    meshCooldowns: new Map(), // meshId -> lastClickTime
    meshClickCooldown: 0.5, // 500ms per-mesh cooldown

    // Gesture cooldowns
    lastGestureTime: 0,
    gestureCooldown: 3.0, // 3 seconds lock after activation
    isGestureLocked: false,

    // Global event cooldowns
    lastGlobalEventTime: 0,
    globalEventCooldown: 1.0, // 1 second between global events
    isGlobalEventActive: false,

    // Check if click is allowed
    canClick(currentTime, meshId = null) {
        // Check global cooldown
        if (currentTime - this.lastClickTime < this.clickCooldown) {
            return false;
        }

        // Check per-mesh cooldown if meshId provided
        if (meshId !== null) {
            const lastMeshClick = this.meshCooldowns.get(meshId) || 0;
            if (currentTime - lastMeshClick < this.meshClickCooldown) {
                return false;
            }
        }

        return true;
    },

    // Register click
    registerClick(currentTime, meshId = null) {
        this.lastClickTime = currentTime;
        if (meshId !== null) {
            this.meshCooldowns.set(meshId, currentTime);
        }
    },

    // Check if gesture is allowed
    canActivateGesture(currentTime) {
        if (this.isGestureLocked) {
            return false;
        }
        if (currentTime - this.lastGestureTime < this.gestureCooldown) {
            return false;
        }
        return true;
    },

    // Register gesture activation
    registerGesture(currentTime) {
        this.lastGestureTime = currentTime;
        this.isGestureLocked = true;

        // Unlock after gesture duration
        setTimeout(() => {
            this.isGestureLocked = false;
        }, this.gestureCooldown * 1000);
    },

    // Check if global event is allowed
    canTriggerGlobalEvent(currentTime) {
        if (this.isGlobalEventActive) {
            return false;
        }
        if (currentTime - this.lastGlobalEventTime < this.globalEventCooldown) {
            return false;
        }
        return true;
    },

    // Register global event start
    registerGlobalEventStart(currentTime) {
        this.lastGlobalEventTime = currentTime;
        this.isGlobalEventActive = true;
    },

    // Register global event end
    registerGlobalEventEnd() {
        this.isGlobalEventActive = false;
    },

    // Reset all cooldowns (for RESET state)
    reset() {
        this.lastClickTime = 0;
        this.meshCooldowns.clear();
        this.lastGestureTime = 0;
        this.isGestureLocked = false;
        this.lastGlobalEventTime = 0;
        this.isGlobalEventActive = false;
    }
};

const stateMachine = {
    currentState: InteractionState.IDLE,
    stateStartTime: 0,
    stateData: {}, // Store state-specific data

    // Transition to new state with validation
    setState(newState, currentTime, data = {}) {
        // Validate state transition
        if (!this.canTransitionTo(newState)) {
            console.warn(`Invalid state transition: ${this.currentState} -> ${newState}`);
            return false;
        }

        // Exit current state
        this.exitState(this.currentState, currentTime);

        // Transition to new state
        const previousState = this.currentState;
        this.currentState = newState;
        this.stateStartTime = currentTime;
        this.stateData = data;

        // Enter new state
        this.enterState(newState, currentTime);

        console.log(`State: ${previousState} -> ${newState}`);
        return true;
    },

    // Check if transition is allowed
    canTransitionTo(newState) {
        const current = this.currentState;

        // IDLE can transition to any state
        if (current === InteractionState.IDLE) return true;

        // GLOBAL_EVENT has highest priority, can override anything
        if (newState === InteractionState.GLOBAL_EVENT) return true;

        // RESET can be called from any state
        if (newState === InteractionState.RESET) return true;

        // Other states can only transition to IDLE or RESET
        if (newState === InteractionState.IDLE) return true;

        // Prevent other transitions (e.g., CLICK -> GESTURE directly)
        return false;
    },

    // Enter state handler
    enterState(state, currentTime) {
        switch (state) {
            case InteractionState.IDLE:
                // Clear all active forces and animations
                handTrackingState.gestureForce.set(0, 0, 0);
                handTrackingState.activeGesture = null;
                windState.active = false;
                break;

            case InteractionState.CLICK_INTERACTION:
                // Click interaction starts morphing
                break;

            case InteractionState.GESTURE_INTERACTION:
                // Gesture interaction active
                break;

            case InteractionState.GLOBAL_EVENT:
                // Global events like anomaly, vortex, black hole
                break;

            case InteractionState.RESET:
                // Full system reset
                this.resetSystem(currentTime);
                break;
        }
    },

    // Exit state handler
    exitState(state, currentTime) {
        switch (state) {
            case InteractionState.CLICK_INTERACTION:
                // Ensure morphing cleanup if needed
                break;

            case InteractionState.GESTURE_INTERACTION:
                // Clean up gesture forces
                handTrackingState.gestureForce.set(0, 0, 0);
                break;

            case InteractionState.GLOBAL_EVENT:
                // Clean up global event data
                break;
        }
    },

    // Reset system to clean state
    resetSystem(currentTime) {
        // Clear all forces
        handTrackingState.gestureForce.set(0, 0, 0);
        handTrackingState.activeGesture = null;
        windState.active = false;
        windState.strength = 0;

        // Reset all cooldowns
        cooldownSystem.reset();

        // Transition back to idle
        setTimeout(() => {
            this.setState(InteractionState.IDLE, currentTime);
        }, 100);
    },

    // Check if currently in a specific state
    isState(state) {
        return this.currentState === state;
    },

    // Get time elapsed in current state
    getStateElapsed(currentTime) {
        return currentTime - this.stateStartTime;
    }
};

// Audio system using Web Audio API
const audioSystem = {
    context: null,
    backgroundMusic: null,
    isInitialized: false,
    isMusicPlaying: false,
    lastClickTime: 0,
    clickCooldown: 0.05, // 50ms minimum between sounds

    // Initialize audio context (requires user interaction)
    init() {
        if (this.isInitialized) return;

        try {
            this.context = new (window.AudioContext || window.webkitAudioContext)();
            this.createBackgroundMusic();
            this.isInitialized = true;
            console.log('Audio system initialized');
        } catch (error) {
            console.warn('Audio initialization failed:', error);
        }
    },

    // Create simplified ambient background music (optimized for stability)
    createBackgroundMusic() {
        if (!this.context) return;

        try {
            // Master gain for overall volume control
            const masterGain = this.context.createGain();
            masterGain.gain.value = 0.05; // Reduced for stability
            masterGain.connect(this.context.destination);

            // Layer 1: Deep bass drone (55 Hz - A1) - Foundation
            const bass = this.context.createOscillator();
            bass.type = 'sine';
            bass.frequency.value = 55;
            const bassGain = this.context.createGain();
            bassGain.gain.value = 0.4;
            bass.connect(bassGain);
            bassGain.connect(masterGain);

            // Layer 2: Mid harmonic (165 Hz - E3) - Depth and atmosphere
            const midPad = this.context.createOscillator();
            midPad.type = 'triangle';
            midPad.frequency.value = 165;
            const midPadGain = this.context.createGain();
            midPadGain.gain.value = 0.25;
            midPad.connect(midPadGain);
            midPadGain.connect(masterGain);

            // Layer 3: High shimmer (330 Hz - E4) - Subtle atmosphere
            const highShimmer = this.context.createOscillator();
            highShimmer.type = 'sine';
            highShimmer.frequency.value = 330;
            const highShimmerGain = this.context.createGain();
            highShimmerGain.gain.value = 0.15;
            highShimmer.connect(highShimmerGain);
            highShimmerGain.connect(masterGain);

            this.backgroundMusic = {
                oscillators: [bass, midPad, highShimmer],
                gainNode: masterGain
            };
        } catch (error) {
            console.warn('Failed to create background music:', error);
            this.backgroundMusic = { oscillators: [], gainNode: null };
        }
    },

    // Start background music
    startMusic() {
        if (!this.isInitialized || this.isMusicPlaying) return;

        try {
            if (this.context.state === 'suspended') {
                this.context.resume();
            }

            this.backgroundMusic.oscillators.forEach(osc => {
                try {
                    osc.start();
                } catch (e) {
                    // Already started
                }
            });

            this.isMusicPlaying = true;
            console.log('Background music started');
        } catch (error) {
            console.warn('Failed to start music:', error);
        }
    },

    // STABILITY: Optimized click sound with strict error handling
    playClickSound() {
        if (!this.isInitialized || !this.context) return;

        try {
            const now = this.context.currentTime;

            // Throttle: Prevent too many rapid sounds
            if (now - this.lastClickTime < this.clickCooldown) {
                return;
            }
            this.lastClickTime = now;

            // Create short-lived oscillator (non-blocking)
            const osc = this.context.createOscillator();
            const gainNode = this.context.createGain();

            osc.type = 'sine';
            osc.frequency.value = 1200;

            // Quick envelope
            gainNode.gain.setValueAtTime(0, now);
            gainNode.gain.linearRampToValueAtTime(0.15, now + 0.003);
            gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.06);

            osc.connect(gainNode);
            gainNode.connect(this.context.destination);

            osc.start(now);
            osc.stop(now + 0.08);

        } catch (error) {
            // Silently fail to prevent blocking
        }
    },

    // Stop all audio
    stop() {
        if (this.backgroundMusic && this.isMusicPlaying) {
            try {
                this.backgroundMusic.oscillators.forEach(osc => {
                    try {
                        osc.stop();
                    } catch (e) {}
                });
                this.isMusicPlaying = false;
            } catch (error) {}
        }
    }
};

// Initialize audio on first user interaction
let audioInitialized = false;
document.addEventListener('click', () => {
    if (!audioInitialized) {
        audioInitialized = true;
        audioSystem.init();
        audioSystem.startMusic();
    }
}, { once: true });

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

// OPTIMIZATION: Geometry pool for reusing geometries instead of recreating
const geometryPool = {
    cache: new Map(), // Key: "type_size" -> Array of cached geometries

    // Get or create geometry (reuse when possible)
    get(type, size) {
        const key = `${type}_${size.toFixed(1)}`;

        // Check cache first
        if (!this.cache.has(key)) {
            this.cache.set(key, []);
        }

        const pool = this.cache.get(key);

        // Reuse from pool if available
        if (pool.length > 0) {
            return pool.pop();
        }

        // Create new if pool empty
        const baseGeometry = geometryGenerators[type](size);
        const wireframe = new THREE.WireframeGeometry(baseGeometry);
        baseGeometry.dispose(); // Dispose base immediately
        return wireframe;
    },

    // Return geometry to pool for reuse
    release(type, size, geometry) {
        if (!geometry) return;

        const key = `${type}_${size.toFixed(1)}`;
        if (!this.cache.has(key)) {
            this.cache.set(key, []);
        }

        const pool = this.cache.get(key);

        // Limit pool size to prevent memory bloat
        if (pool.length < 5) {
            pool.push(geometry);
        } else {
            // Pool full, dispose geometry
            geometry.dispose();
        }
    },

    // Clear all cached geometries
    clear() {
        for (const pool of this.cache.values()) {
            pool.forEach(geom => geom.dispose());
        }
        this.cache.clear();
    }
};

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

        // Morphing state (time-based animation)
        this.morphAnimationId = null; // Animation controller ID
        this.morphDuration = 1.0; // seconds
        this.sourcePositions = null;
        this.targetPositions = null;
        this.sourceColor = null;
        this.targetColor = null;
        this.morphSourceCount = 0;
        this.morphTargetCount = 0;

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

    // Backward compatibility: check if currently morphing
    get isMorphing() {
        return this.morphAnimationId !== null;
    }

    morphToNewShape(newGeometryType, newColor) {
        // ANIMATION SYSTEM: Non-blocking morphing using animation controller
        if (this.isMorphing) {
            return; // Already morphing, silently ignore to prevent conflicts
        }

        try {
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
                const otherTypes = geometryTracker.availableTypes.filter(t => t !== this.currentGeometryType);
                if (otherTypes.length === 0) return; // Only one geometry type exists
                const randomType = otherTypes[Math.floor(Math.random() * otherTypes.length)];
                return this.morphToNewShape(randomType, newColor); // Recursive call with different type
            }

            // Prepare morphing data
            const sourceColor = new THREE.Color(this.material.color);
            const targetColor = new THREE.Color(newColor);
            const previousGeometryType = this.currentGeometryType;

            // OPTIMIZATION: Use geometry pool instead of creating new geometry
            const targetWireframe = geometryPool.get(finalGeometryType, this.size);
            const targetPositions = targetWireframe.attributes.position.array;

            // Validate geometry structure
            if (!this.geometry || !this.geometry.attributes || !this.geometry.attributes.position) {
                console.warn(`Mesh ${this.meshId} has invalid geometry, aborting morph`);
                geometryPool.release(finalGeometryType, this.size, targetWireframe);
                return;
            }

            const sourcePositions = this.geometry.attributes.position.array;

            // Validate positions
            if (!sourcePositions || sourcePositions.length === 0 || !targetPositions || targetPositions.length === 0) {
                console.error(`Mesh ${this.meshId} has empty geometry, aborting morph`);
                geometryPool.release(finalGeometryType, this.size, targetWireframe);
                return;
            }

            // Prepare position arrays
            const sourceCount = sourcePositions.length;
            const targetCount = targetPositions.length;
            const maxCount = Math.max(sourceCount, targetCount);

            this.sourcePositions = new Float32Array(maxCount);
            this.targetPositions = new Float32Array(maxCount);
            this.morphSourceCount = sourceCount;
            this.morphTargetCount = targetCount;

            // Copy source positions
            for (let i = 0; i < sourceCount; i++) {
                this.sourcePositions[i] = sourcePositions[i];
            }
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
            if (targetCount < maxCount && targetCount > 0) {
                const lastValue = targetPositions[targetCount - 1];
                for (let i = targetCount; i < maxCount; i++) {
                    this.targetPositions[i] = lastValue;
                }
            }

            console.log(`Morphing mesh ${this.meshId} from ${previousGeometryType} to ${finalGeometryType} (${sourceCount} → ${targetCount} vertices)`);

            // ANIMATION SYSTEM: Create time-based morphing animation
            this.morphAnimationId = animationController.create({
                duration: this.morphDuration,
                easing: EasingFunctions.easeInOutCubic,
                onUpdate: (easedProgress) => {
                    // Update vertex positions
                    const positions = this.geometry.attributes.position;
                    const arrayLength = Math.min(this.sourcePositions.length, positions.array.length);

                    for (let i = 0; i < arrayLength; i++) {
                        positions.array[i] = this.sourcePositions[i] +
                            (this.targetPositions[i] - this.sourcePositions[i]) * easedProgress;
                    }
                    positions.needsUpdate = true;

                    // Interpolate color
                    this.material.color.lerpColors(sourceColor, targetColor, easedProgress);
                },
                onComplete: () => {
                    // OPTIMIZATION: Use geometry pool for final geometry
                    const oldGeometry = this.geometry;
                    const oldType = previousGeometryType;

                    // Get final geometry from pool
                    const finalWireframe = geometryPool.get(finalGeometryType, this.size);

                    // Replace geometry
                    this.geometry = finalWireframe;
                    this.mesh.geometry = this.geometry;

                    // Return old geometry to pool
                    geometryPool.release(oldType, this.size, oldGeometry);

                    // Update material color
                    this.material.color.copy(targetColor);
                    this.currentColor = targetColor.getHex();

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

                    // Clear morphing data
                    this.sourcePositions = null;
                    this.targetPositions = null;
                    this.morphSourceCount = 0;
                    this.morphTargetCount = 0;
                    this.morphAnimationId = null;

                    console.log(`Morphing complete for mesh ${this.meshId}`);
                },
                canInterrupt: false // Cannot interrupt morphing
            });

            // Update geometry type tracker
            geometryTracker.usedGeometries.set(this.meshId, finalGeometryType);
            this.currentGeometryType = finalGeometryType;

        } catch (error) {
            console.warn(`Morph failed for mesh ${this.meshId}:`, error);
            this.morphAnimationId = null;
        }
    }

    // REMOVED: updateMorphing() - now handled by animation controller

    updateMorphing(deltaTime) {
        // ANIMATION SYSTEM: Morphing is now handled by the animation controller
        // This method is kept for backward compatibility but does nothing
        // The animation controller automatically updates all morphing animations
    }

    updateIdle(deltaTime) {
        this.time += deltaTime;

        // OPTIMIZATION: Gentle drift using mesh position (no vertex updates)
        this.mesh.position.x = this.basePosition.x +
            Math.sin(this.time * this.driftSpeed.x * 100) * this.oscillationAmplitude;
        this.mesh.position.y = this.basePosition.y +
            Math.cos(this.time * this.driftSpeed.y * 100) * this.oscillationAmplitude;
        this.mesh.position.z = this.basePosition.z +
            Math.sin(this.time * this.driftSpeed.z * 100) * this.oscillationAmplitude * 0.5;

        // OPTIMIZATION: Slow rotation
        this.mesh.rotation.x += this.rotationSpeed.x;
        this.mesh.rotation.y += this.rotationSpeed.y;
        this.mesh.rotation.z += this.rotationSpeed.z;

        // OPTIMIZATION: Removed per-vertex deformation for better performance
        // The mesh position drift and rotation provide sufficient visual interest
    }

    applyWind(windDirection, windStrength, deltaTime) {
        // OPTIMIZATION: Simplified wind physics - mesh-level movement instead of per-vertex
        // This provides the same visual effect with much better performance

        // Calculate simplified turbulence for the whole mesh
        const turbulence = new THREE.Vector3(
            Math.sin(this.time * 2) * 0.3,
            Math.cos(this.time * 2) * 0.3,
            Math.sin(this.time * 1.5) * 0.3
        );

        // Apply wind force to mesh position
        const windForce = windDirection.clone()
            .multiplyScalar(windStrength * deltaTime * 8)
            .add(turbulence.multiplyScalar(deltaTime));

        this.mesh.position.add(windForce);

        // Add subtle rotation from wind
        this.mesh.rotation.z += windStrength * deltaTime * 0.1;
    }

    recover(deltaTime) {
        // OPTIMIZATION: Simplified recovery - mesh-level only
        const recoverySpeed = 2.0;

        // Recover mesh position to base
        this.mesh.position.lerp(this.basePosition, deltaTime * recoverySpeed);

        // Gradually restore rotation
        this.mesh.rotation.z *= 0.95;
    }

    updateVibration(intensity) {
        // OPTIMIZATION: Mesh-level vibration only
        const vibrationAmount = intensity * 0.5;
        this.mesh.position.x += (Math.random() - 0.5) * vibrationAmount;
        this.mesh.position.y += (Math.random() - 0.5) * vibrationAmount;
        this.mesh.position.z += (Math.random() - 0.5) * vibrationAmount * 0.3;

        // Add rotation shake for visual effect
        this.mesh.rotation.x += (Math.random() - 0.5) * intensity * 0.02;
        this.mesh.rotation.y += (Math.random() - 0.5) * intensity * 0.02;
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

// OPTIMIZATION: Reduced mesh count for better performance
const particleNets = [];
const numNets = 15; // Reduced from 30 for lighter, more fluid interface

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

// COOLDOWN: Click detection with cooldown and state transitions
document.addEventListener('click', (event) => {
    try {
        const currentTime = performance.now() / 1000;

        // Update mouse position
        const rect = renderer.domElement.getBoundingClientRect();
        mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

        // Raycast to detect clicked mesh
        raycaster.setFromCamera(mouse, camera);
        const meshes = particleNets.map(net => net.mesh).filter(m => m);
        const intersects = raycaster.intersectObjects(meshes);

        if (intersects.length > 0) {
            const clickedMesh = intersects[0].object;
            const particleNet = clickedMesh.userData.particleNet;

            if (particleNet) {
                // Check if anomalous mesh was clicked
                if (particleNet.meshId === anomalousState.meshId &&
                    !anomalousState.isVibrating &&
                    !anomalousState.blackHoleSpawned) {

                    // COOLDOWN: Check if global event can be triggered
                    if (!cooldownSystem.canTriggerGlobalEvent(currentTime)) {
                        console.log('Global event on cooldown');
                        return;
                    }

                    // Register global event start
                    cooldownSystem.registerGlobalEventStart(currentTime);

                    // Transition to GLOBAL_EVENT state
                    stateMachine.setState(InteractionState.GLOBAL_EVENT, currentTime, {
                        eventType: 'anomaly'
                    });

                    // Start vibration sequence
                    anomalousState.isVibrating = true;
                    anomalousState.vibrationStartTime = currentTime;

                    // Play click sound
                    audioSystem.playClickSound();

                } else if (!particleNet.isMorphing &&
                           particleNet.meshId !== anomalousState.meshId &&
                           (stateMachine.isState(InteractionState.IDLE) ||
                            stateMachine.isState(InteractionState.CLICK_INTERACTION))) {

                    // COOLDOWN: Check if click is allowed (global + per-mesh)
                    if (!cooldownSystem.canClick(currentTime, particleNet.meshId)) {
                        return; // Silently ignore click on cooldown
                    }

                    // Register click
                    cooldownSystem.registerClick(currentTime, particleNet.meshId);

                    // Transition to CLICK_INTERACTION state
                    stateMachine.setState(InteractionState.CLICK_INTERACTION, currentTime, {
                        meshId: particleNet.meshId
                    });

                    // Normal mesh interaction
                    if (!particleNet.hasBeenClicked) {
                        // First click: Apply both color and geometry change
                        const newColor = getRandomColor();
                        particleNet.morphToNewShape(null, newColor);
                        particleNet.hasBeenClicked = true;

                        // Play click sound
                        audioSystem.playClickSound();
                    } else {
                        // Subsequent clicks: Only change geometry, keep current color
                        particleNet.morphToNewShape(null, particleNet.currentColor);

                        // Play click sound
                        audioSystem.playClickSound();
                    }
                }
            }
        }
    } catch (error) {
        // STABILITY: Silently handle click errors to prevent disruption
        console.warn('Click handler error:', error);
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

// STATE MACHINE: State update functions
function updateIdleState(deltaTime, currentTime) {
    // IDLE state: Only passive floating animations, no forces
    particleNets.forEach(net => {
        // Update morphing if any mesh is still morphing
        net.updateMorphing(deltaTime);

        // Recover to original position
        net.recover(deltaTime);

        // Apply gentle idle animation
        net.updateIdle(deltaTime);
    });

    // Check if gesture becomes active
    const hasGestureForce = handTrackingState.gestureForce.length() > 0.01;
    if (hasGestureForce && handTrackingState.activeGesture) {
        stateMachine.setState(InteractionState.GESTURE_INTERACTION, currentTime);
    }
}

function updateClickInteractionState(deltaTime, currentTime) {
    // CLICK state: Morphing animation active
    let anyMorphing = false;

    particleNets.forEach(net => {
        // Update morphing animation
        net.updateMorphing(deltaTime);
        if (net.isMorphing) anyMorphing = true;

        // Recover to original position
        net.recover(deltaTime);

        // Apply gentle idle animation
        net.updateIdle(deltaTime);
    });

    // Return to IDLE when all morphing complete
    if (!anyMorphing) {
        stateMachine.setState(InteractionState.IDLE, currentTime);
    }
}

function updateGestureInteractionState(deltaTime, currentTime) {
    // GESTURE state: Hand gesture forces active
    updateGestureForces(currentTime);

    const hasGestureForce = handTrackingState.gestureForce.length() > 0.01;

    particleNets.forEach(net => {
        // Update morphing if needed
        net.updateMorphing(deltaTime);

        if (hasGestureForce) {
            const gestureDirection = handTrackingState.gestureForce.clone().normalize();
            const gestureStrength = Math.min(handTrackingState.gestureForce.length() * 0.9, 4.5);
            net.applyWind(gestureDirection, gestureStrength, deltaTime);
        } else {
            net.recover(deltaTime);
        }

        // Light idle animation
        if (!hasGestureForce) {
            net.updateIdle(deltaTime);
        }
    });

    // Decay gesture force
    handTrackingState.gestureForce.multiplyScalar(handTrackingState.forceDecay);

    // Return to IDLE when gesture force dissipates
    if (!hasGestureForce && !handTrackingState.activeGesture) {
        stateMachine.setState(InteractionState.IDLE, currentTime);
    }
}

function updateGlobalEventState(deltaTime, currentTime) {
    // GLOBAL_EVENT state: Vortex, anomaly vibration, black hole

    // Check if vortex is active
    if (vortexState.active) {
        updateVortexAnimation(currentTime, deltaTime);
        return; // Vortex overrides everything
    }

    // Check if anomaly vibration is active
    if (anomalousState.isVibrating) {
        const elapsed = currentTime - anomalousState.vibrationStartTime;

        if (elapsed < anomalousState.delayDuration) {
            particleNets.forEach(net => {
                net.updateVibration(anomalousState.vibrationIntensity);
            });
        } else if (!anomalousState.blackHoleSpawned) {
            // Spawn black hole after delay
            const spawnPosition = new THREE.Vector3(0, 0, 10);
            blackHole = new BlackHole(spawnPosition);
            scene.add(blackHole.mesh);
            anomalousState.blackHoleSpawned = true;
            anomalousState.isVibrating = false;
            anomalousState.blackHoleSpawnTime = currentTime;

            particleNets.forEach(net => {
                net.mesh.position.lerp(net.basePosition, 0.5);
            });
        }
        return;
    }

    // Check if black hole is active
    if (blackHole) {
        blackHole.update(deltaTime);

        particleNets.forEach(net => {
            blackHole.applyAttractionToMesh(net, deltaTime);
        });

        // Check collision with anomalous mesh
        if (anomalousState.mesh && blackHole.checkCollision(anomalousState.mesh)) {
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

            // COOLDOWN: Register global event end
            cooldownSystem.registerGlobalEventEnd();

            // Return to IDLE
            stateMachine.setState(InteractionState.IDLE, currentTime);
        }
        return;
    }

    // No active global events, return to IDLE
    // COOLDOWN: Register global event end
    cooldownSystem.registerGlobalEventEnd();

    stateMachine.setState(InteractionState.IDLE, currentTime);
}

// Animation loop with stability safeguards
const clock = new THREE.Clock();
let isAnimating = false; // Prevent concurrent animation frames

function animate() {
    requestAnimationFrame(animate);

    // STABILITY: Prevent concurrent frame execution
    if (isAnimating) return;
    isAnimating = true;

    try {
        const deltaTime = Math.min(clock.getDelta(), 0.1); // Cap deltaTime to prevent large jumps
        const currentTime = clock.elapsedTime;

        // ANIMATION SYSTEM: Update all active time-based animations
        animationController.updateAll(currentTime);

        // STATE MACHINE: Handle animations based on current state
        switch (stateMachine.currentState) {
            case InteractionState.IDLE:
                // IDLE: Only run passive idle animations
                updateIdleState(deltaTime, currentTime);
                break;

            case InteractionState.CLICK_INTERACTION:
                // CLICK: Morphing + idle animations
                updateClickInteractionState(deltaTime, currentTime);
                break;

            case InteractionState.GESTURE_INTERACTION:
                // GESTURE: Gesture forces + idle animations
                updateGestureInteractionState(deltaTime, currentTime);
                break;

            case InteractionState.GLOBAL_EVENT:
                // GLOBAL: Anomaly, vortex, black hole events
                updateGlobalEventState(deltaTime, currentTime);
                break;

            case InteractionState.RESET:
                // RESET: Transition back to idle
                // resetSystem handles transition
                break;
        }

        // LEGACY: Keep old system for backwards compatibility during transition
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

            // STABILITY: Prioritize hand gestures over keyboard wind with reduced multipliers
            if (hasGestureForce) {
                const gestureDirection = handTrackingState.gestureForce.clone().normalize();
                // Reduced multipliers for stability while maintaining responsiveness
                const gestureStrength = Math.min(handTrackingState.gestureForce.length() * 0.9, 4.5);
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
    } catch (error) {
        // STABILITY: Catch all errors to prevent render loop disruption
        console.warn('Animation frame error:', error);
    } finally {
        // CRITICAL: Always release animation lock
        isAnimating = false;
    }
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

// Hand tracking state (optimized for stability)
const handTrackingState = {
    hands: null,
    camera: null,
    isActive: false,
    lastHandPosition: null,
    currentHandPosition: null,
    gestureForce: new THREE.Vector3(0, 0, 0),
    forceDecay: 0.94,  // Increased decay for better stability
    forceSensitivity: 15.0,  // Reduced for stability while maintaining responsiveness
    currentGesture: null,
    isFist: false,
    fistDetected: false,
    // Gesture persistence system
    activeGesture: null,
    gestureStartTime: 0,
    gestureDuration: 3.0,  // 3 seconds persistence
    gestureTargetForce: new THREE.Vector3(0, 0, 0),
    detectionThreshold: 0.005,
    lastUIUpdate: 0
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


        setTimeout(() => {
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

        // COOLDOWN: If gesture detected, check cooldown and activate
        if (detectedGesture && !handTrackingState.activeGesture) {
            // Check cooldown first
            if (!cooldownSystem.canActivateGesture(currentTime)) {
                return; // Gesture still locked
            }

            // Only activate gesture in IDLE or GESTURE_INTERACTION states
            if (stateMachine.isState(InteractionState.IDLE) ||
                stateMachine.isState(InteractionState.GESTURE_INTERACTION)) {

                // Register gesture activation (locks for 3 seconds)
                cooldownSystem.registerGesture(currentTime);

                handTrackingState.currentGesture = detectedGesture;
                handTrackingState.activeGesture = detectedGesture;
                handTrackingState.gestureStartTime = currentTime;
                handTrackingState.gestureTargetForce.copy(forceVector);

                // Transition to GESTURE_INTERACTION state
                stateMachine.setState(InteractionState.GESTURE_INTERACTION, currentTime, {
                    gesture: detectedGesture
                });

                console.log(`Gesture: ${detectedGesture} (locked for ${cooldownSystem.gestureCooldown}s)`);
            }
        }
    }
}

// STABILITY: Optimized gesture force system with strict bounds
function updateGestureForces(currentTime) {
    try {
        // Check if we have an active gesture
        if (handTrackingState.activeGesture && handTrackingState.gestureStartTime > 0) {
            const elapsed = currentTime - handTrackingState.gestureStartTime;

            if (elapsed < handTrackingState.gestureDuration) {
                // Gesture is still active - maintain force
                const progress = elapsed / handTrackingState.gestureDuration;
                const easing = 1 - Math.pow(progress, 2); // Ease-out quadratic

                // STABILITY: Simplified force application with strict capping
                const sustainedForce = handTrackingState.gestureTargetForce.clone().multiplyScalar(easing * 0.2);
                handTrackingState.gestureForce.add(sustainedForce);

                // CRITICAL: Strict force magnitude limit (reduced for stability)
                const maxForce = 30.0;
                const currentMagnitude = handTrackingState.gestureForce.length();
                if (currentMagnitude > maxForce) {
                    handTrackingState.gestureForce.normalize().multiplyScalar(maxForce);
                }
            } else {
                // Gesture duration expired - clear active gesture
                handTrackingState.activeGesture = null;
                handTrackingState.gestureStartTime = 0;
                handTrackingState.gestureTargetForce.set(0, 0, 0);
            }
        }
    } catch (error) {
        // Silently handle errors to prevent render loop disruption
        handTrackingState.activeGesture = null;
        handTrackingState.gestureForce.set(0, 0, 0);
    }
}

// COOLDOWN: Start vortex sequence with cooldown and state transition
function startVortexSequence() {
    const currentTime = performance.now() / 1000;

    // COOLDOWN: Check if global event can be triggered
    if (!cooldownSystem.canTriggerGlobalEvent(currentTime)) {
        console.log('Vortex on cooldown, cannot trigger');
        return;
    }

    // Register global event start
    cooldownSystem.registerGlobalEventStart(currentTime);

    // Transition to GLOBAL_EVENT state
    stateMachine.setState(InteractionState.GLOBAL_EVENT, currentTime, {
        eventType: 'vortex'
    });

    vortexState.active = true;
    vortexState.startTime = currentTime;
    vortexState.vortexCenter.set(0, 0, 0);

    console.log('Vortex sequence started');
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
        // Phase 3: Reset after flash and return to IDLE
        vortexState.active = false;

        // COOLDOWN: Register global event end
        cooldownSystem.registerGlobalEventEnd();

        // STATE MACHINE: Transition back to IDLE
        stateMachine.setState(InteractionState.IDLE, currentTime);

        console.log('Vortex complete - returning to IDLE');
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

// ANIMATION SYSTEM: Animate mesh to new position using animation controller
function animateMeshToPosition(mesh, startPos, targetPos, duration, onUpdate = null) {
    animationController.create({
        duration: duration,
        easing: EasingFunctions.easeOutQuad,
        onUpdate: (easedProgress) => {
            mesh.position.lerpVectors(startPos, targetPos, easedProgress);
            if (onUpdate) onUpdate();
        },
        onComplete: () => {
            // Animation complete
        },
        canInterrupt: true
    });
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
