'use client';

import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import * as maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import {
  Download,
  Undo2,
  Trash2,
  Droplets,
  Scissors,
  Share2,
  Check,
  Navigation,
  Route,
  PenTool,
  ExternalLink,
  Timer,
  Flame,
  UploadCloud,
  MapPin,
  Sparkles,
} from 'lucide-react';
import Navbar from '@/components/Navbar';
import SsoLogo from '@/components/SsoLogo';
import { generateGPXString, downloadGPXFile, RoutePoint, Waypoint } from '@/lib/gpxGenerator';
import { deleteRoute, fetchMyRoutes, SavedRouteRecord, savePublicRoute } from '@/lib/routeService';

const SAMARINDA_PRESETS = [
  {
    name: 'Tepian Mahakam 5K',
    snap: true,
    points: [
      [117.1365, -0.5032],
      [117.1458, -0.5015],
      [117.1542, -0.5038],
      [117.1610, -0.5072],
    ] as [number, number][],
  },
  {
    name: 'GOR Segiri Track Loop',
    snap: false,
    points: [
      [117.1462, -0.4912],
      [117.1474, -0.4912],
      [117.1474, -0.4926],
      [117.1462, -0.4926],
      [117.1462, -0.4912],
    ] as [number, number][],
  },
  {
    name: 'Jembatan Mahakam - Slamet Riyadi',
    snap: true,
    points: [
      [117.1195, -0.5185],
      [117.1268, -0.5082],
      [117.1365, -0.5032],
    ] as [number, number][],
  },
];

