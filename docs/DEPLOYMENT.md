# Deployment Guide

This guide covers deploying ArchitectAI - System Design Studio using Docker.

## Quick Start

```bash
# 1. Set up environment
cp .env.example .env
# Edit .env and add your GEMINI_API_KEY

# 2. Deploy
docker-compose up -d

# 3. Access the app
# Open http://localhost:2350
```

## Port Configuration

The application uses ports in the 2301-2400 range:
- **Production**: Port `2350` (docker-compose.yml)
- **Development**: Port `2351` (docker-dev.yml)

To change the port, edit:
1. `docker-compose.yml` - Update the ports mapping
2. `Dockerfile` - Update EXPOSE directive
3. `nginx.conf` - Update listen directive

## Architecture

### Production Setup (Dockerfile)

**Multi-stage build process:**

1. **Builder Stage** (node:20-alpine)
   - Installs dependencies with `npm ci`
   - Builds the React application with Vite
   - Output: `/app/dist`

2. **Production Stage** (nginx:alpine)
   - Copies built files to nginx html directory
   - Configures nginx for SPA routing
   - Enables gzip compression
   - Adds security headers
   - Exposes port 2350
   - Includes health check

**Benefits:**
- Small image size (~40MB vs ~1GB with Node.js)
- Better performance with nginx
- No Node.js runtime in production
- Automatic HTTPS/SSL support via reverse proxy

### Development Setup (Dockerfile.dev)

- Single-stage Node.js image
- Mounts source code as volume for hot reload
- Runs Vite dev server
- Full debugging capabilities

## Environment Variables

Required environment variable:
```env
GEMINI_API_KEY=your_gemini_api_key_here
```

The key is passed from the `.env` file to the container via docker-compose.

**Note:** The Vite build process embeds the API key into the JavaScript bundle. For production deployments with sensitive keys, consider:
- Using environment-specific keys
- Implementing a backend proxy for API calls
- Using secrets management (AWS Secrets Manager, HashiCorp Vault)

## Nginx Configuration

`nginx.conf` provides:
- **SPA Routing**: All routes serve `index.html`
- **Gzip Compression**: Reduces bundle size
- **Security Headers**: X-Frame-Options, X-Content-Type-Options, X-XSS-Protection
- **Asset Caching**: 1-year cache for static assets
- **HTML Caching**: No-cache for index.html (ensures fresh deployments)

## Docker Compose Services

### Production Service (docker-compose.yml)

```yaml
services:
  architectai:
    build: .
    ports:
      - "2350:2350"
    environment:
      - GEMINI_API_KEY=${GEMINI_API_KEY}
    restart: unless-stopped
    healthcheck: enabled
```

### Development Service (docker-dev.yml)

```yaml
services:
  architectai-dev:
    build:
      dockerfile: Dockerfile.dev
    ports:
      - "2351:3000"
    volumes:
      - .:/app
      - /app/node_modules
    command: npm run dev
```

## Common Commands

### Production

```bash
# Start services
docker-compose up -d

# View logs
docker-compose logs -f

# Restart services
docker-compose restart

# Stop services
docker-compose down

# Rebuild and start
docker-compose up -d --build

# Remove volumes and rebuild
docker-compose down -v
docker-compose up -d --build
```

### Development

```bash
# Start dev server with hot reload
docker-compose -f docker-dev.yml up

# Stop dev server
docker-compose -f docker-dev.yml down

# Rebuild dev environment
docker-compose -f docker-dev.yml up --build
```

### Manual Docker Commands

```bash
# Build image
docker build -t architectai:latest .

# Run container
docker run -d \
  -p 2350:2350 \
  -e GEMINI_API_KEY=your_key_here \
  --name architectai \
  architectai:latest

# View logs
docker logs -f architectai

# Stop container
docker stop architectai

# Remove container
docker rm architectai

# Execute shell in running container
docker exec -it architectai sh
```

## Health Checks

