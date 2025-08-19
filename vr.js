console.log('MemoReal Multiplayer VR page loaded');

// Multiplayer variables
let isMultiplayerConnected = false;
let playersInRoom = 0;

// Global variables for particle system (same as particles.html)
let originalGeometry = null;
let pointCloud = null;
let pointCloudMaterial = null;
let clock = new THREE.Clock();
let isAnimatingAppearance = false;
let appearanceAnimationStartTime = 0;

// Parameters (same as particles.html)
const params = {
    pointSize: 0.02,
    subsampleRate: 1,
    evaporationAmount: 0.01,
    evaporationSpeed: 0.04,
    maxHeight: 1.0,
    evaporationEnabled: true,
    appearanceAnimationDuration: 3.0,
    appearanceAnimationScale: 1.0,
    appearanceDelay: 2.0
};

// Custom shader for point cloud (EXACT same as particles.html)
const vertexShader = `
uniform float pointSize;
uniform float time;
uniform float evaporationSpeed;
uniform float evaporationEnabled;
uniform float maxHeight;
uniform float appearanceProgress;
uniform float appearanceScale;
uniform float globalOpacity;

attribute float evaporationFactor;
attribute float randomDelay;

varying vec3 vColor;
varying float vOpacity;

float easeOutCubic(float t) {
    return 1.0 - pow(1.0 - t, 3.0);
}

float easeOutBack(float t) {
    float c1 = 1.70158;
    float c3 = c1 + 1.0;
    return 1.0 + c3 * pow(t - 1.0, 3.0) + c1 * pow(t - 1.0, 2.0);
}

float hash(float n) {
    return fract(sin(n) * 43758.5453123);
}

void main() {
    vColor = color.rgb;
    vOpacity = globalOpacity;

    vec3 pos = position;
    float sizeCoef = 1.0;

    if (appearanceProgress < 1.0) {
        float randomSpeed = hash(randomDelay * 123.456) * 0.6 + 0.7;
        float randomPath = hash(randomDelay * 789.123);
        float randomEase = hash(randomDelay * 345.678);
        
        float heightFactor = clamp((position.y + 1.0) / 2.0, 0.0, 1.0);
        float delayFactor = heightFactor * 0.5 + randomDelay * 0.5;
        
        float pointAppearanceThreshold = appearanceProgress * (1.5 + randomSpeed * 0.5);
        float pointProgress = (pointAppearanceThreshold - delayFactor) / (0.8 + randomSpeed * 0.3);
        pointProgress = clamp(pointProgress, 0.0, 1.0);
        
        if (pointProgress > 0.01 && pointProgress < 0.99) {
            if (randomEase < 0.6) {
                pointProgress = easeOutCubic(pointProgress);
            } else {
                pointProgress = easeOutBack(pointProgress);
            }
        }
        
        vOpacity = 0.0;
        
        if (pointProgress > 0.0) {
            vOpacity = globalOpacity * pointProgress;
            
            float xOffset = (randomPath - 0.5) * 0.4;
            float yOffset = -0.5 - randomDelay * 0.5;
            float zOffset = appearanceScale * (0.8 + randomPath * 0.4);
            zOffset += heightFactor * (0.5 + randomPath * 0.3);
            
            float angle = randomPath * 6.28;
            float spiral = 0.15 * randomPath * (1.0 - pointProgress);
            xOffset += cos(angle) * spiral;
            zOffset += sin(angle) * spiral;
            
            vec3 startOffset = vec3(xOffset, yOffset, zOffset);
            float pathBias = pow(pointProgress, 0.7 + randomPath * 0.6);
            pos = mix(position + startOffset, position, pathBias);
            
            if (randomEase > 0.7) {
                float sizeProgress = min(pointProgress * 1.2, 1.0);
                float overshoot = 1.0 + 0.3 * (1.0 - abs(2.0 * sizeProgress - 1.8));
                sizeCoef = mix(0.3, overshoot, sizeProgress);
            } else {
                sizeCoef = mix(0.3, 1.0, pointProgress);
            }
        }
    }

    if (evaporationEnabled > 0.5 && evaporationFactor > 0.01) {
        sizeCoef = 1.5;
        float cycle = fract(time * evaporationFactor * evaporationSpeed);
        pos.y += cycle * maxHeight;
        vOpacity = globalOpacity * (1.0 - cycle);
    }

    vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
    gl_PointSize = pointSize * sizeCoef * (1000.0 / -mvPosition.z);
    gl_Position = projectionMatrix * mvPosition;
}
`;

