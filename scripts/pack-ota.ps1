[Reflection.Assembly]::LoadWithPartialName("System.IO.Compression") | Out-Null
[Reflection.Assembly]::LoadWithPartialName("System.IO.Compression.FileSystem") | Out-Null

$zipFile = Join-Path (Get-Location) "ota-bundle.zip"
if (Test-Path $zipFile) { Remove-Item $zipFile -Force }

$distDir = (Get-Item "dist").FullName
$archive = [System.IO.Compression.ZipFile]::Open($zipFile, [System.IO.Compression.ZipArchiveMode]::Create)

Get-ChildItem -Path "dist" -Recurse | Where-Object { -not $_.PSIsContainer } | ForEach-Object {
    $rel = $_.FullName.Substring($distDir.Length + 1).Replace("\", "/")
    [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile($archive, $_.FullName, $rel) | Out-Null
}

$archive.Dispose()
Write-Host "Created ota-bundle.zip with forward-slash paths successfully."
