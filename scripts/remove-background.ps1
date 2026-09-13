Add-Type -AssemblyName System.Drawing

$src = "C:\Users\KHUZAIMA\.gemini\antigravity-ide\brain\cb6ef31c-f2c9-46cf-ad8f-9fe395562b8f\ai_qa_agent_icon_1789250052316.jpg"
$outPng = "C:\Users\KHUZAIMA\.gemini\antigravity-ide\brain\cb6ef31c-f2c9-46cf-ad8f-9fe395562b8f\ai_qa_agent_icon_transparent.png"

$orig = [System.Drawing.Bitmap]::FromFile($src)
$w = $orig.Width
$h = $orig.Height

# Create 32-bit ARGB bitmap
$transparentBmp = New-Object System.Drawing.Bitmap($w, $h, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)

# Lock bits for high-speed direct memory processing
$rect = New-Object System.Drawing.Rectangle(0, 0, $w, $h)
$srcData = $orig.LockBits($rect, [System.Drawing.Imaging.ImageLockMode]::ReadOnly, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
$dstData = $transparentBmp.LockBits($rect, [System.Drawing.Imaging.ImageLockMode]::WriteOnly, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)

$byteCount = [Math]::Abs($srcData.Stride) * $h
$srcBytes = New-Object byte[] $byteCount
$dstBytes = New-Object byte[] $byteCount

[System.Runtime.InteropServices.Marshal]::Copy($srcData.Scan0, $srcBytes, 0, $byteCount)

# Flood fill from boundaries:
# First identify all outer background pixels using BFS
# State array: 0 = unvisited, 1 = background (transparent), 2 = foreground / edge
$visited = New-Object 'int[,]' $w, $h
$queueX = New-Object System.Collections.Generic.Queue[int]
$queueY = New-Object System.Collections.Generic.Queue[int]

# Background luminance threshold:
# Below $lowLum = purely background (alpha = 0)
# Between $lowLum and $highLum = anti-aliased edge
$lowLum = 25.0
$highLum = 75.0

# Add all perimeter pixels to queue
for ($x = 0; $x -lt $w; $x++) {
    $queueX.Enqueue($x); $queueY.Enqueue(0); $visited[$x, 0] = 1
    $queueX.Enqueue($x); $queueY.Enqueue($h - 1); $visited[$x, $h - 1] = 1
}
for ($y = 1; $y -lt $h - 1; $y++) {
    $queueX.Enqueue(0); $queueY.Enqueue($y); $visited[0, $y] = 1
    $queueX.Enqueue($w - 1); $queueY.Enqueue($y); $visited[$w - 1, $y] = 1
}

$stride = $srcData.Stride

# Breadth-first search
while ($queueX.Count -gt 0) {
    $cx = $queueX.Dequeue()
    $cy = $queueY.Dequeue()

    # Neighbors: 4-connected
    $nxArr = @($cx - 1, $cx + 1, $cx, $cx)
    $nyArr = @($cy, $cy, $cy - 1, $cy + 1)

    for ($i = 0; $i -lt 4; $i++) {
        $nx = $nxArr[$i]
        $ny = $nyArr[$i]

        if ($nx -ge 0 -and $nx -lt $w -and $ny -ge 0 -and $ny -lt $h) {
            if ($visited[$nx, $ny] -eq 0) {
                $idx = ($ny * $stride) + ($nx * 4)
                $b = $srcBytes[$idx]
                $g = $srcBytes[$idx + 1]
                $r = $srcBytes[$idx + 2]
                $lum = 0.299 * $r + 0.587 * $g + 0.114 * $b

                if ($lum -lt $highLum) {
                    $visited[$nx, $ny] = 1
                    $queueX.Enqueue($nx)
                    $queueY.Enqueue($ny)
                } else {
                    $visited[$nx, $ny] = 2 # Boundary reached
                }
            }
        }
    }
}

# Now compute destination pixels
for ($y = 0; $y -lt $h; $y++) {
    for ($x = 0; $x -lt $w; $x++) {
        $idx = ($y * $stride) + ($x * 4)
        $b = $srcBytes[$idx]
        $g = $srcBytes[$idx + 1]
        $r = $srcBytes[$idx + 2]

        if ($visited[$x, $y] -eq 1) {
            $lum = 0.299 * $r + 0.587 * $g + 0.114 * $b
            if ($lum -le $lowLum) {
                # Completely transparent
                $dstBytes[$idx] = 0
                $dstBytes[$idx + 1] = 0
                $dstBytes[$idx + 2] = 0
                $dstBytes[$idx + 3] = 0
            } else {
                # Smooth feathering on boundary
                $alphaFraction = ($lum - $lowLum) / ($highLum - $lowLum)
                if ($alphaFraction -gt 1.0) { $alphaFraction = 1.0 }
                if ($alphaFraction -lt 0.0) { $alphaFraction = 0.0 }
                $alpha = [byte](255 * $alphaFraction)

                # Background color compensation (un-premultiply near-black background)
                $bgR = 8.0; $bgG = 2.0; $bgB = 32.0
                $unR = [Math]::Min(255, [Math]::Max(0, [int](($r - $bgR * (1.0 - $alphaFraction)) / [Math]::Max(0.01, $alphaFraction))))
                $unG = [Math]::Min(255, [Math]::Max(0, [int](($g - $bgG * (1.0 - $alphaFraction)) / [Math]::Max(0.01, $alphaFraction))))
                $unB = [Math]::Min(255, [Math]::Max(0, [int](($b - $bgB * (1.0 - $alphaFraction)) / [Math]::Max(0.01, $alphaFraction))))

                $dstBytes[$idx] = [byte]$unB
                $dstBytes[$idx + 1] = [byte]$unG
                $dstBytes[$idx + 2] = [byte]$unR
                $dstBytes[$idx + 3] = $alpha
            }
        } else {
            # Foreground shield / emblem: 100% solid
            $dstBytes[$idx] = $b
            $dstBytes[$idx + 1] = $g
            $dstBytes[$idx + 2] = $r
            $dstBytes[$idx + 3] = 255
        }
    }
}

[System.Runtime.InteropServices.Marshal]::Copy($dstBytes, 0, $dstData.Scan0, $byteCount)

$orig.UnlockBits($srcData)
$transparentBmp.UnlockBits($dstData)

$orig.Dispose()
$transparentBmp.Save($outPng, [System.Drawing.Imaging.ImageFormat]::Png)
$transparentBmp.Dispose()

Write-Host "Transparent image saved to $outPng"
