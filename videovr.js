console.log('MemoReal Video Hologram VR page loaded');

// Multiplayer variables
let isMultiplayerConnected = false;
let playersInRoom = 0;

// Global variables for video hologram system
let video = null;
let videoTexture = null;
let videoParticles = null;
let videoMaterial = null;
let clock = new THREE.Clock();

// Video hologram parameters (from Video_viewer.html)
const videoParams = {
    particleSize: 2400.0, 
    focalLengthX: 1100.0,
    focalLengthY: 1100.0,
    minZ: -1000.0,
    maxZ: -120.0,
    reverseDepthMap: false,
    farOffAmount: 0
};

// Video hologram shaders (from Video_viewer.html)
const videoVertexShader = `
uniform sampler2D u_videoTexture;
uniform float u_size;
uniform float u_focalLengthX;
uniform float u_focalLengthY;
uniform float u_minZ;
uniform float u_maxZ;
uniform vec2 u_resolution;
uniform vec2 u_depthMapResolution;
uniform float u_reverseDepth;

attribute float a_random;
varying vec2 vOriginalUv;
varying float vDepth;

void main() {
    vec2 gridUv = position.xy;
    vOriginalUv = gridUv;
    vec2 depthTextureUv = vec2(gridUv.x, gridUv.y * 0.5);
    vec2 depthTexelSize = 1. / u_depthMapResolution;
    vec2 pixelCoord = depthTextureUv * u_depthMapResolution;
    vec2 fractCoord = fract(pixelCoord);
    vec2 basePixel = floor(pixelCoord);
    vec2 uv00 = (basePixel + vec2(0.5, 0.5)) * depthTexelSize;
    vec2 uv10 = (basePixel + vec2(1.5, 0.5)) * depthTexelSize;
    vec2 uv01 = (basePixel + vec2(0.5, 1.5)) * depthTexelSize;
    vec2 uv11 = (basePixel + vec2(1.5, 1.5)) * depthTexelSize;
    float d00 = texture2D(u_videoTexture, uv00).r;
    float d10 = texture2D(u_videoTexture, uv10).r;
    float d01 = texture2D(u_videoTexture, uv01).r;
    float d11 = texture2D(u_videoTexture, uv11).r;
    float interp0 = mix(d00, d10, fractCoord.x);
    float interp1 = mix(d01, d11, fractCoord.y);
    float depth = mix(interp0, interp1, fractCoord.y);
    depth = clamp(depth, 0.0, 1.0);
    vDepth = depth;
    if (u_reverseDepth > 0.5) {
        depth = 1.0 - depth;
    }
    float x_pixel = (1.0 - gridUv.x) * u_resolution.x - u_resolution.x / 2.0;
    float y_pixel = (1.0 - gridUv.y) * u_resolution.y - u_resolution.y / 2.0;
    float z_world = mix(u_minZ, u_maxZ, depth);
    vec3 particlePosition;
    particlePosition.x = (x_pixel * z_world) / u_focalLengthX;
    particlePosition.y = (y_pixel * z_world) / u_focalLengthY;
    particlePosition.z = z_world;
    vec4 modelViewPosition = modelViewMatrix * vec4(particlePosition, 1.0);
    gl_Position = projectionMatrix * modelViewPosition;
    float objectScale = length(vec3(modelViewMatrix[0]));
    gl_PointSize = max(1.0, u_size * objectScale / max(1.0, -modelViewPosition.z));
}
`;

const videoFragmentShader = `
uniform sampler2D u_videoTexture;
varying vec2 vOriginalUv;
varying float vDepth;
uniform float u_farOffAmount;

void main() {
    if(vOriginalUv.y > 0.994) discard;
    if (length(gl_PointCoord - vec2(0.5, 0.5)) > 0.5) {
        discard;
    }
    vec2 colorUv = vec2(vOriginalUv.x, vOriginalUv.y * 0.5 + 0.5);
    vec4 color = texture2D(u_videoTexture, colorUv);

    if (color.a < 0.1) discard;

    float farFadeOpacity = 0.0;
    if (u_farOffAmount > 0.001) {
        farFadeOpacity = smoothstep(0.0, u_farOffAmount, vDepth);
    } else {
        farFadeOpacity = 1.0;
    }

    gl_FragColor = vec4(color.rgb, color.a * farFadeOpacity);
}
`;

// VR Controls
document.getElementById('enterVRBtn').addEventListener('click', function() {
    const scene = document.querySelector('a-scene');
    if (scene && scene.enterVR) {
        scene.enterVR();
    }
});

// Multiplayer Event Handlers (same as vr.js)
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

// Get video URL from parameters
function getVideoUrlFromParams() {
    const urlParams = new URLSearchParams(window.location.search);
    const videoParam = urlParams.get('video');
    if (videoParam) {
        return decodeURIComponent(videoParam);
    }
    return null;
}

