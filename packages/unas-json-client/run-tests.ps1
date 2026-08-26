$ErrorActionPreference = "Stop"
$PSScriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path

$ImageName = "unas-json-client-dev"
$ContainerName = "unas-json-client-dev-runner"

Write-Host "==> Building $ImageName Docker image..." -ForegroundColor Cyan
docker build -t $ImageName $PSScriptRoot

Write-Host "==> Running tests inside container..." -ForegroundColor Cyan
# Remove existing test runner container if already present
docker rm -f $ContainerName 2>$null

# Run container with volume mount for live test execution and automatic cleanup
docker run --rm --name $ContainerName -v "${PSScriptRoot}:/workspace" -v "/workspace/node_modules" $ImageName npm run test
