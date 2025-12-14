# Deployment Checklist

## Pre-Deployment Steps

### 1. Environment Setup
- [ ] Create `.env` file in project root (copy from `.env.example`)
- [ ] Add your `GEMINI_API_KEY` to the `.env` file
  - Get key at: https://aistudio.google.com/apikey
  - Format: `GEMINI_API_KEY=your_actual_api_key_here`

### 2. Verify Docker is Running
```bash
docker --version
docker-compose --version
```

### 3. Review Configuration
- [ ] Check `docker-compose.yml` - port 2350 is correct
- [ ] Verify `Dockerfile` - multi-stage build configured
- [ ] Confirm `nginx.conf` - serving on port 2350

## Deployment Commands

### Option 1: Using Make (Recommended)
```bash
# Build and start production
make build
make up

# View logs
make logs

# Check health
make health

# Stop
make down
```

### Option 2: Using Docker Compose Directly
```bash
# Build and start
docker-compose up -d

# View logs
docker-compose logs -f

# Stop
docker-compose down
```

## Post-Deployment Verification

### 1. Check Container Status
```bash
docker ps | grep architectai
```
Expected output: Container running, healthy status

### 2. Access Application
- Open browser: http://localhost:2350
- Verify UI loads correctly
- Check browser console for errors

### 3. Test Core Features
- [ ] Drag component from sidebar to canvas
- [ ] Test AI challenge generation (requires API key)
- [ ] Test AI evaluation (requires API key)
- [ ] Test AI hints (requires API key)
- [ ] Test AI Tutor chat (requires user's own API key in settings)
- [ ] Test undo/redo functionality
- [ ] Test canvas pan/zoom
- [ ] Test component connections

### 4. Check Container Health
```bash
docker inspect --format='{{.State.Health.Status}}' architectai-system-design
```
Expected: `healthy`

### 5. Review Logs for Errors
```bash
docker-compose logs | grep -i error
```
Expected: No critical errors

## Troubleshooting

### Container Won't Start
1. Check `.env` file exists and has valid `GEMINI_API_KEY`
2. Verify port 2350 is not already in use: `lsof -i :2350`
3. Check Docker logs: `docker-compose logs`

### Build Fails
1. Ensure Docker has enough memory (recommend 4GB+)
2. Clear Docker cache: `docker system prune -a`
3. Rebuild: `docker-compose build --no-cache`

### Application Not Loading
1. Check nginx logs: `docker-compose logs architectai`
2. Verify index.html exists in container: `docker exec architectai-system-design ls -la /usr/share/nginx/html`
3. Test health endpoint: `curl http://localhost:2350/`

### API Features Not Working
1. Verify `GEMINI_API_KEY` is set correctly in `.env`
2. Check API key is valid at https://aistudio.google.com/apikey
3. Review browser console for API errors
4. Check that the key has quota remaining

## Production Deployment

### Additional Steps for Production Hosting

1. **Domain & SSL**
   - Configure domain name
   - Set up SSL/TLS certificates (Let's Encrypt recommended)
   - Update nginx.conf for HTTPS

2. **Security**
   - [ ] Change default ports if needed
   - [ ] Set up firewall rules
   - [ ] Enable rate limiting in nginx
   - [ ] Review and harden security headers

3. **Monitoring**
   - [ ] Set up container monitoring (e.g., Prometheus, Grafana)
   - [ ] Configure log aggregation
   - [ ] Set up uptime monitoring

4. **Backup**
   - [ ] Plan for disaster recovery
   - [ ] Document rollback procedure

## Current Deployment Status

✅ **Ready for Docker Deployment**

- Multi-stage Dockerfile optimized
- docker-compose.yml configured
- nginx serving with gzip & security headers
- Health checks enabled
- .dockerignore added for efficient builds
- Makefile with deployment commands
- Environment variable management ready

⚠️ **Notes:**
- Ensure `GEMINI_API_KEY` is set before deployment
- All uncommitted changes will be included in Docker build
- For production: commit changes to git for version control
