'use client';

import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import * as maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer
} from 'recharts';
import {
  Download, Undo2, Trash2, MapPin, Navigation, Droplets, Scissors, Share2, Check, UploadCloud
} from 'lucide-react';
import { generateGPXString, downloadGPXFile, RoutePoint, Waypoint } from '@/lib/gpxGenerator';
import { savePublicRoute } from '@/lib/routeService';

export default function RouteBuilderPage() {
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);

  const [routeTitle, setRouteTitle] = useState('Morning Long Run Route');
  const [controlPoints, setControlPoints] = useState<[number, number][]>([]);
  const [routePoints, setRoutePoints] = useState<RoutePoint[]>([]);
  const [waypoints, setWaypoints] = useState<Waypoint[]>([]);
  const [waypointMode, setWaypointMode] = useState(false);
  const [trimStart, setTrimStart] = useState(0);
  const [trimEnd, setTrimEnd] = useState(0);
  const [isLoadingRoute, setIsLoadingRoute] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [savedLink, setSavedLink] = useState<string | null>(null);

  // Inisialisasi Peta MapLibre (Koordinat awal: Samarinda)
  useEffect(() => {
    if (!mapContainer.current || mapRef.current) return;

    const map = new maplibregl.Map({
      container: mapContainer.current,
      style: {
        version: 8,
        sources: {
          osm: {
            type: 'raster',
            tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
            tileSize: 256,
            attribution: '&copy; OpenStreetMap Contributors',
          },
        },
        layers: [{ id: 'osm-layer', type: 'raster', source: 'osm' }],
      },
      center: [117.1436, -0.5022],
      zoom: 13,
    });

    map.addControl(new maplibregl.NavigationControl(), 'top-right');

    map.on('load', () => {
      map.addSource('route-source', {
        type: 'geojson',
        data: { type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: [] } },
      });

      map.addLayer({
        id: 'route-line',
        type: 'line',
        source: 'route-source',
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: { 'line-color': '#F97316', 'line-width': 5 },
      });
    });

    mapRef.current = map;
    return () => map.remove();
  }, []);

  // Handler klik peta (Tambah titik rute atau Pos Air/Waypoint)
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const handleMapClick = (e: maplibregl.MapMouseEvent) => {
      const { lng, lat } = e.lngLat;
      if (waypointMode) {
        const name = prompt('Nama Waypoint (misal: Pos Air KM 5 / Indomaret):');
        if (name) {
          setWaypoints((prev) => [...prev, { lat, lon: lng, name, type: 'water' }]);
          new maplibregl.Marker({ color: '#2563EB' })
            .setLngLat([lng, lat])
            .setPopup(new maplibregl.Popup().setText(name))
            .addTo(map);
        }
        setWaypointMode(false);
      } else {
        setControlPoints((prev) => [...prev, [lng, lat]]);
      }
    };

    map.on('click', handleMapClick);
    return () => { map.off('click', handleMapClick); };
  }, [waypointMode]);

  // Hitung Rute via OSRM & Ambil Elevasi via Open-Meteo
  useEffect(() => {
    if (controlPoints.length < 2) {
      setRoutePoints([]);
      updateMapLine([]);
      return;
    }

    const fetchRoutingAndElevation = async () => {
      setIsLoadingRoute(true);
      try {
        const coordsString = controlPoints.map((c) => `${c[0]},${c[1]}`).join(';');
        const osrmRes = await fetch(
          `https://router.project-osrm.org/route/v1/foot/${coordsString}?overview=full&geometries=geojson`
        );
        const osrmData = await osrmRes.json();

        if (!osrmData.routes || osrmData.routes.length === 0) return;

        const rawCoords: [number, number][] = osrmData.routes[0].geometry.coordinates;
        const step = Math.max(1, Math.floor(rawCoords.length / 100));
        const sampled = rawCoords.filter((_, idx) => idx % step === 0);
        const lats = sampled.map((c) => c[1].toFixed(5)).join(',');
        const lons = sampled.map((c) => c[0].toFixed(5)).join(',');

        const eleRes = await fetch(
          `https://api.open-meteo.com/v1/elevation?latitude=${lats}&longitude=${lons}`
        );
        const eleData = await eleRes.json();
        const elevations: number[] = eleData.elevation || [];

        let cumulativeDist = 0;
        const processed: RoutePoint[] = sampled.map((coord, idx) => {
          if (idx > 0) {
            cumulativeDist += haversineDistance(
              sampled[idx - 1][1], sampled[idx - 1][0],
              coord[1], coord[0]
            );
          }
          return {
            lon: coord[0],
            lat: coord[1],
            ele: elevations[idx] ?? 0,
            distFromStart: Math.round(cumulativeDist),
          };
        });

        setRoutePoints(processed);
      } catch (err) {
        console.error('Routing error:', err);
      } finally {
        setIsLoadingRoute(false);
      }
    };

    fetchRoutingAndElevation();
  }, [controlPoints]);

  // Terapkan Privacy Trimmer
  const trimmedPoints = React.useMemo(() => {
    if (routePoints.length === 0) return [];
    const startIndex = Math.floor((trimStart / 100) * routePoints.length);
    const endIndex = routePoints.length - Math.floor((trimEnd / 100) * routePoints.length);
    return routePoints.slice(startIndex, Math.max(startIndex + 2, endIndex));
  }, [routePoints, trimStart, trimEnd]);

  useEffect(() => {
    updateMapLine(trimmedPoints.map((p) => [p.lon, p.lat]));
  }, [trimmedPoints]);

  const updateMapLine = (coords: [number, number][]) => {
    const map = mapRef.current;
    if (!map || !map.getSource('route-source')) return;
    (map.getSource('route-source') as maplibregl.GeoJSONSource).setData({
      type: 'Feature',
      properties: {},
      geometry: { type: 'LineString', coordinates: coords },
    });
  };

  const totalDistanceM = trimmedPoints.length > 1
    ? trimmedPoints[trimmedPoints.length - 1].distFromStart - trimmedPoints[0].distFromStart
    : 0;
  const totalDistanceKm = (totalDistanceM / 1000).toFixed(2);

  const elevationGain = trimmedPoints.reduce((acc, pt, idx) => {
    if (idx === 0) return 0;
    const diff = pt.ele - trimmedPoints[idx - 1].ele;
    return diff > 0 ? acc + diff : acc;
  }, 0);

  const handleExportGPX = () => {
    if (trimmedPoints.length < 2) return alert('Gambar rute minimal 2 titik terlebih dahulu.');
    const gpx = generateGPXString(routeTitle, trimmedPoints, waypoints);
    downloadGPXFile(routeTitle, gpx);
  };

  const handleSaveCloud = async () => {
    if (trimmedPoints.length < 2) return alert('Gambar rute minimal 2 titik terlebih dahulu.');
    setIsSaving(true);
    try {
      const routeId = await savePublicRoute(
        routeTitle,
        trimmedPoints,
        waypoints,
        totalDistanceM,
        Math.round(elevationGain)
      );
      const shareUrl = `${window.location.origin}/route/${routeId}`;
      setSavedLink(shareUrl);
      navigator.clipboard?.writeText(shareUrl);
    } catch (err) {
      console.error(err);
      alert('Gagal menyimpan ke cloud. Pastikan ENV Supabase sudah terpasang di Vercel.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="flex flex-col h-screen bg-slate-50 text-slate-900 font-sans">
      {/* Top Navbar - Clean Look */}
      <header className="flex flex-wrap items-center justify-between px-6 py-3 bg-white border-b border-slate-200 z-10 gap-2">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-orange-500 text-white rounded-lg">
            <Navigation className="w-5 h-5" />
          </div>
          <input
            type="text"
            value={routeTitle}
            onChange={(e) => setRouteTitle(e.target.value)}
            className="font-semibold text-lg bg-transparent border-b border-transparent hover:border-slate-300 focus:border-orange-500 focus:outline-none px-1"
          />
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/import"
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium bg-slate-100 text-slate-700 hover:bg-slate-200 transition"
          >
            <UploadCloud className="w-4 h-4 text-orange-500" />
            Import FIT/GPX
          </Link>

          <button
            onClick={() => setWaypointMode(!waypointMode)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium border transition ${
              waypointMode
                ? 'bg-blue-600 text-white border-blue-600'
                : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
            }`}
          >
            <Droplets className="w-4 h-4" />
            {waypointMode ? 'Klik Peta...' : 'Pos Air'}
          </button>

          <button
            onClick={() => setControlPoints((prev) => prev.slice(0, -1))}
            disabled={controlPoints.length === 0}
            className="p-2 text-slate-600 hover:bg-slate-100 rounded-lg border border-slate-200 disabled:opacity-40"
            title="Undo"
          >
            <Undo2 className="w-4 h-4" />
          </button>

          <button
            onClick={() => { setControlPoints([]); setWaypoints([]); setTrimStart(0); setTrimEnd(0); setSavedLink(null); }}
            className="p-2 text-red-600 hover:bg-red-50 rounded-lg border border-slate-200"
            title="Reset"
          >
            <Trash2 className="w-4 h-4" />
          </button>

          <button
            onClick={handleSaveCloud}
            disabled={isSaving}
            className="flex items-center gap-1.5 px-3 py-2 bg-slate-900 hover:bg-slate-800 text-white font-medium text-sm rounded-lg transition"
          >
            {savedLink ? <Check className="w-4 h-4 text-emerald-400" /> : <Share2 className="w-4 h-4" />}
            {isSaving ? 'Menyimpan...' : savedLink ? 'Link Tersalin!' : 'Save & Share'}
          </button>

          <button
            onClick={handleExportGPX}
            className="flex items-center gap-2 px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white font-medium text-sm rounded-lg shadow-sm transition"
          >
            <Download className="w-4 h-4" />
            GPX
          </button>
        </div>
      </header>

      {/* Main Map Area */}
      <div className="relative flex-1">
        <div ref={mapContainer} className="w-full h-full" />

        {controlPoints.length === 0 && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-white/95 backdrop-blur px-4 py-2 rounded-full shadow-md border border-slate-200 text-sm text-slate-700 flex items-center gap-2">
            <MapPin className="w-4 h-4 text-orange-500" />
            Klik di peta untuk mulai menggambar rute lari
          </div>
        )}

        {routePoints.length > 5 && (
          <div className="absolute top-4 left-4 bg-white/95 backdrop-blur p-4 rounded-xl shadow-md border border-slate-200 w-64">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-500 mb-3">
              <Scissors className="w-3.5 h-3.5 text-orange-500" />
              Privacy Trimmer
            </div>
            <div className="space-y-2 text-xs">
              <div>
                <label className="flex justify-between text-slate-600 mb-1">
                  <span>Potong Awal</span>
                  <span>{trimStart}%</span>
                </label>
                <input
                  type="range" min="0" max="30" value={trimStart}
                  onChange={(e) => setTrimStart(Number(e.target.value))}
                  className="w-full accent-orange-500"
                />
              </div>
              <div>
                <label className="flex justify-between text-slate-600 mb-1">
                  <span>Potong Akhir</span>
                  <span>{trimEnd}%</span>
                </label>
                <input
                  type="range" min="0" max="30" value={trimEnd}
                  onChange={(e) => setTrimEnd(Number(e.target.value))}
                  className="w-full accent-orange-500"
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Bottom Elevation & Metrics Drawer */}
      <div className="h-44 bg-white border-t border-slate-200 px-6 py-3 flex items-center gap-6">
        <div className="w-56 shrink-0 space-y-2 border-r border-slate-100 pr-4">
          <div>
            <p className="text-xs text-slate-500 uppercase">Total Jarak</p>
            <p className="text-2xl font-bold text-slate-900">
              {isLoadingRoute ? '...' : totalDistanceKm} <span className="text-sm font-normal text-slate-500">km</span>
            </p>
          </div>
          <div className="flex gap-4">
            <div>
              <p className="text-xs text-slate-500">Elevation Gain</p>
              <p className="text-sm font-semibold text-emerald-600">+{Math.round(elevationGain)} m</p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Waypoints</p>
              <p className="text-sm font-semibold text-blue-600">{waypoints.length} titik</p>
            </div>
          </div>
        </div>

        <div className="flex-1 h-full">
          {trimmedPoints.length > 1 ? (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trimmedPoints}>
                <defs>
                  <linearGradient id="eleGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#F97316" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#F97316" stopOpacity={0} />
                  </linearGradient>
                </defs>
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
                  formatter={(v: any) => [`${Number(v || 0).toFixed(1)} m`, "Elevasi"]} m`, 'Elevasi']}
                  labelFormatter={(l: any) => `Jarak: ${(Number(l || 0) / 1000).toFixed(2)} km`} km`}
                />
                <Area type="monotone" dataKey="ele" stroke="#F97316" strokeWidth={2} fill="url(#eleGrad)" />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-full flex items-center justify-center text-sm text-slate-400">
              Profil elevasi akan muncul otomatis setelah Anda membuat rute di peta
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371e3;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}