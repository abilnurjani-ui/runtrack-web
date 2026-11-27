import { supabase } from './supabaseClient';
import { ProcessedActivity } from './activityProcessor';

export interface ActivityComment {
  id: string;
  athlete_name: string;
  content: string;
  created_at: string;
}

export interface ActivityRecord {
  id: string;
  user_id: string;
  athlete_name: string;
  title: string;
  caption: string | null;
  is_public: boolean;
  start_time: string;
  distance_m: number;
  moving_time_s: number;
  elevation_gain_m: number;
  avg_hr: number | null;
  gap_pace_s_per_km: number | null;
  has_gps_glitch: boolean;
  kudos_count?: number;
  user_has_kudosed?: boolean;
  comments?: ActivityComment[];
}

export async function saveActivityToCloud(
  activity: ProcessedActivity,
  options?: { isPublic?: boolean; caption?: string }
) {
  const { data: authData, error: authErr } = await supabase.auth.getUser();
  if (authErr || !authData.user) {
    throw new Error('Silakan login terlebih dahulu untuk menyimpan riwayat aktivitas.');
  }

  const athleteName = authData.user.email ? authData.user.email.split('@')[0] : 'Pelari';
  const startTime = activity.points[0]?.time
    ? new Date(activity.points[0].time).toISOString()
    : new Date().toISOString();

  const lineStringCoords = activity.points.map((p) => `${p.lon} ${p.lat}`).join(', ');
  const wktGeom = `SRID=4326;LINESTRING(${lineStringCoords})`;

  const { data, error } = await supabase
    .from('activities')
    .insert({
      user_id: authData.user.id,
      athlete_name: athleteName,
      title: activity.title,
      caption: options?.caption || null,
      is_public: options?.isPublic ?? false,
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
  const { data: authData } = await supabase.auth.getUser();
  if (!authData.user) return [];

  const { data, error } = await supabase
    .from('activities')
    .select('id, user_id, athlete_name, title, caption, is_public, start_time, distance_m, moving_time_s, elevation_gain_m, avg_hr, gap_pace_s_per_km, has_gps_glitch')
    .eq('user_id', authData.user.id)
    .order('start_time', { ascending: false });

  if (error) throw error;
  return data || [];
}

export async function toggleActivityPublic(id: string, nextPublicState: boolean) {
  const { error } = await supabase
    .from('activities')
    .update({ is_public: nextPublicState })
    .eq('id', id);
  if (error) throw error;
}

export async function deleteActivity(id: string) {
  const { error } = await supabase.from('activities').delete().eq('id', id);
  if (error) throw error;
}

export async function fetchCommunityFeed(): Promise<ActivityRecord[]> {
  const { data: authData } = await supabase.auth.getUser();
  const currentUserId = authData.user?.id;

  const { data: acts, error } = await supabase
    .from('activities')
    .select('id, user_id, athlete_name, title, caption, is_public, start_time, distance_m, moving_time_s, elevation_gain_m, avg_hr, gap_pace_s_per_km, has_gps_glitch')
    .eq('is_public', true)
    .order('start_time', { ascending: false })
    .limit(30);

  if (error) throw error;
  if (!acts || acts.length === 0) return [];

  const ids = acts.map((a) => a.id);

  const [{ data: kudosList }, { data: commentsList }] = await Promise.all([
    supabase.from('activity_kudos').select('activity_id, user_id').in('activity_id', ids),
    supabase
      .from('activity_comments')
      .select('id, activity_id, athlete_name, content, created_at')
      .in('activity_id', ids)
      .order('created_at', { ascending: true }),
  ]);

  return acts.map((act) => {
    const actKudos = (kudosList || []).filter((k) => k.activity_id === act.id);
    const actComments = (commentsList || []).filter((c) => c.activity_id === act.id);
    return {
      ...act,
      kudos_count: actKudos.length,
      user_has_kudosed: currentUserId ? actKudos.some((k) => k.user_id === currentUserId) : false,
      comments: actComments,
    };
  });
}

export async function toggleKudos(activityId: string, currentlyKudosed: boolean) {
  const { data: authData } = await supabase.auth.getUser();
  if (!authData.user) throw new Error('Silakan login untuk memberi Kudos.');

  if (currentlyKudosed) {
    await supabase
      .from('activity_kudos')
      .delete()
      .eq('activity_id', activityId)
      .eq('user_id', authData.user.id);
  } else {
    await supabase
      .from('activity_kudos')
      .insert({ activity_id: activityId, user_id: authData.user.id });
  }
}

export async function postComment(activityId: string, content: string) {
  const { data: authData } = await supabase.auth.getUser();
  if (!authData.user) throw new Error('Silakan login untuk berkomentar.');

  const athleteName = authData.user.email ? authData.user.email.split('@')[0] : 'Pelari';
  const { data, error } = await supabase
    .from('activity_comments')
    .insert({
      activity_id: activityId,
      user_id: authData.user.id,
      athlete_name: athleteName,
      content,
    })
    .select('id, athlete_name, content, created_at')
    .single();

  if (error) throw error;
  return data as ActivityComment;
}

export function calculateACWR(activities: ActivityRecord[]) {
  const now = Date.now();
  const dayMs = 24 * 60 * 60 * 1000;

  let acuteLoadKm = 0;
  let chronicTotalKm = 0;

  activities.forEach((act) => {
    const ageDays = (now - new Date(act.start_time).getTime()) / dayMs;
    const distKm = Number(act.distance_m) / 1000;
    if (ageDays >= 0 && ageDays <= 7) acuteLoadKm += distKm;
    if (ageDays >= 0 && ageDays <= 28) chronicTotalKm += distKm;
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
