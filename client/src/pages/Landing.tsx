import { useEffect, useState, useCallback } from "react";
import {
  ShieldCheck,
  PenSquare,
  Settings,
  Handshake,
  School,
  Users,
  PackageCheck,
  ChevronRight,
  Menu,
  X,
  LockKeyhole,
  Megaphone,
  ArrowRight,
} from "lucide-react";

/* ───────────────────────────────────────────
   Notices – easy to update in one place
   ─────────────────────────────────────────── */
const NOTICES = [
  {
    title: "New ID Card & Lanyard Designs Available",
    date: "April 25, 2025",
  },
  {
    title: "Contact for Bulk Requirements",
    date: "April 10, 2026",
  },
] as const;

/* ───────────────────────────────────────────
   Nav links
   ─────────────────────────────────────────── */
const NAV_LINKS = [
  { label: "Home", href: "#home" },
  { label: "About Us", href: "#about" },
  { label: "Products", href: "#products" },
  { label: "Notice", href: "#notice" },
  { label: "Contact Us", href: "#contact" },
] as const;

/* ───────────────────────────────────────────
   Client logos (1–11, design order L → R)
   ─────────────────────────────────────────── */
const CLIENT_LOGOS = Array.from({ length: 11 }, (_, i) => {
  const n = String(i + 1).padStart(2, "0");
  return { src: `/home/client-${n}.jpg`, alt: `Client school logo ${i + 1}`, featured: i === 5 };
});

/* ───────────────────────────────────────────
   Product cards data
   ─────────────────────────────────────────── */
const PRODUCT_CARDS = [
  {
    title: "LANYARDS / RIBBONS",
    subtitle: "Custom Printed & Plain Lanyards",
    image: "/home/product-lanyards.jpg",
  },
  {
    title: "ID CARD HOLDERS",
    subtitle: "Different Styles & Sizes",
    image: "/home/product-holders.jpg",
  },
  {
    title: "CLIPS & HOOKS",
    subtitle: "Metal Hooks, Plastic Clips & Attachments",
    image: "/home/product-clips.jpg",
  },
] as const;

/* ───────────────────────────────────────────
   Why-choose features
   ─────────────────────────────────────────── */
const WHY_FEATURES = [
  { icon: ShieldCheck, title: "Quality Products", desc: "Durable and reliable products." },
  { icon: PenSquare, title: "Custom Design", desc: "Your logo, your style, your identity." },
  { icon: Settings, title: "Professional Finishing", desc: "Complete ID card professional look." },
  { icon: Handshake, title: "Complete ID Card Solutions", desc: "From card to lanyard, we provide everything." },
] as const;

/* ───────────────────────────────────────────
   Stats data
   ─────────────────────────────────────────── */
const STATS = [
  { icon: School, value: "500+", label: "Schools" },
  { icon: Users, value: "1000+", label: "Happy Clients" },
  { icon: PackageCheck, value: "100+", label: "Orders Completed" },
  { icon: ShieldCheck, value: "Best", label: "Quality" },
] as const;

/* ═══════════════════════════════════════════
   Landing Component
   ═══════════════════════════════════════════ */
