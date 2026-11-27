'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import FitParser from 'fit-file-parser';
import { ArrowLeft, UploadCloud, ShieldCheck, Activity, Mountain, Heart, Save, Check } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { cleanAndAnalyzeTrack, parseGPXText, ProcessedActivity } from '@/lib/activityProcessor';
import { saveActivityToCloud } from '@/lib/activityService';

function formatPace(secPerKm: number): string {
  if (!secPerKm || secPerKm <= 0 || !isFinite(secPerKm)) return '--:--';
  const mins = Math.floor(secPerKm / 60);
  const secs = Math.round(secPerKm % 60);
  return `${mins}:${secs < 10 ? '0' : ''}${secs} /km`;
}

export default function ImportActivityPage() {
  const router = useRouter();
  const [activity, setActivity] = useState<ProcessedActivity | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isParsing, setIsParsing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsParsing(true);
    setError(null);
    setSavedSuccess(false);

    try {
      const ext = file.name.split('.').pop()?.toLowerCase();
      if (ext === 'gpx') {
        const text = await file.text();
        const result = parseGPXText(text);
        setActivity(result);
      } else if (ext === 'fit') {
        const buffer = await file.arrayBuffer();
        const fitParser = new FitParser({ force: true, speedUnit: 'm/s', lengthUnit: 'm' });
        fitParser.parse(buffer, (err: any, data: any) => {
          if (err) {
            setError('Gagal membaca file .FIT: ' + err.message);
            setIsParsing(false);
            return;
          }
          const records = (data.records || []).filter(
            (r: any) => typeof r.position_lat === 'number' && typeof r.position_long === 'number'
          );
          const rawPoints = records.map((r: any) => ({
            lat: r.position_lat,
            lon: r.position_long,
            ele: r.altitude ?? r.enhanced_altitude,
            time: r.timestamp ? new Date(r.timestamp) : undefined,
            hr: r.heart_rate,
          }));
          const result = cleanAndAnalyzeTrack(file.name.replace(/\.fit$/i, ''), rawPoints);
          setActivity(result);
          setIsParsing(false);
        });
        return;
      } else {
        setError('Format file belum didukung. Gunakan file .FIT atau .GPX.');
      }
    } catch (err: any) {
      setError(err.message || 'Terjadi kesalahan saat memproses file.');
    } finally {
      setIsParsing(false);
    }
  };

  const handleSaveLog = async () => {
    if (!activity) return;
    setIsSaving(true);
    try {
      await saveActivityToCloud(activity);
      setSavedSuccess(true);
      setTimeout(() => router.push('/dashboard'), 1000);
    } catch (err: any) {
      setError('Gagal menyimpan ke Training Log: ' + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="flex items-center justify-between px-6 py-4 bg-white border-b border-slate-200">
        <div className="flex items-center gap-3">
          <Link href="/" className="p-2 hover:bg-slate-100 rounded-lg text-slate-600">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="font-bold text-lg">Import & Clean Smartwatch Activity</h1>
            <p className="text-xs text-slate-500">Garmin &bull; Coros &bull; Huawei Health (.FIT / .GPX)</p>
          </div>
        </div>
        <Link href="/dashboard" className="px-3 py-2 bg-slate-100 hover:bg-slate-200 rounded-lg text-sm font-medium">
          Lihat Training Log
        </Link>
      </header>

      <main className="max-w-4xl mx-auto p-6 space-y-6">
        <label className="flex flex-col items-center justify-center p-10 bg-white border-2 border-dashed border-slate-300 hover:border-orange-500 rounded-2xl cursor-pointer transition">
          <UploadCloud className="w-10 h-10 text-orange-500 mb-3" />
          <p className="font-semibold text-slate-800">Pilih file .FIT atau .GPX dari perangkat Anda</p>
          <p className="text-xs text-slate-500 mt-1">Otomatis membersihkan GPS glitch & menghitung Grade Adjusted Pace (GAP)</p>
          <input type="file" accept=".fit,.gpx" onChange={handleFileUpload} className="hidden" />
        </label>

        {isParsing && <p className="text-center text-sm text-slate-500">Memproses telemetri GPS...</p>}
        {error && <div className="p-4 bg-red-50 text-red-700 rounded-xl text-sm border border-red-200">{error}</div>}

        {activity && (
          <div className="space-y-6">
            <div className="bg-emerald-50 border border-emerald-200 p-4 rounded-xl flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <ShieldCheck className="w-6 h-6 text-emerald-600" />
                <div>
                  <p className="font-semibold text-emerald-900">Anti-Data Pollution Aktif</p>
                  <p className="text-xs text-emerald-700">
                    {activity.glitchesRemoved} titik anomali GPS dibersihkan dari {activity.rawPointsCount} titik mentah.
                  </p>
                </div>
              </div>
              <button
                onClick={handleSaveLog}
                disabled={isSaving || savedSuccess}
                className="flex items-center gap-2 px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white text-sm font-semibold rounded-lg shadow-sm transition"
              >
                {savedSuccess ? <Check className="w-4 h-4" /> : <Save className="w-4 h-4" />}
                {isSaving ? 'Menyimpan...' : savedSuccess ? 'Tersimpan!' : 'Simpan ke Training Log'}
              </button>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-white p-4 rounded-xl border border-slate-200">
                <p className="text-xs text-slate-500">Jarak Bersih</p>
                <p className="text-2xl font-bold mt-1">{(activity.totalDistanceM / 1000).toFixed(2)} km</p>
              </div>
              <div className="bg-white p-4 rounded-xl border border-slate-200">
                <p className="text-xs text-slate-500">Avg Pace / GAP</p>
                <p className="text-xl font-bold mt-1">{formatPace(activity.avgPaceSecPerKm)}</p>
                <p className="text-xs font-medium text-orange-600">GAP: {formatPace(activity.avgGapSecPerKm)}</p>
              </div>
              <div className="bg-white p-4 rounded-xl border border-slate-200">
                <p className="text-xs text-slate-500 flex items-center gap-1"><Mountain className="w-3.5 h-3.5" /> Elevation Gain</p>
                <p className="text-2xl font-bold text-emerald-600 mt-1">+{activity.elevationGainM} m</p>
              </div>
              <div className="bg-white p-4 rounded-xl border border-slate-200">
                <p className="text-xs text-slate-500 flex items-center gap-1"><Heart className="w-3.5 h-3.5 text-red-500" /> Avg Heart Rate</p>
                <p className="text-2xl font-bold mt-1">{activity.avgHr ? `${activity.avgHr} bpm` : 'N/A'}</p>
              </div>
            </div>

            <div className="bg-white p-5 rounded-xl border border-slate-200 h-64">
              <p className="text-xs font-semibold uppercase text-slate-500 mb-3 flex items-center gap-1.5">
                <Activity className="w-4 h-4 text-orange-500" /> Profil Elevasi Aktivitas
              </p>
              <ResponsiveContainer width="100%" height="85%">
                <AreaChart data={activity.points}>
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
        )}
      </main>
    </div>
  );
}
