Add-Type -AssemblyName System.Drawing
$root = 'c:\Users\James Carl M. Osio\Documents\dUNGEON'
$out = Join-Path $root 'site\assets'

$crops = @(
    @{ src = 'Assets\Gate.png';         x = 880; y = 200; w = 512; h = 252; name = 'scene-gate.png' },
    @{ src = 'Assets\Router Quest.png'; x = 972; y = 250; w = 420; h = 304; name = 'scene-research.png' },
    @{ src = 'Assets\The Exit.png';     x = 290; y = 250; w = 432; h = 304; name = 'scene-chest.png' }
)

foreach ($c in $crops) {
    $img = [System.Drawing.Bitmap]::FromFile((Join-Path $root $c.src))
    $r = New-Object System.Drawing.Rectangle($c.x, $c.y, $c.w, $c.h)
    if ($c.x + $c.w -gt $img.Width -or $c.y + $c.h -gt $img.Height) {
        Write-Output ("OUT OF BOUNDS: " + $c.src + " image is " + $img.Width + "x" + $img.Height)
        $img.Dispose(); continue
    }
    $crop = $img.Clone($r, $img.PixelFormat)
    $crop.Save((Join-Path $out $c.name), [System.Drawing.Imaging.ImageFormat]::Png)
    $crop.Dispose(); $img.Dispose()
    Write-Output ("saved " + $c.name)
}
