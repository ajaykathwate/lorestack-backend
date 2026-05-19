SHELL := pwsh.exe
.SHELLFLAGS := -NoLogo -NoProfile -ExecutionPolicy Bypass -Command

.DEFAULT_GOAL := help

.PHONY: help start up dev restart rebuild migrate seed logs status down clean-cache

help:
	@Write-Host "Available commands:"
	@Write-Host "  make start       Start the full Docker stack"
	@Write-Host "  make dev         Start PostgreSQL in Docker and Nest locally with hot reload"
	@Write-Host "  make restart     Rebuild API without cache, restart services, run migrations"
	@Write-Host "  make rebuild     Rebuild API image without cache"
	@Write-Host "  make migrate     Start DB and run pending Prisma migrations"
	@Write-Host "  make seed        Run Prisma seed inside the API container"
	@Write-Host "  make logs        Tail API and database logs"
	@Write-Host "  make status      Show Docker Compose service status"
	@Write-Host "  make down        Stop services without deleting volumes"
	@Write-Host "  make clean-cache Remove local app build cache and Docker builder cache"

start:
	@.\scripts\app.ps1 start

up: start

dev:
	@.\scripts\app.ps1 dev

restart:
	@.\scripts\app.ps1 restart

rebuild:
	@.\scripts\app.ps1 rebuild

migrate:
	@.\scripts\app.ps1 migrate

seed:
	@.\scripts\app.ps1 seed

logs:
	@.\scripts\app.ps1 logs

status:
	@.\scripts\app.ps1 status

down:
	@.\scripts\app.ps1 down

clean-cache:
	@.\scripts\app.ps1 clean-cache
