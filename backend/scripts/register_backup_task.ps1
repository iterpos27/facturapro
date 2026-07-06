param(
  [string]$TaskName = "FacturaPro Backup Diario",
  [string]$Time = "20:00"
)

$backendDir = Resolve-Path (Join-Path $PSScriptRoot "..")
$npm = (Get-Command npm.cmd -ErrorAction Stop).Source

$action = New-ScheduledTaskAction `
  -Execute $npm `
  -Argument "run db:backup" `
  -WorkingDirectory $backendDir

$trigger = New-ScheduledTaskTrigger -Daily -At $Time
$settings = New-ScheduledTaskSettingsSet `
  -AllowStartIfOnBatteries `
  -DontStopIfGoingOnBatteries `
  -StartWhenAvailable

Register-ScheduledTask `
  -TaskName $TaskName `
  -Action $action `
  -Trigger $trigger `
  -Settings $settings `
  -Description "Genera backup diario de PostgreSQL para FacturaPro." `
  -Force

Write-Host "Tarea programada creada: $TaskName a las $Time"
