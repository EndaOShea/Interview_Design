.PHONY: help build up down logs restart clean dev dev-down prod-build prod-up prod-down prod-logs health

# Default target
help:
	@echo "Available commands:"
	@echo "  make build       - Build production Docker image"
	@echo "  make up          - Start production containers"
	@echo "  make down        - Stop production containers"
	@echo "  make logs        - View production logs"
	@echo "  make restart     - Restart production containers"
	@echo "  make clean       - Remove containers, volumes, and images"
	@echo ""
	@echo "  make dev         - Start development server with hot reload"
	@echo "  make dev-down    - Stop development server"
	@echo ""
	@echo "  make health      - Check container health status"
	@echo ""
	@echo "Production runs on: http://localhost:2350"
	@echo "Development runs on: http://localhost:2351"

# Production commands
build:
	docker-compose build

up:
	docker-compose up -d
	@echo "✓ Production server started at http://localhost:2350"

down:
	docker-compose down

logs:
	docker-compose logs -f

restart:
	docker-compose restart

clean:
	docker-compose down -v --rmi all
	@echo "✓ Cleaned up containers, volumes, and images"

# Development commands
dev:
	docker-compose -f docker-dev.yml up
	@echo "✓ Development server started at http://localhost:2351"

dev-down:
	docker-compose -f docker-dev.yml down

# Utility commands
health:
	@echo "Container Status:"
	@docker ps --filter "name=architectai" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"

# Aliases
prod-build: build
prod-up: up
prod-down: down
prod-logs: logs
