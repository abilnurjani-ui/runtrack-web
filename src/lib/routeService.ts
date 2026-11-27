import { supabase } from './supabaseClient';
import { RoutePoint, Waypoint } from './gpxGenerator';

export interface SavedRouteRecord {
  id: string;
  user_id: string | null;
  creator_name: string | null;
  title: string;
  distance_m: number;
  elevation_gain_m: number;
  waypoints: Waypoint[];
  elevation_profile: RoutePoint[];
  created_at: string;
}

export async function savePublicRoute(
  title: string,
  distanceM: number,
  elevationGainM: number,
  points: RoutePoint[],
  waypoints: Waypoint[]
) {
  const { data: authData } = await supabase.auth.getUser();
  const creatorName = authData.user?.email ? authData.user.email.split('@')[0] : 'SSO Runner';
  const lineStringCoords = points.map((p) => `${p.lon} ${p.lat}`).join(', ');
  const wktGeom = `SRID=4326;LINESTRING(${lineStringCoords})`;

  const { data, error } = await supabase
    .from('routes')
    .insert({
      user_id: authData.user?.id ?? null,
      creator_name: creatorName,
      title,
      distance_m: distanceM,
      elevation_gain_m: elevationGainM,
      geom: wktGeom,
      waypoints,
      elevation_profile: points,
      is_public: true,
    })
    .select('id')
    .single();

  if (error) throw error;
  return data.id;
}

export async function fetchMyRoutes(): Promise<SavedRouteRecord[]> {
  const { data: authData } = await supabase.auth.getUser();
  if (!authData.user) return [];

  const { data, error } = await supabase
    .from('routes')
    .select('id, user_id, creator_name, title, distance_m, elevation_gain_m, waypoints, elevation_profile, created_at')
    .eq('user_id', authData.user.id)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data || [];
}

export async function deleteRoute(id: string) {
  const { error } = await supabase.from('routes').delete().eq('id', id);
  if (error) throw error;
}