const fragmentShader = `
varying vec3 vColor;
varying float vOpacity;

void main() {
    float r = length(gl_PointCoord - vec2(0.5, 0.5));
    if (r > 0.5) discard;
    gl_FragColor = vec4(vColor, vOpacity);
}
`;

// VR Controls
document.getElementById('enterVRBtn').addEventListener('click', function() {
    const scene = document.querySelector('a-scene');
    if (scene && scene.enterVR) {
        scene.enterVR();
    }
});

// Multiplayer Event Handlers
function setupMultiplayerEvents() {
    console.log('=== SETTING UP MULTIPLAYER EVENTS ===');
    
    const scene = document.querySelector('a-scene');
    
    // Networked-A-Frame events
    scene.addEventListener('connected', function (evt) {
        console.log('Connected to multiplayer server');
        console.log('Connected to room:', evt.detail.room);
        isMultiplayerConnected = true;
        updatePlayerCount();
        updateMultiplayerUI();
    });

    scene.addEventListener('disconnected', function (evt) {
        console.log('Disconnected from multiplayer server');
        console.log('Disconnected from room:', evt.detail.room);
        isMultiplayerConnected = false;
        playersInRoom = 0;
        updateMultiplayerUI();
    });

    // Check connection status periodically
    setInterval(() => {
        if (typeof NAF !== 'undefined' && NAF.connection) {
            if (NAF.connection.isConnected && NAF.connection.isConnected()) {
                if (!isMultiplayerConnected) {
                    console.log('NAF connection detected');
                    isMultiplayerConnected = true;
                    updatePlayerCount();
                    updateMultiplayerUI();
                }
            } else if (isMultiplayerConnected) {
                console.log('NAF connection lost');
                isMultiplayerConnected = false;
                playersInRoom = 0;
                updateMultiplayerUI();
            }
        }
    }, 1000); // Check every second

    scene.addEventListener('clientConnected', function (evt) {
        console.log('Player joined:', evt.detail.clientId);
        updatePlayerCount();
    });

    scene.addEventListener('clientDisconnected', function (evt) {
        console.log('Player left:', evt.detail.clientId);
        updatePlayerCount();
    });

    scene.addEventListener('entityCreated', function (evt) {
        console.log('Entity created:', evt.detail.el.id);
        
        // Check if this is an avatar entity and assign unique color
        const entity = evt.detail.el;
        const avatarHead = entity.querySelector('.head[dynamic-avatar-color]');
        if (avatarHead) {
            // Trigger color assignment for new avatar
            setTimeout(() => {
                const colorComponent = avatarHead.components['dynamic-avatar-color'];
                if (colorComponent) {
                    const networkedEl = entity.closest('[networked]');
                    if (networkedEl && networkedEl.components.networked) {
                        const clientId = networkedEl.components.networked.data.owner;
                        colorComponent.assignColor(clientId);
                        console.log('Applied color to new player avatar:', clientId);
                    }
                }
            }, 100); // Small delay to ensure networking is ready
        }
    });

    scene.addEventListener('entityRemoved', function (evt) {
        console.log('Entity removed:', evt.detail.networkId);
        
        // Clean up color assignment if this was an avatar
        const clientId = evt.detail.networkId;
        if (typeof colorAssignments !== 'undefined' && colorAssignments.has(clientId)) {
            const removedColor = colorAssignments.get(clientId);
            colorAssignments.delete(clientId);
            console.log('Released color', removedColor, 'from player', clientId);
        }
    });
}

function updatePlayerCount() {
    console.log('Updating player count...');
    
    if (typeof NAF !== 'undefined' && NAF.connection) {
        try {
            if (NAF.connection.isConnected && NAF.connection.isConnected()) {
                const clients = NAF.connection.getConnectedClients();
                playersInRoom = clients.length + 1; // +1 for current player
                console.log('Players in room:', playersInRoom, '(clients:', clients.length + ')');
            } else {
                playersInRoom = 1; // Just the current player
                console.log('Only current player (not connected to multiplayer)');
            }
        } catch (error) {
            console.warn('Error getting connected clients:', error);
            playersInRoom = 1;
        }
    } else {
        playersInRoom = 1; // Default to 1 player if NAF not ready
        console.log('NAF not ready, defaulting to 1 player');
    }
    
    // Update UI
    updateMultiplayerUI();
    
    // Update status if available
    if (typeof updateStatus !== 'undefined') {
        updateStatus(playersInRoom + ' player' + (playersInRoom > 1 ? 's' : '') + ' in VR room', 'info');
    }
}

