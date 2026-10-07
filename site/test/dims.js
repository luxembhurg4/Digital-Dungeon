const fs = require('fs');
function dims(p) {
  const b = fs.readFileSync(p);
  const w = b.readUInt32BE(16), h = b.readUInt32BE(20);
  return p + ' => ' + w + 'x' + h + ' (' + b.length + ' B)';
}
[
  'site/assets/maps/hallway-1.png',
  'new assets/Hallway 01_/map-01/artwork.png',
  'new assets/Hallway 01_/Map 1_/Map base.png',
  'new assets/Hallway 02_/map-02/artwork.png',
  'new assets/control/State=normal.png',
  'site/assets/rooms/gate/map-terrain.png',
  'site/assets/kit-control/up/normal.png'
].forEach(p => { try { console.log(dims(p)); } catch (e) { console.log(p + ' MISSING'); } });
