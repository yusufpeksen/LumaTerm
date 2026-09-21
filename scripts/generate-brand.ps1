Add-Type -AssemblyName System.Drawing
$canvas = New-Object System.Drawing.Bitmap 256,256
$graphics = [System.Drawing.Graphics]::FromImage($canvas)
$graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
$graphics.Clear([System.Drawing.Color]::Transparent)
$background = New-Object System.Drawing.Drawing2D.GraphicsPath
$r = [System.Drawing.Rectangle]::new(10,10,236,236)
$radius = 57
$background.AddArc($r.X,$r.Y,$radius,$radius,180,90)
$background.AddArc($r.Right-$radius,$r.Y,$radius,$radius,270,90)
$background.AddArc($r.Right-$radius,$r.Bottom-$radius,$radius,$radius,0,90)
$background.AddArc($r.X,$r.Bottom-$radius,$radius,$radius,90,90)
$background.CloseFigure()
$baseBrush = New-Object System.Drawing.Drawing2D.LinearGradientBrush([System.Drawing.Point]::new(10,10),[System.Drawing.Point]::new(246,246),[System.Drawing.ColorTranslator]::FromHtml('#222d42'),[System.Drawing.ColorTranslator]::FromHtml('#101620'))
$graphics.FillPath($baseBrush,$background)
$outline = New-Object System.Drawing.Pen ([System.Drawing.ColorTranslator]::FromHtml('#607591')),2
$graphics.DrawPath($outline,$background)
$glyphBrush = New-Object System.Drawing.Drawing2D.LinearGradientBrush([System.Drawing.Point]::new(65,70),[System.Drawing.Point]::new(198,185),[System.Drawing.ColorTranslator]::FromHtml('#62e2d1'),[System.Drawing.ColorTranslator]::FromHtml('#ad8ef6'))
$glyph = [System.Drawing.Point[]]@([System.Drawing.Point]::new(65,73),[System.Drawing.Point]::new(109,73),[System.Drawing.Point]::new(164,128),[System.Drawing.Point]::new(109,183),[System.Drawing.Point]::new(65,183),[System.Drawing.Point]::new(120,128))
$graphics.FillPolygon($glyphBrush,$glyph)
$cutout = [System.Drawing.Point[]]@([System.Drawing.Point]::new(94,92),[System.Drawing.Point]::new(111,92),[System.Drawing.Point]::new(147,128),[System.Drawing.Point]::new(111,164),[System.Drawing.Point]::new(94,164),[System.Drawing.Point]::new(130,128))
$cutoutBrush = New-Object System.Drawing.SolidBrush ([System.Drawing.ColorTranslator]::FromHtml('#101620'))
$graphics.FillPolygon($cutoutBrush,$cutout)
$linePen = New-Object System.Drawing.Pen $glyphBrush,17
$linePen.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
$linePen.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
$graphics.DrawLine($linePen,156,177,198,177)
$pngPath = Join-Path $PSScriptRoot '..\assets\icon.png'
$icoPath = Join-Path $PSScriptRoot '..\assets\icon.ico'
$canvas.Save($pngPath,[System.Drawing.Imaging.ImageFormat]::Png)
$graphics.Dispose(); $canvas.Dispose()
$bytes = [System.IO.File]::ReadAllBytes($pngPath)
$ico = New-Object byte[] (22+$bytes.Length)
$ico[2]=1; $ico[4]=1; $ico[10]=1; $ico[12]=32
[BitConverter]::GetBytes([uint32]$bytes.Length).CopyTo($ico,14)
[BitConverter]::GetBytes([uint32]22).CopyTo($ico,18)
[Array]::Copy($bytes,0,$ico,22,$bytes.Length)
[System.IO.File]::WriteAllBytes($icoPath,$ico)
