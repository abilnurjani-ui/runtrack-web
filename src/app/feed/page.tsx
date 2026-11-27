'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Flame,
  MessageCircle,
  Mountain,
  Heart,
  ShieldCheck,
  Share2,
  Send,
  UploadCloud,
  Calendar,
  Award,
} from 'lucide-react';
import Navbar from '@/components/Navbar';
import {
  ActivityRecord,
  fetchCommunityFeed,
  postComment,
  toggleKudos,
} from '@/lib/activityService';

function formatPace(secPerKm: number | null): string {
  if (!secPerKm || secPerKm <= 0) return '--:--';
  const mins = Math.floor(secPerKm / 60);
  const secs = Math.round(secPerKm % 60);
  return `${mins}:${secs < 10 ? '0' : ''}${secs}/km`;
}

function formatDuration(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  return h > 0 ? `${h}j ${m}m` : `${m}m ${s}d`;
}

export default function CommunityFeedPage() {
  const [feed, setFeed] = useState<ActivityRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [commentInputs, setCommentInputs] = useState<Record<string, string>>({});
  const [submittingComment, setSubmittingComment] = useState<string | null>(null);

  useEffect(() => {
    fetchCommunityFeed()
      .then(setFeed)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const handleKudos = async (act: ActivityRecord) => {
    const currently = Boolean(act.user_has_kudosed);
    // Optimistic UI update
    setFeed((prev) =>
      prev.map((item) =>
        item.id === act.id
          ? {
              ...item,
              user_has_kudosed: !currently,
              kudos_count: (item.kudos_count || 0) + (currently ? -1 : 1),
            }
          : item
      )
    );

    try {
      await toggleKudos(act.id, currently);
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleSendComment = async (activityId: string) => {
    const text = (commentInputs[activityId] || '').trim();
    if (!text) return;
    setSubmittingComment(activityId);
    try {
      const newComment = await postComment(activityId, text);
      setFeed((prev) =>
        prev.map((item) =>
          item.id === activityId
            ? { ...item, comments: [...(item.comments || []), newComment] }
            : item
        )
      );
      setCommentInputs((prev) => ({ ...prev, [activityId]: '' }));
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSubmittingComment(null);
    }
  };

  const handleShareCard = async (act: ActivityRecord) => {
    const summary = `🏃 ${act.athlete_name} baru menyelesaikan "${act.title}" (${(
      Number(act.distance_m) / 1000
    ).toFixed(2)} km • GAP ${formatPace(act.gap_pace_s_per_km)}) di RunTrack!\n${window.location.origin}/feed`;
    await navigator.clipboard.writeText(summary);
    alert('Ringkasan lari tersalin ke clipboard! Siap ditempel ke WhatsApp/Grup Lari.');
  };

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900">
      <Navbar />

      <main className="max-w-2xl mx-auto p-4 md:p-6 space-y-5">
        {/* Header Komunitas */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 flex flex-wrap items-center justify-between gap-4 shadow-sm">
          <div>
            <h1 className="font-extrabold text-lg text-slate-900 flex items-center gap-2">
              <Award className="w-5 h-5 text-orange-600" />
              Feed Aktivitas Komunitas Pelari
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Fokus murni pada progres latihan, pace, & elevasi sesama pelari.
            </p>
          </div>
          <Link
            href="/import"
            className="flex items-center gap-1.5 px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold rounded-xl shadow-sm"
          >
            <UploadCloud className="w-4 h-4" />
            Bagikan Sesi Lari
          </Link>
        </div>

        {loading ? (
          <p className="text-center text-sm text-slate-500 py-10">Memuat aktivitas pelari...</p>
        ) : feed.length === 0 ? (
          <div className="bg-white p-10 rounded-2xl border border-slate-200 text-center space-y-3">
            <p className="text-sm text-slate-600">Belum ada aktivitas publik di feed komunitas.</p>
            <Link
              href="/import"
              className="inline-block px-4 py-2 bg-orange-600 text-white text-xs font-bold rounded-xl"
            >
              Jadilah Pelari Pertama yang Membagikan Sesi &rarr;
            </Link>
          </div>
        ) : (
          feed.map((act) => (
            <article
              key={act.id}
              className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden"
            >
              {/* Header Profil Pelari */}
              <div className="p-5 pb-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-orange-500 to-amber-500 text-white font-black flex items-center justify-center text-sm">
                    {(act.athlete_name || 'P')[0].toUpperCase()}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-slate-900">{act.athlete_name}</span>
                      {act.has_gps_glitch && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 bg-emerald-50 text-emerald-700 rounded-full">
                          <ShieldCheck className="w-3 h-3" /> GPS Verified
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-400 flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {new Date(act.start_time).toLocaleDateString('id-ID', {
                        weekday: 'long',
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => handleShareCard(act)}
                  className="p-2 text-slate-400 hover:text-orange-600 hover:bg-orange-50 rounded-lg transition"
                  title="Salin Ringkasan untuk WhatsApp/Sosmed"
                >
                  <Share2 className="w-4 h-4" />
                </button>
              </div>

              {/* Judul & Catatan Latihan */}
              <div className="px-5 pb-4">
                <h2 className="font-extrabold text-base text-slate-900">{act.title}</h2>
                {act.caption && (
                  <p className="text-sm text-slate-600 mt-1">{act.caption}</p>
                )}

                {/* Grid Metrik Olahraga */}
                <div className="grid grid-cols-4 gap-2 mt-4 p-3.5 bg-slate-50 rounded-xl border border-slate-100">
                  <div>
                    <p className="text-[10px] font-bold uppercase text-slate-400">Jarak</p>
                    <p className="text-base font-black text-slate-900">
                      {(Number(act.distance_m) / 1000).toFixed(2)} <span className="text-xs font-normal">km</span>
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold uppercase text-slate-400">GAP Pace</p>
                    <p className="text-base font-black text-orange-600">
                      {formatPace(act.gap_pace_s_per_km)}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold uppercase text-slate-400">Waktu</p>
                    <p className="text-base font-bold text-slate-800">
                      {formatDuration(act.moving_time_s)}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold uppercase text-slate-400 flex items-center gap-0.5">
                      <Mountain className="w-3 h-3 text-emerald-600" /> Elevasi
                    </p>
                    <p className="text-base font-bold text-emerald-600">
                      +{act.elevation_gain_m} m
                    </p>
                  </div>
                </div>

                {act.avg_hr && (
                  <p className="text-xs text-slate-500 mt-2.5 flex items-center gap-1">
                    <Heart className="w-3.5 h-3.5 text-red-500" /> Rata-rata Detak Jantung: <strong>{act.avg_hr} bpm</strong>
                  </p>
                )}
              </div>

              {/* Bar Aksi Kudos & Jumlah Komentar */}
              <div className="px-5 py-2.5 border-t border-slate-100 flex items-center justify-between bg-slate-50/60">
                <button
                  onClick={() => handleKudos(act)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                    act.user_has_kudosed
                      ? 'bg-orange-600 text-white shadow-sm'
                      : 'bg-white border border-slate-200 text-slate-600 hover:border-orange-400 hover:text-orange-600'
                  }`}
                >
                  <Flame className="w-4 h-4" />
                  <span>{act.kudos_count || 0} Kudos</span>
                </button>

                <span className="text-xs text-slate-500 flex items-center gap-1">
                  <MessageCircle className="w-3.5 h-3.5" />
                  {(act.comments || []).length} Komentar
                </span>
              </div>

              {/* Kolom Komentar Pelari */}
              <div className="px-5 py-3 bg-slate-50 border-t border-slate-100 space-y-2.5">
                {(act.comments || []).map((c) => (
                  <div key={c.id} className="text-xs bg-white p-2.5 rounded-lg border border-slate-100">
                    <span className="font-bold text-slate-900 mr-1.5">{c.athlete_name}</span>
                    <span className="text-slate-700">{c.content}</span>
                  </div>
                ))}

                <div className="flex items-center gap-2 pt-1">
                  <input
                    type="text"
                    value={commentInputs[act.id] || ''}
                    onChange={(e) =>
                      setCommentInputs((prev) => ({ ...prev, [act.id]: e.target.value }))
                    }
                    onKeyDown={(e) => e.key === 'Enter' && handleSendComment(act.id)}
                    placeholder="Beri semangat atau tanya sepatu/rute..."
                    className="flex-1 text-xs px-3 py-2 bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-orange-500"
                  />
                  <button
                    onClick={() => handleSendComment(act.id)}
                    disabled={submittingComment === act.id}
                    className="p-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg disabled:opacity-50"
                  >
                    <Send className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </article>
          ))
        )}
      </main>
    </div>
  );
}
