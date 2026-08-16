# deepseek娘 desktop pet state driver
# usage: powershell -NoProfile -File E:\AI\dsh-jiadaizi-like-pet\set-pet-mode.ps1 <mode>
# mode: idle / working / review / waiting / failed / celebrating
param([Parameter(Position=0)][string]$Mode = "idle")

$valid = @('idle','working','review','waiting','failed','celebrating')
if ($valid -notcontains $Mode) {
    Write-Output "invalid mode: $Mode"
    exit 1
}
try {
    $body = @{ mode = $Mode } | ConvertTo-Json -Compress
    $r = Invoke-WebRequest -Uri "http://127.0.0.1:8999/jiadaizi-pet/set-mode" -Method POST -Body $body -ContentType "application/json" -UseBasicParsing -TimeoutSec 3
    Write-Output $r.Content
} catch {
    # pet not running, skip silently
}