function updateMultiplayerUI() {
    console.log('Updating UI - Connected:', isMultiplayerConnected);
    
    const connectionStatus = document.getElementById('connectionStatus');
    
    if (connectionStatus) {
        if (isMultiplayerConnected) {
            connectionStatus.textContent = 'Connected';
            connectionStatus.className = 'connected';
        } else {
            connectionStatus.textContent = 'Connecting...';
            connectionStatus.className = 'connecting';
        }
        console.log('Connection status updated:', connectionStatus.textContent);
    } else {
        console.warn('connectionStatus element not found');
    }
}

// Share particle system across all players
function syncParticleSystem(modelUrl) {
    console.log('=== SYNCING PARTICLE MODEL ACROSS PLAYERS ===');
    console.log('Broadcasting model URL to all players:', modelUrl);
    
    // Use NAF to broadcast the model URL to all connected clients
    if (isMultiplayerConnected && typeof NAF !== 'undefined') {
        // Create a custom event to sync the model across all clients
        const scene = document.querySelector('a-scene');
        const event = new CustomEvent('syncModel', {
            detail: { modelUrl: modelUrl }
        });
        
        // Broadcast to all clients
        NAF.utils.getNetworkedEntities().forEach(entity => {
            entity.dispatchEvent(event);
        });
        
        console.log('Model sync broadcasted to all players');
    }
}

// Function to trigger appearance animation (EXACT same as particles.html)
function triggerAppearanceAnimation(delaySeconds = 0) {
    if (pointCloudMaterial) {
        pointCloudMaterial.uniforms.appearanceProgress.value = 0.0;
        console.log(`Appearance animation scheduled with ${delaySeconds}s delay`);

        if (delaySeconds > 0) {
            pointCloudMaterial.uniforms.globalOpacity.value = 0.0;
        }

        // Simple timeout-based animation (no TWEEN dependency)
        setTimeout(() => {
            isAnimatingAppearance = true;
            appearanceAnimationStartTime = clock.getElapsedTime();
            pointCloudMaterial.uniforms.globalOpacity.value = 1.0;
            console.log("Appearance animation started");
        }, delaySeconds * 1000);
    }
}

