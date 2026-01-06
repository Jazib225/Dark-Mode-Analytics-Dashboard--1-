# Deployment Guide

## Frontend (Vercel)

The frontend is deployed on Vercel and automatically builds from your GitHub repo.

**Environment Variables needed in Vercel Dashboard:**
```
VITE_API_URL=https://your-backend-url/api
```

## Backend Deployment Options

You have several options to deploy the Express backend:

### Option 1: Render (Recommended - Free tier available)

1. Go to https://render.com
2. Create new "Web Service"
3. Connect your GitHub repo
4. Set:
   - Build Command: `npm run build:server`
   - Start Command: `node dist/server/index.js`
   - Environment: Node.js 18
5. Deploy
6. Get your service URL (e.g., `https://your-backend.onrender.com`)
7. In Vercel dashboard, set `VITE_API_URL=https://your-backend.onrender.com/api`

### Option 2: Railway (Free tier + $5 credit)

1. Go to https://railway.app
2. Create new project
3. Connect your GitHub repo
4. Set environment variables:
   - `BACKEND_PORT=3000`
5. Add start script to package.json if needed
6. Deploy
7. Get your public URL
8. In Vercel dashboard, set `VITE_API_URL=https://your-railway-url/api`

### Option 3: Heroku (Paid)

1. Go to https://heroku.com
2. Create new app
3. Connect GitHub
4. Add buildpack for Node.js
5. Deploy
6. In Vercel dashboard, set `VITE_API_URL=https://your-heroku-app.herokuapp.com/api`

### Option 4: AWS/DigitalOcean/Linode (More complex)

For production, consider VPS providers where you have full control.

## Quick Setup Steps

1. **Choose a backend host** (Render recommended for easiest setup)
2. **Deploy backend** to your chosen service
3. **Get backend URL** (e.g., `https://backend.render.com`)
4. **Update Vercel environment variables:**
   - Go to Vercel Dashboard
   - Select your project
   - Settings → Environment Variables
   - Add: `VITE_API_URL` = `https://backend.render.com/api`
   - Redeploy frontend
5. **Test** - Check browser console (F12) for actual API URL being used

## Testing Locally

```bash
# Terminal 1 - Backend
npm run dev:server
# Runs on http://localhost:3001

# Terminal 2 - Frontend
npm run dev:frontend
# Runs on http://localhost:5173
# Automatically uses http://localhost:3001/api
```

## Troubleshooting

### "Error: Failed to fetch"
- Check browser console (F12) for actual error
- Verify `VITE_API_URL` environment variable is set in Vercel
- Ensure backend is deployed and running
- Check CORS settings in backend (should be enabled for `*` in development)

### Backend URL issues
The frontend will automatically construct the API URL as:
1. Use `VITE_API_URL` if set (takes precedence)
2. Use same domain + `/api` if in production
3. Use `http://localhost:3001/api` as fallback for local development

### CORS Errors
The backend has CORS enabled for all origins. If you see CORS errors:
- Verify the backend is running
- Check that the URL in the browser matches the deployed backend
- Restart the backend service
