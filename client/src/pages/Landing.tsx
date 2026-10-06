import { useEffect, useState, useCallback } from "react";
import { Link } from "wouter";
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
  ArrowRight,
  MapPin,
  Phone,
  Mail,
  Clock,
} from "lucide-react";

/* ───────────────────────────────────────────
   Nav links
   ─────────────────────────────────────────── */
const NAV_LINKS = [
  { label: "Home", href: "/" },
  { label: "About Us", href: "/about-us" },
  { label: "Products", href: "/products" },
  { label: "Contact Us", href: "/contact-us" },
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
    title: "ID CARDS",
    subtitle: "School, College & Institutional ID Cards",
    image: "/home/product-idcards.jpg",
  },
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
    title: "CLAMPS & HOOKS",
    subtitle: "Metal Hooks, Plastic Clamps & Attachments",
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
                  {link.href === "/" ? (
                    <a
                      href="#home"
                      className={activeSection === "home" ? "active" : ""}
                      onClick={(e) => handleNavClick(e, "#home")}
                    >
                      {link.label}
                    </a>
                  ) : (
                    <Link
                      href={link.href}
                      className={activeSection === link.href.replace("/", "") ? "active" : ""}
                    >
                      {link.label}
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          </nav>

          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            {/* Login button */}
            <a href="/login" className="lp-portal-btn">
              <LockKeyhole size={16} />
              Login
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
            link.href === "/" ? (
              <a
                key={link.href}
                href="#home"
                className={activeSection === "home" ? "active" : ""}
                onClick={(e) => handleNavClick(e, "#home")}
              >
                {link.label}
              </a>
            ) : (
              <Link
                key={link.href}
                href={link.href}
                className={activeSection === link.href.replace("/", "") ? "active" : ""}
                onClick={() => setMobileMenuOpen(false)}
              >
                {link.label}
              </Link>
            )
          ))}
          <a href="/login" className="lp-portal-btn" style={{ alignSelf: "flex-start", marginTop: 8 }}>
            <LockKeyhole size={16} />
            Login
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
              alt="ID cards, lanyards, holders and clamps displayed together"
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
                      <Link href="/contact-us" className="lp-arrow-btn" aria-label={`Inquire about ${card.title}`}>
                        <ChevronRight size={18} />
                      </Link>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ════════════ ABOUT US / WHY CHOOSE ════════════ */}
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

        {/* ════════════ CUSTOM REQUIREMENT BANNER ════════════ */}
        <section className="lp-banner-section">
          <div className="lp-container">
            <div className="lp-banner-row">
              <div className="lp-custom-banner">
                <div className="lp-custom-banner-text">
                  <h3 className="font-heading">
                    Designed According to
                    <br />
                    <span className="highlight-green">Your Requirement</span>
                  </h3>
                  <p>
                    Choose your card design, holder, ribbon, colour, clamp and finishing according to your
                    institution's requirements.
                  </p>
                  <Link href="/contact-us" className="lp-banner-cta">
                    Get Customized Now <ArrowRight size={16} />
                  </Link>
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
            </div>
          </div>
        </section>
      </main>

      {/* ════════════ FOOTER (Expanded) ════════════ */}
      <footer className="lp-footer" role="contentinfo">
        <div className="lp-container">
          <div className="lp-footer-grid">
            {/* Column 1: About Us / Brand */}
            <div className="lp-footer-col">
              <a href="#home" onClick={(e) => handleNavClick(e, "#home")}>
                <img
                  src="/insight-education-logo.png"
                  alt="Insight Education logo"
                  className="lp-footer-logo"
                  width={140}
                  height={56}
                  loading="lazy"
                />
              </a>
              <p className="lp-footer-brand-desc">
                Insight Education is a trusted manufacturer and supplier of institutional identity solutions,
                providing premium ID cards, custom lanyards, holders, and accessories across 500+ institutions.
              </p>
              <div className="lp-footer-badge">
                <ShieldCheck size={16} />
                <span>Quality Guaranteed &amp; Verified</span>
              </div>
            </div>

            {/* Column 2: Quick Links (About Us, Products, Notice, Contact Us) */}
            <div className="lp-footer-col">
              <h4 className="lp-footer-col-title">Quick Navigation</h4>
              <ul className="lp-footer-nav-list">
                <li>
                  <a href="#home" onClick={(e) => handleNavClick(e, "#home")}>
                    Home
                  </a>
                </li>
                <li>
                  <Link href="/about-us">About Us</Link>
                </li>
                <li>
                  <Link href="/products">Products</Link>
                </li>
                <li>
                  <Link href="/contact-us">Contact Us</Link>
                </li>
                <li>
                  <a href="/login" className="lp-footer-login-link">
                    <LockKeyhole size={13} />
                    School Portal Login
                  </a>
                </li>
              </ul>
            </div>

            {/* Column 3: Products */}
            <div className="lp-footer-col">
              <h4 className="lp-footer-col-title">Our Products</h4>
              <ul className="lp-footer-nav-list">
                <li>
                  <Link href="/products">Institutional &amp; School ID Cards</Link>
                </li>
                <li>
                  <Link href="/products">Custom Printed &amp; Plain Lanyards</Link>
                </li>
                <li>
                  <Link href="/products">Durable ID Card Holders</Link>
                </li>
                <li>
                  <Link href="/products">Metal Hooks &amp; Retractable Yoyos</Link>
                </li>
                <li>
                  <Link href="/contact-us">Customized Institutional Packages</Link>
                </li>
              </ul>
            </div>

            {/* Column 4: Contact Us */}
            <div className="lp-footer-col">
              <h4 className="lp-footer-col-title">Contact Us</h4>
              <div className="lp-footer-contact-details">
                <div className="lp-footer-contact-row">
                  <MapPin size={18} className="lp-footer-icon" />
                  <span>Plot 42, Okhla Industrial Area Phase-II, New Delhi – 110020</span>
                </div>
                <div className="lp-footer-contact-row">
                  <Phone size={18} className="lp-footer-icon" />
                  <a href="tel:+919876543210">+91 98765 43210 / 11</a>
                </div>
                <div className="lp-footer-contact-row">
                  <Mail size={18} className="lp-footer-icon" />
                  <a href="mailto:sales@insighteducation.in">sales@insighteducation.in</a>
                </div>
                <div className="lp-footer-contact-row">
                  <Clock size={18} className="lp-footer-icon" />
                  <span>Mon – Sat: 9:30 AM – 6:30 PM</span>
                </div>
              </div>
            </div>
          </div>

          {/* Bottom Bar */}
          <div className="lp-footer-bottom">
            <span className="lp-footer-copy">
              © {new Date().getFullYear()}  Insight Education. All rights reserved.
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}

