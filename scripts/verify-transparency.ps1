Add-Type -AssemblyName System.Drawing
$bmp = [System.Drawing.Bitmap]::FromFile('c:\Users\KHUZAIMA\Desktop\personal\extension-qa\public\icons\icon-128.png')
Write-Host "Corner (0,0): $($bmp.GetPixel(0,0))"
Write-Host "Corner (127,0): $($bmp.GetPixel(127,0))"
Write-Host "Corner (0,127): $($bmp.GetPixel(0,127))"
Write-Host "Corner (127,127): $($bmp.GetPixel(127,127))"
Write-Host "Center (64,64): $($bmp.GetPixel(64,64))"
$bmp.Dispose()
