# Docker Quick Start Guide

## Prerequisites
```bash
# Verify Docker is installed
docker --version
docker-compose --version
```

## One-Time Setup

```bash
# 1. Copy environment template
cp .env.example .env

# 2. Edit .env and add your Gemini API key
nano .env  # or use your preferred editor
# Add: GEMINI_API_KEY=your_actual_key_here
```

## Quick Commands

### Using Make (Recommended)
```bash
make help          # Show all available commands
make up            # Start production (port 2350)
make down          # Stop production
make logs          # View logs
make dev           # Start development (port 2351)
```

### Using Docker Compose Directly
```bash
# Production
docker-compose up -d              # Start
docker-compose logs -f            # View logs
docker-compose down               # Stop

# Development
docker-compose -f docker-dev.yml up    # Start with hot reload
```

## Access the Application

- **Production**: http://localhost:2350
- **Development**: http://localhost:2351

## Common Tasks

### View Running Containers
```bash
docker ps
# or
make health
```

### Rebuild After Code Changes (Production)
```bash
docker-compose up -d --build
# or
make build && make up
```

### View Logs
```bash
docker-compose logs -f
# or
make logs
```

### Clean Everything
```bash
docker-compose down -v --rmi all
# or
make clean
```

## Troubleshooting

### Port Already in Use
```bash
# Find what's using the port
lsof -i :2350

# Kill the process or change port in docker-compose.yml
```

### Environment Variable Not Working
```bash
# Verify .env file exists
cat .env

# Rebuild to apply changes
docker-compose down
docker-compose up -d --build
```

### Container Keeps Restarting
```bash
# Check logs for errors
docker-compose logs

# Check health status
docker ps
```

## File Reference

| File | Purpose |
|------|---------|
| `Dockerfile` | Production build (multi-stage) |
| `Dockerfile.dev` | Development build (hot reload) |
| `docker-compose.yml` | Production deployment (port 2350) |
| `docker-dev.yml` | Development deployment (port 2351) |
| `nginx.conf` | Nginx configuration for production |
| `.env.example` | Environment template |
| `.dockerignore` | Files excluded from Docker build |
| `Makefile` | Convenient command shortcuts |

## Architecture

```
Production Flow:
┌─────────────┐    ┌──────────────┐    ┌─────────────┐
│   Browser   │───▶│ Nginx:2350   │───▶│  React App  │
│             │    │  (Alpine)    │    │   (Built)   │
└─────────────┘    └──────────────┘    └─────────────┘

Development Flow:
┌─────────────┐    ┌──────────────┐    ┌─────────────┐
│   Browser   │───▶│ Vite:2351    │───▶│  React App  │
│             │    │  Dev Server  │    │ (Live Code) │
└─────────────┘    └──────────────┘    └─────────────┘
```

## Need More Help?

- Full deployment guide: See [DEPLOYMENT.md](./DEPLOYMENT.md)
- Architecture details: See [CLAUDE.md](./CLAUDE.md)
- General usage: See [README.md](./README.md)
