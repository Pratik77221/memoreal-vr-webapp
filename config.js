// MemoReal Production Configuration
const MEMOREAL_CONFIG = {
    // Multiplayer server URL (Heroku)
    MULTIPLAYER_SERVER: 'https://memoreal-multiplayer-server.herokuapp.com',
    
    // Frontend URL (Hostinger)
    FRONTEND_URL: 'https://memoreal.pratikmane.tech',
    
    // Local development fallback
    LOCAL_SERVER: 'http://localhost:8080',
    
    // Environment detection
    isProduction: () => {
        return window.location.hostname === 'memoreal.pratikmane.tech';
    },
    
    // Get appropriate server URL
    getServerURL: () => {
        if (MEMOREAL_CONFIG.isProduction()) {
            return MEMOREAL_CONFIG.MULTIPLAYER_SERVER;
        }
        return MEMOREAL_CONFIG.LOCAL_SERVER;
    }
};

// Make config globally available
window.MEMOREAL_CONFIG = MEMOREAL_CONFIG;