// Function to subsample point cloud (EXACT same as particles.html)
function updatePointCloudSampling(rate) {
    if (!originalGeometry) return;

    // Remove old point cloud
    if (pointCloud) {
        const threeScene = document.querySelector('a-scene').object3D;
        threeScene.remove(pointCloud);
    }

    const newGeometry = new THREE.BufferGeometry();
    const originalPositions = originalGeometry.attributes.position;
    const originalColors = originalGeometry.attributes.color;

    const originalCount = originalPositions.count;
    const targetCount = Math.max(1, Math.floor(originalCount * rate));

    const newPositions = new Float32Array(targetCount * 3);
    const newColors = new Float32Array(targetCount * 3);
    const evaporationFactors = new Float32Array(targetCount);
    const randomDelays = new Float32Array(targetCount);

    const stride = originalCount / targetCount;
    const evaporationCount = Math.floor(targetCount * params.evaporationAmount);
    console.log(`Setting ${evaporationCount} points to evaporate out of ${targetCount} total`);

    const evaporatingIndices = new Set();
    while (evaporatingIndices.size < evaporationCount) {
        evaporatingIndices.add(Math.floor(Math.random() * targetCount));
    }

    for (let i = 0; i < targetCount; i++) {
        const sourceIndex = Math.min(originalCount - 1, Math.floor(i * stride));

        // Copy position
        newPositions[i * 3] = originalPositions.getX(sourceIndex);
        newPositions[i * 3 + 1] = originalPositions.getY(sourceIndex);
        newPositions[i * 3 + 2] = originalPositions.getZ(sourceIndex);

        // Copy color
        if (originalColors) {
            newColors[i * 3] = originalColors.getX(sourceIndex);
            newColors[i * 3 + 1] = originalColors.getY(sourceIndex);
            newColors[i * 3 + 2] = originalColors.getZ(sourceIndex);
        } else {
            newColors[i * 3] = 1.0;
            newColors[i * 3 + 1] = 1.0;
            newColors[i * 3 + 2] = 1.0;
        }

        // Set evaporation factor
        if (evaporatingIndices.has(i)) {
            evaporationFactors[i] = 0.2 + Math.random() * 0.8;
        } else {
            evaporationFactors[i] = 0.0;
        }

        randomDelays[i] = Math.random();
    }

    newGeometry.setAttribute('position', new THREE.BufferAttribute(newPositions, 3));
    newGeometry.setAttribute('color', new THREE.BufferAttribute(newColors, 3));
    newGeometry.setAttribute('evaporationFactor', new THREE.BufferAttribute(evaporationFactors, 1));
    newGeometry.setAttribute('randomDelay', new THREE.BufferAttribute(randomDelays, 1));

    // Create shader material
    pointCloudMaterial = new THREE.ShaderMaterial({
        uniforms: {
            pointSize: { value: params.pointSize },
            time: { value: 0.0 },
            evaporationSpeed: { value: params.evaporationSpeed },
            maxHeight: { value: params.maxHeight },
            evaporationEnabled: { value: params.evaporationEnabled ? 1.0 : 0.0 },
            appearanceProgress: { value: 1.0 },
            appearanceScale: { value: params.appearanceAnimationScale },
            globalOpacity: { value: 1.0 }
        },
        vertexShader: vertexShader,
        fragmentShader: fragmentShader,
        transparent: true,
        vertexColors: true
    });

    // Create point cloud
    pointCloud = new THREE.Points(newGeometry, pointCloudMaterial);
    
    // Apply different settings based on content type
    const urlParams = new URLSearchParams(window.location.search);
    const contentType = urlParams.get('type');
    
    if (contentType === '360') {
        // 360° content settings
        pointCloud.position.set(0, 7, 2); // Different position for 360
        pointCloud.scale.set(3, 3, 3); // Same scale as room model
        pointCloud.rotation.set(Math.PI/2, Math.PI*2, Math.PI/2); // 90° rotation for 360 generation
        console.log('Applied 360° settings: position(0,7,2), rotation(90°,360°,90°)');
    } else {
        // 3D content settings (no rotation)
        pointCloud.position.set(0, 3.05, 2); // Same position as room model
        pointCloud.scale.set(3, 3, 3); // Same scale as room model
        pointCloud.rotation.set(0, Math.PI, 0); // 180° Y rotation for 3D content
        console.log('Applied 3D settings: position(0,3.05,2), rotation(0°,180°,0°)');
    }

    // Add to A-Frame scene
    const threeScene = document.querySelector('a-scene').object3D;
    threeScene.add(pointCloud);

    console.log(`Created point cloud with ${targetCount} points`);
    
    // Trigger appearance animation
    triggerAppearanceAnimation(params.appearanceDelay);
}

