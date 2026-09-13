Add-Type -AssemblyName System.Drawing

$srcPath = "C:\Users\KHUZAIMA\.gemini\antigravity-ide\brain\cb6ef31c-f2c9-46cf-ad8f-9fe395562b8f\ai_qa_agent_icon_1789250052316.jpg"

if (-not (Test-Path $srcPath)) {
    Write-Error "Source image not found at $srcPath"
    exit 1
}

$img = [System.Drawing.Image]::FromFile($srcPath)
$targetDirs = @(
    "c:\Users\KHUZAIMA\Desktop\personal\extension-qa\public\icons",
    "c:\Users\KHUZAIMA\Desktop\personal\extension-qa\dist\icons"
)
$sizes = @(16, 32, 48, 128)

foreach ($dir in $targetDirs) {
    if (-not (Test-Path $dir)) {
        New-Item -ItemType Directory -Path $dir -Force | Out-Null
    }
    foreach ($size in $sizes) {
        $bmp = New-Object System.Drawing.Bitmap($size, $size)
        $g = [System.Drawing.Graphics]::FromImage($bmp)
        $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
        $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
        $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
        $g.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
        $g.DrawImage($img, 0, 0, $size, $size)
        $g.Dispose()

        $outputPath = Join-Path $dir "icon-$size.png"
        $bmp.Save($outputPath, [System.Drawing.Imaging.ImageFormat]::Png)
        $bmp.Dispose()
        Write-Host "Created: $outputPath"
    }
}

$img.Dispose()
Write-Host "All icons resized and saved successfully."
