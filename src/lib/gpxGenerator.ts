export interface Waypoint {
  lat: number;
  lon: number;
  name: string;
  type: 'water' | 'store' | 'climb' | 'turn' | 'checkpoint';
}

export interface RoutePoint {
  lat: number;
  lon: number;
  ele: number;
  distFromStart: number;
}

export function generateGPXString(
  title: string,
  points: RoutePoint[],
  waypoints: Waypoint[]
): string {
  const escapeXml = (str: string) =>
    str.replace(/[<>&'"]/g, (c) => {
      switch (c) {
        case '<': return '&lt;';
        case '>': return '&gt;';
        case '&': return '&amp;';
        case '\'': return '&apos;';
        case '"': return '&quot;';
        default: return c;
      }
    });

  const wptXml = waypoints
    .map(
      (w) => `
  <wpt lat="${w.lat.toFixed(6)}" lon="${w.lon.toFixed(6)}">
    <name>${escapeXml(w.name)}</name>
    <sym>${w.type === 'water' ? 'Drinking Water' : 'Waypoint'}</sym>
    <type>${w.type}</type>
  </wpt>`
    )
    .join('');

  const trkptXml = points
    .map(
      (p) => `
      <trkpt lat="${p.lat.toFixed(6)}" lon="${p.lon.toFixed(6)}">
        <ele>${p.ele.toFixed(1)}</ele>
      </trkpt>`
    )
    .join('');

  return `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="RunTrack Cloud" xmlns="http://www.topografix.com/GPX/1/1">
  <metadata>
    <name>${escapeXml(title)}</name>
    <time>${new Date().toISOString()}</time>
  </metadata>${wptXml}
  <trk>
    <name>${escapeXml(title)}</name>
    <type>running</type>
    <trkseg>${trkptXml}
    </trkseg>
  </trk>
</gpx>`;
}

export function downloadGPXFile(filename: string, gpxContent: string) {
  const blob = new Blob([gpxContent], { type: 'application/gpx+xml' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${filename.toLowerCase().replace(/\s+/g, '-')}.gpx`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