// Initialize video hologram
function initVideoHologram(videoUrl) {
    console.log('=== VIDEO HOLOGRAM INITIALIZATION ===');
    console.log('Initializing video hologram with URL:', videoUrl);
    
    // Setup video element
    video = document.getElementById('video');
    video.src = videoUrl;
    video.loop = true;
    video.muted = true; // Start muted for autoplay
    video.crossOrigin = 'anonymous';
    video.playsInline = true;
    
    video.load();
    video.play().catch(e => console.error('Video autoplay failed:', e));
    
    // Create video texture
    videoTexture = new THREE.VideoTexture(video);
    videoTexture.minFilter = THREE.NearestFilter;
    videoTexture.magFilter = THREE.NearestFilter;
    videoTexture.format = THREE.RGBAFormat;
    
        // Create particle geometry for video
        createVideoParticleGeometry(2048, 1024);    console.log('Video hologram system initialized');
}

// Create video particle geometry
function createVideoParticleGeometry(width, height) {
    const NUM_PARTICLES = width * height;
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(NUM_PARTICLES * 3);
    const randoms = new Float32Array(NUM_PARTICLES);

    let pIdx = 0;
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            positions[pIdx * 3 + 0] = x / (width - 1);
            positions[pIdx * 3 + 1] = y / (height - 1);
            positions[pIdx * 3 + 2] = 0;
            
            randoms[pIdx] = Math.random();
            pIdx++;
        }
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('a_random', new THREE.BufferAttribute(randoms, 1));

    // Create video particle material
    videoMaterial = new THREE.ShaderMaterial({
        uniforms: {
            u_videoTexture: { value: videoTexture },
            u_size: { value: videoParams.particleSize },
            u_focalLengthX: { value: videoParams.focalLengthX },
            u_focalLengthY: { value: videoParams.focalLengthY },
            u_minZ: { value: videoParams.minZ },
            u_maxZ: { value: videoParams.maxZ },
            u_resolution: { value: new THREE.Vector2(width, height) },
            u_depthMapResolution: { value: new THREE.Vector2(width, height / 2) },
            u_reverseDepth: { value: videoParams.reverseDepthMap ? 1.0 : 0.0 },
            u_farOffAmount: { value: videoParams.farOffAmount }
        },
        vertexShader: videoVertexShader,
        fragmentShader: videoFragmentShader,
        transparent: true
    });

    // Create video particles
    videoParticles = new THREE.Points(geometry, videoMaterial);
    
    // Use WebXR parameters for VR (same as Video_viewer.html)
    videoParticles.position.set(0, 1.4, 0.5); // VR position
    videoParticles.scale.set(0.009, 0.009, 0.009); // VR scale
    
    // Update material size for VR
    videoMaterial.uniforms.u_size.value = 2400.0; // VR particle size

    // Add to A-Frame scene
    const threeScene = document.querySelector('a-scene').object3D;
    threeScene.add(videoParticles);

    console.log('Video particle system created with', NUM_PARTICLES, 'particles');
}

// Animation loop
function animateVideoHologram() {
    // Video texture will update automatically
    requestAnimationFrame(animateVideoHologram);
}

// Initialize when DOM loads
document.addEventListener('DOMContentLoaded', function() {
    console.log('=== MEMOREAL VIDEO HOLOGRAM VR INITIALIZATION ===');
    console.log('DOM loaded, setting up multiplayer VR scene with video hologram');
    
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
        initVideoSystem();
    } else {
        aframeScene.addEventListener('loaded', function() {
            initVideoSystem();
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
    
    function initVideoSystem() {
        console.log('=== VIDEO VR SCENE INITIALIZATION ===');
        console.log('A-Frame scene loaded, initializing video hologram system...');
        
        // Start animation loop
        animateVideoHologram();
        
        // Get video URL from URL parameters
        const urlParams = new URLSearchParams(window.location.search);
        const videoUrl = urlParams.get('video');
        
        console.log('=== URL ANALYSIS ===');
        console.log('Current URL:', window.location.href);
        console.log('URL Search params:', window.location.search);
        console.log('Video URL from parameter (raw):', urlParams.get('video'));
        console.log('Final video URL to load:', videoUrl);
        
        if (!videoUrl) {
            console.warn('No video URL provided. Please upload a video first.');
            console.log('Expected usage: videovr?video=<video_url>');
            return;
        }
        
        console.log('Video URL type:', videoUrl.startsWith('http') ? 'Remote URL' : 'Local URL');
        
        // Initialize video hologram
        initVideoHologram(decodeURIComponent(videoUrl));
        
        console.log('=== VIDEO HOLOGRAM STATUS ===');
        console.log('Video hologram represents the uploaded video');
        console.log('Multiplayer status:', isMultiplayerConnected ? 'Connected' : 'Connecting...');
    }
});
