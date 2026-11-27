import { supabase } from './supabaseClient';
import { ProcessedActivity } from './activityProcessor';

export interface ActivityRecord {
  id: string;
  title: string;
  start_time: string;
  distance_m: number;
  moving_time_s: number;
  elevation_gain_m: number;
  avg_hr: number | null;
  gap_pace_s_per_km: number | null;
  has_gps_glitch: boolean;
}

export async function saveActivityToCloud(activity: ProcessedActivity) {
  const startTime = activity.points[0]?.time
    ? new Date(activity.points[0].time).toISOString()
    : new Date().toISOString();

  const lineStringCoords = activity.points.map((p) => `${p.lon} ${p.lat}`).join(', ');
  const wktGeom = `SRID=4326;LINESTRING(${lineStringCoords})`;

  const { data, error } = await supabase
    .from('activities')
    .insert({
      title: activity.title,
      start_time: startTime,
      distance_m: activity.totalDistanceM,
      moving_time_s: activity.movingTimeSec,
      elevation_gain_m: activity.elevationGainM,
      avg_hr: activity.avgHr ?? null,
      gap_pace_s_per_km: activity.avgGapSecPerKm,
      has_gps_glitch: activity.glitchesRemoved > 0,
      geom: wktGeom,
    })
    .select('id')
    .single();

  if (error) throw error;
  return data.id;
}

export async function fetchActivities(): Promise<ActivityRecord[]> {
  const { data, error } = await supabase
    .from('activities')
    .select('id, title, start_time, distance_m, moving_time_s, elevation_gain_m, avg_hr, gap_pace_s_per_km, has_gps_glitch')
    .order('start_time', { ascending: false });

  if (error) throw error;
  return data || [];
}

export function calculateACWR(activities: ActivityRecord[]) {
  const now = Date.now();
  const dayMs = 24 * 60 * 60 * 1000;

  let acuteLoadKm = 0;   // 7 hari terakhir
  let chronicTotalKm = 0; // 28 hari terakhir

  activities.forEach((act) => {
    const ageDays = (now - new Date(act.start_time).getTime()) / dayMs;
    const distKm = Number(act.distance_m) / 1000;
    if (ageDays >= 0 && ageDays <= 7) {
      acuteLoadKm += distKm;
    }
    if (ageDays >= 0 && ageDays <= 28) {
      chronicTotalKm += distKm;
    }
  });

  const chronicWeeklyAvgKm = chronicTotalKm / 4;
  const ratio = chronicWeeklyAvgKm > 0 ? acuteLoadKm / chronicWeeklyAvgKm : 0;

  let status = 'Belum Cukup Data';
  let color = 'text-slate-600 bg-slate-100';
  if (chronicWeeklyAvgKm > 0) {
    if (ratio < 0.8) {
      status = 'Undertraining (Beban Rendah)';
      color = 'text-blue-700 bg-blue-100';
    } else if (ratio <= 1.3) {
      status = 'Sweet Spot (Zona Optimal)';
      color = 'text-emerald-700 bg-emerald-100';
    } else if (ratio <= 1.5) {
      status = 'Waspada (Beban Meningkat)';
      color = 'text-amber-700 bg-amber-100';
    } else {
      status = 'High Risk Overtraining';
      color = 'text-red-700 bg-red-100';
    }
  }

  return {
    acuteLoadKm: Number(acuteLoadKm.toFixed(1)),
    chronicWeeklyAvgKm: Number(chronicWeeklyAvgKm.toFixed(1)),
    ratio: Number(ratio.toFixed(2)),
    status,
    color,
  };
}
