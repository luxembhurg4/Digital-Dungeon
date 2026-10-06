Add-Type -AssemblyName System.Drawing
$path = 'c:\Users\James Carl M. Osio\Documents\dUNGEON\Assets\Hallway 01\Gate ' + [char]0x2192 + ' Profile Hall.png'
$img = [System.Drawing.Bitmap]::FromFile($path)
Write-Output ('size: ' + $img.Width + 'x' + $img.Height)
Write-Output '--- row y=463 x sweep ---'
foreach($x in @(0,10,20,30,33,34,35,36,40,100,400,700,790,800,802,803,804,805,806,810,830,900,1119)){
    $p = $img.GetPixel($x,463)
    Write-Output ("x=$x -> " + $p.R + ',' + $p.G + ',' + $p.B)
}
Write-Output '--- col x=400 y sweep ---'
foreach($y in @(100,150,160,170,172,173,174,175,176,178,180,200,700,740,745,748,749,750,751,752,754,756,760,780)){
    $p = $img.GetPixel(400,$y)
    Write-Output ("y=$y -> " + $p.R + ',' + $p.G + ',' + $p.B)
}
$img.Dispose()