// Function to load GLB model (EXACT same as particles.html)
function loadGlbModel(glbUrl) {
    console.log('=== GLB MODEL LOADING ===');
    console.log(`Starting GLB load: ${glbUrl}`);
    
    // Remove existing point cloud
    if (pointCloud) {
        const threeScene = document.querySelector('a-scene').object3D;
        threeScene.remove(pointCloud);
        pointCloud = null;
        console.log('Removed existing point cloud');
    }

    originalGeometry = null;
    const loader = new THREE.GLTFLoader();

    // Configure loader for remote URLs
    if (glbUrl.startsWith('http')) {
        console.log('=== REMOTE GLB LOADING ===');
        console.log('Loading remote GLB model from:', glbUrl);
        console.log('Setting CORS origin to anonymous');
        // Add credentials for S3 if needed
        loader.setCrossOrigin('anonymous');
    } else {
        console.log('=== LOCAL GLB LOADING ===');
        console.log('Loading local GLB model from:', glbUrl);
    }

    console.log('=== STARTING GLB DOWNLOAD ===');
    loader.load(
        glbUrl,
        function (gltf) {
            console.log('=== GLB LOAD SUCCESS ===');
            console.log('GLTF object received:', gltf);
            console.log('GLTF scene:', gltf.scene);
            console.log('GLTF animations:', gltf.animations);
            console.log('GLTF cameras:', gltf.cameras);
            console.log('GLTF asset info:', gltf.asset);
            
            const model = gltf.scene;
            let foundPointCloud = false;
            let childrenCount = 0;

            model.traverse((child) => {
                childrenCount++;
                console.log(`Child ${childrenCount}:`, {
                    name: child.name,
                    type: child.type,
                    isPoints: child.isPoints,
                    isMesh: child.isMesh,
                    geometry: child.geometry ? 'Present' : 'None',
                    material: child.material ? 'Present' : 'None'
                });
                
                if (child.isPoints || child.isMesh) {
                    foundPointCloud = true;
                    console.log(`=== GEOMETRY FOUND ===`);
                    console.log(`Found geometry in child: ${child.name || 'unnamed'}`);
                    console.log('Geometry type:', child.geometry.type);
                    console.log('Geometry attributes:', Object.keys(child.geometry.attributes));

                    const geometry = child.geometry;
                    originalGeometry = geometry.clone();

                    // Handle color attributes
                    if (geometry.attributes.color) {
                        console.log("Color attribute found");
                        console.log('Color attribute count:', geometry.attributes.color.count);
                    } else if (geometry.attributes.COLOR_0) {
                        console.log("COLOR_0 attribute found, mapping to color");
                        console.log('COLOR_0 attribute count:', geometry.attributes.COLOR_0.count);
                        geometry.setAttribute("color", geometry.attributes.COLOR_0);
                        originalGeometry.setAttribute("color", geometry.attributes.COLOR_0.clone());
                    } else {
                        console.log("No color attribute found, creating default colors");
                        const count = geometry.attributes.position.count;
                        console.log('Creating default colors for', count, 'points');
                        const colors = new Float32Array(count * 3);
                        for (let i = 0; i < count * 3; i++) {
                            colors[i] = 1.0;
                        }
                        geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
                        originalGeometry.setAttribute("color", new THREE.BufferAttribute(colors.slice(), 3));
                    }

                    // Create subsampled point cloud with evaporation effect
                    console.log('=== CREATING PARTICLE SYSTEM ===');
                    updatePointCloudSampling(params.subsampleRate);
                    console.log(`Successfully loaded and processed: ${glbUrl}`);
                }
            });

            console.log(`=== TRAVERSAL COMPLETE ===`);
            console.log(`Total children found: ${childrenCount}`);
            console.log(`Geometry found: ${foundPointCloud}`);

            if (!foundPointCloud) {
                console.warn(`No geometry found in ${glbUrl}!`);
                console.log(`No renderable geometry in ${glbUrl}`);
            }
        },
        function (xhr) {
            if (xhr.lengthComputable) {
                const percentComplete = Math.round((xhr.loaded / xhr.total) * 100);
                console.log(`Download progress: ${percentComplete}% (${xhr.loaded}/${xhr.total} bytes)`);
            } else {
                console.log(`Download progress: ${xhr.loaded} bytes loaded`);
            }
        },
        function (error) {
            console.error('=== GLB LOAD ERROR ===');
            console.error(`Error loading ${glbUrl}:`, error);
            console.error('Error type:', error.constructor.name);
            console.error('Error message:', error.message);
            console.error('Error details:', error);
            
            // Check if it's a CORS error
            if (error.message && error.message.includes('CORS')) {
                console.error('This appears to be a CORS error');
                console.error('The server needs to allow cross-origin requests');
            }
            
            // Check if it's a network error
            if (error.message && (error.message.includes('fetch') || error.message.includes('network'))) {
                console.error('This appears to be a network connectivity error');
                console.error('Check if the server is accessible and the URL is correct');
            }
            
            // Don't fallback to any model - just show error
            console.log('Failed to load dynamic model. No fallback will be loaded.');
            
            // Show error message to user
            console.log('Model loading failed - please try uploading a different image');
        }
    );
}

