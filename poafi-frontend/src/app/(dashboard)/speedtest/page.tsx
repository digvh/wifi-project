"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import {
  Gauge,
  ArrowDown,
  ArrowUp,
  Activity,
  Wifi,
  Play,
  RotateCcw,
  Router,
  Users,
  Trash2,
  ShieldAlert,
  Radio,
} from "lucide-react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import { apiFetch, getApiUrl } from "@/lib/api";
import { useLanguage } from "@/context/LanguageContext";

type TestPhase = "idle" | "ping" | "download" | "upload" | "done";

interface SpeedSample {
  step: string;
  download: number | null;
  upload: number | null;
}

interface HistoryEntry {
  id: string;
  timestamp: string;
  downloadMbps: number;
  uploadMbps: number;
  pingMs: number;
  jitterMs: number;
}

function createRandomPayload(totalBytes: number): Uint8Array {
  const buf = new Uint8Array(totalBytes);
  if (typeof window !== "undefined" && window.crypto?.getRandomValues) {
    const step = 65536;
    for (let offset = 0; offset < totalBytes; offset += step) {
      const len = Math.min(step, totalBytes - offset);
      window.crypto.getRandomValues(buf.subarray(offset, offset + len));
    }
  } else {
    for (let i = 0; i < totalBytes; i++) {
      buf[i] = (i * 131 + 17) & 0xff;
    }
  }
  return buf;
}

