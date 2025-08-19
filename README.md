# MemoReal - VR Multiplayer Application

## Frontend Deployment (Hostinger)

1. Upload the entire frontend folder contents to your Hostinger domain: `memoreal.pratikmane.tech`
2. Make sure all files are in the public_html directory
3. The site will be accessible at https://memoreal.pratikmane.tech

## Multiplayer Server Deployment (Heroku)

The multiplayer server is configured to run on Heroku at: `memoreal-multiplayer-server.herokuapp.com`

### Heroku Deployment Commands:
```bash
# Login to Heroku
heroku login

# Create Heroku app
heroku create memoreal-multiplayer-server

# Deploy
git init
git add .
git commit -m "Initial commit"
heroku git:remote -a memoreal-multiplayer-server
git push heroku main
```

## Configuration

- Frontend URL: https://memoreal.pratikmane.tech
- Multiplayer Server: https://memoreal-multiplayer-server.herokuapp.com
- The app automatically detects production vs development environment

## Features

- 3D Image to VR Scene generation
- 360° Panoramic VR experiences  
- Video to Hologram conversion
- Multiplayer VR support with voice chat
- Cross-platform VR compatibility

## File Structure

```
├── index.html          # Main landing page
├── vr.html            # 3D/360° VR viewer
├── videovr.html       # Video hologram VR viewer
├── app.js             # Main application logic
├── vr.js              # VR scene management
├── videovr.js         # Video hologram logic
├── server.js          # Multiplayer server
├── config.js          # Production configuration
├── style.css          # Styling
├── networked-aframe.min.js  # Multiplayer networking
└── Assets/            # 3D models and resources
```

## Support

For issues or questions, contact the MemoReal team.
