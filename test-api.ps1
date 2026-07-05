# ============================================================
#  NETMED — Test automatico di TUTTE le API
#  Uso:  .\test-api.ps1 -Email "tuo@email.it" -Password "tuapassword"
#  Opz:  -Base "http://localhost:3000"  (default)
# ============================================================
param(
  [string]$Base = "http://localhost:3000",
  [string]$Email,
  [string]$Password,
  [string]$AdminEmail,
  [string]$AdminPassword
)

if (-not $Email) {
  $Email = Read-Host "Email utente"
}
if (-not $Password) {
  $pw = Read-Host "Password utente" -AsSecureString
  $Password = [Runtime.InteropServices.Marshal]::PtrToStringAuto(
    [Runtime.InteropServices.Marshal]::SecureStringToBSTR($pw))
}

$results = @()
$total = 0; $ok = 0; $fail = 0

function Test-Endpoint {
  param(
    [string]$Name,
    [string]$Method,
    [string]$Path,
    [string]$Token,
    [string]$Body,
    [int[]]$ExpectedStatus = @(200, 201, 204)
  )
  $script:total++
  $url = "$Base$Path"
  $headers = @{}
  if ($Token) { $headers["Authorization"] = "Bearer $Token" }
  if ($Body)  { $headers["Content-Type"]  = "application/json" }

  try {
    $resp = Invoke-WebRequest -Uri $url -Method $Method -Headers $headers `
              -Body $Body -UseBasicParsing -ErrorAction Stop -TimeoutSec 8
    $status = $resp.StatusCode
  } catch {
    $status = if ($_.Exception.Response) { [int]$_.Exception.Response.StatusCode } else { 0 }
  }

  if ($ExpectedStatus -contains $status) {
    $script:ok++
    Write-Host ("  [OK ] {0,3}  {1,-7} {2}" -f $status, $Method, $Path) -ForegroundColor Green
    $script:results += [PSCustomObject]@{ Name=$Name; Method=$Method; Path=$Path; Status=$status; OK=$true }
  } else {
    $script:fail++
    Write-Host ("  [KO ] {0,3}  {1,-7} {2}" -f $status, $Method, $Path) -ForegroundColor Red
    $script:results += [PSCustomObject]@{ Name=$Name; Method=$Method; Path=$Path; Status=$status; OK=$false }
  }
}

Write-Host ""
Write-Host "===========================================" -ForegroundColor Cyan
Write-Host " NETMED API TEST — $Base" -ForegroundColor Cyan
Write-Host "===========================================" -ForegroundColor Cyan
Write-Host ""

# ---- 1) Health pubblici (no auth)
Write-Host "[1] Endpoint pubblici" -ForegroundColor Yellow
Test-Endpoint "version"     "GET" "/api/__version"
Test-Endpoint "home"        "GET" "/api/user/home"
Test-Endpoint "categories"  "GET" "/api/user/categories"
Test-Endpoint "tags"        "GET" "/api/user/tags?limit=10"
Test-Endpoint "explore"     "GET" "/api/user/explore"
Test-Endpoint "search-q"    "GET" "/api/user/search?q=cuore"
Test-Endpoint "search-sort" "GET" "/api/user/search?sort=views"

# ---- 2) Login (richiesto per i restanti test)
Write-Host ""
Write-Host "[2] Login utente: $Email" -ForegroundColor Yellow
$loginBody = @{ email=$Email; password=$Password } | ConvertTo-Json
try {
  $r = Invoke-RestMethod -Method Post -Uri "$Base/api/auth/login" `
         -ContentType "application/json" -Body $loginBody -TimeoutSec 8
  $TOKEN = $r.token
  $userId = $r.user.id
  $role   = $r.user.role
  Write-Host "  [OK ] login: $($r.user.username) ($role) - token len=$($TOKEN.Length)" -ForegroundColor Green
  $ok++
  $total++
} catch {
  Write-Host "  [FATAL] login fallito: $($_.Exception.Message)" -ForegroundColor Red
  Write-Host "  Non posso testare gli endpoint autenticati. Esco." -ForegroundColor Red
  exit 1
}

# ---- 3) Dati personali utente
Write-Host ""
Write-Host "[3] Profilo personale" -ForegroundColor Yellow
Test-Endpoint "auth/me"          "GET" "/api/auth/me"                  $TOKEN
Test-Endpoint "user/me"          "GET" "/api/user/me"                  $TOKEN
Test-Endpoint "user/me/history"  "GET" "/api/user/me/history"          $TOKEN
Test-Endpoint "user/me/comments" "GET" "/api/user/me/comments"         $TOKEN
Test-Endpoint "notifications"    "GET" "/api/user/me/notifications"    $TOKEN
Test-Endpoint "notif-unread"     "GET" "/api/user/me/notifications/unread-count" $TOKEN

# ---- 4) Preferiti & cartelle
Write-Host ""
Write-Host "[4] Preferiti e cartelle" -ForegroundColor Yellow
Test-Endpoint "favorites"   "GET" "/api/user/favorites"   $TOKEN
Test-Endpoint "collections" "GET" "/api/user/collections" $TOKEN

# ---- 5) Recupera un video reale per testare i dettagli
Write-Host ""
Write-Host "[5] Cerco un video di esempio nel DB..." -ForegroundColor Yellow
try {
  $h = Invoke-RestMethod -Uri "$Base/api/user/explore" -TimeoutSec 8
  $videoId = $null
  if ($h.videos -and $h.videos.Count -gt 0) {
    $videoId = $h.videos[0].id
  } elseif ($h -is [System.Collections.IEnumerable] -and $h.Count -gt 0) {
    $videoId = $h[0].id
  }
  if (-not $videoId) {
    # fallback: prima riga della home
    $home = Invoke-RestMethod -Uri "$Base/api/user/home" -TimeoutSec 8
    if ($home.rows -and $home.rows.Count -gt 0 -and $home.rows[0].videos.Count -gt 0) {
      $videoId = $home.rows[0].videos[0].id
    }
  }
  if ($videoId) {
    Write-Host "  Trovato videoId=$videoId" -ForegroundColor DarkGray
  } else {
    Write-Host "  Nessun video nel DB - skip test video" -ForegroundColor DarkGray
  }
} catch {
  Write-Host "  Errore recupero video: $($_.Exception.Message)" -ForegroundColor DarkGray
  $videoId = $null
}

# ---- 6) Dettaglio video
if ($videoId) {
  Write-Host ""
  Write-Host "[6] Dettaglio video #$videoId" -ForegroundColor Yellow
  Test-Endpoint "video-detail"   "GET" "/api/user/videos/$videoId"
  Test-Endpoint "video-related"  "GET" "/api/user/videos/$videoId/related"
  Test-Endpoint "video-comments" "GET" "/api/user/videos/$videoId/comments"
  Test-Endpoint "video-detail-auth" "GET" "/api/user/videos/$videoId" $TOKEN
}

# ---- 7) Categoria e tag specifici
Write-Host ""
Write-Host "[7] Categorie e tag" -ForegroundColor Yellow
try {
  $cats = Invoke-RestMethod -Uri "$Base/api/user/categories" -TimeoutSec 8
  if ($cats.Count -gt 0) {
    $catId = $cats[0].id
    Test-Endpoint "cat-videos" "GET" "/api/user/categories/$catId/videos"
  }
} catch {}

# ---- 8) Profilo creator pubblico
Write-Host ""
Write-Host "[8] Profilo creator pubblico" -ForegroundColor Yellow
try {
  $tags = Invoke-RestMethod -Uri "$Base/api/user/tags?limit=5" -TimeoutSec 8
  # Provo qualche username noto dal seed
  foreach ($u in @("leo2004", "mario", "admin")) {
    Test-Endpoint "creator-$u"           "GET" "/api/user/creators/$u"           -ExpectedStatus @(200, 404)
    Test-Endpoint "creator-followers-$u" "GET" "/api/user/creators/$u/followers" -ExpectedStatus @(200, 404)
    Test-Endpoint "creator-following-$u" "GET" "/api/user/creators/$u/following" -ExpectedStatus @(200, 404)
  }
} catch {}

# ---- 9) Endpoint creator (solo se utente verificato)
Write-Host ""
Write-Host "[9] Endpoint creator (richiede verified)" -ForegroundColor Yellow
Test-Endpoint "creator-videos" "GET" "/api/creator/videos" $TOKEN -ExpectedStatus @(200, 403)

# ---- 10) Endpoint admin (solo se role=admin)
Write-Host ""
Write-Host "[10] Endpoint admin (richiede role=admin)" -ForegroundColor Yellow
$exp = if ($role -eq "admin") { @(200) } else { @(401, 403) }
Test-Endpoint "admin-stats"    "GET" "/api/admin/stats"        $TOKEN -ExpectedStatus $exp
Test-Endpoint "admin-users"    "GET" "/api/admin/users"        $TOKEN -ExpectedStatus $exp
Test-Endpoint "admin-comments" "GET" "/api/admin/comments"     $TOKEN -ExpectedStatus $exp
Test-Endpoint "admin-reports"  "GET" "/api/admin/reports"      $TOKEN -ExpectedStatus $exp
Test-Endpoint "admin-audit"    "GET" "/api/admin/audit"        $TOKEN -ExpectedStatus $exp
Test-Endpoint "admin-vreq"     "GET" "/api/admin/verification-requests" $TOKEN -ExpectedStatus $exp

# ---- 11) Round-trip commento (write + read + delete)
if ($videoId) {
  Write-Host ""
  Write-Host "[11] Round-trip commento (write/read/delete)" -ForegroundColor Yellow
  $body = @{ content = "Test API automatico - $(Get-Date -Format o)" } | ConvertTo-Json
  try {
    $cr = Invoke-RestMethod -Method Post -Uri "$Base/api/user/videos/$videoId/comments" `
           -Headers @{ "Authorization" = "Bearer $TOKEN" } `
           -ContentType "application/json" -Body $body -TimeoutSec 8
    $newId = $cr.comment.id
    if (-not $newId) { $newId = $cr.id }
    Write-Host "  [OK ] 200  POST    /api/user/videos/$videoId/comments -> id=$newId" -ForegroundColor Green
    $ok++; $total++
    if ($newId) {
      Test-Endpoint "comment-delete" "DELETE" "/api/user/comments/$newId" $TOKEN
    }
  } catch {
    $st = if ($_.Exception.Response) { [int]$_.Exception.Response.StatusCode } else { 0 }
    Write-Host "  [KO ] $st POST commento: $($_.Exception.Message)" -ForegroundColor Red
    $fail++; $total++
  }
}

# ============================================================
# Riepilogo
# ============================================================
Write-Host ""
Write-Host "===========================================" -ForegroundColor Cyan
Write-Host (" RIEPILOGO: {0} totali, {1} OK, {2} FAIL" -f $total, $ok, $fail) -ForegroundColor Cyan
Write-Host "===========================================" -ForegroundColor Cyan

if ($fail -gt 0) {
  Write-Host ""
  Write-Host "Endpoint falliti:" -ForegroundColor Red
  $results | Where-Object { -not $_.OK } | Format-Table Method, Path, Status -AutoSize
}

# Esporto risultati in JSON per audit/tesi
$out = Join-Path (Get-Location) "test-api-results.json"
$results | ConvertTo-Json -Depth 4 | Out-File $out -Encoding utf8
Write-Host ""
Write-Host "Risultati salvati in: $out" -ForegroundColor DarkGray

if ($fail -gt 0) { exit 1 } else { exit 0 }
