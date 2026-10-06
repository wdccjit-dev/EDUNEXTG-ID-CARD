import { useEffect } from "react";
import { Link } from "wouter";
import PublicLayout from "@/components/PublicLayout";
import {
  Phone,
  Mail,
  MapPin,
  Clock,
  School,
  LockKeyhole,
  ArrowRight,
  ShieldCheck,
  PackageCheck,
  CheckCircle2,
} from "lucide-react";

export default function ContactUsPage() {
  useEffect(() => {
    document.title = "Contact Us · Insight Education ID Card Solutions";
    window.scrollTo(0, 0);
  }, []);

  return (
    <PublicLayout activePath="/contact-us">
      {/* ════════════ PAGE BANNER ════════════ */}
      <section className="lp-page-banner">
        <div className="lp-container">
          <div className="lp-page-banner-content">
            <span className="lp-page-badge">DIRECT CONTACT</span>
            <h1 className="font-heading">Contact Our Institutional Team</h1>
            <p>
              Direct contact channels for school principals, college administrators, and institutional purchase teams across India.
            </p>
          </div>
        </div>
      </section>

      {/* ════════════ CONTACT CARDS SECTION (NO FORM) ════════════ */}
      <section className="lp-contact-section py-12">
        <div className="lp-container">
          <div className="lp-contact-direct-wrap">
            <div className="lp-contact-direct-grid">
              {/* Phone & WhatsApp */}
              <div className="lp-contact-card">
                <div className="lp-contact-icon-box">
                  <Phone size={24} />
                </div>
                <div>
                  <h4>Phone &amp; WhatsApp Support</h4>
                  <p className="lp-contact-main-text">+91 81008 79809</p>
                  <p className="lp-contact-sub-text">
                    Direct line to our institutional order desk. Available Monday through Saturday, 9:30 AM to 6:30 PM IST.
                  </p>
                  <div className="lp-contact-action-bar">
                    <a href="tel:+918100879809" className="lp-contact-cta-btn">
                      Call Support
                    </a>
                    <a
                      href="https://wa.me/918100879809?text=Hello%20Insight%20Education,%20we%20are%20inquiring%20about%20school%20ID%20cards"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="lp-contact-cta-btn secondary"
                    >
                      WhatsApp Us
                    </a>
                  </div>
                </div>
              </div>

              {/* Email */}
              <div className="lp-contact-card">
                <div className="lp-contact-icon-box">
                  <Mail size={24} />
                </div>
                <div>
                  <h4>Official Email Inquiries</h4>
                  <p className="lp-contact-main-text">insiteducation@gmail.com</p>
                  <p className="lp-contact-sub-text">
                    Send tender inquiries, bulk RFP requirements, or sample requests. Typical response turnaround within 2–4 business hours.
                  </p>
                  <div className="lp-contact-action-bar">
                    <a href="mailto:insiteducation@gmail.com?subject=School%20ID%20Card%20Inquiry" className="lp-contact-cta-btn">
                      Send Email
                    </a>
                  </div>
                </div>
              </div>

              {/* Head Office */}
              <div className="lp-contact-card">
                <div className="lp-contact-icon-box">
                  <MapPin size={24} />
                </div>
                <div>
                  <h4>Head Office</h4>
                  <p className="lp-contact-main-text">Insight Education Identity Solutions</p>
                  <p className="lp-contact-sub-text">
                    AF-333, Rabindrapally, Talbagan, P.O. Prafulla Kanan, Kolkata-700101, India.
                  </p>
                </div>
              </div>



              {/* Quality Guarantee */}
              <div className="lp-contact-card">
                <div className="lp-contact-icon-box">
                  <ShieldCheck size={24} />
                </div>
                <div>
                  <h4>100% Quality &amp; Accuracy Guarantee</h4>
                  <p className="lp-contact-main-text">Thermal &amp; Re-transfer High Def Finishing</p>
                  <p className="lp-contact-sub-text">
                    Every batch undergoes digital proofing and multi-point barcode/QR scanning verification prior to dispatch.
                  </p>
                </div>
              </div>
            </div>

            {/* Portal Action Banner */}
            <div className="lp-contact-portal-banner">
              <div>
                <h3>Already a Partner School or Registered Admin?</h3>
                <p>
                  Access your institution portal to approve card proofs, review student data, and monitor live printing status.
                </p>
              </div>
              <Link href="/login" className="lp-contact-portal-btn">
                <LockKeyhole size={16} /> School Portal Login <ArrowRight size={16} />
              </Link>
            </div>
          </div>
        </div>
      </section>
    </PublicLayout>
  );
}

