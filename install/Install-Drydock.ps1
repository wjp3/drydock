# Install Drydock on Windows 10 or 11.
#
# What it does, in order, skipping anything already present:
#   1. git            2. Node.js LTS        3. GitHub's command-line tool (gh)      4. The Claude desktop app (opens the download page)
#   5. Claude Code's command-line tool      6. The Drydock plugin from github.com/wjp3/drydock
#   7. A Builds folder with a START HERE note                8. Sign-in to GitHub, in your browser
#
# It never asks for a password itself. Windows may show its "allow this app to make changes" prompt when a program is installed,
# and every sign-in happens in your browser. Safe to run more than once.
#
# Run it: right-click Install-Drydock.bat and choose "Run as administrator",
# or in PowerShell:  irm https://raw.githubusercontent.com/wjp3/drydock/v0.1.0/install/Install-Drydock.ps1 | iex
param([switch]$DryRun, [switch]$Yes)

$ErrorActionPreference = "Continue"
$Repo = "wjp3/drydock"
$Builds = Join-Path $HOME "Builds"

function Bold($t) { Write-Host ""; Write-Host $t -ForegroundColor Cyan }
function Note($t) { Write-Host "   $t" }
function Have($cmd) { return [bool](Get-Command $cmd -ErrorAction SilentlyContinue) }
function RefreshPath { $env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User") + ";" + (Join-Path $HOME ".local\bin") }
function Pause-Unless { if (-not $Yes -and -not $DryRun) { Read-Host "   Press Enter to continue (or close this window to stop)" | Out-Null } }
function Winget-Install($id, $label) {
  if ($DryRun) { Note "(dry run) winget install -e --id $id"; return }
  if (-not (Have "winget")) { Note "winget is missing. Install '$label' by hand from its website, then run this again."; return }
  winget install -e --id $id --accept-source-agreements --accept-package-agreements --silent | Out-Null
  RefreshPath
}

Bold "Drydock installer"
Note "This sets up this computer to build with Claude Code and Drydock. It takes 10 to 20 minutes."
Note "Windows may ask you to allow a program to make changes. That is normal."
Pause-Unless

Bold "1 of 8: git"
if (Have "git") { Note "git is already here: $(git --version)" } else { Note "Installing git ..."; Winget-Install "Git.Git" "git" }

Bold "2 of 8: Node.js (version 20 or newer)"
$nodeOk = $false
if (Have "node") { $v = (node --version) -replace "^v",""; if ([int]($v.Split(".")[0]) -ge 20) { $nodeOk = $true; Note "Node is already here: v$v" } }
if (-not $nodeOk) { Note "Installing Node LTS ..."; Winget-Install "OpenJS.NodeJS.LTS" "Node.js" }

Bold "3 of 8: GitHub's command-line tool (gh)"
if (Have "gh") { Note "gh is already here: $((gh --version)[0])" } else { Note "Installing gh ..."; Winget-Install "GitHub.cli" "GitHub CLI" }

Bold "4 of 8: the Claude desktop app"
$claudeApp = Join-Path $env:LOCALAPPDATA "AnthropicClaude"
if (Test-Path $claudeApp) { Note "The Claude app is installed." }
else {
  Note "Opening the download page. Install the app, open it, sign in, then come back here."
  if (-not $DryRun) { Start-Process "https://claude.com/download"; Read-Host "   Press Enter once the Claude app is installed and signed in" | Out-Null }
}

Bold "5 of 8: Claude Code's command-line tool"
if (Have "claude") { Note "Claude Code is already here: $(claude --version 2>$null)" }
else {
  Note "Installing Claude Code from claude.ai ..."
  if ($DryRun) { Note "(dry run) irm https://claude.ai/install.ps1 | iex" } else { Invoke-RestMethod https://claude.ai/install.ps1 | Invoke-Expression; RefreshPath }
  if (-not $DryRun -and -not (Have "claude")) { Note "Claude Code did not install. Open a new PowerShell window and run this installer again."; exit 1 }
}

Bold "6 of 8: the Drydock plugin"
if ($DryRun) { Note "(dry run) claude plugin marketplace add $Repo; claude plugin install drydock@drydock" }
else {
  $mp = (claude plugin marketplace list 2>$null | Out-String)
  if ($mp -match "drydock") { Note "The Drydock marketplace is already added." } else { claude plugin marketplace add $Repo }
  $pl = (claude plugin list 2>$null | Out-String)
  if ($pl -match "drydock@drydock") { Note "Drydock is already installed." } else { claude plugin install drydock@drydock }
  (claude plugin list 2>$null | Out-String) -split "`n" | Where-Object { $_ -match "drydock|Version|Scope|Status" } | ForEach-Object { Note $_.Trim() }
}

Bold "7 of 8: a Builds folder"
if (-not $DryRun) {
  New-Item -ItemType Directory -Force -Path (Join-Path $Builds "my-first-build") | Out-Null
  @"
START HERE

1. Open the Claude app. Click the Code tab. Open the folder  Builds \ my-first-build  (or any folder you make in Builds).
2. In the message box, type:   /drydock:setup     and press Enter. Answer the four questions.
3. Then type:   /drydock:plan     and describe what you want to build, in your own words.
4. Then type:   /drydock:build S0     and watch. When it stops and shows you, try it. Say   next   to continue.
5. When you stop for the day, type:   /drydock:handoff     When you come back, type:   /drydock:wake

Three sentences worth remembering:
   "Show me the evidence."      when something is called done
   "Stop and tell me what's blocking."      when it keeps trying the same thing
   "Handoff."      when the conversation has gotten long or confused (then open a fresh session and type /drydock:wake)

The playbook PDF explains everything else. Nothing goes live without your yes.
"@ | Set-Content -Path (Join-Path $Builds "START HERE.txt") -Encoding UTF8
}
Note "Folder: $Builds (with a START HERE note)"

Bold "8 of 8: sign-in to GitHub (in your browser)"
if ($DryRun) { Note "(dry run) gh auth login --web" }
else {
  gh auth status 2>$null | Out-Null
  if ($LASTEXITCODE -eq 0) { Note "GitHub: already signed in." }
  else { Note "A code will appear below and your browser will open. Sign in to GitHub (create a free account first at github.com if you have none), paste the code, click Authorize."; gh auth login --web --git-protocol https }
}

Bold "Done."
Note "Next: open the Claude app, click Code, open the folder Builds\my-first-build, and type  /drydock:setup"
Note "If /drydock:setup is not offered, type  /plugin marketplace add $Repo  then  /plugin install drydock@drydock  in the message box once."
if (-not $Yes -and -not $DryRun) { Read-Host "   Press Enter to close" | Out-Null }
