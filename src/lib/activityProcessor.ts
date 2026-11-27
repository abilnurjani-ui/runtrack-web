export interface TrackPoint {
  lat: number;
  lon: number;
  ele: number;
  time?: Date;
  hr?: number;
  distFromStart: number;
  speedMs: number;
  gradePct: number;
  gapPaceSecPerKm: number;
  isGlitch?: boolean;
}

export interface ProcessedActivity {
  title: string;
  rawPointsCount: number;
  cleanPointsCount: number;
  glitchesRemoved: number;
  totalDistanceM: number;
  movingTimeSec: number;
  elevationGainM: number;
  avgPaceSecPerKm: number;
  avgGapSecPerKm: number;
  avgHr?: number;
  points: TrackPoint[];
}

function haversine(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371e3;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function calcGapFactor(gradeDecimal: number): number {
  const i = Math.max(-0.3, Math.min(0.3, gradeDecimal));
  const cost =
    155.4 * i ** 5 -
    30.4 * i ** 4 -
    43.3 * i ** 3 +
    46.3 * i ** 2 +
    19.5 * i +
    3.6;
  return cost / 3.6;
}

export function cleanAndAnalyzeTrack(
  title: string,
  rawPoints: { lat: number; lon: number; ele?: number; time?: Date; hr?: number }[]
): ProcessedActivity {
  if (rawPoints.length < 2) {
    throw new Error('Data titik GPS terlalu sedikit.');
  }

  const clean: TrackPoint[] = [];
  let glitchesRemoved = 0;
  let totalDist = 0;
  let movingTime = 0;
  let eleGain = 0;
  let gapWeightedTime = 0;
  let hrSum = 0;
  let hrCount = 0;

  for (let i = 0; i < rawPoints.length; i++) {
    const curr = rawPoints[i];
    if (clean.length === 0) {
      clean.push({
        lat: curr.lat,
        lon: curr.lon,
        ele: curr.ele ?? 0,
        time: curr.time,
        hr: curr.hr,
        distFromStart: 0,
        speedMs: 0,
        gradePct: 0,
        gapPaceSecPerKm: 0,
      });
      if (curr.hr) { hrSum += curr.hr; hrCount++; }
      continue;
    }

    const prev = clean[clean.length - 1];
    const dist = haversine(prev.lat, prev.lon, curr.lat, curr.lon);
    const dt =
      curr.time && prev.time
        ? (curr.time.getTime() - prev.time.getTime()) / 1000
        : 1;

    const speed = dt > 0 ? dist / dt : 0;
    if (speed > 12.0 || (dt <= 2 && dist > 50)) {
      glitchesRemoved++;
      continue;
    }

    const currEle = curr.ele ?? prev.ele;
    const dEle = currEle - prev.ele;
    if (dEle > 0.5 && dist > 2) eleGain += dEle;

    const grade = dist > 2 ? dEle / dist : 0;
    const gapFactor = calcGapFactor(grade);

    totalDist += dist;
    if (speed > 0.5) movingTime += dt;
    gapWeightedTime += dt * gapFactor;

    const paceSec = speed > 0.5 ? 1000 / speed : 0;
    const gapPaceSec = paceSec > 0 ? paceSec / gapFactor : 0;

    if (curr.hr) { hrSum += curr.hr; hrCount++; }

    clean.push({
      lat: curr.lat,
      lon: curr.lon,
      ele: currEle,
      time: curr.time,
      hr: curr.hr,
      distFromStart: Math.round(totalDist),
      speedMs: speed,
      gradePct: Number((grade * 100).toFixed(1)),
      gapPaceSecPerKm: Math.round(gapPaceSec),
    });
  }

  const avgPaceSecPerKm = totalDist > 0 ? (movingTime / (totalDist / 1000)) : 0;
  const avgGapSecPerKm = totalDist > 0 ? (gapWeightedTime / (totalDist / 1000)) : 0;

  return {
    title,
    rawPointsCount: rawPoints.length,
    cleanPointsCount: clean.length,
    glitchesRemoved,
    totalDistanceM: Math.round(totalDist),
    movingTimeSec: Math.round(movingTime),
    elevationGainM: Math.round(eleGain),
    avgPaceSecPerKm: Math.round(avgPaceSecPerKm),
    avgGapSecPerKm: Math.round(avgGapSecPerKm),
    avgHr: hrCount > 0 ? Math.round(hrSum / hrCount) : undefined,
    points: clean,
  };
}

export function parseGPXText(xmlText: string) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xmlText, 'application/xml');
  const title = doc.querySelector('trk > name, metadata > name')?.textContent || 'Imported GPX Run';
  const trkpts = Array.from(doc.querySelectorAll('trkpt'));
  const points = trkpts.map((pt) => {
    const lat = parseFloat(pt.getAttribute('lat') || '0');
    const lon = parseFloat(pt.getAttribute('lon') || '0');
    const eleText = pt.querySelector('ele')?.textContent;
    const timeText = pt.querySelector('time')?.textContent;
    return {
      lat,
      lon,
      ele: eleText ? parseFloat(eleText) : undefined,
      time: timeText ? new Date(timeText) : undefined,
    };
  });
  return cleanAndAnalyzeTrack(title, points);
}
