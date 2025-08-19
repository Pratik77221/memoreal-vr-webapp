// Production configuration for networked-aframe
document.addEventListener('DOMContentLoaded', function() {
    if (typeof MEMOREAL_CONFIG !== 'undefined') {
        const serverURL = MEMOREAL_CONFIG.getServerURL();
        console.log('MemoReal: Using multiplayer server:', serverURL);
        
        // Update networked-aframe configuration if needed
        if (typeof NAF !== 'undefined') {
            NAF.schemas.getComponentsOriginal = NAF.schemas.getComponents;
        }
    }
});
