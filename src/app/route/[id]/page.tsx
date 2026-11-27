'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import * as maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { Download, ArrowLeft, MapPin, Mountain, Compass } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { generateGPXString, downloadGPXFile, RoutePoint, Waypoint } from '@/lib/gpxGenerator';

export default function SharedRoutePage() {
  const params = useParams();
  const routeId = params?.id as string;
  const mapContainer = useRef<HTMLDivElement>(null);

  const [route, setRoute] = useState<{
    title: string;
    distance_m: number;
    elevation_gain_m: number;
    waypoints: Waypoint[];
    elevation_profile: RoutePoint[];
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!routeId) return;
    const fetchRoute = async () => {
      const { data, error } = await supabase
        .from('routes')
        .select('title, distance_m, elevation_gain_m, waypoints, elevation_profile')
        .eq('id', routeId)
        .single();

      if (error || !data) {
        setErrorMsg('Rute tidak ditemukan atau bersifat privat.');
      } else {
        setRoute(data);
      }
      setLoading(false);
    };
    fetchRoute();
  }, [routeId]);

  useEffect(() => {
    if (!route || !mapContainer.current) return;
    const pts = route.elevation_profile || [];
    if (pts.length === 0) return;

    const map = new maplibregl.Map({
      container: mapContainer.current,
      style: {
        version: 8,
        sources: {
          osm: {
            type: 'raster',
            tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
            tileSize: 256,
            attribution: '&copy; OpenStreetMap',
          },
        },
        layers: [{ id: 'osm-layer', type: 'raster', source: 'osm' }],
      },
      center: [pts[0].lon, pts[0].lat],
      zoom: 13,
    });

    map.on('load', () => {
      const coords = pts.map((p) => [p.lon, p.lat]);
      map.addSource('shared-route', {
        type: 'geojson',
        data: { type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: coords } },
      });
      map.addLayer({
        id: 'shared-route-line',
        type: 'line',
        source: 'shared-route',
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: { 'line-color': '#F97316', 'line-width': 5 },
      });

      const bounds = new maplibregl.LngLatBounds();
      coords.forEach((c) => bounds.extend(c as [number, number]));
      map.fitBounds(bounds, { padding: 50 });

      (route.waypoints || []).forEach((w) => {
        new maplibregl.Marker({ color: '#2563EB' })
          .setLngLat([w.lon, w.lat])
          .setPopup(new maplibregl.Popup().setText(w.name))
          .addTo(map);
      });
    });

    return () => map.remove();
  }, [route]);

  if (loading) {
    return <div className="h-screen flex items-center justify-center text-slate-500">Memuat rute lari...</div>;
  }

  if (errorMsg || !route) {
    return (
      <div className="h-screen flex flex-col items-center justify-center gap-4">
        <p className="text-slate-600">{errorMsg}</p>
        <Link href="/" className="px-4 py-2 bg-orange-500 text-white rounded-lg text-sm font-medium">
          Buat Rute Baru
        </Link>
      </div>
    );
  }

  const handleDownload = () => {
    const gpx = generateGPXString(route.title, route.elevation_profile, route.waypoints || []);
    downloadGPXFile(route.title, gpx);
  };

  return (
    <div className="flex flex-col h-screen bg-slate-50 text-slate-900">
      <header className="flex items-center justify-between px-6 py-3 bg-white border-b border-slate-200">
        <div className="flex items-center gap-3">
          <Link href="/" className="p-2 hover:bg-slate-100 rounded-lg text-slate-600">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="font-bold text-lg text-slate-900">{route.title}</h1>
            <p className="text-xs text-slate-500">Shared Public Route &bull; RunTrack Cloud</p>
          </div>
        </div>
        <button
          onClick={handleDownload}
          className="flex items-center gap-2 px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white font-medium text-sm rounded-lg shadow-sm"
        >
          <Download className="w-4 h-4" />
          Download GPX
        </button>
      </header>

      <div className="relative flex-1">
        <div ref={mapContainer} className="w-full h-full" />
      </div>

      <div className="h-44 bg-white border-t border-slate-200 px-6 py-3 flex items-center gap-6">
        <div className="w-60 shrink-0 space-y-2 border-r border-slate-100 pr-4">
          <div className="flex items-center gap-2">
            <Compass className="w-4 h-4 text-orange-500" />
            <div>
              <p className="text-xs text-slate-500">Jarak Total</p>
              <p className="text-xl font-bold">{(route.distance_m / 1000).toFixed(2)} km</p>
            </div>
          </div>
          <div className="flex gap-4 pt-1">
            <div className="flex items-center gap-1.5">
              <Mountain className="w-4 h-4 text-emerald-600" />
              <span className="text-sm font-semibold text-emerald-600">+{route.elevation_gain_m} m</span>
            </div>
            <div className="flex items-center gap-1.5">
              <MapPin className="w-4 h-4 text-blue-600" />
              <span className="text-sm font-semibold text-blue-600">{(route.waypoints || []).length} pos</span>
            </div>
          </div>
        </div>

        <div className="flex-1 h-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={route.elevation_profile}>
              <XAxis
                dataKey="distFromStart"
                tickFormatter={(v) => `${(v / 1000).toFixed(1)}k`}
                tick={{ fontSize: 11, fill: '#64748B' }}
              />
              <YAxis
                domain={['auto', 'auto']}
                tickFormatter={(v) => `${v}m`}
                tick={{ fontSize: 11, fill: '#64748B' }}
                width={40}
              />
              <Tooltip
                formatter={(v: any) => [`${Number(v || 0).toFixed(1)} m`, 'Elevasi']}
                labelFormatter={(l: any) => `Jarak: ${(Number(l || 0) / 1000).toFixed(2)} km`}
              />
              <Area type="monotone" dataKey="ele" stroke="#F97316" strokeWidth={2} fill="#FDBA74" fillOpacity={0.3} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