export default function RouteBuilderPage() {
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<maplibregl.Marker[]>([]);

  const [routeTitle, setRouteTitle] = useState('Morning Run — SSO Samarinda');
  const [snapToRoad, setSnapToRoad] = useState(true);
  const [clickPoints, setClickPoints] = useState<[number, number][]>([]);
  const [routePoints, setRoutePoints] = useState<RoutePoint[]>([]);
  const [waypoints, setWaypoints] = useState<Waypoint[]>([]);
  const [addingWaypoint, setAddingWaypoint] = useState(false);
  const addingWaypointRef = useRef(false);

  const [trimStartPct, setTrimStartPct] = useState(0);
  const [trimEndPct, setTrimEndPct] = useState(0);
  const [isSharing, setIsSharing] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [myRoutes, setMyRoutes] = useState<SavedRouteRecord[]>([]);

  const [calcDistKm, setCalcDistKm] = useState(5);
  const [calcMinutes, setCalcMinutes] = useState(25);

  useEffect(() => {
    addingWaypointRef.current = addingWaypoint;
  }, [addingWaypoint]);

  const loadMyRoutes = () => {
    fetchMyRoutes().then(setMyRoutes).catch(console.error);
  };

  useEffect(() => {
    loadMyRoutes();
  }, []);

  useEffect(() => {
    if (!mapContainer.current) return;
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
      center: [117.1485, -0.4985],
      zoom: 14,
    });

    map.addControl(new maplibregl.NavigationControl(), 'top-right');

    map.on('load', () => {
      map.addSource('route-line-src', {
        type: 'geojson',
        data: { type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: [] } },
      });

      map.addLayer({
        id: 'route-line-casing',
        type: 'line',
        source: 'route-line-src',
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: { 'line-color': '#09090B', 'line-width': 9 },
      });

      map.addLayer({
        id: 'route-line-main',
        type: 'line',
        source: 'route-line-src',
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: { 'line-color': '#FC4C02', 'line-width': 5 },
      });
    });

    map.on('click', (e) => {
      const lngLat: [number, number] = [e.lngLat.lng, e.lngLat.lat];
      if (addingWaypointRef.current) {
        const name = prompt('Nama Water Station / Checkpoint:', 'Water Station SSO') || 'Pos Air';
        setWaypoints((prev) => [...prev, { lat: lngLat[1], lon: lngLat[0], name, type: 'water' }]);
        setAddingWaypoint(false);
      } else {
        setClickPoints((prev) => [...prev, lngLat]);
      }
    });

    mapRef.current = map;
    return () => map.remove();
  }, []);

  useEffect(() => {
    if (clickPoints.length === 0) {
      setRoutePoints([]);
      return;
    }
    if (clickPoints.length === 1) {
      setRoutePoints([{ lat: clickPoints[0][1], lon: clickPoints[0][0], ele: 10, distFromStart: 0 }]);
      return;
    }

    const buildDirectTrack = (coords: [number, number][]) => {
      let distAcc = 0;
      return coords.map((c, idx) => {
        if (idx > 0) {
          const dx = (c[0] - coords[idx - 1][0]) * 111320 * Math.cos((c[1] * Math.PI) / 180);
          const dy = (c[1] - coords[idx - 1][1]) * 110540;
          distAcc += Math.sqrt(dx * dx + dy * dy);
        }
        const simEle = Math.round(10 + Math.sin(distAcc / 150) * 5);
        return { lat: c[1], lon: c[0], ele: simEle, distFromStart: Math.round(distAcc) };
      });
    };

    if (!snapToRoad) {
      setRoutePoints(buildDirectTrack(clickPoints));
      return;
    }

    const fetchOSRM = async () => {
      try {
        const coordsStr = clickPoints.map((c) => `${c[0]},${c[1]}`).join(';');
        const res = await fetch(`https://router.project-osrm.org/route/v1/foot/${coordsStr}?overview=full&geometries=geojson`);
        const json = await res.json();
        const coords: [number, number][] = json.routes?.[0]?.geometry?.coordinates || clickPoints;
        setRoutePoints(buildDirectTrack(coords));
      } catch {
        setRoutePoints(buildDirectTrack(clickPoints));
      }
    };
    fetchOSRM();
  }, [clickPoints, snapToRoad]);

  const trimmedPoints = React.useMemo(() => {
    if (routePoints.length < 2) return routePoints;
    const startIdx = Math.floor((trimStartPct / 100) * (routePoints.length - 1));
    const endIdx = Math.max(startIdx + 1, Math.ceil(((100 - trimEndPct) / 100) * routePoints.length));
    return routePoints.slice(startIdx, endIdx);
  }, [routePoints, trimStartPct, trimEndPct]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const updateVisuals = () => {
      const src = map.getSource('route-line-src') as maplibregl.GeoJSONSource | undefined;
      if (src) {
        src.setData({
          type: 'Feature',
          properties: {},
          geometry: {
            type: 'LineString',
            coordinates: trimmedPoints.map((p) => [p.lon, p.lat]),
          },
        });
      }

      markersRef.current.forEach((m) => m.remove());
      markersRef.current = [];

      clickPoints.forEach((pt, idx) => {
        const el = document.createElement('div');
        const isStart = idx === 0;
        const isEnd = idx === clickPoints.length - 1 && clickPoints.length > 1;

        if (isStart) {
          el.className = 'w-7 h-7 rounded-full bg-emerald-500 border-2 border-zinc-950 shadow-lg flex items-center justify-center text-[11px] font-black text-zinc-950';
          el.innerText = 'S';
        } else if (isEnd) {
          el.className = 'w-7 h-7 rounded-full bg-zinc-950 border-2 border-orange-500 shadow-lg flex items-center justify-center text-[11px] font-black text-white';
          el.innerText = 'F';
        } else {
          el.className = 'w-3.5 h-3.5 rounded-full bg-orange-500 border-2 border-zinc-950 shadow-md';
        }

        const marker = new maplibregl.Marker({ element: el }).setLngLat(pt).addTo(map);
        markersRef.current.push(marker);
      });

      waypoints.forEach((w) => {
        const el = document.createElement('div');
        el.className = 'px-2.5 py-0.5 rounded-full bg-zinc-950 text-white text-[10px] font-bold border border-orange-500 shadow-md';
        el.innerText = `💧 ${w.name}`;
        const marker = new maplibregl.Marker({ element: el }).setLngLat([w.lon, w.lat]).addTo(map);
        markersRef.current.push(marker);
      });
    };

    if (map.isStyleLoaded()) {
      updateVisuals();
    } else {
      map.once('load', updateVisuals);
    }
  }, [trimmedPoints, clickPoints, waypoints]);

  const totalDistanceM =
    trimmedPoints.length > 1
      ? trimmedPoints[trimmedPoints.length - 1].distFromStart - trimmedPoints[0].distFromStart
      : 0;

  const elevationGainM = trimmedPoints.reduce((acc, pt, i) => {
    if (i === 0) return 0;
    const diff = pt.ele - trimmedPoints[i - 1].ele;
    return diff > 0 ? acc + diff : acc;
  }, 0);

  const handleSaveAndShare = async () => {
    if (trimmedPoints.length < 2) return alert('Klik minimal 2 titik di peta untuk membuat track lari.');
    setIsSharing(true);
    try {
      const id = await savePublicRoute(routeTitle, totalDistanceM, elevationGainM, trimmedPoints, waypoints);
      const url = `${window.location.origin}/route/${id}`;
      await navigator.clipboard.writeText(url);
      setCopiedLink(true);
      loadMyRoutes();
      setTimeout(() => setCopiedLink(false), 3000);
      alert(`Track "${routeTitle}" tersimpan & link publik tersalin:\n${url}`);
    } catch (err: any) {
      alert('Gagal menyimpan track: ' + err.message);
    } finally {
      setIsSharing(false);
    }
  };

  const applyPreset = (preset: (typeof SAMARINDA_PRESETS)[0]) => {
    setRouteTitle(preset.name);
    setSnapToRoad(preset.snap);
    setClickPoints(preset.points);
    if (mapRef.current && preset.points.length > 0) {
      mapRef.current.flyTo({ center: preset.points[0], zoom: 14.5 });
    }
  };

  const paceMinPerKm = calcDistKm > 0 ? calcMinutes / calcDistKm : 0;
  const paceM = Math.floor(paceMinPerKm);
  const paceS = Math.round((paceMinPerKm - paceM) * 60);

  return (
    <div className="min-h-screen flex flex-col bg-zinc-100 text-zinc-950">
      <Navbar />

      {/* Hero Banner SSO RUNNERS */}
      <section className="bg-zinc-950 text-white border-b border-zinc-800 px-4 md:px-8 py-6 relative overflow-hidden">
        <div className="absolute -right-24 -top-24 w-80 h-80 rounded-full bg-orange-600/15 blur-3xl pointer-events-none" />
        <div className="max-w-7xl mx-auto flex flex-col lg:flex-row lg:items-center justify-between gap-5 relative z-10">
          <div className="flex items-start sm:items-center gap-4">
            <SsoLogo size="lg" />
            <div>
              <div className="flex flex-wrap items-center gap-2.5">
                <h1 className="font-black text-2xl md:text-3xl tracking-tight">SSO RUNNERS</h1>
                <span className="px-3 py-0.5 rounded-full bg-zinc-900 border border-zinc-700 text-xs font-bold text-orange-500">
                  @samasama.olahraga
                </span>
              </div>
              <p className="text-xs md:text-sm font-extrabold tracking-[0.18em] uppercase text-zinc-300 mt-1">
                Move // Connect // Grow &bull; Samarinda Multi Sport Community
              </p>
              <p className="text-xs md:text-sm text-zinc-400 mt-1.5 max-w-2xl">
                Part of <span className="text-white font-bold">@samasama.disamarinda</span> &mdash; Mari{' '}
                <span className="text-orange-400 font-bold">#samasamaolahraga</span> dan menjadi sporty yang kau minta.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <a
              href="https://strava.app.link/rhxCd3a9n5b"
              target="_blank"
              rel="noopener noreferrer"
              className="px-4 py-2.5 rounded-xl bg-orange-600 hover:bg-orange-500 text-white text-xs font-black uppercase tracking-wider flex items-center gap-1.5 shadow-lg shadow-orange-600/25 transition"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              Strava Club SSO
            </a>
            <Link
              href="/feed"
              className="px-4 py-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-white text-xs font-bold flex items-center gap-1.5 transition"
            >
              <Flame className="w-3.5 h-3.5 text-orange-500" />
              Feed Member
            </Link>
            <Link
              href="/import"
              className="px-4 py-2.5 rounded-xl bg-white hover:bg-zinc-200 text-zinc-950 text-xs font-black flex items-center gap-1.5 transition"
            >
              <UploadCloud className="w-3.5 h-3.5 text-orange-600" />
              Upload .FIT / .GPX
            </Link>
          </div>
        </div>
      </section>

      {/* Bar Kontrol Track Lari */}
      <div className="bg-white border-b border-zinc-200 px-4 md:px-8 py-3.5 space-y-3 shadow-sm">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-zinc-100">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[11px] font-black uppercase tracking-wider text-zinc-400 flex items-center gap-1">
              <MapPin className="w-3.5 h-3.5 text-orange-600" /> Preset Rute Samarinda:
            </span>
            {SAMARINDA_PRESETS.map((preset) => (
              <button
                key={preset.name}
                type="button"
                onClick={() => applyPreset(preset)}
                className="px-3 py-1 rounded-full bg-zinc-100 hover:bg-zinc-950 hover:text-white text-zinc-800 text-xs font-bold transition"
              >
                {preset.name}
              </button>
            ))}
          </div>
          <span className="text-[11px] font-semibold text-zinc-400 hidden md:inline">
            Klik peta untuk titik rute &bull; <strong className="text-emerald-600">S</strong> = Start &bull; <strong className="text-zinc-950">F</strong> = Finish
          </span>
        </div>

        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 flex-1 min-w-[220px]">
            <Navigation className="w-4 h-4 text-orange-600 shrink-0" />
            <input
              value={routeTitle}
              onChange={(e) => setRouteTitle(e.target.value)}
              placeholder="Nama track lari..."
              className="font-extrabold text-base bg-zinc-50 border border-zinc-200 rounded-lg px-3 py-1.5 w-full max-w-xs focus:border-zinc-950 focus:outline-none"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex rounded-xl border border-zinc-200 overflow-hidden text-xs font-bold bg-zinc-50 p-0.5">
              <button
                type="button"
                onClick={() => setSnapToRoad(true)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition ${
                  snapToRoad ? 'bg-zinc-950 text-white shadow-sm' : 'text-zinc-600 hover:text-zinc-950'
                }`}
              >
                <Route className="w-3.5 h-3.5 text-orange-500" />
                Ikuti Jalan
              </button>
              <button
                type="button"
                onClick={() => setSnapToRoad(false)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition ${
                  !snapToRoad ? 'bg-zinc-950 text-white shadow-sm' : 'text-zinc-600 hover:text-zinc-950'
                }`}
              >
                <PenTool className="w-3.5 h-3.5 text-orange-500" />
                Track Bebas / Stadion
              </button>
            </div>

            <button
              onClick={() => setAddingWaypoint(!addingWaypoint)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold border transition ${
                addingWaypoint ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-zinc-800 border-zinc-200 hover:bg-zinc-50'
              }`}
            >
              <Droplets className="w-3.5 h-3.5 text-blue-500" />
              {addingWaypoint ? 'Klik Peta...' : 'Water Station'}
            </button>

            <button
              onClick={() => setClickPoints((prev) => prev.slice(0, -1))}
              disabled={clickPoints.length === 0}
              className="p-2 rounded-xl border border-zinc-200 text-zinc-700 hover:bg-zinc-100 disabled:opacity-40"
              title="Undo Titik"
            >
              <Undo2 className="w-4 h-4" />
            </button>

            <button
              onClick={() => { setClickPoints([]); setWaypoints([]); }}
              disabled={clickPoints.length === 0}
              className="p-2 rounded-xl border border-zinc-200 text-red-600 hover:bg-red-50 disabled:opacity-40"
              title="Reset Track"
            >
              <Trash2 className="w-4 h-4" />
            </button>

            <button
              onClick={handleSaveAndShare}
              disabled={isSharing}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-black bg-zinc-950 hover:bg-zinc-800 text-white transition"
            >
              {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Share2 className="w-3.5 h-3.5 text-orange-500" />}
              {copiedLink ? 'Link Tersalin!' : 'Simpan & Share'}
            </button>

            <button
              onClick={() => {
                if (trimmedPoints.length < 2) return alert('Buat track minimal 2 titik terlebih dahulu.');
                downloadGPXFile(routeTitle, generateGPXString(routeTitle, trimmedPoints, waypoints));
              }}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-black bg-orange-600 hover:bg-orange-500 text-white shadow-sm transition"
            >
              <Download className="w-3.5 h-3.5" />
              GPX
            </button>
          </div>
        </div>
      </div>

      {/* Peta Interaktif */}
      <div className="relative h-[55vh] min-h-[380px]">
        <div ref={mapContainer} className="w-full h-full" />

        {clickPoints.length === 0 && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-zinc-950/90 backdrop-blur text-white px-4 py-2 rounded-full text-xs font-bold shadow-xl border border-zinc-800 pointer-events-none text-center">
            Klik titik di peta Samarinda atau pilih Preset Rute di atas untuk mulai
          </div>
        )}

        <div className="absolute top-4 left-4 bg-zinc-950/90 backdrop-blur-md text-white p-4 rounded-2xl shadow-xl border border-zinc-800 w-56 space-y-3">
          <p className="text-[11px] font-black uppercase tracking-wider text-orange-500 flex items-center gap-1.5">
            <Scissors className="w-3.5 h-3.5" /> Privacy Trimmer
          </p>
          <div>
            <div className="flex justify-between text-[11px] text-zinc-300 mb-1">
              <span>Potong Titik Awal</span>
              <span className="font-bold text-white">{trimStartPct}%</span>
            </div>
            <input
              type="range"
              min={0}
              max={40}
              value={trimStartPct}
              onChange={(e) => setTrimStartPct(Number(e.target.value))}
              className="w-full accent-orange-500 h-1.5"
            />
          </div>
          <div>
            <div className="flex justify-between text-[11px] text-zinc-300 mb-1">
              <span>Potong Titik Akhir</span>
              <span className="font-bold text-white">{trimEndPct}%</span>
            </div>
            <input
              type="range"
              min={0}
              max={40}
              value={trimEndPct}
              onChange={(e) => setTrimEndPct(Number(e.target.value))}
              className="w-full accent-orange-500 h-1.5"
            />
          </div>
        </div>
      </div>

      {/* Bar Statistik & Grafik Elevasi */}
      <div className="h-40 bg-white border-t border-zinc-200 px-6 py-3.5">
        <div className="max-w-7xl mx-auto h-full flex items-center gap-6">
          <div className="w-56 shrink-0 border-r border-zinc-100 pr-5 space-y-2">
            <div>
              <p className="text-[10px] font-black uppercase tracking-wider text-zinc-400">Total Jarak Track</p>
              <p className="text-3xl font-black text-zinc-950">
                {(totalDistanceM / 1000).toFixed(2)} <span className="text-xs font-bold text-zinc-500">km</span>
              </p>
            </div>
            <div className="flex gap-5">
              <div>
                <p className="text-[10px] font-bold uppercase text-zinc-400">Elevation</p>
                <p className="text-sm font-extrabold text-emerald-600">+{elevationGainM} m</p>
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase text-zinc-400">Waypoints</p>
                <p className="text-sm font-extrabold text-zinc-900">{clickPoints.length} pt &bull; {waypoints.length} pos</p>
              </div>
            </div>
          </div>

          <div className="flex-1 h-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trimmedPoints}>
                <XAxis
                  dataKey="distFromStart"
                  tickFormatter={(v) => `${(v / 1000).toFixed(1)}k`}
                  tick={{ fontSize: 11, fill: '#71717A' }}
                />
                <YAxis
                  domain={['auto', 'auto']}
                  tickFormatter={(v) => `${v}m`}
                  tick={{ fontSize: 11, fill: '#71717A' }}
                  width={38}
                />
                <Tooltip
                  formatter={(v: any) => [`${Number(v || 0).toFixed(1)} m`, 'Elevasi']}
                  labelFormatter={(l: any) => `Jarak: ${(Number(l || 0) / 1000).toFixed(2)} km`}
                />
                <Area type="monotone" dataKey="ele" stroke="#FC4C02" strokeWidth={2.5} fill="#FC4C02" fillOpacity={0.2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Utilitas Pelari SSO: Pace Calculator & Koleksi Track */}
      <section className="max-w-7xl w-full mx-auto px-4 md:px-8 py-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-2xl border border-zinc-200 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Timer className="w-5 h-5 text-orange-600" />
              <h2 className="font-black text-base text-zinc-950">SSO Pace Calculator</h2>
            </div>
            <Sparkles className="w-4 h-4 text-zinc-400" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-bold uppercase text-zinc-500 mb-1">Jarak (km)</label>
              <input
                type="number"
                step="0.1"
                min="0.1"
                value={calcDistKm}
                onChange={(e) => setCalcDistKm(Number(e.target.value))}
                className="w-full px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-xl text-sm font-extrabold"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold uppercase text-zinc-500 mb-1">Waktu (Menit)</label>
              <input
                type="number"
                min="1"
                value={calcMinutes}
                onChange={(e) => setCalcMinutes(Number(e.target.value))}
                className="w-full px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-xl text-sm font-extrabold"
              />
            </div>
          </div>
          <div className="p-4 rounded-xl bg-zinc-950 text-white flex items-center justify-between">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">Target Pace Lari</p>
              <p className="text-2xl font-black text-orange-500 mt-0.5">
                {paceM}:{paceS < 10 ? '0' : ''}{paceS} <span className="text-xs text-zinc-300 font-bold">/km</span>
              </p>
            </div>
            <div className="text-right text-xs text-zinc-400">
              <p>Kecepatan:</p>
              <p className="font-extrabold text-white text-sm">
                {calcMinutes > 0 ? ((calcDistKm / calcMinutes) * 60).toFixed(1) : '0'} km/j
              </p>
            </div>
          </div>
        </div>

        <div className="lg:col-span-2 bg-white p-6 rounded-2xl border border-zinc-200 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-black text-base text-zinc-950">Koleksi Track Lari SSO Anda ({myRoutes.length})</h2>
            <span className="text-xs font-semibold text-zinc-400">Siap Export GPX & Share</span>
          </div>

          {myRoutes.length === 0 ? (
            <div className="py-8 text-center border border-dashed border-zinc-200 rounded-xl">
              <p className="text-xs text-zinc-500">
                Belum ada track tersimpan. Pilih preset rute Samarinda atau gambar di peta lalu klik <strong>Simpan & Share</strong>.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {myRoutes.map((r) => (
                <div key={r.id} className="p-4 rounded-xl border border-zinc-200 flex items-center justify-between gap-3 hover:border-zinc-950 transition">
                  <div>
                    <p className="font-extrabold text-sm text-zinc-950">{r.title}</p>
                    <p className="text-xs font-semibold text-zinc-500 mt-0.5">
                      {(r.distance_m / 1000).toFixed(2)} km &bull; +{r.elevation_gain_m} m
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Link
                      href={`/route/${r.id}`}
                      className="flex items-center gap-1 px-3 py-1.5 bg-zinc-950 text-white hover:bg-zinc-800 rounded-lg text-xs font-bold"
                    >
                      <ExternalLink className="w-3.5 h-3.5 text-orange-500" />
                      Buka
                    </Link>
                    <button
                      onClick={async () => {
                        if (!confirm('Hapus track ini?')) return;
                        await deleteRoute(r.id);
                        loadMyRoutes();
                      }}
                      className="p-1.5 text-zinc-400 hover:text-red-600 rounded-lg"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
