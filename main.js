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

// Mouse interaction state
const mouseState = {
    position: new THREE.Vector2(0, 0),
    worldPosition: new THREE.Vector3(0, 0, 0),
    isDown: false,
    isDragging: false,
    lastPosition: new THREE.Vector2(0, 0),
    velocity: new THREE.Vector2(0, 0),
    clickBursts: [],
    influenceRadius: 25,
    influenceStrength: 1.5
};

// Black hole state
const blackHoleState = {
    active: false,
    position: new THREE.Vector3(0, 0, 0),
    targetPosition: new THREE.Vector3(0, 0, 0),
    radius: 8,
    eventHorizonRadius: 12,
    gravityRadius: 35,
    gravityStrength: 2.5,
    mesh: null,
    accretionDisk: null,
    glowMesh: null
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

        // Fabric-like properties
        this.flutterPhase = Math.random() * Math.PI * 2;
        this.flutterSpeed = 0.5 + Math.random() * 0.5;
        this.flutterIntensity = 0.3 + Math.random() * 0.4;

        // Create mesh structure
        this.createMesh();

        // Wind physics
        this.velocities = [];
        this.originalPositions = [];
        this.vertexTrails = []; // For trailing behavior
        this.windAccumulator = new THREE.Vector3(0, 0, 0);
        const positions = this.geometry.attributes.position;
        for (let i = 0; i < positions.count; i++) {
            this.velocities.push(new THREE.Vector3(0, 0, 0));
            this.vertexTrails.push(new THREE.Vector3(0, 0, 0));
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

        // Fabric-like flutter and ripple deformation
        const positions = this.geometry.attributes.position;
        for (let i = 0; i < positions.count; i++) {
            const original = this.originalPositions[i];

            // Calculate distance from center for wave propagation
            const distFromCenter = Math.sqrt(
                original.x * original.x +
                original.y * original.y +
                original.z * original.z
            );
            const normalizedDist = distFromCenter / this.size;

            // Flutter like fabric in gentle breeze
            const flutterX = Math.sin(
                this.time * this.flutterSpeed * 2 +
                this.flutterPhase +
                original.y * 0.3 +
                normalizedDist * 2
            ) * this.flutterIntensity * 0.3;

            const flutterY = Math.cos(
                this.time * this.flutterSpeed * 1.7 +
                this.flutterPhase +
                original.x * 0.3 +
                normalizedDist * 2.5
            ) * this.flutterIntensity * 0.4;

            const flutterZ = Math.sin(
                this.time * this.flutterSpeed * 2.2 +
                this.flutterPhase +
                original.x * 0.2 +
                original.y * 0.2
            ) * this.flutterIntensity * 0.25;

            // Wave propagation through the mesh
            const wavePropagation = Math.sin(
                this.time * this.oscillationSpeed * 3 +
                normalizedDist * Math.PI * 2
            ) * 0.15;

            // Billowing effect
            const billow = Math.sin(
                this.time * this.oscillationSpeed * 1.5 +
                original.x * 0.15 +
                original.z * 0.15
            ) * Math.cos(
                this.time * this.oscillationSpeed * 1.2 +
                original.y * 0.1
            ) * 0.2;

            // Trailing effect based on position
            const trailFactor = (1 + normalizedDist) * 0.3;
            this.vertexTrails[i].x += (flutterX - this.vertexTrails[i].x) * deltaTime * (2 - trailFactor);
            this.vertexTrails[i].y += (flutterY - this.vertexTrails[i].y) * deltaTime * (2 - trailFactor);
            this.vertexTrails[i].z += (flutterZ - this.vertexTrails[i].z) * deltaTime * (2 - trailFactor);

            positions.setXYZ(
                i,
                original.x + this.vertexTrails[i].x + wavePropagation * 0.3 + billow * 0.2,
                original.y + this.vertexTrails[i].y + wavePropagation * 0.4 + billow * 0.3,
                original.z + this.vertexTrails[i].z + wavePropagation * 0.2 + billow * 0.15
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
            const original = this.originalPositions[i];

            // Calculate world position
            const worldPos = pos.clone().applyMatrix4(this.mesh.matrixWorld);

            // Calculate distance from center for fabric-like trailing
            const distFromCenter = Math.sqrt(
                original.x * original.x +
                original.y * original.y +
                original.z * original.z
            );
            const normalizedDist = distFromCenter / this.size;
            const trailingFactor = 0.5 + normalizedDist * 0.5; // Outer parts trail more

            // Soft, flowing turbulence with multiple frequency layers
            const turbulenceX =
                Math.sin(this.time * 0.8 + worldPos.x * 0.08 + worldPos.y * 0.05) * 0.2 +
                Math.sin(this.time * 1.3 + worldPos.x * 0.12 + normalizedDist * 2) * 0.12;

            const turbulenceY =
                Math.cos(this.time * 0.7 + worldPos.y * 0.08 + worldPos.z * 0.05) * 0.2 +
                Math.cos(this.time * 1.1 + worldPos.y * 0.1 + normalizedDist * 2) * 0.12;

            const turbulenceZ =
                Math.sin(this.time * 0.9 + worldPos.z * 0.08 + worldPos.x * 0.05) * 0.2 +
                Math.sin(this.time * 1.2 + worldPos.z * 0.11 + normalizedDist * 2) * 0.12;

            const turbulence = new THREE.Vector3(turbulenceX, turbulenceY, turbulenceZ);

            // Fabric ripple effect - waves propagating through the mesh
            const ripple = Math.sin(
                this.time * 4 +
                normalizedDist * Math.PI * 3 +
                this.windAccumulator.length() * 2
            ) * windStrength * 0.4;

            const rippleDir = new THREE.Vector3(
                Math.sin(this.time * 2 + original.x * 0.2),
                Math.cos(this.time * 2 + original.y * 0.2),
                Math.sin(this.time * 2 + original.z * 0.2)
            ).normalize();

            // Gentle wind force with smooth accumulation and fabric behavior
            const windForce = this.windAccumulator.clone()
                .multiplyScalar(0.6 * trailingFactor)
                .add(turbulence.multiplyScalar(trailingFactor))
                .add(rippleDir.multiplyScalar(ripple));

            // Apply force to velocity with smooth acceleration
            this.velocities[i].add(windForce.multiplyScalar(deltaTime * 0.6));

            // Soft damping for gentle, flowing motion
            this.velocities[i].multiplyScalar(0.88);

            // Update position with smooth interpolation for fabric softness
            const targetPos = pos.clone().add(this.velocities[i].clone().multiplyScalar(deltaTime * 2.5));
            pos.lerp(targetPos, 0.4);

            positions.setXYZ(i, pos.x, pos.y, pos.z);
        }

        positions.needsUpdate = true;

        // Apply gentle force to mesh position with slight sway
        const meshForce = this.windAccumulator.clone().multiplyScalar(deltaTime * 2);
        const sway = new THREE.Vector3(
            Math.sin(this.time * 1.5) * windStrength * 0.3,
            Math.cos(this.time * 1.3) * windStrength * 0.2,
            Math.sin(this.time * 1.7) * windStrength * 0.2
        );
        this.mesh.position.add(meshForce).add(sway.multiplyScalar(deltaTime));
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

    applyMouseInfluence(mouseWorldPos, influenceRadius, influenceStrength, deltaTime) {
        // Calculate distance from mouse to particle net center
        const distToMouse = this.mesh.position.distanceTo(mouseWorldPos);

        if (distToMouse < influenceRadius * 2) {
            // Direction from particle to mouse
            const directionToMouse = new THREE.Vector3()
                .subVectors(mouseWorldPos, this.mesh.position)
                .normalize();

            // Influence strength falls off with distance
            const falloff = Math.max(0, 1 - distToMouse / (influenceRadius * 2));
            const force = directionToMouse.multiplyScalar(falloff * influenceStrength * deltaTime * 3);

            // Apply subtle attraction to mesh
            this.mesh.position.add(force);

            // Apply to individual vertices with fabric-like response
            const positions = this.geometry.attributes.position;
            for (let i = 0; i < positions.count; i++) {
                const pos = new THREE.Vector3(
                    positions.getX(i),
                    positions.getY(i),
                    positions.getZ(i)
                );
                const original = this.originalPositions[i];

                const worldPos = pos.clone().applyMatrix4(this.mesh.matrixWorld);
                const vertexDistToMouse = worldPos.distanceTo(mouseWorldPos);

                if (vertexDistToMouse < influenceRadius) {
                    // Calculate normalized distance from center for trailing
                    const distFromCenter = Math.sqrt(
                        original.x * original.x +
                        original.y * original.y +
                        original.z * original.z
                    );
                    const normalizedDist = distFromCenter / this.size;
                    const softness = 0.6 + normalizedDist * 0.4;

                    const vertexDir = new THREE.Vector3()
                        .subVectors(mouseWorldPos, worldPos)
                        .normalize();

                    const vertexFalloff = Math.max(0, 1 - vertexDistToMouse / influenceRadius);

                    // Add soft, flowing influence like fabric being pulled
                    const vertexForce = vertexDir.multiplyScalar(
                        vertexFalloff * influenceStrength * deltaTime * 0.4 * softness
                    );

                    // Add wave effect that propagates through the mesh
                    const wave = Math.sin(
                        this.time * 5 +
                        normalizedDist * Math.PI * 2 +
                        vertexFalloff * Math.PI
                    ) * vertexFalloff * 0.1;

                    this.velocities[i].add(vertexForce);
                    this.velocities[i].y += wave * influenceStrength * deltaTime;
                }
            }
        }
    }

    applyClickBurst(burstPos, burstStrength, burstRadius, deltaTime) {
        const distToBurst = this.mesh.position.distanceTo(burstPos);

        if (distToBurst < burstRadius) {
            // Direction away from burst
            const direction = new THREE.Vector3()
                .subVectors(this.mesh.position, burstPos)
                .normalize();

            const falloff = Math.max(0, 1 - distToBurst / burstRadius);
            const force = direction.multiplyScalar(falloff * burstStrength * deltaTime * 15);

            this.mesh.position.add(force);

            // Apply to vertices with fabric ripple effect
            const positions = this.geometry.attributes.position;
            for (let i = 0; i < positions.count; i++) {
                const pos = new THREE.Vector3(
                    positions.getX(i),
                    positions.getY(i),
                    positions.getZ(i)
                );
                const original = this.originalPositions[i];

                const worldPos = pos.clone().applyMatrix4(this.mesh.matrixWorld);
                const vertexDistToBurst = worldPos.distanceTo(burstPos);

                if (vertexDistToBurst < burstRadius) {
                    // Calculate distance from center for trailing behavior
                    const distFromCenter = Math.sqrt(
                        original.x * original.x +
                        original.y * original.y +
                        original.z * original.z
                    );
                    const normalizedDist = distFromCenter / this.size;

                    const vertexDir = new THREE.Vector3()
                        .subVectors(worldPos, burstPos)
                        .normalize();

                    const vertexFalloff = Math.max(0, 1 - vertexDistToBurst / burstRadius);

                    // Softer burst with trailing
                    const trailingFactor = 0.7 + normalizedDist * 0.3;
                    const vertexForce = vertexDir.multiplyScalar(
                        vertexFalloff * burstStrength * 1.8 * trailingFactor
                    );

                    // Add ripple wave that spreads through fabric
                    const rippleWave = Math.sin(
                        vertexDistToBurst * 0.5 +
                        this.time * 8
                    ) * vertexFalloff * burstStrength * 0.3;

                    const perpendicular = new THREE.Vector3(
                        -vertexDir.y,
                        vertexDir.x,
                        vertexDir.z * 0.5
                    ).normalize();

                    this.velocities[i].add(vertexForce);
                    this.velocities[i].add(perpendicular.multiplyScalar(rippleWave));
                }
            }
        }
    }

    updateHoverEffect(mouseWorldPos, influenceRadius) {
        const distToMouse = this.mesh.position.distanceTo(mouseWorldPos);

        if (distToMouse < influenceRadius) {
            const falloff = Math.max(0, 1 - distToMouse / influenceRadius);
            const targetOpacity = 0.7 + falloff * 0.3;
            this.material.opacity += (targetOpacity - this.material.opacity) * 0.1;

            // Subtle color shift
            const hoverColor = new THREE.Color(0x00ffff);
            const currentColor = new THREE.Color(this.material.color);
            currentColor.lerp(hoverColor, falloff * 0.3);
            this.material.color.copy(currentColor);
        } else {
            // Return to original opacity
            const baseOpacity = 0.5 + Math.random() * 0.1;
            this.material.opacity += (baseOpacity - this.material.opacity) * 0.05;
        }
    }

    applyBlackHoleGravity(blackHolePos, gravityRadius, gravityStrength, eventHorizonRadius, deltaTime) {
        const distToBlackHole = this.mesh.position.distanceTo(blackHolePos);

        if (distToBlackHole < gravityRadius) {
            // Direction toward black hole
            const directionToBlackHole = new THREE.Vector3()
                .subVectors(blackHolePos, this.mesh.position)
                .normalize();

            // Inverse square law for gravity (stronger when closer)
            const distanceRatio = distToBlackHole / gravityRadius;
            const gravityFalloff = 1 / (distanceRatio * distanceRatio + 0.1);
            const clampedGravity = Math.min(gravityFalloff, 5.0);

            // Pull mesh toward black hole
            const meshForce = directionToBlackHole.clone()
                .multiplyScalar(clampedGravity * gravityStrength * deltaTime * 0.8);
            this.mesh.position.add(meshForce);

            // Apply spaghettification to vertices
            const positions = this.geometry.attributes.position;
            for (let i = 0; i < positions.count; i++) {
                const pos = new THREE.Vector3(
                    positions.getX(i),
                    positions.getY(i),
                    positions.getZ(i)
                );
                const original = this.originalPositions[i];

                // World position of vertex
                const worldPos = pos.clone().applyMatrix4(this.mesh.matrixWorld);
                const vertexDistToBlackHole = worldPos.distanceTo(blackHolePos);

                if (vertexDistToBlackHole < gravityRadius) {
                    // Calculate normalized distance for effects
                    const distFromCenter = Math.sqrt(
                        original.x * original.x +
                        original.y * original.y +
                        original.z * original.z
                    );
                    const normalizedDist = distFromCenter / this.size;

                    const vertexDir = new THREE.Vector3()
                        .subVectors(blackHolePos, worldPos)
                        .normalize();

                    const vertexDistRatio = vertexDistToBlackHole / gravityRadius;
                    const vertexGravity = 1 / (vertexDistRatio * vertexDistRatio + 0.1);
                    const clampedVertexGravity = Math.min(vertexGravity, 8.0);

                    // Spaghettification: outer parts stretch more toward black hole
                    const stretchFactor = 1.0 + normalizedDist * 0.5;
                    const vertexForce = vertexDir.multiplyScalar(
                        clampedVertexGravity * gravityStrength * deltaTime * 0.3 * stretchFactor
                    );

                    // Tidal forces: perpendicular stretching
                    const toBlackHole = new THREE.Vector3().subVectors(blackHolePos, worldPos);
                    const perpendicular = new THREE.Vector3()
                        .crossVectors(toBlackHole, new THREE.Vector3(0, 1, 0))
                        .normalize();

                    const tidalStrength = clampedVertexGravity * 0.05;
                    const tidalForce = perpendicular.multiplyScalar(
                        Math.sin(this.time * 3 + normalizedDist * Math.PI) * tidalStrength
                    );

                    this.velocities[i].add(vertexForce);
                    this.velocities[i].add(tidalForce);

                    // Extreme deformation near event horizon
                    if (vertexDistToBlackHole < eventHorizonRadius) {
                        const horizonFactor = 1 - (vertexDistToBlackHole / eventHorizonRadius);
                        const extremeStretch = vertexDir.multiplyScalar(
                            horizonFactor * gravityStrength * 2.0
                        );
                        this.velocities[i].add(extremeStretch);
                    }
                }
            }
        }
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

// Create black hole visuals
function createBlackHole() {
    // Core black sphere (event horizon)
    const coreGeometry = new THREE.SphereGeometry(blackHoleState.radius, 32, 32);
    const coreMaterial = new THREE.MeshBasicMaterial({
        color: 0x000000,
        transparent: true,
        opacity: 1.0
    });
    blackHoleState.mesh = new THREE.Mesh(coreGeometry, coreMaterial);
    blackHoleState.mesh.visible = false;
    scene.add(blackHoleState.mesh);

    // Outer glow/distortion ring
    const glowGeometry = new THREE.RingGeometry(
        blackHoleState.radius * 1.2,
        blackHoleState.eventHorizonRadius,
        64
    );
    const glowMaterial = new THREE.MeshBasicMaterial({
        color: 0x8800ff,
        transparent: true,
        opacity: 0.3,
        side: THREE.DoubleSide
    });
    blackHoleState.glowMesh = new THREE.Mesh(glowGeometry, glowMaterial);
    blackHoleState.glowMesh.visible = false;
    scene.add(blackHoleState.glowMesh);

    // Accretion disk
    const diskGeometry = new THREE.RingGeometry(
        blackHoleState.eventHorizonRadius,
        blackHoleState.eventHorizonRadius * 1.8,
        64
    );
    const diskMaterial = new THREE.ShaderMaterial({
        transparent: true,
        side: THREE.DoubleSide,
        uniforms: {
            time: { value: 0 },
            color1: { value: new THREE.Color(0xff4400) },
            color2: { value: new THREE.Color(0xff8800) },
            color3: { value: new THREE.Color(0xffaa00) }
        },
        vertexShader: `
            varying vec2 vUv;
            varying vec3 vPosition;
            void main() {
                vUv = uv;
                vPosition = position;
                gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
        `,
        fragmentShader: `
            uniform float time;
            uniform vec3 color1;
            uniform vec3 color2;
            uniform vec3 color3;
            varying vec2 vUv;
            varying vec3 vPosition;

            void main() {
                vec2 center = vec2(0.5, 0.5);
                float dist = distance(vUv, center);

                // Rotating swirl pattern
                float angle = atan(vUv.y - 0.5, vUv.x - 0.5);
                float spiral = sin(angle * 8.0 + dist * 20.0 - time * 2.0) * 0.5 + 0.5;

                // Color gradient from center to edge
                vec3 color = mix(color1, color2, dist * 2.0);
                color = mix(color, color3, spiral);

                // Fade based on distance
                float alpha = (1.0 - dist * 2.0) * (0.4 + spiral * 0.3);
                alpha *= smoothstep(0.0, 0.1, dist); // Fade near center

                gl_FragColor = vec4(color, alpha);
            }
        `
    });
    blackHoleState.accretionDisk = new THREE.Mesh(diskGeometry, diskMaterial);
    blackHoleState.accretionDisk.visible = false;
    scene.add(blackHoleState.accretionDisk);
}

createBlackHole();

// Keyboard controls
document.addEventListener('keydown', (e) => {
    if (e.code in windState.keys) {
        e.preventDefault();
        windState.keys[e.code] = true;
        updateWindDirection();
    }

    // Toggle black hole with 'B' key
    if (e.code === 'KeyB') {
        e.preventDefault();
        blackHoleState.active = !blackHoleState.active;
        blackHoleState.mesh.visible = blackHoleState.active;
        blackHoleState.glowMesh.visible = blackHoleState.active;
        blackHoleState.accretionDisk.visible = blackHoleState.active;

        if (blackHoleState.active) {
            // Position black hole at current mouse position
            blackHoleState.position.copy(mouseState.worldPosition);
            blackHoleState.targetPosition.copy(mouseState.worldPosition);
        }
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

// Mouse and touch controls
function updateMousePosition(clientX, clientY) {
    // Normalized device coordinates (-1 to +1)
    mouseState.position.x = (clientX / window.innerWidth) * 2 - 1;
    mouseState.position.y = -(clientY / window.innerHeight) * 2 + 1;

    // Calculate mouse velocity for drag effects
    mouseState.velocity.x = mouseState.position.x - mouseState.lastPosition.x;
    mouseState.velocity.y = mouseState.position.y - mouseState.lastPosition.y;
    mouseState.lastPosition.copy(mouseState.position);

    // Convert to world coordinates
    const vector = new THREE.Vector3(mouseState.position.x, mouseState.position.y, 0.5);
    vector.unproject(camera);
    const dir = vector.sub(camera.position).normalize();
    const distance = -camera.position.z / dir.z;
    mouseState.worldPosition.copy(camera.position).add(dir.multiplyScalar(distance));
}

document.addEventListener('mousemove', (e) => {
    updateMousePosition(e.clientX, e.clientY);
    if (mouseState.isDown) {
        mouseState.isDragging = true;
    }
});

document.addEventListener('mousedown', (e) => {
    mouseState.isDown = true;
    updateMousePosition(e.clientX, e.clientY);
});

document.addEventListener('mouseup', (e) => {
    if (mouseState.isDown) {
        // Create click burst effect
        mouseState.clickBursts.push({
            position: mouseState.worldPosition.clone(),
            strength: mouseState.isDragging ? 3.0 : 2.0,
            radius: mouseState.isDragging ? 35 : 25,
            life: 1.0
        });
    }
    mouseState.isDown = false;
    mouseState.isDragging = false;
});

// Touch support
document.addEventListener('touchstart', (e) => {
    if (e.touches.length > 0) {
        e.preventDefault();
        const touch = e.touches[0];
        mouseState.isDown = true;
        updateMousePosition(touch.clientX, touch.clientY);
    }
}, { passive: false });

document.addEventListener('touchmove', (e) => {
    if (e.touches.length > 0) {
        e.preventDefault();
        const touch = e.touches[0];
        updateMousePosition(touch.clientX, touch.clientY);
        mouseState.isDragging = true;
    }
}, { passive: false });

document.addEventListener('touchend', (e) => {
    e.preventDefault();
    if (mouseState.isDown) {
        mouseState.clickBursts.push({
            position: mouseState.worldPosition.clone(),
            strength: mouseState.isDragging ? 3.0 : 2.0,
            radius: mouseState.isDragging ? 35 : 25,
            life: 1.0
        });
    }
    mouseState.isDown = false;
    mouseState.isDragging = false;
}, { passive: false });

// Animation loop
const clock = new THREE.Clock();

function animate() {
    requestAnimationFrame(animate);

    const deltaTime = Math.min(clock.getDelta(), 0.1); // Cap delta time for stability

    // Very smooth wind strength transition with easing
    const strengthDelta = windState.targetStrength - windState.strength;
    const easeInOut = Math.abs(strengthDelta) < 0.5 ? strengthDelta * 0.5 : strengthDelta;
    windState.strength += easeInOut * deltaTime * 2.5;

    // Update click bursts
    mouseState.clickBursts = mouseState.clickBursts.filter(burst => {
        burst.life -= deltaTime * 2.0;
        return burst.life > 0;
    });

    // Update black hole position and visuals
    if (blackHoleState.active) {
        // Smoothly follow mouse
        blackHoleState.targetPosition.copy(mouseState.worldPosition);
        blackHoleState.position.lerp(blackHoleState.targetPosition, deltaTime * 5);

        // Update black hole mesh positions
        blackHoleState.mesh.position.copy(blackHoleState.position);
        blackHoleState.glowMesh.position.copy(blackHoleState.position);
        blackHoleState.accretionDisk.position.copy(blackHoleState.position);

        // Rotate glow ring to face camera
        blackHoleState.glowMesh.lookAt(camera.position);

        // Animate accretion disk rotation and shader
        blackHoleState.accretionDisk.rotation.z += deltaTime * 0.5;
        if (blackHoleState.accretionDisk.material.uniforms) {
            blackHoleState.accretionDisk.material.uniforms.time.value = clock.elapsedTime;
        }

        // Pulsing glow effect
        const pulseFactor = Math.sin(clock.elapsedTime * 2) * 0.1 + 0.3;
        blackHoleState.glowMesh.material.opacity = pulseFactor;
    }

    // Update all particle networks
    particleNets.forEach(net => {
        // Apply black hole gravity
        if (blackHoleState.active) {
            net.applyBlackHoleGravity(
                blackHoleState.position,
                blackHoleState.gravityRadius,
                blackHoleState.gravityStrength,
                blackHoleState.eventHorizonRadius,
                deltaTime
            );
        }

        // Apply keyboard wind
        if (windState.strength > 0.01) {
            net.applyWind(windState.direction, windState.strength, deltaTime);
        } else {
            net.recover(deltaTime);
        }

        // Apply mouse influence (attraction) - only if black hole is not active
        if (!blackHoleState.active) {
            net.applyMouseInfluence(
                mouseState.worldPosition,
                mouseState.influenceRadius,
                mouseState.influenceStrength,
                deltaTime
            );
        }

        // Apply click bursts
        mouseState.clickBursts.forEach(burst => {
            net.applyClickBurst(burst.position, burst.strength, burst.radius, deltaTime);
        });

        // Update hover glow effect - only if black hole is not active
        if (!blackHoleState.active) {
            net.updateHoverEffect(mouseState.worldPosition, mouseState.influenceRadius);
        }

        // Always apply idle animation for continuous organic movement
        if (windState.strength < 0.7 && !blackHoleState.active) {
            net.updateIdle(deltaTime);
        }
    });

    // Very gentle camera movement - like floating in space
    const cameraTime = clock.elapsedTime;
    camera.position.x = Math.sin(cameraTime * 0.08) * 8 + Math.sin(cameraTime * 0.05) * 3;
    camera.position.y = Math.cos(cameraTime * 0.1) * 5 + Math.cos(cameraTime * 0.06) * 2;
    camera.position.z = 50 + Math.sin(cameraTime * 0.07) * 4;
    camera.lookAt(0, 0, 0);

    // Update wind sound volume based on wind strength
    if (audioSystem.isPlaying) {
        updateWindVolume();
    }

    renderer.render(scene, camera);
}

// Handle window resize
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

// Audio system
const audioSystem = {
    music: document.getElementById('background-music'),
    wind: document.getElementById('wind-sound'),
    toggle: document.getElementById('audio-toggle'),
    musicVolume: document.getElementById('music-volume'),
    windVolume: document.getElementById('wind-volume'),
    isPlaying: false,
    userInteracted: false
};

// Initialize audio
function initAudio() {
    if (!audioSystem.userInteracted) {
        audioSystem.userInteracted = true;

        // Try to play audio after first user interaction
        const playAudio = () => {
            if (!audioSystem.isPlaying) {
                audioSystem.music.volume = audioSystem.musicVolume.value / 100;
                audioSystem.wind.volume = audioSystem.windVolume.value / 100;

                Promise.all([
                    audioSystem.music.play().catch(e => console.log('Music playback failed:', e)),
                    audioSystem.wind.play().catch(e => console.log('Wind playback failed:', e))
                ]).then(() => {
                    audioSystem.isPlaying = true;
                    audioSystem.toggle.classList.remove('muted');
                }).catch(err => {
                    console.log('Audio autoplay blocked. Click the audio button to enable.');
                });
            }
        };

        // Try to play on first interaction
        playAudio();
    }
}

// Toggle audio on/off
audioSystem.toggle.addEventListener('click', (e) => {
    e.stopPropagation();

    if (!audioSystem.userInteracted) {
        audioSystem.userInteracted = true;
    }

    if (audioSystem.isPlaying) {
        audioSystem.music.pause();
        audioSystem.wind.pause();
        audioSystem.isPlaying = false;
        audioSystem.toggle.classList.add('muted');
    } else {
        audioSystem.music.volume = audioSystem.musicVolume.value / 100;
        audioSystem.wind.volume = audioSystem.windVolume.value / 100;

        audioSystem.music.play().catch(e => console.log('Music play error:', e));
        audioSystem.wind.play().catch(e => console.log('Wind play error:', e));
        audioSystem.isPlaying = true;
        audioSystem.toggle.classList.remove('muted');
    }
});

// Music volume control
audioSystem.musicVolume.addEventListener('input', (e) => {
    const volume = e.target.value / 100;
    audioSystem.music.volume = volume;
});

// Wind volume control with dynamic intensity
audioSystem.windVolume.addEventListener('input', (e) => {
    updateWindVolume();
});

function updateWindVolume() {
    const baseVolume = audioSystem.windVolume.value / 100;
    // Increase wind volume when wind is active
    const windIntensity = windState.strength;
    const finalVolume = baseVolume * (0.5 + windIntensity * 0.5);
    audioSystem.wind.volume = Math.min(1.0, finalVolume);
}

// Initialize audio on first user interaction
document.addEventListener('click', initAudio, { once: true });
document.addEventListener('keydown', initAudio, { once: true });
document.addEventListener('touchstart', initAudio, { once: true });

// Start animation
animate();
