import { supabase } from './supabaseClient';
import { RoutePoint, Waypoint } from './gpxGenerator';

export async function savePublicRoute(
  title: string,
  points: RoutePoint[],
  waypoints: Waypoint[],
  distanceM: number,
  elevationGainM: number
) {
  const lineStringCoords = points.map((p) => `${p.lon} ${p.lat}`).join(', ');
  const wktGeom = `SRID=4326;LINESTRING(${lineStringCoords})`;

  const { data, error } = await supabase
    .from('routes')
    .insert({
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