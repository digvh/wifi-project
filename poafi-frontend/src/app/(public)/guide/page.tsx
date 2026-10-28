"use client";

import { useState } from "react";
import Link from "next/link";
import { 
  Server, 
  Terminal, 
  Copy, 
  Check, 
  HelpCircle, 
  ShieldCheck, 
  PhoneCall, 
  Layers, 
  Wifi, 
  ArrowRight,
  Download,
  AlertTriangle,
  FileCode,
  Globe
} from "lucide-react";

import { useLanguage } from "@/context/LanguageContext";

export default function GuidePage() {
  const { lang, setLang } = useLanguage();
  const [activeBrand, setActiveBrand] = useState<"mikrotik" | "tplink" | "ruijie" | "generic">("mikrotik");
  const [copiedScript, setCopiedScript] = useState<string | null>(null);

  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedScript(id);
    setTimeout(() => setCopiedScript(null), 2500);
  };

  const mikrotikScript = `/ip hotspot profile
set [ find default=yes ] login-by=http-chap,http-pap,mac-cookie
/ip hotspot walled-garden
add dst-host=*poafi.co.tz
add dst-host=*azampay.com
add dst-host=*vodacom.co.tz
add dst-host=*tigo.co.tz
add dst-host=*airtel.co.tz
add dst-host=*halotel.co.tz
/ip service
set api disabled=no port=8728
/user group
add name=poafi policy=api,read,write,test
/user
add group=poafi name=poafi_agent password="ChaguaNenosiriLako123"`;

  const walledGardenScript = `/ip hotspot walled-garden ip
add action=accept dst-address=192.168.56.1
add action=accept dst-host=*poafi*
add action=accept dst-host=*azam*
add action=accept dst-host=*tigopesa*
add action=accept dst-host=*mpesa*`;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-12">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-8 border-b border-white/10">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#00f3ff]/10 border border-[#00f3ff]/20 text-[#00f3ff] text-xs font-bold mb-3">
            <Server size={14} />
            <span>{lang === "sw" ? "Mwongozo wa Kiufundi" : "Technical Setup Guide"}</span>
          </div>
          <h1 className="text-3xl sm:text-5xl font-black text-white">
            {lang === "sw" ? "Jinsi ya Kusanidi Router Yako na PoaFi" : "How to Configure Your Router for PoaFi"}
          </h1>
          <p className="text-sm text-gray-400 mt-2 max-w-3xl leading-relaxed">
            {lang === "sw"
              ? "Fuata hatua hizi rahisi kuunganisha router yako na mfumo wa PoaFi. Ikiwa huwezi kusanidi mwenyewe, unaweza kuleta kifaa ofisini kwetu na mafundi wetu watakusanidia bure au kwa TeamViewer."
              : "Follow these step-by-step instructions to connect your router to the PoaFi platform. If you prefer our team to configure it for you, bring the device to our office or contact us for remote setup."}
          </p>
        </div>

        {/* Language Switcher */}
        <div className="flex items-center gap-2 bg-white/5 border border-white/10 p-1.5 rounded-2xl shrink-0 self-start md:self-auto">
          <button
            onClick={() => setLang("sw")}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              lang === "sw"
                ? "bg-[#00f3ff] text-black shadow-md shadow-[#00f3ff]/30"
                : "text-gray-400 hover:text-white"
            }`}
          >
            🇹🇿 Kiswahili
          </button>
          <button
            onClick={() => setLang("en")}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              lang === "en"
                ? "bg-[#00f3ff] text-black shadow-md shadow-[#00f3ff]/30"
                : "text-gray-400 hover:text-white"
            }`}
          >
            🇬🇧 English
          </button>
        </div>
      </div>

      {/* Choice Banner: Self-Config vs Bring Device */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="glass-panel p-6 rounded-2xl border border-white/10 bg-gradient-to-tr from-[#00f3ff]/5 to-transparent">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-9 h-9 rounded-xl bg-[#00f3ff]/15 flex items-center justify-center text-[#00f3ff] font-bold text-sm">
              A
            </div>
            <h3 className="font-bold text-white text-base">
              {lang === "sw" ? "Kusanidi Mwenyewe (Self-Service)" : "Self-Configuration"}
            </h3>
          </div>
          <p className="text-xs text-gray-300 leading-relaxed">
            {lang === "sw"
              ? "Fuata maelekezo ya hapa chini kulingana na router yako (MikroTik, TP-Link, n.k.). Kisha jisajili kwenye mfumo na uingize taarifa za router yako kwenye sehemu ya 'Routers'."
              : "Follow the technical steps below for your hardware brand. Then log into your PoaFi operator dashboard and add the router details under 'Routers'."}
          </p>
        </div>

        <div className="glass-panel p-6 rounded-2xl border border-white/10 bg-gradient-to-tr from-[#9d00ff]/5 to-transparent">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-9 h-9 rounded-xl bg-[#9d00ff]/15 flex items-center justify-center text-[#9d00ff] font-bold text-sm">
              B
            </div>
            <h3 className="font-bold text-white text-base">
              {lang === "sw" ? "Leta Kifaa Ofisini / Msaada wa Mbali" : "Assisted Setup by PoaFi Team"}
            </h3>
          </div>
          <p className="text-xs text-gray-300 leading-relaxed mb-3">
            {lang === "sw"
              ? "Huna utaalamu wa mtandao? Leta kifaa chako katika ofisi zetu (Dar es Salaam / Arusha) au tupigie tukuunganishe kupitia AnyDesk. Msimamizi atakuwekea kila kitu!"
              : "Don't want to tinker with network settings? Bring your device to our office or let our engineers configure it remotely via AnyDesk / TeamViewer for free."}
          </p>
          <Link
            href="/contact"
            className="inline-flex items-center gap-1.5 text-xs text-[#00f3ff] font-semibold hover:underline"
          >
            <PhoneCall size={14} />
            <span>{lang === "sw" ? "Wasiliana na Mafundi Wetu" : "Contact Technical Support"} &rarr;</span>
          </Link>
        </div>
      </div>

      {/* Hardware Tabs */}
      <div className="flex flex-wrap gap-3 border-b border-white/10 pb-4">
        {[
          { id: "mikrotik", label: "MikroTik (RouterOS v6 & v7)", tag: "Recommended" },
          { id: "tplink", label: "TP-Link Omada / SafeStream", tag: "Hotspot" },
          { id: "ruijie", label: "Ruijie Reyee Cloud", tag: "Cloud AP" },
          { id: "generic", label: "Cudy / Comfast / Wavlink APs", tag: "Access Point" },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveBrand(tab.id as any)}
            className={`px-5 py-3 rounded-2xl text-xs font-bold transition-all flex items-center gap-2 ${
              activeBrand === tab.id
                ? "bg-[#00f3ff] text-black shadow-lg shadow-[#00f3ff]/30 scale-[1.02]"
                : "bg-white/5 border border-white/10 text-gray-400 hover:text-white hover:bg-white/10"
            }`}
          >
            <span>{tab.label}</span>
            <span
              className={`text-[9px] px-1.5 py-0.5 rounded-full ${
                activeBrand === tab.id ? "bg-black/20 text-black" : "bg-white/10 text-gray-400"
              }`}
            >
              {tab.tag}
            </span>
          </button>
        ))}
      </div>

      {/* TAB 1: MIKROTIK GUIDE */}
      {activeBrand === "mikrotik" && (
        <div className="space-y-8">
          <div className="glass-panel p-6 sm:p-8 rounded-3xl border border-white/10 space-y-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-[#00f3ff] to-[#9d00ff] text-black font-black flex items-center justify-center">
                RB
              </div>
              <div>
                <h2 className="text-xl sm:text-2xl font-bold text-white">
                  {lang === "sw"
                    ? "Mwongozo wa Hatua kwa Hatua: MikroTik RouterOS"
                    : "Step-by-Step Guide: MikroTik RouterOS"}
                </h2>
                <p className="text-xs text-gray-400">
                  {lang === "sw"
                    ? "Inafanya kazi na hEX, hAP ac2, hAP ax2, RB3011, RB4011, CCR na mifano yote ya MikroTik."
                    : "Compatible with all MikroTik RouterBOARD models (hEX, hAP, RB, CCR series)."}
                </p>
              </div>
            </div>

            {/* Step 1: Physical Setup */}
            <div className="space-y-3 pt-4 border-t border-white/5">
              <div className="flex items-center gap-2.5">
                <span className="w-7 h-7 rounded-lg bg-[#00f3ff]/20 text-[#00f3ff] font-bold text-xs flex items-center justify-center">
                  1
                </span>
                <h3 className="font-bold text-white text-base">
                  {lang === "sw" ? "Uunganishaji wa Waya (Wiring)" : "Physical Cable Connection"}
                </h3>
              </div>
              <p className="text-xs text-gray-300 pl-9 leading-relaxed">
                {lang === "sw" ? (
                  <>
                    Chomeka waya wa intaneti kutoka kwa mtoa huduma wako (Modem/Fiber) kwenye port ya{" "}
                    <code className="text-[#00f3ff] bg-black/40 px-1.5 py-0.5 rounded">ether1 (WAN)</code>. Chomeka
                    kompyuta au Access Point (kwa ajili ya wateja) kwenye port ya{" "}
                    <code className="text-[#00f3ff] bg-black/40 px-1.5 py-0.5 rounded">ether2</code> au switch ya
                    hotspot.
                  </>
                ) : (
                  <>
                    Connect your upstream internet connection (ISP/Fiber/Modem) into{" "}
                    <code className="text-[#00f3ff] bg-black/40 px-1.5 py-0.5 rounded">ether1 (WAN)</code>. Connect
                    your local network switch or outdoor Wi-Fi Access Points to{" "}
                    <code className="text-[#00f3ff] bg-black/40 px-1.5 py-0.5 rounded">ether2 (LAN/Hotspot)</code>.
                  </>
                )}
              </p>
            </div>

            {/* Step 2: Open WinBox & Hotspot Wizard */}
            <div className="space-y-3 pt-4 border-t border-white/5">
              <div className="flex items-center gap-2.5">
                <span className="w-7 h-7 rounded-lg bg-[#00f3ff]/20 text-[#00f3ff] font-bold text-xs flex items-center justify-center">
                  2
                </span>
                <h3 className="font-bold text-white text-base">
                  {lang === "sw" ? "Fungua WinBox na Sanidi Hotspot" : "Open WinBox & Run Hotspot Setup"}
                </h3>
              </div>
              <p className="text-xs text-gray-300 pl-9 leading-relaxed">
                {lang === "sw" ? (
                  <>
                    Fungua programu ya <strong>WinBox</strong> na uingie kwenye router yako (default login:{" "}
                    <code>admin</code> bila password). Kisha nenda kwenye menu ya:
                    <br />
                    <span className="text-[#00f3ff] font-mono block mt-1">
                      IP &rarr; Hotspot &rarr; Bofya kitufe cha &quot;Hotspot Setup&quot;
                    </span>
                    Chagua interface ya <code>ether2</code> au <code>bridge-hotspot</code> na ubonyeze Next mpaka
                    ikamilike. Kwenye DNS Name unaweza kuandika: <code>wifi.poafi.co.tz</code>.
                  </>
                ) : (
                  <>
                    Launch <strong>WinBox</strong> and connect to your router using its MAC address (default:{" "}
                    <code>admin</code>, no password). Navigate to:
                    <br />
                    <span className="text-[#00f3ff] font-mono block mt-1">
                      IP &rarr; Hotspot &rarr; Click &quot;Hotspot Setup&quot;
                    </span>
                    Select your LAN interface (e.g. <code>ether2</code> or <code>bridge-hotspot</code>), follow the
                    prompts to completion. Set DNS name to: <code>wifi.poafi.co.tz</code>.
                  </>
                )}
              </p>
            </div>

            {/* Step 3: Terminal script for PoaFi Integration */}
            <div className="space-y-3 pt-4 border-t border-white/5">
              <div className="flex items-center gap-2.5">
                <span className="w-7 h-7 rounded-lg bg-[#00f3ff]/20 text-[#00f3ff] font-bold text-xs flex items-center justify-center">
                  3
                </span>
                <h3 className="font-bold text-white text-base">
                  {lang === "sw"
                    ? "Weka Script ya PoaFi API na Ulinzi (New Terminal)"
                    : "Paste PoaFi API & Walled Garden Script (New Terminal)"}
                </h3>
              </div>
              <p className="text-xs text-gray-300 pl-9 leading-relaxed">
                {lang === "sw"
                  ? "Kwenye WinBox, bofya 'New Terminal' na ubandike (paste) script hii ya chini. Inafungua API ya router na kusanidi Walled Garden ili wateja waweze kufanya malipo ya M-Pesa na Tigo Pesa kabla hawajanunua kifurushi:"
                  : "In WinBox, click 'New Terminal' and paste the commands below. This creates an isolated API user for PoaFi and configures the Walled Garden to allow mobile money gateways before user login:"}
              </p>

              <div className="ml-9 relative">
                <div className="bg-black/70 border border-white/10 rounded-2xl p-4 font-mono text-xs text-[#00f3ff] overflow-x-auto">
                  <pre>{mikrotikScript}</pre>
                </div>
                <button
                  onClick={() => handleCopy("mikrotik-script", mikrotikScript)}
                  className="absolute top-3 right-3 px-3 py-1.5 bg-white/10 hover:bg-white/20 border border-white/20 rounded-xl text-xs font-semibold text-white flex items-center gap-1.5 transition-colors"
                >
                  {copiedScript === "mikrotik-script" ? (
                    <>
                      <Check size={14} className="text-green-400" />
                      <span className="text-green-400">Imenakiliwa!</span>
                    </>
                  ) : (
                    <>
                      <Copy size={14} />
                      <span>{lang === "sw" ? "Nakili Script" : "Copy Script"}</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Step 4: Add Router in Dashboard */}
            <div className="space-y-3 pt-4 border-t border-white/5">
              <div className="flex items-center gap-2.5">
                <span className="w-7 h-7 rounded-lg bg-[#00f3ff]/20 text-[#00f3ff] font-bold text-xs flex items-center justify-center">
                  4
                </span>
                <h3 className="font-bold text-white text-base">
                  {lang === "sw" ? "Ingiza Router Kwenye Dashboard ya PoaFi" : "Register Router in PoaFi Dashboard"}
                </h3>
              </div>
              <p className="text-xs text-gray-300 pl-9 leading-relaxed">
                {lang === "sw" ? (
                  <>
                    Ingia kwenye akaunti yako ya PoaFi, nenda kwenye ukurasa wa <strong>Routers & Gateways</strong>,
                    kisha bofya <strong>+ Add New Router</strong>.
                    <br />
                    Jaza taarifa:
                    <ul className="list-disc list-inside mt-2 space-y-1 text-gray-400">
                      <li>
                        <strong>Vendor:</strong> MIKROTIK
                      </li>
                      <li>
                        <strong>Host/IP:</strong> IP ya router yako (mfano <code>192.168.88.1</code> au Public IP)
                      </li>
                      <li>
                        <strong>API Port:</strong> <code>8728</code>
                      </li>
                      <li>
                        <strong>Username:</strong> <code>poafi_agent</code>
                      </li>
                      <li>
                        <strong>Password:</strong> Nenosiri uliloweka kwenye script hapo juu
                      </li>
                    </ul>
                  </>
                ) : (
                  <>
                    Log in to your PoaFi operator dashboard, go to <strong>Routers & Gateways</strong>, and click{" "}
                    <strong>+ Add New Router</strong>. Fill in the fields: Vendor = MIKROTIK, Host = Router IP, API Port
                    = 8728, Username = poafi_agent, Password = the password configured in Step 3.
                  </>
                )}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: TP-LINK OMADA */}
      {activeBrand === "tplink" && (
        <div className="glass-panel p-6 sm:p-8 rounded-3xl border border-white/10 space-y-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600 text-white font-black flex items-center justify-center">
              TP
            </div>
            <div>
              <h2 className="text-xl sm:text-2xl font-bold text-white">
                {lang === "sw"
                  ? "Mwongozo: TP-Link Omada SDN & SafeStream Routers"
                  : "TP-Link Omada SDN & SafeStream Guide"}
              </h2>
              <p className="text-xs text-gray-400">
                ER605, ER7206, OC200, OC300 au Omada Software Controller.
              </p>
            </div>
          </div>

          <div className="space-y-4 text-xs text-gray-300 leading-relaxed">
            <p>
              {lang === "sw" ? (
                <>
                  1. Ingia kwenye Omada Controller yako kupitia kivinjari (Browser) au Omada Cloud.
                  <br />
                  2. Nenda kwenye <strong>Settings &rarr; Authentication &rarr; Portal</strong>.
                  <br />
                  3. Bofya <strong>Create New Portal</strong> na uchague aina ya <strong>External Portal Server</strong>.
                  <br />
                  4. Kwenye <em>Server IP / URL</em>, weka anuani ya portal ya PoaFi:{" "}
                  <code className="text-[#00f3ff] bg-black/40 px-2 py-0.5 rounded">
                    http://192.168.56.1:3000/portal
                  </code>
                  <br />
                  5. Kwenye <strong>Access Control (Pre-Authentication / Walled Garden)</strong>, ongeza:
                  <ul className="list-disc list-inside mt-2 space-y-1 text-gray-400">
                    <li>*.poafi.co.tz</li>
                    <li>*.azampay.com</li>
                    <li>*.vodacom.co.tz</li>
                    <li>*.tigo.co.tz</li>
                  </ul>
                </>
              ) : (
                <>
                  1. Log into your Omada Controller web interface.
                  <br />
                  2. Navigate to <strong>Settings &rarr; Authentication &rarr; Portal</strong>.
                  <br />
                  3. Create a new portal and set the portal type to <strong>External Portal Server</strong>.
                  <br />
                  4. Set the redirection URL to your PoaFi captive portal URL.
                  <br />
                  5. In Pre-Authentication Access list, add PoaFi domain and Tanzanian mobile money endpoints to ensure
                  customers can check out before logging in.
                </>
              )}
            </p>
          </div>
        </div>
      )}

      {/* TAB 3: RUIJIE REYEE */}
      {activeBrand === "ruijie" && (
        <div className="glass-panel p-6 sm:p-8 rounded-3xl border border-white/10 space-y-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-600 text-white font-black flex items-center justify-center">
              RJ
            </div>
            <div>
              <h2 className="text-xl sm:text-2xl font-bold text-white">
                {lang === "sw" ? "Mwongozo: Ruijie Reyee Cloud Gateway" : "Ruijie Reyee Cloud Gateway Setup"}
              </h2>
              <p className="text-xs text-gray-400">
                RG-EG105G, RG-EG210G, RG-EG310G na Access Points za Reyee.
              </p>
            </div>
          </div>

          <div className="space-y-4 text-xs text-gray-300 leading-relaxed">
            <p>
              {lang === "sw" ? (
                <>
                  1. Ingia kwenye <strong>Ruijie Cloud App</strong> au web portal (cloud.ruijienetworks.com).
                  <br />
                  2. Fungua mradi wako wa mtandao na uchague <strong>Gateway &rarr; Auth & Security</strong>.
                  <br />
                  3. Wezesha <strong>Captive Portal</strong> na chagua <strong>Third-Party Captive Portal</strong>.
                  <br />
                  4. Jaza Web Auth URL ya PoaFi iliyotolewa kwenye dashboard yako ya PoaFi.
                  <br />
                  5. Wezesha <em>Walled Garden Passthrough</em> kwa ajili ya AzamPay na mitandao ya simu ya Tanzania.
                </>
              ) : (
                <>
                  1. Log into your Ruijie Cloud web dashboard or mobile app.
                  <br />
                  2. Select your gateway and navigate to Authentication settings.
                  <br />
                  3. Enable Captive Portal and select Third-Party Portal integration.
                  <br />
                  4. Enter your PoaFi portal URL and whitelist the necessary mobile payment domains.
                </>
              )}
            </p>
          </div>
        </div>
      )}

      {/* TAB 4: GENERIC / CUDY / COMFAST */}
      {activeBrand === "generic" && (
        <div className="glass-panel p-6 sm:p-8 rounded-3xl border border-white/10 space-y-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white font-black flex items-center justify-center">
              AP
            </div>
            <div>
              <h2 className="text-xl sm:text-2xl font-bold text-white">
                {lang === "sw"
                  ? "Access Points za Kawaida: Cudy, Comfast, Wavlink"
                  : "Generic APs: Cudy, Comfast & Wavlink"}
              </h2>
              <p className="text-xs text-gray-400">
                {lang === "sw"
                  ? "Vifaa vinavyotumika kama Access Points nyuma ya router ya kati."
                  : "Standalone outdoor or indoor APs connected to a central router."}
              </p>
            </div>
          </div>

          <div className="space-y-4 text-xs text-gray-300 leading-relaxed">
            <p>
              {lang === "sw" ? (
                <>
                  Kama unatumia Antena za Comfast au Wavlink kusambaza Wi-Fi ya mbali:
                  <br />
                  1. Weka AP kwenye hali ya <strong>Bridge Mode / Access Point Mode</strong> (zisiwe na DHCP server yake
                  yenyewe).
                  <br />
                  2. Chomeka waya wa LAN kutoka kwenye MikroTik/TP-Link (port ya hotspot) kwenda kwenye PoE injector ya
                  AP.
                  <br />
                  3. Wateja wataunganishwa kwenye Wi-Fi ya Comfast/Wavlink lakini watapokea ukurasa wa malipo na vocha
                  kutoka kwenye mfumo wa PoaFi kiotomatiki!
                </>
              ) : (
                <>
                  When using outdoor high-power antennas such as Comfast or Wavlink:
                  <br />
                  1. Set the device to <strong>Bridge / AP Mode</strong> with DHCP disabled.
                  <br />
                  2. Connect the LAN port of the PoE injector directly to your configured MikroTik or TP-Link router.
                  <br />
                  3. All user traffic will flow through the PoaFi gateway seamlessly.
                </>
              )}
            </p>
          </div>
        </div>
      )}

      {/* Assistance Footer Box */}
      <div className="glass-panel p-8 rounded-3xl border border-white/15 bg-gradient-to-r from-yellow-500/10 via-transparent to-[#00f3ff]/10 flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-2xl bg-yellow-500/20 text-yellow-400 flex items-center justify-center shrink-0">
            <AlertTriangle size={24} />
          </div>
          <div>
            <h4 className="text-lg font-bold text-white">
              {lang === "sw" ? "Umekwama au Unahitaji Msaada?" : "Need Direct Assistance?"}
            </h4>
            <p className="text-xs text-gray-300 mt-1 max-w-xl leading-relaxed">
              {lang === "sw"
                ? "Timu yetu ya wahandisi inapatikana kila siku kuanzia saa 2:00 asubuhi hadi saa 4:00 usiku. Piga simu au tutumie ujumbe WhatsApp na tutakusanidia router yako mtandaoni papo hapo."
                : "Our engineers are available daily to assist you with router configuration via remote screen-share or phone call."}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <a
            href="https://wa.me/255754000000"
            target="_blank"
            rel="noopener noreferrer"
            className="px-5 py-3 bg-[#25D366] hover:bg-[#20ba59] text-white font-bold rounded-xl text-xs flex items-center gap-2 transition-colors shadow-lg"
          >
            <span>WhatsApp Msaada</span>
          </a>
          <Link
            href="/contact"
            className="px-5 py-3 bg-white/10 hover:bg-white/15 border border-white/20 text-white font-bold rounded-xl text-xs transition-colors"
          >
            {lang === "sw" ? "Mawasiliano" : "Contact Us"}
          </Link>
        </div>
      </div>
    </div>
  );
}

