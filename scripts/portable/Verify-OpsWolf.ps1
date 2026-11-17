# The CMD launcher embeds these same readable commands. Explicit semicolons and
# single-quoted strings keep that command safe without eval or policy changes.
$ErrorActionPreference = 'Stop';
if ([string]::IsNullOrWhiteSpace($PSScriptRoot)) { $packageRoot = $env:OPSWOLF_PORTABLE_ROOT; } else { $packageRoot = $PSScriptRoot; }

function Assert-RegularPath([string]$Path, [bool]$File) {
    $item = Get-Item -LiteralPath $Path -Force;
    if ($File -and $item.PSIsContainer) { throw ('Expected a file: ' + $Path); }
    while ($null -ne $item) {
        if (($item.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) { throw ('Linked paths are not supported: ' + $item.FullName); }
        if ($item.PSIsContainer) { $item = $item.Parent; } else { $item = $item.Directory; }
    }
}

try {
    if ([string]::IsNullOrWhiteSpace($packageRoot)) { throw 'Package root is missing.'; }
    Assert-RegularPath $packageRoot $false;
    $manifestPath = Join-Path $packageRoot 'portable-manifest.json';
    Assert-RegularPath $manifestPath $true;
    $manifest = Get-Content -LiteralPath $manifestPath -Raw -Encoding UTF8 | ConvertFrom-Json;
    if ($manifest.formatVersion -ne 1 -or $manifest.product -ne 'OpsWolf' -or $manifest.platform -ne 'windows-x64' -or @($manifest.files).Count -lt 10 -or @($manifest.files).Count -gt 4096) { throw 'Invalid portable manifest.'; }
    $seen = @{};
    foreach ($file in $manifest.files) {
        $relativePath = [string]$file.path;
        if ([string]::IsNullOrWhiteSpace($relativePath) -or $relativePath -match '[\\<>:\x22|?*\x00-\x1f]' -or $relativePath.StartsWith('/')) { throw 'Invalid manifest path.'; }
        foreach ($part in $relativePath.Split('/')) {
            if ([string]::IsNullOrEmpty($part) -or $part -eq '.' -or $part -eq '..' -or $part -match '[. ]$' -or $part -match '^(con|prn|aux|nul|com[0-9]|lpt[0-9])(?:\.|$)') { throw 'Unsafe manifest path.'; }
        }
        if ($seen.ContainsKey($relativePath)) { throw 'Duplicate manifest path.'; }
        $seen[$relativePath] = $true;
        if ($file.sha256 -notmatch '^[a-f0-9]{64}$' -or $file.size -le 0) { throw 'Invalid manifest hash or size.'; }
        $path = Join-Path $packageRoot $relativePath;
        Assert-RegularPath $path $true;
        if ((Get-Item -LiteralPath $path).Length -ne $file.size) { throw ('Package integrity check failed: ' + $relativePath); }
        $hashStream = [IO.File]::OpenRead($path); $hasher = [Security.Cryptography.SHA256]::Create();
        try { $actualHash = [BitConverter]::ToString($hasher.ComputeHash($hashStream)).Replace('-','').ToLowerInvariant(); } finally { $hasher.Dispose(); $hashStream.Dispose(); }
        if ($actualHash -ne $file.sha256) { throw ('Package integrity check failed: ' + $relativePath); }
    }
    foreach ($required in @('code-codex.exe', 'code-codex-launcher.exe', 'explorer.js', 'storage-layout.json', 'Launch OpsWolf.cmd', 'Verify-OpsWolf.ps1')) {
        if (-not $seen.ContainsKey($required)) { throw ('Manifest is missing required file: ' + $required); }
    }
    $marker = Get-Content -LiteralPath (Join-Path $packageRoot 'storage-layout.json') -Raw -Encoding UTF8 | ConvertFrom-Json;
    if ($marker.schema -ne 1 -or $marker.product -ne 'Code-Codex') { throw 'Invalid portable storage marker.'; }
    Write-Output ('Verified ' + $manifest.files.Count + ' files for OpsWolf ' + $manifest.version + ', portable revision ' + $manifest.packageRevision + '.');
    Write-Output 'This checks file integrity, not publisher identity or Codex compatibility.';
    exit 0;
}
catch {
    [Console]::Error.WriteLine('OpsWolf verification failed: ' + $_.Exception.Message);
    exit 1;
}
