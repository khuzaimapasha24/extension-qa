Add-Type -AssemblyName System.Drawing
$bmp = [System.Drawing.Bitmap]::FromFile('C:\Users\KHUZAIMA\.gemini\antigravity-ide\brain\cb6ef31c-f2c9-46cf-ad8f-9fe395562b8f\ai_qa_agent_icon_1789250052316.jpg')
Write-Host "Dimensions: $($bmp.Width) x $($bmp.Height)"
Write-Host "Top-Left: $($bmp.GetPixel(5, 5))"
Write-Host "Top-Right: $($bmp.GetPixel($bmp.Width - 6, 5))"
Write-Host "Bottom-Left: $($bmp.GetPixel(5, $bmp.Height - 6))"
Write-Host "Bottom-Right: $($bmp.GetPixel($bmp.Width - 6, $bmp.Height - 6))"
Write-Host "Edge-Middle-Left: $($bmp.GetPixel(5, [int]($bmp.Height / 2)))"
Write-Host "Edge-Middle-Top: $($bmp.GetPixel([int]($bmp.Width / 2), 5))"
$bmp.Dispose()
