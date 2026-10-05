import { useEffect } from "react";
import { Link } from "wouter";
import PublicLayout from "@/components/PublicLayout";
import {
  ShieldCheck,
  PenSquare,
  Settings,
  Handshake,
  School,
  Users,
  PackageCheck,
  Award,
  Clock,
  Truck,
  CheckCircle2,
  ArrowRight,
} from "lucide-react";

const WHY_FEATURES = [
  { icon: ShieldCheck, title: "Quality Products", desc: "Durable and reliable PVC materials engineered to withstand everyday student and staff use." },
  { icon: PenSquare, title: "Custom Design", desc: "Your school colors, crest, security watermark, barcodes and specialized card layouts." },
  { icon: Settings, title: "Professional Finishing", desc: "Glossy/matte lamination, chip embedding, barcode printing and premium edge finishing." },
  { icon: Handshake, title: "Complete ID Card Solutions", desc: "End-to-end hardware, software, printing, pre-punched holders, and customized ribbons." },
] as const;

const STATS = [
  { icon: School, value: "500+", label: "Schools & Colleges" },
  { icon: Users, value: "1000+", label: "Happy Clients" },
  { icon: PackageCheck, value: "100+", label: "Orders Completed" },
  { icon: ShieldCheck, value: "Best", label: "Quality Assurance" },
] as const;

const CLIENT_LOGOS = Array.from({ length: 11 }, (_, i) => {
  const n = String(i + 1).padStart(2, "0");
  return { src: `/home/client-${n}.jpg`, alt: `Partner school logo ${i + 1}`, featured: i === 5 };
});

export default function AboutUsPage() {
  useEffect(() => {
    document.title = "About Us · Insight Education ID Card Solutions";
    window.scrollTo(0, 0);
  }, []);

  return (
    <PublicLayout activePath="/about-us">
      {/* ════════════ HERO BANNER ════════════ */}
      <section className="lp-page-banner">
        <div className="lp-container">
          <div className="lp-page-banner-content">
            <span className="lp-page-badge">WHO WE ARE</span>
            <h1 className="font-heading">About Insight Education</h1>
            <p>
              Dedicated to delivering dependable, secure, and world-class identity solutions for educational institutions and organizations across India.
            </p>
          </div>
        </div>
      </section>

      {/* ════════════ MISSION & STORY ════════════ */}
      <section className="lp-about-story-section">
        <div className="lp-container">
          <div className="lp-about-story-grid">
            <div className="lp-about-story-text">
              <span className="highlight-green font-bold text-sm tracking-wider uppercase">Our Journey &amp; Mission</span>
              <h2 className="font-heading text-3xl font-bold mt-2 mb-4 text-[#1b4a7c]">
                Crafting Reliable Campus Identities for Over a Decade
              </h2>
              <p className="text-[#555] leading-relaxed mb-4">
                Insight Education was established with a clear mission: to simplify, elevate, and modernize student and faculty identification systems. We recognize that an ID card represents school pride, campus security, and institutional belonging.
              </p>
              <p className="text-[#555] leading-relaxed mb-6">
                From high-density digital smart cards and satin sublimation lanyards to tamper-resistant holders and digital cloud management, our full suite covers every step of the identity lifecycle.
              </p>

              <div className="lp-about-highlights-grid">
                <div className="lp-about-highlight-box">
                  <Award size={24} className="text-[#00894d] mb-2" />
                  <h4 className="font-bold text-sm text-[#1d5a2e]">ISO 9001:2015</h4>
                  <p className="text-xs text-[#666]">Standardized industrial production &amp; quality checks</p>
                </div>
                <div className="lp-about-highlight-box">
                  <Truck size={24} className="text-[#00894d] mb-2" />
                  <h4 className="font-bold text-sm text-[#1d5a2e]">Pan-India Logistics</h4>
                  <p className="text-xs text-[#666]">Prompt dispatch with real-time consignment tracking</p>
                </div>
                <div className="lp-about-highlight-box">
                  <Clock size={24} className="text-[#00894d] mb-2" />
                  <h4 className="font-bold text-sm text-[#1d5a2e]">Rapid Turnaround</h4>
                  <p className="text-xs text-[#666]">3–5 business days turnaround for bulk school batches</p>
                </div>
              </div>
            </div>

            <div className="lp-about-story-image">
              <div className="lp-about-img-frame">
                <img
                  src="/home/hero-products.jpg"
                  alt="Insight Education identity showcase"
                  className="rounded-2xl shadow-xl w-full object-cover"
                />
                <div className="lp-about-experience-pill">
                  <span className="text-2xl font-black text-[#00894d]">10+</span>
                  <span className="text-xs font-semibold leading-tight text-[#333]">Years of Institutional Trust</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ════════════ WHY CHOOSE US ════════════ */}
      <section className="lp-why-choose">
        <div className="lp-container">
          <div className="lp-why-inner">
            <div className="lp-why-left">
              <h2 className="font-heading">
                Why Choose
                <br />
                Insight Education?
              </h2>
              <p>We deliver reliable, high-quality and customized ID card solutions to meet your every need</p>
              <div className="lp-why-underline" />
            </div>
            <div className="lp-why-features">
              {WHY_FEATURES.map((f) => (
                <div key={f.title} className="lp-why-feature">
                  <div className="lp-why-icon">
                    <f.icon size={26} />
                  </div>
                  <h4>{f.title}</h4>
                  <p>{f.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ════════════ STATS ════════════ */}
      <section className="lp-stats">
        <div className="lp-container">
          <div className="lp-stats-panel">
            {STATS.map((s) => (
              <div key={s.label} className="lp-stat-item">
                <s.icon size={52} className="lp-stat-icon" />
                <div className="lp-stat-text">
                  <h3>{s.value}</h3>
                  <p>{s.label}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ════════════ OUR CLIENTS ════════════ */}
      <section className="lp-clients py-12">
        <div className="lp-container">
          <div className="lp-section-title">
            <span className="line" />
            <h2 className="font-heading">Our Trusted Partners</h2>
            <span className="line" />
          </div>

          <div className="lp-clients-panel">
            {CLIENT_LOGOS.map((logo, i) => (
              <img
                key={i}
                src={logo.src}
                alt={logo.alt}
                className={logo.featured ? "featured" : ""}
                loading="lazy"
                width={logo.featured ? 72 : 50}
                height={logo.featured ? 72 : 50}
              />
            ))}
          </div>
        </div>
      </section>

      {/* ════════════ CTA BANNER ════════════ */}
      <section className="lp-contact-cta-band">
        <div className="lp-container">
          <div className="lp-contact-cta-inner">
            <div>
              <h3 className="text-2xl font-bold font-heading mb-2">Ready to Upgrade Your Institution's ID Cards?</h3>
              <p className="text-sm opacity-90">Talk to our campus identity consultant today for free design samples and pricing.</p>
            </div>
            <Link href="/contact-us" className="lp-banner-cta">
              Get in Touch <ArrowRight size={16} />
            </Link>
          </div>
        </div>
      </section>
    </PublicLayout>
  );
}