export default function Landing() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [activeSection, setActiveSection] = useState("home");

  /* ── Set document title ── */
  useEffect(() => {
    const prev = document.title;
    document.title = "Insight Education · ID Cards & Lanyard Solutions";
    return () => {
      document.title = prev;
    };
  }, []);

  /* ── Close mobile menu on resize ── */
  useEffect(() => {
    const onResize = () => {
      if (window.innerWidth >= 768) setMobileMenuOpen(false);
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  /* ── Smooth-scroll click handler for anchors ── */
  const handleNavClick = useCallback(
    (e: React.MouseEvent<HTMLAnchorElement>, href: string) => {
      e.preventDefault();
      setMobileMenuOpen(false);
      const id = href.replace("#", "");
      const el = document.getElementById(id);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "start" });
      }
      setActiveSection(id);
    },
    [],
  );

  /* ── Intersection observer for active nav ── */
  useEffect(() => {
    const ids = NAV_LINKS.map((l) => l.href.replace("#", ""));
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActiveSection(entry.target.id);
          }
        }
      },
      { rootMargin: "-40% 0px -55% 0px" },
    );
    ids.forEach((id) => {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, []);

  return (
    <div className="landing-root">
      {/* ════════════ HEADER ════════════ */}
      <header className="lp-header" role="banner">
        <div className="lp-header-inner">
          <a href="#home" onClick={(e) => handleNavClick(e, "#home")}>
            <img
              src="/insight-education-logo.png"
              alt="Insight Education logo"
              className="lp-logo"
              width={160}
              height={64}
            />
          </a>

          {/* Desktop nav */}
          <nav aria-label="Main navigation">
            <ul className="lp-nav">
              {NAV_LINKS.map((link) => (
                <li key={link.href}>
                  <a
                    href={link.href}
                    className={activeSection === link.href.replace("#", "") ? "active" : ""}
                    onClick={(e) => handleNavClick(e, link.href)}
                  >
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>

          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            {/* Portal Login button */}
            <a href="/login" className="lp-portal-btn">
              <LockKeyhole size={16} />
              Portal Login
            </a>

            {/* Hamburger (mobile) */}
            <button
              className="lp-hamburger"
              onClick={() => setMobileMenuOpen((v) => !v)}
              aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
              aria-expanded={mobileMenuOpen}
            >
              {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
          </div>
        </div>

        {/* Mobile nav drawer */}
        <nav
          className={`lp-mobile-nav ${mobileMenuOpen ? "open" : ""}`}
          aria-label="Mobile navigation"
        >
          {NAV_LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className={activeSection === link.href.replace("#", "") ? "active" : ""}
              onClick={(e) => handleNavClick(e, link.href)}
            >
              {link.label}
            </a>
          ))}
          <a href="/login" className="lp-portal-btn" style={{ alignSelf: "flex-start", marginTop: 8 }}>
            <LockKeyhole size={16} />
            Portal Login
          </a>
        </nav>
      </header>

      <main>
        {/* ════════════ HERO ════════════ */}
        <section id="home" className="lp-hero">
          <div className="lp-hero-content">
            <p className="lp-hero-tagline">IDENTITY &nbsp;|&nbsp; SECURITY &nbsp;|&nbsp; PROFESSIONALISM</p>
            <h1 className="font-heading">
              Complete ID Card &amp;
              <br />
              Lanyard Solutions
            </h1>
            <p className="lp-hero-desc">
              Quality ID Cards, Lanyards, Holders &amp; Accessories for Schools, Colleges, Institutions &amp;
              Organizations.
            </p>
            <a href="#products" className="lp-hero-cta" onClick={(e) => handleNavClick(e, "#products")}>
              Explore Our Products <ArrowRight size={18} />
            </a>
          </div>
          <div className="lp-hero-image">
            <img
              src="/home/hero-products.jpg"
              alt="ID cards, lanyards, holders and clips displayed together"
              width={988}
              height={380}
            />
          </div>
        </section>

        {/* ════════════ OUR CLIENTS ════════════ */}
        <section className="lp-clients">
          <div className="lp-container">
            <div className="lp-section-title">
              <span className="line" />
              <h2 className="font-heading">Our Clients</h2>
              <span className="line" />
            </div>

            {/* Desktop: static row */}
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

            {/* Mobile: marquee */}
            <div className="lp-clients-marquee">
              <div className="lp-marquee-track">
                {/* Duplicate the logos for seamless looping */}
                {[...CLIENT_LOGOS, ...CLIENT_LOGOS].map((logo, i) => (
                  <img
                    key={i}
                    src={logo.src}
                    alt={logo.alt}
                    className={logo.featured ? "featured" : ""}
                    loading="lazy"
                    width={logo.featured ? 68 : 48}
                    height={logo.featured ? 68 : 48}
                  />
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ════════════ PRODUCTS ════════════ */}
        <section id="products" className="lp-products">
          <div className="lp-container">
            <div className="lp-products-grid">
              {/* Card 1 — ID Cards (green, hover overlay) */}
              <div className="lp-product-card-primary" tabIndex={0}>
                <div className="card-default">
                  <div className="card-image-area">
                    {/* product-idcards.jpg may be missing; use a solid bg as fallback */}
                    <img
                      src="/home/product-idcards.jpg"
                      alt="ID Cards"
                      loading="lazy"
                      width={280}
                      height={200}
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = "none";
                      }}
                    />
                  </div>
                  <div className="card-info">
                    <div className="card-info-text">
                      <h3>ID CARDS</h3>
                      <p>School, College &amp; Institutional ID Cards</p>
                    </div>
                    {/* TODO: link to real product page */}
                    <a href="#contact" className="lp-arrow-btn lp-arrow-btn-green" aria-label="View ID Cards">
                      <ChevronRight size={18} />
                    </a>
                  </div>
                </div>
                {/* Overlay shown on hover / focus */}
                <div className="card-overlay">
                  <p>
                    Discover durable, high-quality ID cards designed to meet every institution's needs.
                  </p>
                  <p>
                    <span className="click-more">Click More</span> Options to know more.
                  </p>
                </div>
              </div>

              {/* Cards 2–4 — light green */}
              {PRODUCT_CARDS.map((card) => (
                <div key={card.title} className="lp-product-card">
                  <img
                    src={card.image}
                    alt={card.title}
                    className="card-img"
                    loading="lazy"
                    width={280}
                    height={200}
                  />
                  <div className="card-body">
                    <h3>{card.title}</h3>
                    <p>{card.subtitle}</p>
                    <div className="card-body-footer">
                      {/* TODO: link to real product page */}
                      <a href="#contact" className="lp-arrow-btn" aria-label={`View ${card.title}`}>
                        <ChevronRight size={18} />
                      </a>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ════════════ WHY CHOOSE ════════════ */}
        <section id="about" className="lp-why-choose">
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

        {/* ════════════ CUSTOM BANNER + NOTICES ════════════ */}
        <section id="notice" className="lp-banner-section">
          <div className="lp-container">
            <div className="lp-banner-row">
              {/* Left – custom requirement banner */}
              <div className="lp-custom-banner">
                <div className="lp-custom-banner-text">
                  <h3 className="font-heading">
                    Designed According to
                    <br />
                    <span className="highlight-green">Your Requirement</span>
                  </h3>
                  <p>
                    Choose your card design, holder, ribbon, colour, clip and finishing according to your
                    institution's requirements.
                  </p>
                  <a href="#contact" className="lp-banner-cta" onClick={(e) => handleNavClick(e, "#contact")}>
                    Get Customized Now <ArrowRight size={16} />
                  </a>
                </div>
                <div className="lp-banner-image">
                  <img
                    src="/home/banner-products.jpg"
                    alt="Custom ID card products showcase"
                    loading="lazy"
                    width={500}
                    height={280}
                  />
                </div>
              </div>

              {/* Right – notices */}
              <div className="lp-notices-card">
                <div className="lp-notices-header">
                  <Megaphone size={18} />
                  Latest Notice
                </div>
                <div className="lp-notices-body">
                  {NOTICES.map((notice, i) => (
                    <div key={i} className="lp-notice-item">
                      <div className="lp-notice-title">
                        <span className="lp-notice-dot" />
                        {notice.title}
                      </div>
                      <div className="lp-notice-date">{notice.date}</div>
                    </div>
                  ))}
                </div>
                <div className="lp-notices-footer">
                  <a href="#notice" onClick={(e) => handleNavClick(e, "#notice")}>
                    VIEW ALL NOTICE <ChevronRight size={14} />
                  </a>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* ════════════ FOOTER ════════════ */}
      <footer id="contact" className="lp-footer" role="contentinfo">
        <div className="lp-container">
          <div className="lp-footer-inner">
            <img
              src="/insight-education-logo.png"
              alt="Insight Education logo"
              width={120}
              height={48}
              loading="lazy"
            />
            <div className="lp-footer-contact">
              {/* TODO: replace with real contact details */}
              <a href="mailto:info@insighteducation.com">info@insighteducation.com</a>
              <a href="tel:+910000000000">+91 00000 00000</a>
            </div>
            <span className="lp-footer-copy">© {new Date().getFullYear()} Insight Education. All rights reserved.</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
