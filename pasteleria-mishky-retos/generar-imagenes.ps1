
$ErrorActionPreference = "Stop"

Add-Type -AssemblyName System.Drawing

$carpeta = Join-Path $PSScriptRoot "img\productos"

if (!(Test-Path -LiteralPath $carpeta -PathType Container)) {
    throw "No se encontró la carpeta img\productos."
}

$archivos = @(
    Get-ChildItem -LiteralPath $carpeta -File |
    Where-Object {
        $_.Extension -ieq ".jpg" -and
        $_.BaseName -notmatch "-(300|600)$"
    }
)

if ($archivos.Count -ne 16) {
    throw "Se esperaban 16 imágenes originales JPG y se encontraron $($archivos.Count)."
}

$codec = [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() |
    Where-Object { $_.MimeType -eq "image/jpeg" } |
    Select-Object -First 1

if ($null -eq $codec) {
    throw "No se encontró el codificador JPEG."
}

$calidad = [System.Drawing.Imaging.Encoder]::Quality
$parametros = [System.Drawing.Imaging.EncoderParameters]::new(1)
$parametros.Param[0] = [System.Drawing.Imaging.EncoderParameter]::new($calidad, [long]88)

try {
    foreach ($archivo in $archivos) {
        $original = [System.Drawing.Image]::FromFile($archivo.FullName)

        try {
            foreach ($ancho in @(300, 600)) {
                $alto = [Math]::Max(
                    1,
                    [int][Math]::Round(
                        $original.Height * $ancho / [double]$original.Width
                    )
                )

                $bitmap = [System.Drawing.Bitmap]::new($ancho, $alto)
                $grafico = [System.Drawing.Graphics]::FromImage($bitmap)

                try {
                    $grafico.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
                    $grafico.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
                    $grafico.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
                    $grafico.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality

                    $grafico.DrawImage($original, 0, 0, $ancho, $alto)

                    $nombre = "{0}-{1}.jpg" -f $archivo.BaseName, $ancho
                    $destino = Join-Path $carpeta $nombre

                    if (Test-Path -LiteralPath $destino) {
                        Remove-Item -LiteralPath $destino -Force
                    }

                    $bitmap.Save($destino, $codec, $parametros)

                } finally {
                    $grafico.Dispose()
                    $bitmap.Dispose()
                }
            }
        } finally {
            $original.Dispose()
        }
    }
} finally {
    $parametros.Dispose()
}

Write-Host "Se generaron correctamente las 32 imagenes."
