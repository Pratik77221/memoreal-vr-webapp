document.addEventListener('DOMContentLoaded', function() {
    const generate3dBtn = document.getElementById('generate3dBtn');
    const generate360Btn = document.getElementById('generate360Btn');
    const generateVideoBtn = document.getElementById('generateVideoBtn');
    const vrBtn = document.getElementById('vrBtn');
    const statusDiv = document.getElementById('status');
    const fileInput3d = document.getElementById('image3d');
    const fileInput360 = document.getElementById('image360');
    const fileInputVideo = document.getElementById('videoFile');
    const fileLabel3d = document.getElementById('file-label-3d');
    const fileLabel360 = document.getElementById('file-label-360');
    const fileInputVideoLabel = document.getElementById('file-label-video');
        let modelUrl = null;
    let currentContentType = null; // Track if it's '3d' or '360' content

    // File input handling for 3D images
    fileInput3d.addEventListener('change', function() {
        if (this.files && this.files[0]) {
            fileLabel3d.textContent = this.files[0].name;
            fileLabel3d.classList.add('has-file');
            generate3dBtn.disabled = false;
        } else {
            fileLabel3d.textContent = 'Choose 3D image';
            fileLabel3d.classList.remove('has-file');
            generate3dBtn.disabled = true;
        }
    });

    // File input handling for 360° images
    fileInput360.addEventListener('change', function() {
        if (this.files && this.files[0]) {
            fileLabel360.textContent = this.files[0].name;
            fileLabel360.classList.add('has-file');
            generate360Btn.disabled = false;
        } else {
            fileLabel360.textContent = 'Choose 360° image';
            fileLabel360.classList.remove('has-file');
            generate360Btn.disabled = true;
        }
    });

    // File input handling for video files
    fileInputVideo.addEventListener('change', function() {
        if (this.files && this.files[0]) {
            fileInputVideoLabel.textContent = this.files[0].name;
            fileInputVideoLabel.classList.add('has-file');
            generateVideoBtn.disabled = false;
        } else {
            fileInputVideoLabel.textContent = 'Choose video file';
            fileInputVideoLabel.classList.remove('has-file');
            generateVideoBtn.disabled = true;
        }
    });

    // Drag and drop handling for 3D images
    setupDragAndDrop(fileLabel3d, fileInput3d, 'Choose 3D image');
    
    // Drag and drop handling for 360° images
    setupDragAndDrop(fileLabel360, fileInput360, 'Choose 360° image');
    
    // Drag and drop handling for video files
    setupDragAndDrop(fileInputVideoLabel, fileInputVideo, 'Choose video file');

    function setupDragAndDrop(label, input, defaultText) {
        label.addEventListener('dragover', function(e) {
            e.preventDefault();
            this.style.borderColor = '#3b82f6';
            this.style.background = '#f8fafc';
        });

        label.addEventListener('dragleave', function(e) {
            e.preventDefault();
            this.style.borderColor = '#d1d5db';
            this.style.background = '#f8fafc';
        });

        label.addEventListener('drop', function(e) {
            e.preventDefault();
            this.style.borderColor = '#d1d5db';
            this.style.background = '#f8fafc';
            
            if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                input.files = e.dataTransfer.files;
                label.textContent = e.dataTransfer.files[0].name;
                label.classList.add('has-file');
                
                // Enable corresponding button
                if (input === fileInput3d) {
                    generate3dBtn.disabled = false;
                } else if (input === fileInput360) {
                    generate360Btn.disabled = false;
                } else if (input === fileInputVideo) {
                    generateVideoBtn.disabled = false;
                }
            }
        });
    }

    function updateStatus(message, type = 'info') {
        statusDiv.textContent = message;
        statusDiv.className = `status-${type}`;
        statusDiv.style.display = 'block';
    }

    // Generate 3D scene function
    async function generateScene(imageFile, endpoint, buttonElement) {
        try {
            updateStatus('Uploading image and generating 3D model...', 'info');
            buttonElement.disabled = true;
            buttonElement.classList.add('loading');
            
            // Debug: Log initial file info
            console.log('=== STARTING GENERATION ===');
            console.log('Endpoint:', endpoint);
            console.log('Original file info:');
            console.log('- Name:', imageFile.name);
            console.log('- Size:', imageFile.size, 'bytes');
            console.log('- Type:', imageFile.type);
            console.log('- Last Modified:', new Date(imageFile.lastModified));
            
            // Convert image to RGB format to avoid tensor dimension issues
            updateStatus('Processing image format...', 'info');
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            const img = new Image();
            
            // Create a promise to handle image loading
            const processImage = new Promise((resolve, reject) => {
                img.onload = function() {
                    console.log('Image loaded for processing:');
                    console.log('- Dimensions:', img.width + 'x' + img.height);
                    
                    // Set canvas size to image size
                    canvas.width = img.width;
                    canvas.height = img.height;
                    
                    // Draw image on white background to ensure RGB
                    ctx.fillStyle = '#FFFFFF';
                    ctx.fillRect(0, 0, canvas.width, canvas.height);
                    ctx.drawImage(img, 0, 0);
                    
                    // Convert canvas to blob (JPEG format ensures RGB)
                    canvas.toBlob(resolve, 'image/jpeg', 0.9);
                };
                img.onerror = (error) => {
                    console.error('Image processing error:', error);
                    reject(error);
                };
                img.src = URL.createObjectURL(imageFile);
            });
            
            const processedBlob = await processImage;
            
            // Debug: Log processed image info
            console.log('Image processed successfully:');
            console.log('- Processed size:', processedBlob.size, 'bytes');
            console.log('- Processed type:', processedBlob.type);
            console.log('- Size reduction:', ((imageFile.size - processedBlob.size) / imageFile.size * 100).toFixed(1) + '%');
            
            // Create FormData with processed image
            const formData = new FormData();
            formData.append('file', processedBlob, 'image.jpg');
            
            // Debug: Log request details
            console.log('=== SENDING REQUEST ===');
            console.log('URL:', `https://www.memoreal.app/${endpoint}`);
            console.log('Method: POST');
            console.log('FormData contents:');
            for (let [key, value] of formData.entries()) {
                if (value instanceof Blob) {
                    console.log(`- ${key}: Blob (${value.size} bytes, ${value.type})`);
                } else {
                    console.log(`- ${key}: ${value}`);
                }
            }
            
            updateStatus('Sending image to server...', 'info');
            
            // First, do a quick health check
            console.log('=== SERVER HEALTH CHECK ===');
            updateStatus('Checking server status...', 'info');
            
            try {
                const healthController = new AbortController();
                setTimeout(() => healthController.abort(), 10000); // 10 second timeout for health check
                
                const healthResponse = await fetch('https://www.memoreal.app/', {
                    method: 'GET',
                    signal: healthController.signal
                });
                
                console.log('Server health check passed:', healthResponse.status);
                updateStatus('Server is responsive, sending image...', 'info');
                
            } catch (healthError) {
                console.log('Server health check failed:', healthError.message);
                updateStatus('Server appears slow or unresponsive, attempting anyway...', 'info');
                
                // If health check fails, we'll still try the main request but warn the user
                if (healthError.name === 'AbortError') {
                    console.log('Server is responding very slowly');
                } else {
                    console.log('Server connectivity issues detected');
                }
            }
            
            // Create AbortController for timeout handling
            const controller = new AbortController();
            const timeoutId = setTimeout(() => {
                controller.abort();
                console.log('Request aborted due to timeout (90 seconds)');
            }, 90000); // 90 second timeout for image processing
            
            let response;
            let retryCount = 0;
            const maxRetries = 2;
            
            while (retryCount <= maxRetries) {
                try {
                    if (retryCount > 0) {
                        console.log(`Retry attempt ${retryCount}/${maxRetries}`);
                        updateStatus(`Retrying request (attempt ${retryCount + 1})...`, 'info');
                        // Wait a bit before retrying
                        await new Promise(resolve => setTimeout(resolve, 3000));
                    }
                    
                    response = await fetch(`https://www.memoreal.app/${endpoint}`, {
                        method: 'POST',
                        body: formData,
                        signal: controller.signal,
                        // Add headers for better compatibility
                        headers: {
                            'Accept': 'application/json',
                        }
                    });
                    
                    clearTimeout(timeoutId); // Clear timeout if request succeeds
                    break; // Success, exit retry loop
                    
                } catch (fetchError) {
                    retryCount++;
                    
                    // Handle specific error types
                    if (fetchError.name === 'AbortError') {
                        clearTimeout(timeoutId);
                        throw new Error('Request timed out after 90 seconds. The server may be overloaded processing your image.');
                    } else if (fetchError.message.includes('Failed to fetch')) {
                        if (retryCount > maxRetries) {
                            clearTimeout(timeoutId);
                            throw new Error('Cannot connect to server after multiple attempts. The server may be down.');
                        }
                        console.log(`Connection failed, will retry... (${retryCount}/${maxRetries})`);
                    } else {
                        clearTimeout(timeoutId);
                        throw new Error(`Network error: ${fetchError.message}`);
                    }
                }
            }
            
            // Debug: Log response details
            console.log('=== SERVER RESPONSE ===');
            console.log('Status:', response.status, response.statusText);
            console.log('Headers:');
            for (let [key, value] of response.headers.entries()) {
                console.log(`- ${key}: ${value}`);
            }
            
            if (!response.ok) {
                // Try to get detailed error info
                let errorMessage = `Server error: ${response.status} ${response.statusText}`;
                try {
                    const errorText = await response.text();
                    console.log('Error response body:', errorText);
                    if (errorText) {
                        errorMessage += ` - ${errorText}`;
                    }
                } catch (e) {
                    console.log('Could not read error response body');
                }
                throw new Error(errorMessage);
            }
            
            updateStatus('Processing server response...', 'info');
            const data = await response.json();
            
            // Debug: Log successful response
            console.log('=== SUCCESS RESPONSE ===');
            console.log('Response data:', data);
            
            if (data.glb_url) {
                modelUrl = data.glb_url;
                console.log('=== MODEL URL RECEIVED ===');
                console.log('Generated model URL:', modelUrl);
                console.log('URL type:', modelUrl.startsWith('http') ? 'Remote URL' : 'Local/Blob URL');
                
                updateStatus('3D model generated successfully! Click "Enter VR" to view.', 'success');
                vrBtn.disabled = false;
            } else {
                throw new Error(data.error || 'Invalid response: no glb_url found');
            }
            
        } catch (error) {
            console.error('=== ERROR OCCURRED ===');
            console.error('Error type:', error.constructor.name);
            console.error('Error message:', error.message);
            console.error('Error stack:', error.stack);
            console.error('Full error object:', error);
            
            updateStatus(`Error: ${error.message}`, 'error');
        } finally {
            console.log('=== GENERATION COMPLETED ===');
            buttonElement.disabled = false;
            buttonElement.classList.remove('loading');
        }
    }

    // Generate video hologram function
    async function generateVideoHologram(videoFile, buttonElement) {
        try {
            updateStatus('Uploading video and generating hologram...', 'info');
            buttonElement.disabled = true;
            buttonElement.classList.add('loading');
            
            console.log('=== STARTING VIDEO GENERATION ===');
            console.log('Video file info:');
            console.log('- Name:', videoFile.name);
            console.log('- Size:', videoFile.size, 'bytes');
            console.log('- Type:', videoFile.type);
            
            // Create FormData with video file
            const formData = new FormData();
            formData.append('file', videoFile);
            
            updateStatus('Sending video to server...', 'info');
            
            const response = await fetch('https://www.memoreal.app/generate-video', {
                method: 'POST',
                body: formData
            });
            
            const data = await response.json();
            
            console.log('=== SUCCESS VIDEO RESPONSE ===');
            console.log('Response data:', data);
            
            if (data.video_url) {
                modelUrl = data.video_url;
                console.log('=== VIDEO URL RECEIVED ===');
                console.log('Generated video URL:', modelUrl);
                
                updateStatus('Video hologram generated successfully! Click "Enter VR" to view.', 'success');
                vrBtn.disabled = false;
            } else {
                throw new Error(data.error || 'Invalid response: no video_url found');
            }
            
        } catch (error) {
            console.error('=== VIDEO ERROR OCCURRED ===');
            console.error('Error:', error.message);
            updateStatus(`Error: ${error.message}`, 'error');
        } finally {
            console.log('=== VIDEO GENERATION COMPLETED ===');
            buttonElement.disabled = false;
            buttonElement.classList.remove('loading');
        }
    }

    // Event listeners for generation buttons
    generate3dBtn.onclick = () => {
        const imageFile = fileInput3d.files[0];
        if (!imageFile) {
            console.log('3D Generation clicked but no file selected');
            updateStatus('Please upload a 3D image first.', 'error');
            return;
        }
        console.log('3D Generation starting with file:', imageFile.name);
        currentContentType = '3d'; // Set content type for VR rotation
        generateScene(imageFile, 'generate-scene', generate3dBtn);
    };

    generate360Btn.onclick = () => {
        const imageFile = fileInput360.files[0];
        if (!imageFile) {
            console.log('360° Generation clicked but no file selected');
            updateStatus('Please upload a 360° image first.', 'error');
            return;
        }
        console.log('360° Generation starting with file:', imageFile.name);
        currentContentType = '360'; // Set content type for VR rotation
        generateScene(imageFile, 'generate-360-scene', generate360Btn);
    };

    generateVideoBtn.onclick = () => {
        const videoFile = fileInputVideo.files[0];
        if (!videoFile) {
            console.log('Video Generation clicked but no file selected');
            updateStatus('Please upload a video file first.', 'error');
            return;
        }
        console.log('Video Generation starting with file:', videoFile.name);
        generateVideoHologram(videoFile, generateVideoBtn);
    };

    vrBtn.onclick = () => {
        console.log('=== VR BUTTON CLICKED ===');
        console.log('Current modelUrl:', modelUrl);
        
        if (!modelUrl) {
            console.log('No model URL available, VR button should be disabled');
            return;
        }
        
        updateStatus('Redirecting to VR experience...', 'info');
        
        // Check if this is a video URL and redirect accordingly
        if (modelUrl.includes('video') || modelUrl.endsWith('.mp4') || modelUrl.endsWith('.webm') || modelUrl.endsWith('.mov')) {
            // Video hologram - redirect to videovr.html
            const encodedUrl = encodeURIComponent(modelUrl);
            const videoVrUrl = `videovr.html?video=${encodedUrl}`;
            console.log('Navigating to Video VR:');
            console.log('- Original URL:', modelUrl);
            console.log('- Encoded URL:', encodedUrl);
            console.log('- Video VR URL:', videoVrUrl);
            
            window.location.href = videoVrUrl;
        } else {
            // Regular 3D model - redirect to vr.html
            const encodedUrl = encodeURIComponent(modelUrl);
            const typeParam = currentContentType ? `&type=${currentContentType}` : '';
            const fullVrUrl = `vr.html?model=${encodedUrl}${typeParam}`;
            console.log('Navigating to VR:');
            console.log('- Original URL:', modelUrl);
            console.log('- Encoded URL:', encodedUrl);
            console.log('- Content Type:', currentContentType);
            console.log('- Full VR URL:', fullVrUrl);
            
            window.location.href = fullVrUrl;
        }
    };
});
