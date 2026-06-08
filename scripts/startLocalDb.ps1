$ErrorActionPreference = "Stop"

$dockerPipe = "\\.\pipe\dockerDesktopLinuxEngine"

if (-not (Test-Path $dockerPipe)) {
  Write-Host ""
  Write-Host "Docker Desktop no esta corriendo o el Linux engine no esta listo." -ForegroundColor Yellow
  Write-Host ""
  Write-Host "Abre Docker Desktop y espera a que diga 'Docker Desktop is running'."
  Write-Host "Luego vuelve a ejecutar:"
  Write-Host ""
  Write-Host "  npm run db:local" -ForegroundColor Cyan
  Write-Host ""
  Write-Host "Si prefieres no usar Docker, levanta MongoDB local como servicio y ejecuta:"
  Write-Host ""
  Write-Host "  npm run dev" -ForegroundColor Cyan
  Write-Host ""
  exit 1
}

docker compose up -d mongo
