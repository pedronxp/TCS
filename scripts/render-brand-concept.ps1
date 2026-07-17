param(
  [string]$Output = "tmp/tcs-brand-concept.png"
)

Add-Type -AssemblyName System.Drawing

$size = 1024
$bitmap = New-Object System.Drawing.Bitmap($size, $size, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
$graphics = [System.Drawing.Graphics]::FromImage($bitmap)
$graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
$graphics.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit

$navy = [System.Drawing.ColorTranslator]::FromHtml('#0B0F19')
$surface = [System.Drawing.ColorTranslator]::FromHtml('#111827')
$blue = [System.Drawing.ColorTranslator]::FromHtml('#3B82F6')
$white = [System.Drawing.ColorTranslator]::FromHtml('#F8FAFC')
$muted = [System.Drawing.ColorTranslator]::FromHtml('#94A3B8')
$risk = @('#10B981', '#F59E0B', '#F97316', '#EF4444') | ForEach-Object { [System.Drawing.ColorTranslator]::FromHtml($_) }

$graphics.Clear($navy)

$frame = New-Object System.Drawing.RectangleF(132, 132, 760, 760)
$path = New-Object System.Drawing.Drawing2D.GraphicsPath
$radius = 176
$diameter = $radius * 2
$path.AddArc($frame.Left, $frame.Top, $diameter, $diameter, 180, 90)
$path.AddArc($frame.Right - $diameter, $frame.Top, $diameter, $diameter, 270, 90)
$path.AddArc($frame.Right - $diameter, $frame.Bottom - $diameter, $diameter, $diameter, 0, 90)
$path.AddArc($frame.Left, $frame.Bottom - $diameter, $diameter, $diameter, 90, 90)
$path.CloseFigure()
$graphics.FillPath((New-Object System.Drawing.SolidBrush($surface)), $path)
$graphics.DrawPath((New-Object System.Drawing.Pen($blue, 24)), $path)

$font = New-Object System.Drawing.Font('Arial', 196, ([System.Drawing.FontStyle]::Bold), [System.Drawing.GraphicsUnit]::Pixel)
$format = New-Object System.Drawing.StringFormat
$format.Alignment = [System.Drawing.StringAlignment]::Center
$format.LineAlignment = [System.Drawing.StringAlignment]::Center
$graphics.DrawString('TCS', $font, (New-Object System.Drawing.SolidBrush($white)), (New-Object System.Drawing.RectangleF(150, 250, 724, 300)), $format)

$barY = 618
$barWidth = 126
$gap = 18
$barX = 242
for ($i = 0; $i -lt 4; $i++) {
  $brush = New-Object System.Drawing.SolidBrush($risk[$i])
  $graphics.FillRectangle($brush, $barX + (($barWidth + $gap) * $i), $barY, $barWidth, 28)
  $brush.Dispose()
}

$captionFont = New-Object System.Drawing.Font('Arial', 30, ([System.Drawing.FontStyle]::Bold), [System.Drawing.GraphicsUnit]::Pixel)
$graphics.DrawString('RELATORIO E RISCO', $captionFont, (New-Object System.Drawing.SolidBrush($muted)), (New-Object System.Drawing.RectangleF(150, 680, 724, 70)), $format)

$resolved = [System.IO.Path]::GetFullPath((Join-Path (Get-Location) $Output))
$directory = [System.IO.Path]::GetDirectoryName($resolved)
[System.IO.Directory]::CreateDirectory($directory) | Out-Null
$bitmap.Save($resolved, [System.Drawing.Imaging.ImageFormat]::Png)

$font.Dispose()
$captionFont.Dispose()
$format.Dispose()
$path.Dispose()
$graphics.Dispose()
$bitmap.Dispose()

Write-Output $resolved
