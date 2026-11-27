<#
.SYNOPSIS
  Commit everything and push the current branch to the same branch on origin,
  using your CyberGen identity for THIS repo only.

.DESCRIPTION
  First run: asks for your @cybergen.ai email and CyberGen GitHub username once and saves them
  in this repo's local git config (global config and other repos are untouched).
  Every run after that:   .\push.ps1          (or  .\push.ps1 "commit message")

  It stages all changes (including untracked files), commits if there is anything new,
  and pushes to origin/<current branch>. It will not push straight to master/main.
#>
param([string]$Message)

$ErrorActionPreference = 'Stop'

function Invoke-Git {
  & git @args
  if ($LASTEXITCODE -ne 0) { throw "git $($args -join ' ') failed (exit $LASTEXITCODE)." }
}

Set-Location $PSScriptRoot
Invoke-Git rev-parse --is-inside-work-tree | Out-Null

# --- One-time setup (saved in .git/config of this repo only) ------------------
$email = git config --local --get user.email
while (-not $email) {
  $email = (Read-Host 'Enter email (you@example.com)').Trim()
}
git config --local user.email $email

$name = git config --local --get user.name
if (-not $name) {
  $name = (Read-Host 'Your name for commits').Trim()
  if ($name) { git config --local user.name $name }
}

$ghUser = git config --local --get credential.https://github.com.username
while (-not $ghUser) {
  $ghUser = (Read-Host 'Your GitHub username').Trim()
}
# Git Credential Manager signs in as this account for this repo (asks once in the browser).
git config --local credential.https://github.com.username $ghUser

# --- Branch -------------------------------------------------------------------
$branch = (git rev-parse --abbrev-ref HEAD).Trim()
if ($branch -in @('master', 'main', 'HEAD')) {
  throw "You are on '$branch'. Make a branch first:  git switch -c feature/my-change  then run .\push.ps1 again."
}

# --- Commit all changes ---------------------------------------------------------
Invoke-Git add -A
git diff --cached --quiet
if ($LASTEXITCODE -ne 0) {
  if (-not $Message) { $Message = "Update $(Get-Date -Format 'yyyy-MM-dd HH:mm')" }
  Write-Host "Committing as $email on '$branch'..."
  Invoke-Git commit -m $Message
} else {
  Write-Host 'Nothing new to commit; pushing existing commits.'
}

# --- Push to the same branch on origin --------------------------------------------
Write-Host "Pushing '$branch' to origin as '$ghUser'..."
Invoke-Git push -u origin "${branch}:${branch}"
Write-Host "Done. Open a pull request for '$branch' on GitHub (or: gh pr create --fill)."
