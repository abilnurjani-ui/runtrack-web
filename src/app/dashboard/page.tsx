'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { Activity, ArrowLeft, Gauge, Mountain, ShieldCheck, UploadCloud, Calendar } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { ActivityRecord, calculateACWR, fetchActivities } from '@/lib/activityService';

function formatPace(secPerKm: number | null): string {
  if (!secPerKm || secPerKm <= 0) return '--:--';
  const mins = Math.floor(secPerKm / 60);
  const secs = Math.round(secPerKm % 60);
  return `${mins}:${secs < 10 ? '0' : ''}${secs}/km`;
}

export default function TrainingDashboardPage() {
  const [activities, setActivities] = useState<ActivityRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchActivities()
      .then(setActivities)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const acwr = calculateACWR(activities);
  const totalKm = activities.reduce((acc, a) => acc + Number(a.distance_m) / 1000, 0);
  const totalEle = activities.reduce((acc, a) => acc + Number(a.elevation_gain_m || 0), 0);

  const chartData = [...activities]
    .slice(0, 10)
    .reverse()
    .map((a) => ({
      date: new Date(a.start_time).toLocaleDateString('id-ID', { day: '2-digit', month: 'short' }),
      km: Number((Number(a.distance_m) / 1000).toFixed(2)),
    }));

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="flex items-center justify-between px-6 py-4 bg-white border-b border-slate-200">
        <div className="flex items-center gap-3">
          <Link href="/" className="p-2 hover:bg-slate-100 rounded-lg text-slate-600">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="font-bold text-lg">Training Log & ACWR Analytics</h1>
            <p className="text-xs text-slate-500">Acute:Chronic Workload Ratio &bull; Bebas Biaya Langganan</p>
          </div>
        </div>
        <Link
          href="/import"
          className="flex items-center gap-1.5 px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white text-sm font-medium rounded-lg shadow-sm"
        >
          <UploadCloud className="w-4 h-4" />
          Import Aktivitas
        </Link>
      </header>

      <main className="max-w-5xl mx-auto p-6 space-y-6">
        {/* Kartu Ringkasan & ACWR */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white p-5 rounded-xl border border-slate-200 md:col-span-2">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold uppercase text-slate-500 flex items-center gap-1.5">
                <Gauge className="w-4 h-4 text-orange-500" /> ACWR Ratio (7d / 28d)
              </p>
              <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full ${acwr.color}`}>
                {acwr.status}
              </span>
            </div>
            <p className="text-3xl font-bold mt-2">{acwr.ratio}</p>
            <p className="text-xs text-slate-500 mt-1">
              Beban 7 hari: <strong>{acwr.acuteLoadKm} km</strong> &bull; Rata-rata 28 hari: <strong>{acwr.chronicWeeklyAvgKm} km/minggu</strong>
            </p>
          </div>

          <div className="bg-white p-5 rounded-xl border border-slate-200">
            <p className="text-xs font-semibold uppercase text-slate-500">Total Jarak Tercatat</p>
            <p className="text-3xl font-bold mt-2">{totalKm.toFixed(1)} <span className="text-sm font-normal text-slate-500">km</span></p>
            <p className="text-xs text-slate-500 mt-1">{activities.length} sesi lari</p>
          </div>

          <div className="bg-white p-5 rounded-xl border border-slate-200">
            <p className="text-xs font-semibold uppercase text-slate-500 flex items-center gap-1">
              <Mountain className="w-4 h-4 text-emerald-600" /> Total Elevation
            </p>
            <p className="text-3xl font-bold text-emerald-600 mt-2">+{Math.round(totalEle)} <span className="text-sm font-normal">m</span></p>
            <p className="text-xs text-slate-500 mt-1">Akumulasi tanjakan</p>
          </div>
        </div>

        {/* Grafik Jarak 10 Sesi Terakhir */}
        {chartData.length > 0 && (
          <div className="bg-white p-5 rounded-xl border border-slate-200 h-60">
            <p className="text-xs font-semibold uppercase text-slate-500 mb-3 flex items-center gap-1.5">
              <Activity className="w-4 h-4 text-orange-500" /> Volume Lari 10 Sesi Terakhir (km)
            </p>
            <ResponsiveContainer width="100%" height="85%">
              <BarChart data={chartData}>
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#64748B' }} />
                <YAxis tick={{ fontSize: 11, fill: '#64748B' }} width={35} />
                <Tooltip formatter={(v: any) => [`${v} km`, 'Jarak']} />
                <Bar dataKey="km" fill="#F97316" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Daftar Riwayat Aktivitas */}
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-100 font-semibold text-sm">
            Riwayat Sesi Lari
          </div>
          {loading ? (
            <p className="p-6 text-sm text-slate-500 text-center">Memuat log latihan...</p>
          ) : activities.length === 0 ? (
            <div className="p-8 text-center space-y-2">
              <p className="text-sm text-slate-500">Belum ada aktivitas tersimpan.</p>
              <Link href="/import" className="inline-block text-sm font-medium text-orange-600 hover:underline">
                Unggah file .FIT atau .GPX pertama Anda &rarr;
              </Link>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {activities.map((act) => (
                <div key={act.id} className="px-5 py-4 flex flex-wrap items-center justify-between gap-4 hover:bg-slate-50">
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-slate-900">{act.title}</p>
                      {act.has_gps_glitch && (
                        <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 bg-emerald-50 text-emerald-700 rounded-full">
                          <ShieldCheck className="w-3 h-3" /> GPS Cleaned
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                      <Calendar className="w-3 h-3" />
                      {new Date(act.start_time).toLocaleDateString('id-ID', {
                        weekday: 'short', day: 'numeric', month: 'short', year: 'numeric',
                      })}
                    </p>
                  </div>

                  <div className="flex items-center gap-6 text-sm">
                    <div>
                      <p className="text-xs text-slate-400">Jarak</p>
                      <p className="font-bold">{(Number(act.distance_m) / 1000).toFixed(2)} km</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-400">GAP Pace</p>
                      <p className="font-semibold text-orange-600">{formatPace(act.gap_pace_s_per_km)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-400">Elevasi</p>
                      <p className="font-semibold text-emerald-600">+{act.elevation_gain_m} m</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
