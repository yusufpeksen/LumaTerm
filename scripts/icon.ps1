Add-Type -AssemblyName System.Drawing
$assetDirectory = Join-Path $PSScriptRoot '..\assets'
New-Item -ItemType Directory -Path $assetDirectory -Force | Out-Null
$bitmap = New-Object System.Drawing.Bitmap 256,256
$graphics = [System.Drawing.Graphics]::FromImage($bitmap)
$graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
$graphics.Clear([System.Drawing.Color]::FromArgb(22,25,32))
$pen = New-Object System.Drawing.Pen ([System.Drawing.Color]::FromArgb(139,156,255)),18
$pen.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
$pen.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
$graphics.DrawLine($pen,62,80,112,128)
$graphics.DrawLine($pen,112,128,62,176)
$graphics.DrawLine($pen,139,178,197,178)
$bitmap.Save((Join-Path $assetDirectory 'icon.png'),[System.Drawing.Imaging.ImageFormat]::Png)
$icon = [System.Drawing.Icon]::FromHandle($bitmap.GetHicon())
$stream = [System.IO.File]::Create((Join-Path $assetDirectory 'icon.ico'))
$icon.Save($stream)
$stream.Dispose()
$icon.Dispose()
$pen.Dispose()
$graphics.Dispose()
$bitmap.Dispose()
