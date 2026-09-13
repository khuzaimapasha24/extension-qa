Add-Type -AssemblyName System.Drawing

$src = "C:\Users\KHUZAIMA\.gemini\antigravity-ide\brain\cb6ef31c-f2c9-46cf-ad8f-9fe395562b8f\ai_qa_agent_icon_1789250052316.jpg"
$bmp = [System.Drawing.Bitmap]::FromFile($src)
$w = $bmp.Width
$h = $bmp.Height

# Scan from left edge to center at y = h/2
$y = [int]($h / 2)
Write-Host "Horizontal scanline at y = $y from x = 0 to 300:"
for ($x = 0; $x -lt 300; $x += 20) {
    $c = $bmp.GetPixel($x, $y)
    Write-Host "x=$x : R=$($c.R), G=$($c.G), B=$($c.B)"
}

# Scan from top edge to center at x = w/2
$x = [int]($w / 2)
Write-Host "`nVertical scanline at x = $x from y = 0 to 300:"
for ($y = 0; $y -lt 300; $y += 20) {
    $c = $bmp.GetPixel($x, $y)
    Write-Host "y=$y : R=$($c.R), G=$($c.G), B=$($c.B)"
}

$bmp.Dispose()
