param([string]$OutputDirectory = "public/icons")

$ErrorActionPreference = "Stop"
$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$resolvedOutput = Join-Path $projectRoot $OutputDirectory
New-Item -ItemType Directory -Force -Path $resolvedOutput | Out-Null
Add-Type -AssemblyName System.Drawing

function New-ExResumeIcon {
  param([int]$Size)

  $bitmap = [System.Drawing.Bitmap]::new($Size, $Size)
  $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
  $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $graphics.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit

  try {
    $graphics.Clear([System.Drawing.Color]::Transparent)
    $inset = [Math]::Max(1, [int]($Size * 0.055))
    $radius = [Math]::Max(2, [int]($Size * 0.23))
    $diameter = $radius * 2
    $rect = [System.Drawing.RectangleF]::new($inset, $inset, $Size - (2 * $inset), $Size - (2 * $inset))
    $path = [System.Drawing.Drawing2D.GraphicsPath]::new()
    try {
      $path.AddArc($rect.Left, $rect.Top, $diameter, $diameter, 180, 90)
      $path.AddArc($rect.Right - $diameter, $rect.Top, $diameter, $diameter, 270, 90)
      $path.AddLine($rect.Right, $rect.Top + $radius, $rect.Right, $rect.Bottom - [int]($Size * 0.18))
      $path.AddLine($rect.Right, $rect.Bottom - [int]($Size * 0.18), $rect.Right - [int]($Size * 0.18), $rect.Bottom)
      $path.AddLine($rect.Right - [int]($Size * 0.18), $rect.Bottom, $rect.Left + $radius, $rect.Bottom)
      $path.AddArc($rect.Left, $rect.Bottom - $diameter, $diameter, $diameter, 90, 90)
      $path.CloseFigure()
      $background = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(255, 12, 73, 56))
      try { $graphics.FillPath($background, $path) } finally { $background.Dispose() }
    } finally { $path.Dispose() }

    if ($Size -ge 32) {
      $font = [System.Drawing.Font]::new("Georgia", [single]($Size * 0.48), [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)
      $brush = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::White)
      $format = [System.Drawing.StringFormat]::new()
      try {
        $format.Alignment = [System.Drawing.StringAlignment]::Center
        $format.LineAlignment = [System.Drawing.StringAlignment]::Center
        $graphics.DrawString("E", $font, $brush, [System.Drawing.RectangleF]::new(0, -[single]($Size * 0.035), $Size, $Size), $format)
      } finally {
        $format.Dispose()
        $brush.Dispose()
        $font.Dispose()
      }
    } else {
      $pen = [System.Drawing.Pen]::new([System.Drawing.Color]::White, [Math]::Max(1.5, $Size * 0.115))
      try {
        $pen.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
        $pen.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
        $x = [single]($Size * 0.34)
        $graphics.DrawLine($pen, $x, [single]($Size * 0.28), $x, [single]($Size * 0.70))
        $graphics.DrawLine($pen, $x, [single]($Size * 0.29), [single]($Size * 0.69), [single]($Size * 0.29))
        $graphics.DrawLine($pen, $x, [single]($Size * 0.49), [single]($Size * 0.62), [single]($Size * 0.49))
        $graphics.DrawLine($pen, $x, [single]($Size * 0.70), [single]($Size * 0.69), [single]($Size * 0.70))
      } finally { $pen.Dispose() }
    }

    $accent = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(255, 236, 111, 84))
    try {
      $dotSize = [Math]::Max(2, [int]($Size * 0.155))
      $graphics.FillEllipse($accent, $Size - $inset - $dotSize - [int]($Size * 0.09), $Size - $inset - $dotSize - [int]($Size * 0.09), $dotSize, $dotSize)
    } finally { $accent.Dispose() }

    $outputPath = Join-Path $resolvedOutput "icon-$Size.png"
    $bitmap.Save($outputPath, [System.Drawing.Imaging.ImageFormat]::Png)
    Write-Output "Generated $outputPath"
  } finally {
    $graphics.Dispose()
    $bitmap.Dispose()
  }
}

16, 32, 48, 128 | ForEach-Object { New-ExResumeIcon -Size $_ }