export default function SpeedTestPage() {
  const { t } = useLanguage();

  const [phase, setPhase] = useState<TestPhase>("idle");
  const [liveMbps, setLiveMbps] = useState(0);
  const [downloadMbps, setDownloadMbps] = useState(0);
  const [peakDownload, setPeakDownload] = useState(0);
  const [uploadMbps, setUploadMbps] = useState(0);
  const [peakUpload, setPeakUpload] = useState(0);
  const [pingMs, setPingMs] = useState(0);
  const [jitterMs, setJitterMs] = useState(0);
  const [progressPct, setProgressPct] = useState(0);
  const [samples, setSamples] = useState<SpeedSample[]>([]);
  const [error, setError] = useState("");
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  // MikroTik Router WAN probe state
  const [routers, setRouters] = useState<any[]>([]);
  const [selectedRouterId, setSelectedRouterId] = useState("");
  const [wanLoading, setWanLoading] = useState(false);
  const [wanStats, setWanStats] = useState<any>(null);
  const [wanError, setWanError] = useState("");

  const abortRef = useRef<AbortController | null>(null);
  const xhrRef = useRef<XMLHttpRequest | null>(null);

  const isLocalHost =
    typeof window !== "undefined" &&
    ["localhost", "127.0.0.1"].includes(window.location.hostname);

  useEffect(() => {
    try {
      const saved = localStorage.getItem("poafi_speed_history");
      if (saved) setHistory(JSON.parse(saved));
    } catch {
      /* ignore storage errors */
    }

    apiFetch("/routers")
      .then((res) => {
        const supported = (res.routers || []).filter(
          (r: any) => r.vendor === "MIKROTIK" || r.vendor === "TPLINK_OMADA"
        );
        setRouters(supported);
        if (supported.length > 0) setSelectedRouterId(supported[0].id);
      })
      .catch(() => {});

    return () => {
      abortRef.current?.abort();
      xhrRef.current?.abort();
    };
  }, []);

  const gaugeMax = useMemo(() => {
    const top = Math.max(liveMbps, downloadMbps, uploadMbps, 50);
    if (top <= 50) return 50;
    if (top <= 100) return 100;
    if (top <= 250) return 250;
    if (top <= 500) return 500;
    return 1000;
  }, [liveMbps, downloadMbps, uploadMbps]);

  const gaugeProgress = Math.min(1, Math.max(0, liveMbps / gaugeMax));
  // 240-degree sweep arc
  const radius = 92;
  const circumference = 2 * Math.PI * radius;
  const arcLength = circumference * (240 / 360);
  const dashOffset = arcLength * (1 - gaugeProgress);
  const needleDeg = -120 + gaugeProgress * 240;

  const estimatedUsers = useMemo(() => {
    if (downloadMbps <= 0) return 0;
    return Math.max(1, Math.floor(downloadMbps / 3)); // ~3 Mbps per active hotspot client
  }, [downloadMbps]);

  const runSpeedTest = async () => {
    if (phase !== "idle" && phase !== "done") return;

    setError("");
    setSamples([]);
    setDownloadMbps(0);
    setPeakDownload(0);
    setUploadMbps(0);
    setPeakUpload(0);
    setPingMs(0);
    setJitterMs(0);
    setLiveMbps(0);
    setProgressPct(4);

    const baseUrl = getApiUrl();
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      // -------------------------------------------------------------
      // 1. PING & JITTER (5 HTTP round-trips)
      // -------------------------------------------------------------
      setPhase("ping");
      const rtts: number[] = [];
      for (let i = 0; i < 5; i++) {
        const t0 = performance.now();
        const res = await fetch(`${baseUrl}/speedtest/ping?_=${Date.now()}_${i}`, {
          credentials: "include",
          headers: { "X-Requested-With": "PoaFi-Web" },
          signal: controller.signal,
        });
        if (!res.ok) throw new Error(t("Imeshindikana kuwasiliana na seva ya kipimo.", "Could not reach speed test server."));
        await res.json();
        const rtt = performance.now() - t0;
        rtts.push(rtt);
        setProgressPct(6 + (i + 1) * 3);
      }

      const avgPing = Number((rtts.reduce((a, b) => a + b, 0) / rtts.length).toFixed(1));
      let jitterSum = 0;
      for (let i = 1; i < rtts.length; i++) {
        jitterSum += Math.abs(rtts[i] - rtts[i - 1]);
      }
      const avgJitter = Number((rtts.length > 1 ? jitterSum / (rtts.length - 1) : 0).toFixed(1));
      setPingMs(avgPing);
      setJitterMs(avgJitter);

      // -------------------------------------------------------------
      // 2. DOWNLOAD SPEED (8 MB incompressible binary stream)
      // -------------------------------------------------------------
      setPhase("download");
      const targetDownloadBytes = 8_000_000;
      const dlStart = performance.now();
      const dlRes = await fetch(`${baseUrl}/speedtest/download?bytes=${targetDownloadBytes}&_=${Date.now()}`, {
        credentials: "include",
        headers: { "X-Requested-With": "PoaFi-Web" },
        signal: controller.signal,
      });
      if (!dlRes.ok || !dlRes.body) {
        throw new Error(t("Jaribio la kupakua limeshindwa.", "Download speed measurement failed."));
      }

      const reader = dlRes.body.getReader();
      let receivedBytes = 0;
      let lastSampleTime = dlStart;
      let lastSampleBytes = 0;
      let maxDl = 0;
      let tick = 1;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        receivedBytes += value.byteLength;
        const now = performance.now();
        const elapsedTotalSec = Math.max(0.005, (now - dlStart) / 1000);
        const totalAvgMbps = Number((((receivedBytes * 8) / elapsedTotalSec) / 1_000_000).toFixed(2));

        const windowSec = (now - lastSampleTime) / 1000;
        if (windowSec >= 0.08) {
          const instantMbps = Number(((((receivedBytes - lastSampleBytes) * 8) / windowSec) / 1_000_000).toFixed(2));
          if (instantMbps > maxDl) maxDl = instantMbps;
          setLiveMbps(instantMbps);
          setDownloadMbps(totalAvgMbps);
          setPeakDownload(maxDl);
          setProgressPct(22 + Math.min(38, Math.round((receivedBytes / targetDownloadBytes) * 38)));
          setSamples((prev) => [...prev.slice(-24), { step: `D${tick++}`, download: instantMbps, upload: null }]);
          lastSampleTime = now;
          lastSampleBytes = receivedBytes;
        }
      }

      const dlTotalSec = Math.max(0.005, (performance.now() - dlStart) / 1000);
      const finalDlMbps = Number((((receivedBytes * 8) / dlTotalSec) / 1_000_000).toFixed(2));
      const finalPeakDl = Math.max(maxDl, finalDlMbps);
      setDownloadMbps(finalDlMbps);
      setPeakDownload(finalPeakDl);
      setLiveMbps(finalDlMbps);
      setProgressPct(60);

      // -------------------------------------------------------------
      // 3. UPLOAD SPEED (4 MB binary XHR progress stream)
      // -------------------------------------------------------------
      setPhase("upload");
      const uploadBytes = 4_000_000;
      const payload = createRandomPayload(uploadBytes);
      let maxUl = 0;

      const finalUlMbps = await new Promise<number>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhrRef.current = xhr;
        const ulStart = performance.now();
        let lastT = ulStart;
        let lastLoaded = 0;
        let ulTick = 1;

        xhr.open("POST", `${baseUrl}/speedtest/upload?_=${Date.now()}`, true);
        xhr.withCredentials = true;
        xhr.setRequestHeader("Content-Type", "application/octet-stream");
        xhr.setRequestHeader("X-Requested-With", "PoaFi-Web");

        xhr.upload.onprogress = (ev) => {
          if (!ev.lengthComputable) return;
          const now = performance.now();
          const winSec = (now - lastT) / 1000;
          if (winSec >= 0.08) {
            const inst = Number(((((ev.loaded - lastLoaded) * 8) / winSec) / 1_000_000).toFixed(2));
            const avg = Number((((ev.loaded * 8) / Math.max(0.005, (now - ulStart) / 1000)) / 1_000_000).toFixed(2));
            if (inst > maxUl) maxUl = inst;
            setLiveMbps(inst);
            setUploadMbps(avg);
            setPeakUpload(maxUl);
            setProgressPct(60 + Math.min(38, Math.round((ev.loaded / ev.total) * 38)));
            setSamples((prev) => [...prev.slice(-24), { step: `U${ulTick++}`, download: null, upload: inst }]);
            lastT = now;
            lastLoaded = ev.loaded;
          }
        };

        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            const totalSec = Math.max(0.005, (performance.now() - ulStart) / 1000);
            const avg = Number((((uploadBytes * 8) / totalSec) / 1_000_000).toFixed(2));
            resolve(avg);
          } else {
            reject(new Error(`Upload failed (HTTP ${xhr.status})`));
          }
        };
        xhr.onerror = () => reject(new Error(t("Jaribio la kupakia limeshindwa.", "Upload speed test failed.")));
        xhr.onabort = () => reject(new Error("Aborted"));
        xhr.send(new Blob([payload.buffer as ArrayBuffer], { type: "application/octet-stream" }));
      });

      const finalPeakUl = Math.max(maxUl, finalUlMbps);
      setUploadMbps(finalUlMbps);
      setPeakUpload(finalPeakUl);
      setLiveMbps(finalDlMbps);
      setProgressPct(100);
      setPhase("done");

      const entry: HistoryEntry = {
        id: `${Date.now()}`,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
        downloadMbps: finalDlMbps,
        uploadMbps: finalUlMbps,
        pingMs: avgPing,
        jitterMs: avgJitter,
      };
      setHistory((prev) => {
        const next = [entry, ...prev].slice(0, 8);
        try {
          localStorage.setItem("poafi_speed_history", JSON.stringify(next));
        } catch {
          /* ignore */
        }
        return next;
      });
    } catch (err: any) {
      if (err?.name !== "AbortError") {
        setError(err.message || t("Kipimo kimeshindwa.", "Speed test failed."));
      }
      setPhase("idle");
      setProgressPct(0);
    } finally {
      abortRef.current = null;
      xhrRef.current = null;
    }
  };

  const probeRouterWan = async () => {
    if (!selectedRouterId) return;
    setWanLoading(true);
    setWanError("");
    try {
      const res = await apiFetch(`/speedtest/router/${selectedRouterId}/wan`);
      setWanStats(res);
    } catch (err: any) {
      setWanError(err.message || t("Imeshindikana kusoma kipimo cha WAN kutoka kwenye router.", "Could not read WAN bandwidth from router."));
    } finally {
      setWanLoading(false);
    }
  };

  const phaseLabel =
    phase === "ping"
      ? t("Inapima Muda wa Majibu (Ping)...", "Measuring Ping & Jitter...")
      : phase === "download"
        ? t("Inapima Kasi ya Kupakua (Download)...", "Testing Download Bandwidth...")
        : phase === "upload"
          ? t("Inapima Kasi ya Kupakia (Upload)...", "Testing Upload Bandwidth...")
          : phase === "done"
            ? t("Kipimo Kimekamilika", "Test Complete")
            : t("Tayari Kupima Kasi ya ISP", "Ready to Test ISP Speed");

  return (
    <div className="max-w-[1600px] mx-auto space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-3">
            <Gauge className="text-[#00f3ff] w-8 h-8 shrink-0" />
            <span>{t("Kipima Kasi & Uwezo wa ISP", "ISP Bandwidth & Speed Tester")}</span>
          </h1>
          <p className="text-gray-400 text-sm mt-1">
            {t(
              "Pima kasi halisi ya intaneti kutoka kwa mtoa huduma wako (ISP) na uwezo wa mtandao kuhudumia wateja.",
              "Measure live ISP download/upload speed, latency, and hotspot capacity."
            )}
          </p>
        </div>

        <motion.button
          whileHover={{ scale: 1.03 }}
          whileTap={{ scale: 0.97 }}
          onClick={runSpeedTest}
          disabled={phase !== "idle" && phase !== "done"}
          className="w-full sm:w-auto bg-gradient-to-r from-[#00f3ff] to-[#9d00ff] text-white font-black px-6 py-3 rounded-2xl text-sm shadow-lg shadow-[#00f3ff]/25 flex items-center justify-center gap-2 disabled:opacity-50"
        >
          {phase === "done" ? <RotateCcw size={16} /> : <Play size={16} />}
          <span>
            {phase !== "idle" && phase !== "done"
              ? t("Inapima...", "Testing...")
              : phase === "done"
                ? t("Pima Tena", "Run Test Again")
                : t("Anza Kupima Kasi", "Start Speed Test")}
          </span>
        </motion.button>
      </div>

      {isLocalHost && (
        <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-200 text-xs flex items-start gap-2.5">
          <Radio size={16} className="text-amber-400 shrink-0 mt-0.5" />
          <span>
            {t(
              "Uko kwenye kompyuta ya ndani (localhost). Kwenye seva halisi hewani, kipimo hiki hupima kasi halisi ya ISP wako kuelekea seva. Tumia pia Kipimo cha MikroTik WAN hapa chini kupima trafiki halisi ya router.",
              "Running on localhost loopback — speeds reflect local memory bus. When deployed online (or from your hotspot site), this tests true ISP throughput. You can also probe live MikroTik WAN traffic below."
            )}
          </span>
        </div>
      )}

      {error && (
        <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 text-sm flex items-center gap-2">
          <ShieldAlert size={18} />
          <span>{error}</span>
        </div>
      )}

      {/* Main Gauge + Live Chart */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Animated Speedometer Gauge */}
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-panel p-6 rounded-3xl border border-white/10 flex flex-col items-center justify-between relative overflow-hidden"
        >
          <div className="flex items-center gap-2 text-xs font-semibold px-3 py-1 rounded-full bg-white/5 border border-white/10 text-[#00f3ff]">
            <span
              className={`w-2 h-2 rounded-full ${
                phase !== "idle" && phase !== "done" ? "bg-[#00f3ff] animate-ping" : "bg-emerald-400"
              }`}
            />
            <span>{phaseLabel}</span>
          </div>

          <div className="relative w-56 h-56 sm:w-64 sm:h-64 flex items-center justify-center my-4">
            <svg viewBox="0 0 220 220" className="w-full h-full">
              <defs>
                <linearGradient id="speedArcGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#00f3ff" />
                  <stop offset="60%" stopColor="#6a00ff" />
                  <stop offset="100%" stopColor="#ff00ea" />
                </linearGradient>
              </defs>

              {/* Background 240-deg track */}
              <circle
                cx="110"
                cy="110"
                r={radius}
                fill="none"
                stroke="rgba(255,255,255,0.08)"
                strokeWidth="16"
                strokeLinecap="round"
                strokeDasharray={`${arcLength} ${circumference}`}
                transform="rotate(150 110 110)"
              />

              {/* Animated active progress arc */}
              <motion.circle
                cx="110"
                cy="110"
                r={radius}
                fill="none"
                stroke="url(#speedArcGrad)"
                strokeWidth="16"
                strokeLinecap="round"
                strokeDasharray={`${arcLength} ${circumference}`}
                animate={{ strokeDashoffset: dashOffset }}
                transition={{ type: "spring", stiffness: 90, damping: 18 }}
                transform="rotate(150 110 110)"
              />

              {/* Animated gauge needle */}
              <motion.g
                animate={{ rotate: needleDeg }}
                transition={{ type: "spring", stiffness: 100, damping: 16 }}
                style={{ transformOrigin: "110px 110px" }}
              >
                <line
                  x1="110"
                  y1="110"
                  x2="110"
                  y2="38"
                  stroke="#00f3ff"
                  strokeWidth="3"
                  strokeLinecap="round"
                />
                <circle cx="110" cy="110" r="7" fill="#00f3ff" />
              </motion.g>
            </svg>

            <div className="absolute inset-0 flex flex-col items-center justify-end pb-6 pointer-events-none">
              <span className="text-4xl sm:text-5xl font-black font-mono tabular-nums text-white tracking-tight">
                {liveMbps.toFixed(1)}
              </span>
              <span className="text-xs font-bold uppercase tracking-widest text-[#00f3ff]">Mbps</span>
              <span className="text-[10px] text-gray-500 mt-0.5">
                {t("Kiwango:", "Scale:")} 0 – {gaugeMax} Mbps
              </span>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="w-full space-y-1.5">
            <div className="w-full bg-white/5 rounded-full h-2 overflow-hidden">
              <motion.div
                animate={{ width: `${progressPct}%` }}
                transition={{ duration: 0.2 }}
                className="h-full bg-gradient-to-r from-[#00f3ff] to-[#9d00ff]"
              />
            </div>
            <div className="flex justify-between text-[11px] text-gray-400">
              <span>{progressPct}%</span>
              <span>
                {phase === "upload"
                  ? t("Kupakia", "Upload")
                  : phase === "download"
                    ? t("Kupakua", "Download")
                    : phase === "ping"
                      ? "Ping"
                      : t("Kipimo", "Status")}
              </span>
            </div>
          </div>
        </motion.div>

        {/* Live Telemetry Cards + Real-time Chart */}
        <div className="lg:col-span-2 space-y-5 min-w-0">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.04 }}
              className="glass-panel p-4 rounded-2xl border border-white/10"
            >
              <div className="flex items-center justify-between text-xs text-gray-400 mb-1">
                <span>{t("Kupakua", "Download")}</span>
                <ArrowDown size={15} className="text-[#00f3ff]" />
              </div>
              <p className="text-2xl font-black font-mono text-[#00f3ff] tabular-nums">
                {downloadMbps.toFixed(1)}
              </p>
              <p className="text-[10px] text-gray-500 mt-0.5">
                {t("Juu zaidi:", "Peak:")} {peakDownload.toFixed(1)} Mbps
              </p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.08 }}
              className="glass-panel p-4 rounded-2xl border border-white/10"
            >
              <div className="flex items-center justify-between text-xs text-gray-400 mb-1">
                <span>{t("Kupakia", "Upload")}</span>
                <ArrowUp size={15} className="text-[#9d00ff]" />
              </div>
              <p className="text-2xl font-black font-mono text-[#c066ff] tabular-nums">
                {uploadMbps.toFixed(1)}
              </p>
              <p className="text-[10px] text-gray-500 mt-0.5">
                {t("Juu zaidi:", "Peak:")} {peakUpload.toFixed(1)} Mbps
              </p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.12 }}
              className="glass-panel p-4 rounded-2xl border border-white/10"
            >
              <div className="flex items-center justify-between text-xs text-gray-400 mb-1">
                <span>Ping / Jitter</span>
                <Activity size={15} className="text-emerald-400" />
              </div>
              <p className="text-2xl font-black font-mono text-white tabular-nums">
                {pingMs > 0 ? `${pingMs}ms` : "—"}
              </p>
              <p className="text-[10px] text-gray-500 mt-0.5">
                Jitter: {jitterMs > 0 ? `${jitterMs} ms` : "—"}
              </p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.16 }}
              className="glass-panel p-4 rounded-2xl border border-emerald-500/25 bg-emerald-500/5"
            >
              <div className="flex items-center justify-between text-xs text-emerald-300 mb-1">
                <span>{t("Uwezo (Wateja)", "Capacity")}</span>
                <Users size={15} className="text-emerald-400" />
              </div>
              <p className="text-2xl font-black font-mono text-emerald-400 tabular-nums">
                {estimatedUsers > 0 ? `~${estimatedUsers}` : "—"}
              </p>
              <p className="text-[10px] text-gray-400 mt-0.5">
                {t("Wateja @ 3 Mbps kila mmoja", "Concurrent @ 3 Mbps each")}
              </p>
            </motion.div>
          </div>

          {/* Live Transfer Graph */}
          <div className="glass-panel p-5 rounded-2xl border border-white/10 h-[240px] flex flex-col">
            <div className="flex items-center justify-between mb-3 text-xs">
              <h2 className="font-bold text-white flex items-center gap-2">
                <Wifi size={15} className="text-[#00f3ff]" />
                <span>{t("Mwenendo wa Kasi Moja kwa Moja (Mbps)", "Real-Time Throughput Curve (Mbps)")}</span>
              </h2>
              <div className="flex items-center gap-3 text-[11px]">
                <span className="text-[#00f3ff]">● {t("Kupakua", "Download")}</span>
                <span className="text-[#c066ff]">● {t("Kupakia", "Upload")}</span>
              </div>
            </div>

            <div className="flex-1 min-h-0">
              {samples.length === 0 ? (
                <div className="h-full flex items-center justify-center text-xs text-gray-500">
                  {t(
                    "Bonyeza \"Anza Kupima Kasi\" kuona grafu ya kasi moja kwa moja.",
                    "Click \"Start Speed Test\" to plot real-time ISP throughput."
                  )}
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={samples}>
                    <defs>
                      <linearGradient id="dlGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#00f3ff" stopOpacity={0.35} />
                        <stop offset="95%" stopColor="#00f3ff" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="ulGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#9d00ff" stopOpacity={0.35} />
                        <stop offset="95%" stopColor="#9d00ff" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" vertical={false} />
                    <XAxis dataKey="step" stroke="#64748b" tick={{ fontSize: 10 }} tickLine={false} />
                    <YAxis stroke="#64748b" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "rgba(10,10,26,0.95)",
                        border: "1px solid rgba(0,243,255,0.3)",
                        borderRadius: "10px",
                        fontSize: "11px",
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey="download"
                      name={t("Kupakua (Mbps)", "Download (Mbps)")}
                      stroke="#00f3ff"
                      strokeWidth={2.5}
                      fill="url(#dlGrad)"
                      connectNulls={false}
                      isAnimationActive={false}
                    />
                    <Area
                      type="monotone"
                      dataKey="upload"
                      name={t("Kupakia (Mbps)", "Upload (Mbps)")}
                      stroke="#c066ff"
                      strokeWidth={2.5}
                      fill="url(#ulGrad)"
                      connectNulls={false}
                      isAnimationActive={false}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Row: MikroTik Live WAN Probe + Recent History */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* MikroTik Router WAN Monitor */}
        <div className="glass-panel p-6 rounded-2xl border border-white/10 space-y-4">
          <div className="flex items-center justify-between gap-2">
            <h2 className="font-bold text-white flex items-center gap-2 text-base">
              <Router size={18} className="text-[#00f3ff]" />
              <span>{t("Trafiki ya Moja kwa Moja ya Router WAN (ISP)", "Live Router WAN Traffic & ISP Ping")}</span>
            </h2>
          </div>

          <p className="text-xs text-gray-400">
            {t(
              "Chunguza kipimo halisi cha intaneti kutoka MikroTik (WAN + ping 8.8.8.8) au Kidhibiti cha TP-Link Omada (trafiki ya mtambo na wateja hewani).",
              "Reads real-time Rx/Tx throughput and latency directly from your MikroTik WAN port or TP-Link Omada Controller."
            )}
          </p>

          {routers.length === 0 ? (
            <p className="text-xs text-gray-500 p-3 rounded-xl bg-white/5 border border-white/10">
              {t(
                "Hakuna router ya MikroTik au TP-Link Omada iliyosajiliwa bado. Nenda kwenye ukurasa wa Routers kuunganisha.",
                "No MikroTik or TP-Link Omada routers registered yet. Add one on the Routers page to probe WAN telemetry."
              )}
            </p>
          ) : (
            <div className="flex flex-col sm:flex-row gap-2.5">
              <select
                value={selectedRouterId}
                onChange={(e) => setSelectedRouterId(e.target.value)}
                className="flex-1 bg-[#0a0a1a] border border-white/15 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-[#00f3ff]"
              >
                {routers.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name} [{r.vendor === "TPLINK_OMADA" ? "Omada" : "MikroTik"}] ({r.host})
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={probeRouterWan}
                disabled={wanLoading}
                className="bg-white/10 hover:bg-white/20 text-white font-bold px-4 py-2.5 rounded-xl text-xs transition-colors shrink-0 disabled:opacity-50"
              >
                {wanLoading ? t("Inasoma Router...", "Probing Router...") : t("Pima WAN ya Mtambo", "Probe Router WAN")}
              </button>
            </div>
          )}

          {wanError && (
            <div className="text-xs text-red-300 bg-red-500/10 border border-red-500/30 p-3 rounded-xl">
              {wanError}
            </div>
          )}

          {wanStats && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
              <div className="bg-white/5 border border-white/10 rounded-xl p-3">
                <p className="text-[10px] text-gray-400 uppercase">{t("Mlango / Kifaa", "WAN / Target")}</p>
                <p className="text-sm font-bold text-white font-mono mt-0.5 truncate" title={wanStats.wanInterface}>{wanStats.wanInterface}</p>
              </div>
              <div className="bg-white/5 border border-white/10 rounded-xl p-3">
                <p className="text-[10px] text-gray-400 uppercase">{t("ISP Inayoingia", "Live Rx")}</p>
                <p className="text-sm font-bold text-[#00f3ff] font-mono mt-0.5">{wanStats.rxMbps} Mbps</p>
              </div>
              <div className="bg-white/5 border border-white/10 rounded-xl p-3">
                <p className="text-[10px] text-gray-400 uppercase">{t("ISP Inayotoka", "Live Tx")}</p>
                <p className="text-sm font-bold text-[#c066ff] font-mono mt-0.5">{wanStats.txMbps} Mbps</p>
              </div>
              <div className="bg-white/5 border border-white/10 rounded-xl p-3">
                <p className="text-[10px] text-gray-400 uppercase">
                  {wanStats.vendor === "TPLINK_OMADA"
                    ? t("Wateja / Ping", "Clients / RTT")
                    : "Ping 8.8.8.8"}
                </p>
                <p className="text-sm font-bold text-emerald-400 font-mono mt-0.5">
                  {wanStats.vendor === "TPLINK_OMADA" && wanStats.activeClients !== undefined
                    ? `${wanStats.activeClients} (${wanStats.pingMs ?? "-"}ms)`
                    : wanStats.pingMs !== null
                      ? `${wanStats.pingMs} ms`
                      : "N/A"}
                  {wanStats.packetLossPct !== null && wanStats.packetLossPct > 0
                    ? ` (${wanStats.packetLossPct}% loss)`
                    : ""}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Recent History */}
        <div className="glass-panel p-6 rounded-2xl border border-white/10 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-bold text-white text-base">
              {t("Historia ya Vipimo vya Hivi Karibuni", "Recent Speed Test History")}
            </h2>
            {history.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  setHistory([]);
                  try {
                    localStorage.removeItem("poafi_speed_history");
                  } catch {
                    /* ignore */
                  }
                }}
                className="text-xs text-red-400 hover:text-red-300 flex items-center gap-1"
              >
                <Trash2 size={13} /> {t("Futa", "Clear")}
              </button>
            )}
          </div>

          {history.length === 0 ? (
            <p className="text-xs text-gray-500 p-3 rounded-xl bg-white/5 border border-white/10">
              {t("Hakuna historia bado. Endesha kipimo chako cha kwanza hapa juu.", "No tests recorded yet. Run your first test above.")}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="text-gray-400 border-b border-white/10 uppercase">
                  <tr>
                    <th className="py-2 pr-3">{t("Muda", "Time")}</th>
                    <th className="py-2 pr-3">{t("Kupakua", "Download")}</th>
                    <th className="py-2 pr-3">{t("Kupakia", "Upload")}</th>
                    <th className="py-2">Ping</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {history.map((item) => (
                    <tr key={item.id}>
                      <td className="py-2 pr-3 text-gray-400 font-mono">{item.timestamp}</td>
                      <td className="py-2 pr-3 text-[#00f3ff] font-bold font-mono">{item.downloadMbps.toFixed(1)} Mbps</td>
                      <td className="py-2 pr-3 text-[#c066ff] font-bold font-mono">{item.uploadMbps.toFixed(1)} Mbps</td>
                      <td className="py-2 text-white font-mono">{item.pingMs} ms</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
