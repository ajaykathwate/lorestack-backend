param(
  [ValidateSet('start', 'dev', 'restart', 'rebuild', 'migrate', 'seed', 'logs', 'status', 'down', 'clean-cache')]
  [string] $Command = 'start'
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
if (Get-Variable -Name PSNativeCommandUseErrorActionPreference -ErrorAction SilentlyContinue) {
  $PSNativeCommandUseErrorActionPreference = $true
}

$Root = Split-Path -Parent $PSScriptRoot
Set-Location $Root

function Write-Step {
  param([string] $Message)
  Write-Host ""
  Write-Host "==> $Message" -ForegroundColor Cyan
}

function Ensure-Command {
  param([string] $Name)
  if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
    throw "$Name is not installed or not available on PATH."
  }
}

function Ensure-Pnpm {
  Ensure-Command 'pnpm'
}

function Ensure-EnvFile {
  if (-not (Test-Path '.env')) {
    if (-not (Test-Path '.env.example')) {
      throw '.env is missing and .env.example was not found.'
    }

    Copy-Item '.env.example' '.env'
    Write-Host 'Created .env from .env.example. Review secrets before production use.' -ForegroundColor Yellow
  }
}

function Assert-DockerRunning {
  Ensure-Command 'docker'

  try {
    docker info *> $null
  } catch {
    throw 'Docker is installed, but the Docker engine is not running. Start Docker Desktop and retry.'
  }
}

function Compose {
  docker compose @args
}

function Clear-AppBuildCache {
  if (Test-Path 'dist') {
    Remove-Item -LiteralPath 'dist' -Recurse -Force
  }

  if (Test-Path 'tsconfig.build.tsbuildinfo') {
    Remove-Item -LiteralPath 'tsconfig.build.tsbuildinfo' -Force
  }
}

function Ensure-NodeModules {
  Ensure-Pnpm

  if (-not (Test-Path 'node_modules')) {
    Write-Step 'Installing local dependencies'
    pnpm install
  }
}

function Set-LocalDevEnvironment {
  $env:NODE_ENV = 'development'
  $env:PORT = if ($env:PORT) { $env:PORT } else { '3000' }
  $env:DATABASE_URL = 'postgresql://postgres:postgres@localhost:5432/lorestack?schema=public'

  if (-not $env:JWT_SECRET) {
    $env:JWT_SECRET = 'change-me-in-production-with-at-least-32-characters'
  }

  if (-not $env:JWT_EXPIRES_IN) {
    $env:JWT_EXPIRES_IN = '15m'
  }
}

function Wait-ForPostgres {
  Write-Step 'Waiting for PostgreSQL healthcheck'

  for ($i = 1; $i -le 30; $i++) {
    $status = docker inspect --format '{{.State.Health.Status}}' lorestack-postgres 2>$null

    if ($status -eq 'healthy') {
      Write-Host 'PostgreSQL is healthy.' -ForegroundColor Green
      return
    }

    Start-Sleep -Seconds 2
  }

  Compose logs postgres
  throw 'PostgreSQL did not become healthy in time.'
}

function Start-Stack {
  Ensure-EnvFile
  Assert-DockerRunning

  Write-Step 'Starting Docker services'
  Compose up -d --build
  Compose ps
}

function Start-LocalDev {
  Ensure-EnvFile
  Assert-DockerRunning
  Ensure-NodeModules
  Set-LocalDevEnvironment

  Write-Step 'Stopping Docker API service to free the local app port'
  Compose stop api 2>$null

  Write-Step 'Starting PostgreSQL in Docker'
  Compose up -d postgres
  Wait-ForPostgres

  Write-Step 'Generating Prisma client'
  pnpm prisma:generate

  Write-Step 'Applying pending Prisma migrations locally'
  pnpm prisma migrate deploy

  Write-Step 'Starting NestJS locally with hot reload'
  pnpm start:dev
}

function Rebuild-ApiNoCache {
  Ensure-EnvFile
  Assert-DockerRunning

  Write-Step 'Clearing local app build cache'
  Clear-AppBuildCache

  Write-Step 'Building API image without Docker cache'
  Compose build --no-cache api
}

function Run-Migrations {
  Ensure-EnvFile
  Assert-DockerRunning

  Write-Step 'Starting PostgreSQL'
  Compose up -d postgres
  Wait-ForPostgres

  Write-Step 'Running pending Prisma migrations'
  Compose run --rm api pnpm prisma migrate deploy
}

function Restart-Clean {
  Ensure-EnvFile
  Assert-DockerRunning

  Write-Step 'Stopping existing services'
  Compose down --remove-orphans

  Rebuild-ApiNoCache

  Write-Step 'Starting PostgreSQL'
  Compose up -d postgres
  Wait-ForPostgres

  Write-Step 'Applying pending Prisma migrations'
  Compose run --rm api pnpm prisma migrate deploy

  Write-Step 'Starting API service'
  Compose up -d api

  Write-Step 'Current service status'
  Compose ps
}

switch ($Command) {
  'start' {
    Start-Stack
  }
  'dev' {
    Start-LocalDev
  }
  'restart' {
    Restart-Clean
  }
  'rebuild' {
    Rebuild-ApiNoCache
  }
  'migrate' {
    Run-Migrations
  }
  'seed' {
    Ensure-EnvFile
    Assert-DockerRunning
    Compose run --rm api pnpm prisma:seed
  }
  'logs' {
    Assert-DockerRunning
    Compose logs -f api postgres
  }
  'status' {
    Assert-DockerRunning
    Compose ps
  }
  'down' {
    Assert-DockerRunning
    Compose down --remove-orphans
  }
  'clean-cache' {
    Assert-DockerRunning
    Clear-AppBuildCache
    docker builder prune -f
  }
}
