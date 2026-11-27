'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import FitParser from 'fit-file-parser';
import { UploadCloud, ShieldCheck, Activity, Mountain, Heart, Save, Check, Globe, Lock } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import Navbar from '@/components/Navbar';
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
  const [customTitle, setCustomTitle] = useState('');
  const [caption, setCaption] = useState('');
  const [isPublic, setIsPublic] = useState(true);
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
        setCustomTitle(result.title);
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
          const title = file.name.replace(/\.fit$/i, '');
          const result = cleanAndAnalyzeTrack(title, rawPoints);
          setActivity(result);
          setCustomTitle(title);
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
      await saveActivityToCloud(
        { ...activity, title: customTitle || activity.title },
        { isPublic, caption }
      );
      setSavedSuccess(true);
      setTimeout(() => router.push(isPublic ? '/feed' : '/dashboard'), 900);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <Navbar />

      <main className="max-w-4xl mx-auto p-6 space-y-6">
        <div>
          <h1 className="font-extrabold text-xl">Import & Bagikan Sesi Lari</h1>
          <p className="text-xs text-slate-500">Unggah file .FIT atau .GPX dari Garmin, Coros, atau Huawei Health</p>
        </div>

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
            <div className="bg-emerald-50 border border-emerald-200 p-4 rounded-xl flex items-center gap-3">
              <ShieldCheck className="w-6 h-6 text-emerald-600 shrink-0" />
              <div>
                <p className="font-semibold text-emerald-900">Anti-Data Pollution Aktif</p>
                <p className="text-xs text-emerald-700">
                  {activity.glitchesRemoved} titik anomali GPS dibersihkan dari {activity.rawPointsCount} titik mentah.
                </p>
              </div>
            </div>

            {/* Pengaturan Judul, Catatan Olahraga & Visibilitas Medsos */}
            <div className="bg-white p-5 rounded-xl border border-slate-200 space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase text-slate-500 mb-1">Judul Sesi Lari</label>
                <input
                  value={customTitle}
                  onChange={(e) => setCustomTitle(e.target.value)}
                  className="w-full px-3.5 py-2 border border-slate-200 rounded-lg text-sm font-semibold focus:outline-none focus:border-orange-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-slate-500 mb-1">Catatan Latihan / Feel (Opsional)</label>
                <textarea
                  rows={2}
                  value={caption}
                  onChange={(e) => setCaption(e.target.value)}
                  placeholder="Contoh: Easy run pagi hari, HR terjaga di Zona 2..."
                  className="w-full px-3.5 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-orange-500"
                />
              </div>

              <div className="flex flex-wrap items-center justify-between gap-4 pt-2 border-t border-slate-100">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsPublic(true)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border transition ${
                      isPublic ? 'bg-orange-50 border-orange-500 text-orange-700' : 'bg-white border-slate-200 text-slate-500'
                    }`}
                  >
                    <Globe className="w-3.5 h-3.5" />
                    Bagikan ke Feed Pelari
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsPublic(false)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border transition ${
                      !isPublic ? 'bg-slate-900 border-slate-900 text-white' : 'bg-white border-slate-200 text-slate-500'
                    }`}
                  >
                    <Lock className="w-3.5 h-3.5" />
                    Simpan Pribadi Saja
                  </button>
                </div>

                <button
                  onClick={handleSaveLog}
                  disabled={isSaving || savedSuccess}
                  className="flex items-center gap-2 px-5 py-2.5 bg-orange-600 hover:bg-orange-700 text-white text-sm font-bold rounded-xl shadow-sm transition"
                >
                  {savedSuccess ? <Check className="w-4 h-4" /> : <Save className="w-4 h-4" />}
                  {isSaving ? 'Menyimpan...' : savedSuccess ? 'Berhasil!' : isPublic ? 'Simpan & Posting ke Feed' : 'Simpan ke Log Pribadi'}
                </button>
              </div>
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
                  <Area type="monotone" dataKey="ele" stroke="#FC4C02" strokeWidth={2} fill="#FDBA74" fillOpacity={0.3} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