The production container includes a health check that:
- Runs every 30 seconds
- Attempts to fetch the homepage via wget
- Times out after 3 seconds
- Retries 3 times before marking unhealthy
- Waits 5 seconds before first check

Check health status:
```bash
docker ps
docker inspect architectai | grep -A 10 Health
```

## Troubleshooting

### Container won't start

```bash
# Check logs
docker-compose logs

# Check if port is already in use
lsof -i :2350
netstat -tuln | grep 2350

# Remove and rebuild
docker-compose down
docker-compose up --build
```

### API key not working

```bash
# Verify environment variable
docker-compose exec architectai env | grep GEMINI

# Check if .env file exists
cat .env

# Rebuild to embed new key
docker-compose down
docker-compose up -d --build
```

### Cannot access application

```bash
# Check if container is running
docker ps | grep architectai

# Check health status
docker ps --format "table {{.Names}}\t{{.Status}}"

# Test from inside container
docker exec architectai wget -O- http://localhost:2350

# Check nginx logs
docker exec architectai cat /var/log/nginx/error.log
```

### Hot reload not working (dev mode)

```bash
# Ensure volumes are mounted
docker-compose -f docker-dev.yml config

# Restart with fresh volumes
docker-compose -f docker-dev.yml down -v
docker-compose -f docker-dev.yml up
```

## Production Deployment Checklist

- [ ] Generate production Gemini API key
- [ ] Update `.env` with production key
- [ ] Review nginx security headers
- [ ] Configure HTTPS/SSL (if deploying behind reverse proxy)
- [ ] Set up monitoring and logging
- [ ] Configure backup strategy
- [ ] Test health check endpoint
- [ ] Set resource limits (CPU/Memory)
- [ ] Configure restart policy
- [ ] Review .dockerignore to minimize image size
- [ ] Set up CI/CD pipeline

## Cloud Deployment Options

### AWS
- **ECS/Fargate**: Deploy container directly
- **Elastic Beanstalk**: Upload docker-compose.yml
- **EC2**: Install Docker and run compose

### Google Cloud
- **Cloud Run**: Deploy container image
- **GKE**: Kubernetes deployment
- **Compute Engine**: Install Docker and run compose

### Azure
- **Container Instances**: Deploy container
- **App Service**: Container deployment
- **AKS**: Kubernetes deployment

### Generic VPS (DigitalOcean, Linode, etc.)
```bash
# SSH into server
ssh user@your-server

# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sh get-docker.sh

# Clone repository
git clone <your-repo>
cd Interview_Design

# Set up environment
cp .env.example .env
nano .env  # Add GEMINI_API_KEY

# Deploy
docker-compose up -d
```

## Security Considerations

1. **API Key Management**: Never commit `.env` to version control
2. **HTTPS**: Always use HTTPS in production (configure reverse proxy)
3. **Firewall**: Only expose port 2350 or use a reverse proxy
4. **Updates**: Regularly update base images (`nginx:alpine`, `node:20-alpine`)
5. **Secrets**: Consider using Docker secrets for sensitive data
6. **Network**: Use Docker networks to isolate services

## Performance Optimization

1. **Image Size**: Multi-stage build reduces final image to ~40MB
2. **Gzip**: Enabled in nginx for all text assets
3. **Caching**: Long-term caching for static assets
4. **Health Checks**: Ensures only healthy containers receive traffic
5. **Resource Limits**: Add to docker-compose.yml if needed:
   ```yaml
   deploy:
     resources:
       limits:
         cpus: '0.5'
         memory: 512M
   ```

## Monitoring

Add monitoring with Prometheus/Grafana:

```yaml
# docker-compose.monitoring.yml
services:
  prometheus:
    image: prom/prometheus
    ports:
      - "9090:9090"
    volumes:
      - ./prometheus.yml:/etc/prometheus/prometheus.yml

  grafana:
    image: grafana/grafana
    ports:
      - "3001:3000"
```

## Support

For issues or questions:
- Check the [main README](./README.md)
- Review [CLAUDE.md](./CLAUDE.md) for architecture details
- Open an issue on GitHub
