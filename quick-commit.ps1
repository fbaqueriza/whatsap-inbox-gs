Set-ItemProperty -Path 'HKCU:\Software\Setup' -Name 'enabled' -Value $false
$env:GIT_MERGE_AUTOEDIT='no'
$env:EDITOR='echo'

git add .
git commit -m "Fix: Environment variables validation"
git push origin HEAD --quiet

Write-Host "Commit completed"
