function replaceInFile {
    param (
        [string]$file,
        [array]$replace
    )

    if (-Not (Test-Path -Path $file -PathType Leaf)) {
        Write-Error "File does not exist: $file"
        exit 1
    }

    $lines = Get-Content -Path $file
    foreach ($r in $replace) {
        if ($null -eq $r.replace) {
            $lines = $lines | Where-Object { $_ -notmatch [regex]::Escape($r.find) }
        }
        else {
            $lines = $lines | ForEach-Object { $_ -replace [regex]::Escape($r.find), $r.replace }
        }
    }

    Set-Content -Path $file -Value $lines
    Write-Host "Replacements completed for $file"
}
function updateBuildNumber {
    param (
        [string]$version
    )
    $parts = $version -split '\.'
    if ($parts.Length -ne 4) {
        Write-Error "Version string must have 4 parts (e.g., 1.2.3.4)"
        exit 1
    }
    $parts[3] = ([int]$parts[3] + 1).ToString()
    return ($parts -join '.')
}

function copyFiles {
    param (
        [string[]]$files,
        [string]$destination
    )

    if (-Not (Test-Path -Path $destination)) {
        Write-Error "Destination folder does not exist: $destination"
        exit 1
    }

    foreach ($file in $files) {
        if (Test-Path -Path $file -PathType Leaf) {
            Copy-Item -Path $file -Destination $destination -Force
            Write-Host "Copied file: $file to $destination"
        }
        else {
            Write-Error "File does not exist: $file"
            exit 1
        }
    }
}

function deleteFolder {
    param (
        [string]$folderPath
    )
    if (Test-Path -Path $folderPath -PathType Container) {
        Remove-Item -Path $folderPath -Recurse -Force
        Write-Host "Deleted folder and its contents: $folderPath"
    }
    else {
        Write-Error "Folder does not exist: $folderPath"
        exit 1
    }
}

function folderExists {
    param (
        [string]$folderPath
    )
    return Test-Path -Path $folderPath -PathType Container
}

function createFolder {
    param (
        [string]$folderPath
    )

    if (-Not (Test-Path -Path $folderPath)) {
        New-Item -ItemType Directory -Path $folderPath | Out-Null
        Write-Host "Created folder: $folderPath"
    }
    else {
        Write-Error "Folder already exists: $folderPath"
        exit 1
    }
}

function copyFolder {
    param (
        [string]$source,
        [string]$destination,
        [string[]]$excludeFolders = @()
    )

    if (-Not (Test-Path -Path $source)) {
        Write-Error "Source folder does not exist: $source"
        exit 1
    }

    if (-Not (Test-Path -Path $destination)) {
        New-Item -ItemType Directory -Path $destination | Out-Null
    }

    $excludeSet = @{}
    foreach ($folder in $excludeFolders) {
        $excludeSet[$folder] = $true
    }

    $items = Get-ChildItem -Path $source -Force
    foreach ($item in $items) {
        if ($item.PSIsContainer -and $excludeSet.ContainsKey($item.Name)) {
            Write-Host "Excluded folder: $($item.FullName)"
            continue
        }
        $destPath = Join-Path $destination $item.Name
        Copy-Item -Path $item.FullName -Destination $destPath -Recurse -Force
    }
    Write-Host "Copied folder from '$source' to '$destination'"
}

function updateVersionBuildNumber {
    param (
        [string]$versionFile
    )

    if (Test-Path -Path $versionFile) {
        $versionContent = Get-Content -Path $versionFile | ConvertFrom-Json
        $newVersion = updateBuildNumber $versionContent.version
        $versionContent.version = $newVersion
        $versionContent | ConvertTo-Json -Depth 10 | Set-Content -Path $versionFile
        Write-Host "Updated version to: $newVersion"
        return $newVersion
    }
    else {
        Write-Error "Version file does not exist: $versionFile"
        exit 1
    }
}

function main {
    $packageName = "stocksprite"
    $tempPath = "./temp"
    $appPath = "../app"
    $appFolderName = [System.IO.Path]::GetFileName($appPath)
    $scriptsPath = "./scripts"
    $containersPath = "../containers"
    $containersFolderName = [System.IO.Path]::GetFileName($containersPath)
    $scriptsContainersAppPath = Join-Path $scriptsPath (Join-Path $containersFolderName $appFolderName)
    $tempContainersPath = Join-Path $tempPath $containersFolderName
    $tempContainersAppPath = Join-Path $tempContainersPath $appFolderName
    $tempContainersAppSourcePath = Join-Path $tempContainersAppPath $appFolderName
    $versionFilePath = "$appPath/version.json"

    # Clean temp folder
    if (folderExists $tempPath) { deleteFolder $tempPath }
    createFolder $tempPath

    # Update version number
    $version = updateVersionBuildNumber $versionFilePath

    # Copy containers folder
    Write-Host "Copy: $containersPath -> $tempContainersPath"
    copyFolder $containersPath $tempContainersPath @()

    # Copy app folder (excluding some folders)
    Write-Host "Copy: $appPath -> $tempContainersAppSourcePath (excluding node_modules, dist, logs, .vscode)"
    copyFolder $appPath $tempContainersAppSourcePath @("node_modules", "dist", "logs", ".vscode")

    # Copy root-level files
    $rootFiles = @(
        "../docker-compose.yaml"
    )
    copyFiles $rootFiles $tempPath

    # Replace in docker-compose.yaml
    $replacePatterns = @(
        @{ find = "./app/logs"; replace = "./containers/app/logs" },
        @{ find = "./app:/app"; replace = $null },
        @{ find = "./app/test-data:/app/dist/test-data"; replace = "./containers/app/app/test-data:/app/test-data" },
        @{ find = "./app/secrets:/run/secrets:ro"; replace = "./containers/app/app/secrets:/run/secrets:ro" },
        @{ find = "command: top"; replace = $null }
    )
    replaceInFile (Join-Path $tempPath "docker-compose.yaml") $replacePatterns

    # Copy app container files
    copyFolder $scriptsContainersAppPath $tempContainersAppPath

    $replacePatterns = @(
        @{ find = 'LABEL stocksprite-version="1.0.0"'; replace = "LABEL stocksprite-version=`"$($version)`"" }
    )
    replaceInFile (Join-Path $tempContainersAppPath "dockerfile") $replacePatterns

    # Pack the folder
    $zipFilePath = "$tempPath/$packageName.$version.zip"
    if (Test-Path -Path $zipFilePath) {
        Remove-Item -Path $zipFilePath -Force
    }
    Compress-Archive -Path "$tempPath/*" -DestinationPath $zipFilePath -Force
    Write-Host "Package file created successfully: $zipFilePath"
}

main