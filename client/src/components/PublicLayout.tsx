import { useState } from "react";
import { Link, useLocation } from "wouter";
import {
  ShieldCheck,
  LockKeyhole,
  Menu,
  X,
  MapPin,
  Phone,
  Mail,
  Clock,
} from "lucide-react";

export const PUBLIC_NAV_LINKS = [
  { label: "Home", href: "/" },
  { label: "About Us", href: "/about-us" },
  { label: "Products", href: "/products" },
  { label: "Contact Us", href: "/contact-us" },
] as const;

interface PublicLayoutProps {
  children: React.ReactNode;
  activePath?: string;
}

export default function PublicLayout({ children, activePath }: PublicLayoutProps) {
  const [location] = useLocation();
  const currentPath = activePath || location;
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="landing-root">
      {/* ════════════ HEADER ════════════ */}
      <header className="lp-header" role="banner">
        <div className="lp-header-inner">
          <Link href="/">
            <img
              src="/insight-education-logo.png"
              alt="Insight Education logo"
              className="lp-logo"
              width={160}
              height={64}
            />
          </Link>

          {/* Desktop nav */}
          <nav aria-label="Main navigation">
            <ul className="lp-nav">
              {PUBLIC_NAV_LINKS.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className={
                      currentPath === link.href ||
                      (link.href !== "/" && currentPath.startsWith(link.href))
                        ? "active"
                        : ""
                    }
                  >
                    {link.label}
                  </Link>
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
          {PUBLIC_NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={
                currentPath === link.href ||
                (link.href !== "/" && currentPath.startsWith(link.href))
                  ? "active"
                  : ""
              }
              onClick={() => setMobileMenuOpen(false)}
            >
              {link.label}
            </Link>
          ))}
          <a
            href="/login"
            className="lp-portal-btn"
            style={{ alignSelf: "flex-start", marginTop: 8 }}
          >
            <LockKeyhole size={16} />
            Login
          </a>
        </nav>
      </header>

      {/* ════════════ MAIN CONTENT ════════════ */}
      <main>{children}</main>

      {/* ════════════ FOOTER (Expanded) ════════════ */}
      <footer className="lp-footer" role="contentinfo">
        <div className="lp-container">
          <div className="lp-footer-grid">
            {/* Column 1: About Us / Brand */}
            <div className="lp-footer-col">
              <Link href="/">
                <img
                  src="/insight-education-logo.png"
                  alt="Insight Education logo"
                  className="lp-footer-logo"
                  width={140}
                  height={56}
                  loading="lazy"
                />
              </Link>
              <p className="lp-footer-brand-desc">
                Insight Education is a trusted manufacturer and supplier of institutional identity solutions,
                providing premium ID cards, custom lanyards, holders, and accessories across 500+ institutions.
              </p>
              <div className="lp-footer-badge">
                <ShieldCheck size={16} />
                <span>Quality Guaranteed &amp; Verified</span>
              </div>
            </div>

            {/* Column 2: Quick Navigation */}
            <div className="lp-footer-col">
              <h4 className="lp-footer-col-title">Quick Navigation</h4>
              <ul className="lp-footer-nav-list">
                <li>
                  <Link href="/">Home</Link>
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
              © {new Date().getFullYear()} Insight Education Solutions. All rights reserved.
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}
