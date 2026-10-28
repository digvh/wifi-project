"use client";

import { useState } from "react";
import { 
  PhoneCall, 
  MapPin, 
  Clock, 
  Send, 
  CheckCircle, 
  HelpCircle, 
  ChevronDown, 
  ChevronUp,
  MessageSquare,
  Sparkles
} from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";

export default function ContactPage() {
  const { lang, setLang } = useLanguage();

  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    city: "",
    subject: "General Inquiry",
    message: "",
  });
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      setSubmitted(true);
    }, 1000);
  };

  const faqs = [
    {
      q: lang === "sw" 
        ? "Je, ninahitaji mtaji gani kuanza biashara ya kuuza Wi-Fi?"
        : "How much starting capital do I need to launch a Wi-Fi hotspot business?",
      a: lang === "sw"
        ? "Unahitaji vitu vitatu tu: (1) Njia ya intaneti (Fiber ya TTCL, Zuku, au Sim-card Router ya 4G/5G), (2) Router inayokubali hotspot (mfano MikroTik hEX inayogharimu takriban TZS 140,000 - 180,000), na (3) Mfumo wa PoaFi ambao usajili wake ni bure kabisa!"
        : "You only need three items: (1) An active internet uplink (Fiber or 4G/5G LTE modem), (2) A hotspot-capable router (such as a MikroTik hEX costing ~TZS 150,000), and (3) A PoaFi operator account which is completely free to create!",
    },
    {
      q: lang === "sw"
        ? "Je, ninaweza kusanidi router yangu niliyonayo tayari bila kuleta ofisini?"
        : "Can I configure my existing router without bringing it to your physical office?",
      a: lang === "sw"
        ? "Ndiyo! Tuna mwongozo kamili wa Kiswahili na Kiingereza kwenye ukurasa wetu wa 'Mwongozo wa Router'. Pia mafundi wetu wanaweza kukuunganisha kwa mbali kupitia AnyDesk au WhatsApp video bila wewe kusafiri."
        : "Yes! Our interactive Router Guide has copy-paste scripts for WinBox and Omada. Alternatively, our technical team can assist you remotely over AnyDesk or TeamViewer at no extra cost.",
    },
    {
      q: lang === "sw"
        ? "Pesa za mauzo ya intaneti zinafikaje mikononi mwangu?"
        : "How do I receive the money collected from voucher sales?",
      a: lang === "sw"
        ? "Kama unatumia mfumo wa PoaFi, kila mteja anaponunua kifurushi kupitia M-Pesa, Tigo Pesa au Airtel Money, mfumo unarekodi mauzo hayo na asilimia 90% (90%) ya pesa inahamishiwa moja kwa moja kwenye namba yako ya simu au akaunti ya benki."
        : "Whenever a user pays via M-Pesa, Tigo Pesa, or Airtel Money, 90% of the gross sale is attributed directly to your operator account balance and disbursed to your registered mobile wallet or bank.",
    },
    {
      q: lang === "sw"
        ? "Je, ikiwa router yangu itazima umeme au mtandao ukakatika inakuwaje?"
        : "What happens if power goes off or my internet uplink temporarily drops?",
      a: lang === "sw"
        ? "Mfumo wa PoaFi unahifadhi kumbukumbu zote za wateja kwenye cloud salama. Umeme au intaneti ikirudi, router inajiunganisha kiotomatiki na wateja wenye vifurushi vilivyo hai wanaendelea kupata huduma bila kupoteza haki zao."
        : "All session state is stored in PoaFi's cloud database. Once power or uplink is restored, your router re-authenticates active sessions automatically, so customers do not lose their paid time.",
    },
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-16">
      {/* Header */}
      <div className="text-center max-w-3xl mx-auto space-y-3">
        {/* Language selector badge */}
        <div className="flex items-center justify-center gap-3">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#00f3ff]/10 border border-[#00f3ff]/20 text-xs font-bold text-[#00f3ff]">
            <Sparkles size={14} />
            <span>{lang === "sw" ? "Mawasiliano" : "Support & Helpdesk"}</span>
          </div>

          <div className="inline-flex items-center gap-1 bg-white/5 border border-white/10 p-1 rounded-full text-xs font-semibold">
            <button
              onClick={() => setLang("sw")}
              className={`px-3 py-1 rounded-full text-xs font-bold transition-all ${
                lang === "sw" ? "bg-[#00f3ff] text-black shadow-sm" : "text-gray-400 hover:text-white"
              }`}
            >
              🇹🇿 SW
            </button>
            <button
              onClick={() => setLang("en")}
              className={`px-3 py-1 rounded-full text-xs font-bold transition-all ${
                lang === "en" ? "bg-[#00f3ff] text-black shadow-sm" : "text-gray-400 hover:text-white"
              }`}
            >
              🇬🇧 EN
            </button>
          </div>
        </div>

        <h1 className="text-4xl sm:text-5xl font-black text-white">
          {lang === "sw" ? "Wasiliana Nasi" : "Get in Touch with PoaFi"}
        </h1>
        <p className="text-sm text-gray-400 leading-relaxed">
          {lang === "sw"
            ? "Una swali kuhusu kuanzisha mtandao wako wa Wi-Fi, unahitaji msaada wa kusanidi router, au unataka kutembelea ofisi yetu? Timu yetu ipo tayari kukuhudumia."
            : "Have a question about launching your hotspot, need remote router configuration assistance, or want to schedule an office visit? We are here to help."}
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
        {/* Contact Info Cards */}
        <div className="space-y-6 lg:col-span-1">
          <div className="glass-panel p-6 rounded-2xl border border-white/10 space-y-3">
            <div className="flex items-center gap-3 text-[#00f3ff]">
              <PhoneCall size={20} />
              <h3 className="font-bold text-white text-base">
                {lang === "sw" ? "Piga Simu / Call Us" : "Call Our Hotline"}
              </h3>
            </div>
            <p className="text-xs text-gray-400">
              {lang === "sw" ? "Timu yetu inapatikana masaa 14 kila siku:" : "Available 14 hours every day:"}
            </p>
            <div className="space-y-1 font-mono text-sm text-white">
              <p>+255 754 000 000 (Vodacom)</p>
              <p>+255 655 000 000 (Tigo)</p>
            </div>
          </div>

          <div className="glass-panel p-6 rounded-2xl border border-white/10 space-y-3">
            <div className="flex items-center gap-3 text-[#25D366]">
              <MessageSquare size={20} />
              <h3 className="font-bold text-white text-base">
                {lang === "sw" ? "WhatsApp Support" : "WhatsApp Fast Response"}
              </h3>
            </div>
            <p className="text-xs text-gray-400">
              {lang === "sw" ? "Pata jibu la haraka ndani ya dakika 5:" : "Get a response within 5 minutes:"}
            </p>
            <a
              href="https://wa.me/255754000000"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2 bg-[#25D366] text-white font-bold rounded-xl text-xs hover:bg-[#20ba59] transition-colors"
            >
              <span>{lang === "sw" ? "Fungua WhatsApp Chat" : "Open WhatsApp Chat"}</span>
            </a>
          </div>

          <div className="glass-panel p-6 rounded-2xl border border-white/10 space-y-3">
            <div className="flex items-center gap-3 text-[#9d00ff]">
              <MapPin size={20} />
              <h3 className="font-bold text-white text-base">
                {lang === "sw" ? "Ofisi Zetu" : "Our Office Location"}
              </h3>
            </div>
            <p className="text-xs text-gray-300">
              Makumbusho Towers, 3rd Floor
              <br />
              Bagamoyo Road, Kijitonyama
              <br />
              Dar es Salaam, Tanzania
            </p>
            <div className="flex items-center gap-1.5 text-[11px] text-gray-500 pt-1">
              <Clock size={14} />
              <span>
                {lang === "sw" ? "Jumatatu - Jumamosi: Saa 2:00 Asb - Saa 4:00 Uck" : "Mon - Sat: 8:00 AM - 10:00 PM EAT"}
              </span>
            </div>
          </div>
        </div>

        {/* Contact Form */}
        <div className="glass-panel p-8 rounded-3xl border border-white/10 lg:col-span-2">
          <h2 className="text-2xl font-bold text-white mb-2">
            {lang === "sw" ? "Tutumie Ujumbe" : "Send Us a Message"}
          </h2>
          <p className="text-xs text-gray-400 mb-6">
            {lang === "sw"
              ? "Jaza fomu hii nasi tutakujibu ndani ya saa 2 kupitia simu au barua pepe yako."
              : "Fill out the form below and an engineer will respond within 2 hours."}
          </p>

          {submitted ? (
            <div className="p-8 text-center bg-green-500/10 border border-green-500/30 rounded-2xl space-y-3">
              <CheckCircle className="w-12 h-12 text-green-400 mx-auto" />
              <h4 className="text-lg font-bold text-white">
                {lang === "sw" ? "Ujumbe Wako Umepokelewa!" : "Message Received Successfully!"}
              </h4>
              <p className="text-xs text-gray-300 max-w-md mx-auto">
                {lang === "sw"
                  ? "Asante kwa kuwasiliana na PoaFi. Mhandisi wetu atawasiliana nawe mara moja."
                  : "Thank you for reaching out to PoaFi. Our team will contact you shortly."}
              </p>
              <button
                onClick={() => setSubmitted(false)}
                className="mt-4 px-4 py-2 bg-white/10 hover:bg-white/15 text-xs text-white rounded-xl transition-colors"
              >
                {lang === "sw" ? "Tuma Ujumbe Mwingine" : "Send Another Message"}
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-300 mb-1">
                    {lang === "sw" ? "Jina Kamili *" : "Full Name *"}
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-[#00f3ff]"
                    placeholder="Juma Rashid"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-300 mb-1">
                    {lang === "sw" ? "Namba ya Simu *" : "Phone Number *"}
                  </label>
                  <input
                    type="tel"
                    required
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-[#00f3ff]"
                    placeholder="0754 123 456"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-300 mb-1">
                    {lang === "sw" ? "Barua Pepe *" : "Email Address *"}
                  </label>
                  <input
                    type="email"
                    required
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-[#00f3ff]"
                    placeholder="juma@gmail.com"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-300 mb-1">
                    {lang === "sw" ? "Mkoa Uliopo" : "City / Region"}
                  </label>
                  <input
                    type="text"
                    value={formData.city}
                    onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-[#00f3ff]"
                    placeholder="Dar es Salaam, Arusha..."
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1">
                  {lang === "sw" ? "Ujumbe Wako *" : "Your Message *"}
                </label>
                <textarea
                  required
                  rows={4}
                  value={formData.message}
                  onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                  className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-[#00f3ff] resize-none"
                  placeholder={
                    lang === "sw"
                      ? "Eleza aina ya router uliyonayo au msaada unaouhitaji..."
                      : "Describe your router model or what kind of setup assistance you require..."
                  }
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3.5 bg-gradient-to-r from-[#00f3ff] to-[#9d00ff] text-white font-bold rounded-xl text-xs hover:opacity-95 transition-opacity shadow-lg shadow-[#00f3ff]/20 flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {loading ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    <Send size={15} />
                    <span>{lang === "sw" ? "Wasilisha Ujumbe" : "Send Inquiry"}</span>
                  </>
                )}
              </button>
            </form>
          )}
        </div>
      </div>

      {/* FAQs Section */}
      <div className="pt-8 border-t border-white/10 space-y-6">
        <div className="text-center max-w-2xl mx-auto">
          <div className="inline-flex items-center gap-1.5 text-xs font-bold text-[#00f3ff] mb-2">
            <HelpCircle size={16} />
            <span>{lang === "sw" ? "Maswali Yanayoulizwa Mara kwa Mara" : "Frequently Asked Questions"}</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-white">
            {lang === "sw" ? "Maswali ya Kawaida (FAQs)" : "Common Questions"}
          </h2>
        </div>

        <div className="max-w-4xl mx-auto space-y-3">
          {faqs.map((faq, i) => (
            <div
              key={i}
              className="glass-panel rounded-2xl border border-white/10 overflow-hidden transition-all"
            >
              <button
                onClick={() => setOpenFaq(openFaq === i ? null : i)}
                className="w-full p-5 text-left flex items-center justify-between gap-4 font-bold text-sm text-white hover:text-[#00f3ff] transition-colors"
              >
                <span>{faq.q}</span>
                {openFaq === i ? (
                  <ChevronUp size={18} className="text-[#00f3ff] shrink-0" />
                ) : (
                  <ChevronDown size={18} className="text-gray-400 shrink-0" />
                )}
              </button>
              {openFaq === i && (
                <div className="px-5 pb-5 pt-1 text-xs text-gray-300 leading-relaxed border-t border-white/5">
                  {faq.a}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
