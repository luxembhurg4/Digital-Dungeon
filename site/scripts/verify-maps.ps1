Add-Type -AssemblyName System.Drawing
$root = 'c:\Users\James Carl M. Osio\Documents\dUNGEON'
$mapsDir = Join-Path $root 'site\assets\maps'

# --- part 1: diff site crops vs fresh original crops (detect damage) ---
$halls = Get-ChildItem (Join-Path $root 'Assets') -Directory -Filter 'Hallway *' | Sort-Object Name
foreach($hall in $halls){
    $file = Get-ChildItem $hall.FullName -Filter '*.png' | Where-Object { $_.Name -notlike '*Collision*' } | Select-Object -First 1
    $n = [int]($hall.Name -replace 'Hallway ','')
    $orig = [System.Drawing.Bitmap]::FromFile($file.FullName)
    $rect = New-Object System.Drawing.Rectangle(36,176,768,576)
    $origCrop = $orig.Clone($rect, $orig.PixelFormat)
    $orig.Dispose()
    $cur = [System.Drawing.Bitmap]::FromFile((Join-Path $mapsDir "hallway-$n.png"))

    # count changed pixels and their bbox in the spawn window region only vs whole map
    $changed=0; $minX=9999;$maxX=-1;$minY=9999;$maxY=-1
    for($y=0; $y -lt 576; $y+=1){ for($x=0; $x -lt 768; $x+=1){
        $a=$origCrop.GetPixel($x,$y); $b=$cur.GetPixel($x,$y)
        if([math]::Abs($a.R-$b.R) -gt 6 -or [math]::Abs($a.G-$b.G) -gt 6 -or [math]::Abs($a.B-$b.B) -gt 6){
            $changed++
            if($x -lt $minX){$minX=$x}; if($x -gt $maxX){$maxX=$x}
            if($y -lt $minY){$minY=$y}; if($y -gt $maxY){$maxY=$y}
        }
    }}
    if($changed -gt 0){ Write-Output ("map ${n}: changed=$changed bbox=($minX,$minY)-($maxX,$maxY)") }
    else { Write-Output ("map ${n}: no changes") }
    $origCrop.Dispose(); $cur.Dispose()
}

# --- part 2: stack hallway titles from presentations ---
$titles = New-Object System.Drawing.Bitmap(700, 7*56, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
$g = [System.Drawing.Graphics]::FromImage($titles)
$g.Clear([System.Drawing.Color]::FromArgb(41,35,52))
$gy = 0
foreach($hall in $halls){
    $file = Get-ChildItem $hall.FullName -Filter '*.png' | Where-Object { $_.Name -notlike '*Collision*' } | Select-Object -First 1
    $orig = [System.Drawing.Bitmap]::FromFile($file.FullName)
    $trect = New-Object System.Drawing.Rectangle(36,52,700,48)
    $strip = $orig.Clone($trect, $orig.PixelFormat)
    $g.DrawImage($strip, 0, $gy)
    $strip.Dispose(); $orig.Dispose()
    $gy += 56
}
$g.Dispose()
$titles.Save((Join-Path (Join-Path $root 'site\scripts') 'titles-strip.png'), [System.Drawing.Imaging.ImageFormat]::Png)
$titles.Dispose()
Write-Output 'titles saved'
