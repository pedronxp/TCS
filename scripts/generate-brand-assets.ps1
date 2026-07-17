param([string]$OutputDirectory = "assets/brand")

Add-Type -AssemblyName System.Drawing

$navy = [System.Drawing.ColorTranslator]::FromHtml('#0B0F19')
$surface = [System.Drawing.ColorTranslator]::FromHtml('#111827')
$blue = [System.Drawing.ColorTranslator]::FromHtml('#3B82F6')
$white = [System.Drawing.ColorTranslator]::FromHtml('#F8FAFC')
$risk = @('#10B981', '#F59E0B', '#F97316', '#EF4444') | ForEach-Object { [System.Drawing.ColorTranslator]::FromHtml($_) }
$root = [System.IO.Path]::GetFullPath((Join-Path (Get-Location) $OutputDirectory))
[System.IO.Directory]::CreateDirectory($root) | Out-Null

function New-RoundedPath([System.Drawing.RectangleF]$rect, [float]$radius) {
  $path = New-Object System.Drawing.Drawing2D.GraphicsPath
  $d = $radius * 2
  $path.AddArc($rect.Left, $rect.Top, $d, $d, 180, 90)
  $path.AddArc($rect.Right - $d, $rect.Top, $d, $d, 270, 90)
  $path.AddArc($rect.Right - $d, $rect.Bottom - $d, $d, $d, 0, 90)
  $path.AddArc($rect.Left, $rect.Bottom - $d, $d, $d, 90, 90)
  $path.CloseFigure()
  return $path
}

function Draw-Mark($graphics, [float]$x, [float]$y, [float]$size, [bool]$monochrome = $false) {
  $frame = [System.Drawing.RectangleF]::new([single]$x, [single]$y, [single]$size, [single]$size)
  $path = New-RoundedPath $frame ($size * 0.22)
  if ($monochrome) {
    $pen = [System.Drawing.Pen]::new($white, [single]([Math]::Max(2, $size * 0.075)))
    $graphics.DrawPath($pen, $path)
    $graphics.DrawLine($pen, $x + ($size * 0.30), $y + ($size * 0.32), $x + ($size * 0.70), $y + ($size * 0.32))
    $graphics.DrawLine($pen, $x + ($size * 0.50), $y + ($size * 0.32), $x + ($size * 0.50), $y + ($size * 0.62))
    for ($i = 0; $i -lt 4; $i++) {
      $graphics.FillRectangle((New-Object System.Drawing.SolidBrush($white)), $x + ($size * (0.22 + 0.15 * $i)), $y + ($size * 0.73), $size * 0.10, $size * 0.045)
    }
    $pen.Dispose(); $path.Dispose()
    return
  }
  $frameBrush = [System.Drawing.SolidBrush]::new($surface)
  $graphics.FillPath($frameBrush, $path)
  $pen = [System.Drawing.Pen]::new($blue, [single]($size * 0.032))
  $graphics.DrawPath($pen, $path)
  $pen.Dispose()

  $font = [System.Drawing.Font]::new('Arial', [single]($size * 0.25), [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)
  $format = New-Object System.Drawing.StringFormat
  $format.Alignment = [System.Drawing.StringAlignment]::Center
  $format.LineAlignment = [System.Drawing.StringAlignment]::Center
  $textBrush = [System.Drawing.SolidBrush]::new($white)
  $textRect = [System.Drawing.RectangleF]::new([single]$x, [single]($y + ($size * 0.18)), [single]$size, [single]($size * 0.42))
  $graphics.DrawString('TCS', $font, $textBrush, $textRect, $format)
  $textBrush.Dispose()

  $barY = $y + ($size * 0.66)
  $barW = $size * 0.13
  $gap = $size * 0.024
  $barX = $x + ($size * 0.20)
  for ($i = 0; $i -lt 4; $i++) {
    $brush = New-Object System.Drawing.SolidBrush($risk[$i])
    $graphics.FillRectangle($brush, $barX + (($barW + $gap) * $i), $barY, $barW, $size * 0.035)
    $brush.Dispose()
  }

  $font.Dispose(); $format.Dispose(); $frameBrush.Dispose(); $path.Dispose()
}

function Save-Asset([string]$name, [int]$size, [bool]$opaque, [float]$markScale, [bool]$monochrome = $false) {
  $bitmap = New-Object System.Drawing.Bitmap($size, $size, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
  $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $graphics.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit
  if ($opaque) { $graphics.Clear($navy) } else { $graphics.Clear([System.Drawing.Color]::Transparent) }
  $markSize = $size * $markScale
  Draw-Mark $graphics (($size - $markSize) / 2) (($size - $markSize) / 2) $markSize $monochrome
  $path = Join-Path $root $name
  $bitmap.Save($path, [System.Drawing.Imaging.ImageFormat]::Png)
  $graphics.Dispose(); $bitmap.Dispose()
}

Save-Asset 'tcs-icon.png' 1024 $true 0.74
Save-Asset 'tcs-mark.png' 1024 $false 0.76
Save-Asset 'tcs-splash.png' 1024 $false 0.54
Save-Asset 'tcs-adaptive-foreground.png' 1024 $false 0.42
Save-Asset 'tcs-monochrome.png' 1024 $false 0.42 $true
Save-Asset 'tcs-notification.png' 96 $false 0.70 $true
Save-Asset 'tcs-favicon.png' 48 $true 0.82

Write-Output "Generated brand assets in $root"