// Animation loop (same as particles.html)
function animateParticles() {
    if (pointCloudMaterial) {
        pointCloudMaterial.uniforms.time.value = clock.getElapsedTime();

        // Update appearance animation
        if (isAnimatingAppearance) {
            const elapsed = clock.getElapsedTime() - appearanceAnimationStartTime;
            const progress = Math.min(elapsed / params.appearanceAnimationDuration, 1.0);
            pointCloudMaterial.uniforms.appearanceProgress.value = progress;

            if (progress >= 1.0) {
                isAnimatingAppearance = false;
                console.log("Appearance animation completed");
            }
        }

        pointCloudMaterial.uniforms.appearanceScale.value = params.appearanceAnimationScale;
    }
    
    requestAnimationFrame(animateParticles);
}

// Initialize when DOM loads
document.addEventListener('DOMContentLoaded', function() {
    console.log('=== MEMOREAL MULTIPLAYER VR INITIALIZATION ===');
    console.log('DOM loaded, setting up multiplayer VR scene with particles');
    
    // Initial UI setup
    playersInRoom = 1; // Start with 1 (current player)
    isMultiplayerConnected = false;
    updateMultiplayerUI();
    
    const aframeScene = document.querySelector('a-scene');
    
    // Setup multiplayer events first
    setupMultiplayerEvents();
    
    // Force an initial UI update after a short delay to ensure DOM is ready
    setTimeout(() => {
        console.log('Forcing initial UI update...');
        updateMultiplayerUI();
    }, 500);
    
    // Wait for A-Frame scene to load
    if (aframeScene.hasLoaded) {
        initParticleSystem();
    } else {
        aframeScene.addEventListener('loaded', function() {
            initParticleSystem();
        });
    }
    
    // Also listen for NAF adapter ready events
    aframeScene.addEventListener('adapter-ready', function(evt) {
        console.log('NAF adapter ready:', evt.detail);
        isMultiplayerConnected = true;
        updatePlayerCount();
        updateMultiplayerUI();
    });
    
    // Listen for room events
    aframeScene.addEventListener('room-joined', function(evt) {
        console.log('Joined room:', evt.detail);
        updatePlayerCount();
    });
    
    // Listen for model sync events from other players
    aframeScene.addEventListener('syncModel', function(evt) {
        console.log('Received model sync from another player:', evt.detail.modelUrl);
        loadGlbModel(evt.detail.modelUrl);
    });
    
    function initParticleSystem() {
        console.log('=== VR SCENE INITIALIZATION ===');
        console.log('A-Frame scene loaded, loading GLB model...');
        
        // Start animation loop
        animateParticles();
        
        // Get model URL and type from URL parameters - REQUIRED
        const urlParams = new URLSearchParams(window.location.search);
        const modelUrl = urlParams.get('model');
        const contentType = urlParams.get('type'); // '3d' or '360'
        
        console.log('=== URL ANALYSIS ===');
        console.log('Current URL:', window.location.href);
        console.log('URL Search params:', window.location.search);
        console.log('URL Parameters object:', urlParams);
        console.log('All URL parameters:');
        for (let [key, value] of urlParams.entries()) {
            console.log(`- ${key}: ${value}`);
        }
        console.log('Model URL from parameter (raw):', urlParams.get('model'));
        console.log('Content Type from parameter:', contentType);
        console.log('Final model URL to load:', modelUrl);
        
        if (!modelUrl) {
            console.warn('No model URL provided. Please upload an image first.');
            console.log('Expected usage: vr?model=<model_url>');
            return;
        }
        
        console.log('Model URL type:', modelUrl.startsWith('http') ? 'Remote URL' : 'Local URL');
        
        if (modelUrl.startsWith('http')) {
            console.log('=== REMOTE MODEL ANALYSIS ===');
            try {
                const url = new URL(modelUrl);
                console.log('- Protocol:', url.protocol);
                console.log('- Host:', url.host);
                console.log('- Pathname:', url.pathname);
                console.log('- Origin:', url.origin);
            } catch (e) {
                console.error('Invalid URL format:', e);
                return;
            }
        }
        
        // Load the model using particles.html method
        loadGlbModel(modelUrl);
        
        // Sync this model with other players in multiplayer
        syncParticleSystem(modelUrl);
        
        // Particles ARE the model - no need to show original GLB model
        console.log('=== PARTICLE SYSTEM STATUS ===');
        console.log('Particles will represent the model geometry');
        console.log('Multiplayer status:', isMultiplayerConnected ? 'Connected' : 'Connecting...');
    }
});