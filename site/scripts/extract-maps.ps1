Add-Type -AssemblyName System.Drawing

$root = 'c:\Users\James Carl M. Osio\Documents\dUNGEON'
$outDir = Join-Path $root 'site\assets\maps'
[void][System.IO.Directory]::CreateDirectory($outDir)

# spawn tile per hallway (top-left tile of hero canvas) - from master plan section 4
$spawns = @(
    @(11,14), @(5,13), @(5,4), @(5,14), @(11,14), @(6,12), @(11,14)
)

function Test-Bright([System.Drawing.Bitmap]$b, [int]$x0, [int]$y0, [int]$w, [int]$h) {
    for($y=$y0; $y -lt ($y0+$h); $y++){
        for($x=$x0; $x -lt ($x0+$w); $x++){
            if($x -lt 0 -or $y -lt 0 -or $x -ge $b.Width -or $y -ge $b.Height){ return $true }
            $p = $b.GetPixel($x,$y)
            if(($p.R + $p.G + $p.B) -gt 300){ return $true }
        }
    }
    return $false
}

$halls = Get-ChildItem (Join-Path $root 'Assets') -Directory -Filter 'Hallway *' | Sort-Object Name
foreach($hall in $halls){
    $file = Get-ChildItem $hall.FullName -Filter '*.png' | Where-Object { $_.Name -notlike '*Collision*' } | Select-Object -First 1
    $n = [int]($hall.Name -replace 'Hallway ','')
    $img = [System.Drawing.Bitmap]::FromFile($file.FullName)

    # detect panel bounds: walk outwards from (400,463) until page bg (41,35,52)
    $cx=400; $cy=463
    $left=$cx; while($left -gt 0){ $p=$img.GetPixel($left-1,$cy); if($p.R -eq 41 -and $p.G -eq 35 -and $p.B -eq 52){ break }; $left-- }
    $right=$cx; while($right -lt ($img.Width-1)){ $p=$img.GetPixel($right+1,$cy); if($p.R -eq 41 -and $p.G -eq 35 -and $p.B -eq 52){ break }; $right++ }
    $top=$cy; while($top -gt 0){ $p=$img.GetPixel($cx,$top-1); if($p.R -eq 41 -and $p.G -eq 35 -and $p.B -eq 52){ break }; $top-- }
    $bottom=$cy; while($bottom -lt ($img.Height-1)){ $p=$img.GetPixel($cx,$bottom+1); if($p.R -eq 41 -and $p.G -eq 35 -and $p.B -eq 52){ break }; $bottom++ }

    $pw = $right-$left+1; $ph = $bottom-$top+1
    Write-Output ("hallway $n : panel ($left,$top) ${pw}x${ph} from $($file.Name)")

    if($pw -ne 768 -or $ph -ne 576){ Write-Output "  !! unexpected size"; $img.Dispose(); continue }

    # spawn canvas in image coords (2x scale)
    $sx = $left + $spawns[$n-1][0]*16*2
    $sy = $top  + $spawns[$n-1][1]*16*2

    # window around preview knight (+-4 px)
    $wx=$sx-4; $wy=$sy-4; $ww=40; $wh=40
    if((Test-Bright $img $wx $wy $ww $wh)){
        # patch rect: canvas + 2px margins left/right/top, bottom = canvas bottom (avoid threshold row below)
        $px0=$sx-2; $py0=$sy-2; $pw2=36; $ph2=34
        $patched=$false
        foreach($off in @(64,-64,96,-96)){
            $tx=$px0+$off
            if($tx -ge $left -and ($tx+$pw2) -le ($right+1) -and -not (Test-Bright $img $tx $py0 $pw2 $ph2)){
                for($y=0; $y -lt $ph2; $y++){ for($x=0; $x -lt $pw2; $x++){ $img.SetPixel($px0+$x,$py0+$y,$img.GetPixel($tx+$x,$py0+$y)) } }
                $patched=$true
                Write-Output "  knight preview patched (offset $off)"
                break
            }
        }
        if(-not $patched){
            # try vertical offsets
            foreach($off in @(-64,64)){
                $ty=$py0+$off
                if($ty -ge $top -and ($ty+$ph2) -le ($bottom+1) -and -not (Test-Bright $img $px0 $ty $pw2 $ph2)){
                    for($y=0; $y -lt $ph2; $y++){ for($x=0; $x -lt $pw2; $x++){ $img.SetPixel($px0+$x,$py0+$y,$img.GetPixel($px0+$x,$ty+$y)) } }
                    $patched=$true
                    Write-Output "  knight preview patched (vertical $off)"
                    break
                }
            }
        }
        if(-not $patched){ Write-Output "  !! knight preview NOT patched" }
    } else {
        Write-Output "  no bright pixels near spawn (no preview knight?)"
    }

    # crop panel -> 768x576 output
    $rect = New-Object System.Drawing.Rectangle($left,$top,768,576)
    $crop = $img.Clone($rect, $img.PixelFormat)
    $outPath = Join-Path $outDir ("hallway-$n.png")
    $crop.Save($outPath, [System.Drawing.Imaging.ImageFormat]::Png)
    $crop.Dispose(); $img.Dispose()
    Write-Output "  saved $outPath"
}
