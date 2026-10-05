import { useEffect } from "react";
import { Link } from "wouter";
import PublicLayout from "@/components/PublicLayout";
import {
  Megaphone,
  Calendar,
  AlertCircle,
  FileText,
  ArrowRight,
  ExternalLink,
  ShieldAlert,
  CheckCircle,
} from "lucide-react";

interface NoticeItem {
  id: string;
  badge: "Update" | "Important" | "Announcement" | "Bulk Order";
  badgeColor: string;
  title: string;
  date: string;
  summary: string;
  details: string[];
}

const PUBLIC_NOTICES: NoticeItem[] = [
  {
    id: "n-01",
    badge: "Announcement",
    badgeColor: "bg-blue-100 text-blue-700 border-blue-200",
    title: "New ID Card & Lanyard Designs Available for Session 2026-27",
    date: "April 25, 2026",
    summary: "Explore our latest catalogue featuring dual-sided holographic laminate options, matte-frost premium PVC textures, and enhanced safety breakaway lanyards.",
    details: [
      "New anti-scratch micro-lamination available on all standard CR80 PVC batches.",
      "Over 40 new school colour combinations introduced in satin sublimation ribbons.",
      "Full integration with dynamic QR codes for campus bus routing and library checks.",
      "Complimentary sample kit dispatch available for registered school principals and admins.",
    ],
  },
  {
    id: "n-02",
    badge: "Important",
    badgeColor: "bg-amber-100 text-amber-800 border-amber-200",
    title: "Contact for Bulk Requirements & Pre-Session Booking",
    date: "April 10, 2026",
    summary: "Educational institutions preparing for the new academic session are encouraged to submit bulk requirements in advance for priority manufacturing.",
    details: [
      "Early booking discount of up to 15% on combined ID card + lanyard orders of 500+ units.",
      "Dedicated account manager allocated for student database upload & photo alignment verification.",
      "Pre-session delivery guarantee before school opening dates.",
      "Free mock template design service included for all verified institutions.",
    ],
  },
  {
    id: "n-03",
    badge: "Update",
    badgeColor: "bg-emerald-100 text-emerald-800 border-emerald-200",
    title: "Digital School Portal Upgraded: Excel Bulk Upload & Approval System",
    date: "March 18, 2026",
    summary: "School administrators can now manage card requests, verify student proofs, and track printing progress directly via our online portal.",
    details: [
      "Single-click bulk Excel upload with automatic roll number and section mapping.",
      "Real-time visual proof approval before final batch printing commences.",
      "Live order consignment tracking from press to school campus doorstep.",
    ],
  },
  {
    id: "n-04",
    badge: "Bulk Order",
    badgeColor: "bg-purple-100 text-purple-800 border-purple-200",
    title: "Express Onboarding for Colleges & Multi-Branch Institutions",
    date: "February 28, 2026",
    summary: "Multi-campus trusts and collegiate networks can now centralize identity management across branches with synchronized branding.",
    details: [
      "Centralized template branding with branch-specific campus color variations.",
      "Separate login portals for individual branch coordinators with global admin oversight.",
      "Direct pan-India dispatch to respective branch locations.",
    ],
  },
];

export default function NoticePage() {
  useEffect(() => {
    document.title = "Notices & Announcements · Insight Education";
    window.scrollTo(0, 0);
  }, []);

  return (
    <PublicLayout activePath="/notice">
      {/* ════════════ PAGE BANNER ════════════ */}
      <section className="lp-page-banner">
        <div className="lp-container">
          <div className="lp-page-banner-content">
            <span className="lp-page-badge">NOTICE BOARD</span>
            <h1 className="font-heading">Institutional Notices &amp; Bulletins</h1>
            <p>
              Stay informed with our latest product additions, academic session schedule updates, bulk ordering guidelines, and client service announcements.
            </p>
          </div>
        </div>
      </section>

      {/* ════════════ NOTICES LISTING ════════════ */}
      <section className="lp-notices-page-section">
        <div className="lp-container">
          <div className="lp-notices-feed">
            {PUBLIC_NOTICES.map((notice) => (
              <article key={notice.id} className="lp-notice-feed-card">
                <div className="lp-notice-feed-header">
                  <div className="flex items-center gap-3">
                    <span className={`lp-notice-pill ${notice.badgeColor}`}>
                      {notice.badge}
                    </span>
                    <span className="lp-notice-date-meta">
                      <Calendar size={14} />
                      {notice.date}
                    </span>
                  </div>
                </div>

                <h3 className="lp-notice-feed-title font-heading">{notice.title}</h3>
                <p className="lp-notice-feed-summary">{notice.summary}</p>

                <div className="lp-notice-feed-details">
                  <h5 className="font-bold text-xs uppercase tracking-wider text-[#1b4a7c] mb-2">Key Details</h5>
                  <ul className="space-y-1.5">
                    {notice.details.map((point, idx) => (
                      <li key={idx} className="flex items-start gap-2 text-xs text-[#555]">
                        <span className="w-1.5 h-1.5 rounded-full bg-[#00894d] mt-1.5 flex-shrink-0" />
                        <span>{point}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="lp-notice-feed-footer">
                  <Link href="/contact-us" className="lp-notice-action-link">
                    Inquire Regarding This Notice <ArrowRight size={14} />
                  </Link>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ════════════ NEED HELP CTA ════════════ */}
      <section className="lp-contact-cta-band">
        <div className="lp-container">
          <div className="lp-contact-cta-inner">
            <div>
              <h3 className="text-2xl font-bold font-heading mb-2">Have Questions About These Announcements?</h3>
              <p className="text-sm opacity-90">Reach out to our customer support desk for fast clarification or assistance.</p>
            </div>
            <Link href="/contact-us" className="lp-banner-cta">
              Contact Support <ArrowRight size={16} />
            </Link>
          </div>
        </div>
      </section>
    </PublicLayout>
  );
}
