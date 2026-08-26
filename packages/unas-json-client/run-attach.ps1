$ErrorActionPreference = "Stop"
$PSScriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path

$ImageName = "unas-json-client-dev"
$ContainerName = "unas-json-client-dev"

Write-Host "==> Building $ImageName Docker image..." -ForegroundColor Cyan
docker build -t $ImageName $PSScriptRoot

# Check if container is already running
$existing = docker ps -a --filter "name=^/${ContainerName}$" --format "{{.Status}}"
if (-not $existing) {
    Write-Host "==> Starting persistent dev container $ContainerName..." -ForegroundColor Cyan
    docker run -d --name $ContainerName -v "${PSScriptRoot}:/workspace" -v "/workspace/node_modules" $ImageName
} elseif (-not ($existing -like "Up*")) {
    Write-Host "==> Starting stopped container $ContainerName..." -ForegroundColor Cyan
    docker start $ContainerName
}

Write-Host "==> Attaching interactive bash terminal..." -ForegroundColor Green
docker exec -it $ContainerName /bin/bash
