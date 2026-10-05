import { useEffect, useState } from "react";
import PublicLayout from "@/components/PublicLayout";
import {
  Phone,
  Mail,
  MapPin,
  Clock,
  Send,
  CheckCircle2,
  Building2,
  School,
  ShieldCheck,
  MessageSquare,
} from "lucide-react";

export default function ContactUsPage() {
  const [formData, setFormData] = useState({
    name: "",
    institution: "",
    email: "",
    phone: "",
    product: "ID Cards",
    message: "",
  });
  const [formSubmitted, setFormSubmitted] = useState(false);
  const [formLoading, setFormLoading] = useState(false);

  useEffect(() => {
    document.title = "Contact Us · Insight Education ID Card Solutions";
    window.scrollTo(0, 0);

    // Read initial product from query param if available
    try {
      const params = new URLSearchParams(window.location.search);
      const prod = params.get("product");
      if (prod) {
        setFormData((prev) => ({ ...prev, product: prod }));
      }
    } catch {
      // ignore
    }
  }, []);

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormLoading(true);
    setTimeout(() => {
      setFormLoading(false);
      setFormSubmitted(true);
    }, 600);
  };

  return (
    <PublicLayout activePath="/contact-us">
      {/* ════════════ PAGE BANNER ════════════ */}
      <section className="lp-page-banner">
        <div className="lp-container">
          <div className="lp-page-banner-content">
            <span className="lp-page-badge">GET IN TOUCH</span>
            <h1 className="font-heading">Contact Our Institutional Team</h1>
            <p>
              Whether you need quotations for an entire student body, custom lanyard samples, or software portal onboarding, our specialists are ready to help.
            </p>
          </div>
        </div>
      </section>

      {/* ════════════ CONTACT SECTION ════════════ */}
      <section className="lp-contact-section py-12">
        <div className="lp-container">
          <div className="lp-contact-grid">
            {/* Left Column: Direct Contact Info */}
            <div className="lp-contact-info-cards">
              <div className="lp-contact-card">
                <div className="lp-contact-icon-box">
                  <Phone size={22} />
                </div>
                <div>
                  <h4>Phone &amp; WhatsApp Support</h4>
                  <p className="lp-contact-main-text">+91 98765 43210 &nbsp;|&nbsp; +91 98765 43211</p>
                  <p className="lp-contact-sub-text">Mon – Sat: 9:30 AM – 6:30 PM IST</p>
                </div>
              </div>

              <div className="lp-contact-card">
                <div className="lp-contact-icon-box">
                  <Mail size={22} />
                </div>
                <div>
                  <h4>Email Inquiries</h4>
                  <p className="lp-contact-main-text">sales@insighteducation.in</p>
                  <p className="lp-contact-sub-text">Quick responses within 2–4 business hours</p>
                </div>
              </div>

              <div className="lp-contact-card">
                <div className="lp-contact-icon-box">
                  <MapPin size={22} />
                </div>
                <div>
                  <h4>Production &amp; Head Office</h4>
                  <p className="lp-contact-main-text">Insight Education Identity Solutions</p>
                  <p className="lp-contact-sub-text">Plot 42, Okhla Industrial Area Phase-II, New Delhi – 110020</p>
                </div>
              </div>

              <div className="lp-contact-card">
                <div className="lp-contact-icon-box">
                  <Clock size={22} />
                </div>
                <div>
                  <h4>Institutional Dispatch &amp; Delivery</h4>
                  <p className="lp-contact-main-text">Pan-India Express Shipping</p>
                  <p className="lp-contact-sub-text">Express 3–5 days turnaround for confirmed school batches</p>
                </div>
              </div>

              <div className="lp-contact-card">
                <div className="lp-contact-icon-box">
                  <School size={22} />
                </div>
                <div>
                  <h4>Free Physical Sample Kit</h4>
                  <p className="lp-contact-main-text">Available for Schools &amp; Colleges</p>
                  <p className="lp-contact-sub-text">We dispatch complimentary cards, lanyard samples &amp; holders upon institutional request.</p>
                </div>
              </div>
            </div>

            {/* Right Column: Inquiry Form */}
            <div className="lp-contact-form-card">
              <h3 className="font-heading">Request a Quote or Sample Kit</h3>
              <p className="lp-form-intro">
                Fill out the quick form below and our institutional specialist will get back to you promptly with tailored pricing.
              </p>

              {formSubmitted ? (
                <div className="lp-form-success">
                  <CheckCircle2 size={36} className="text-green-600" />
                  <div>
                    <h4>Thank You for Your Inquiry!</h4>
                    <p>We have received your requirement. A member of our education specialist team will contact you shortly.</p>
                    <button
                      type="button"
                      onClick={() => {
                        setFormSubmitted(false);
                        setFormData({ name: "", institution: "", email: "", phone: "", product: "ID Cards", message: "" });
                      }}
                      className="lp-form-reset-btn"
                    >
                      Send Another Inquiry
                    </button>
                  </div>
                </div>
              ) : (
                <form onSubmit={handleFormSubmit} className="lp-contact-form">
                  <div className="lp-form-row">
                    <div className="lp-form-group">
                      <label htmlFor="contact-name">Your Name *</label>
                      <input
                        id="contact-name"
                        type="text"
                        required
                        placeholder="e.g. Ramesh Kumar"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      />
                    </div>
                    <div className="lp-form-group">
                      <label htmlFor="contact-institution">School / College / Organization *</label>
                      <input
                        id="contact-institution"
                        type="text"
                        required
                        placeholder="e.g. Delhi Public School"
                        value={formData.institution}
                        onChange={(e) => setFormData({ ...formData, institution: e.target.value })}
                      />
                    </div>
                  </div>

                  <div className="lp-form-row">
                    <div className="lp-form-group">
                      <label htmlFor="contact-email">Email Address *</label>
                      <input
                        id="contact-email"
                        type="email"
                        required
                        placeholder="principal@school.edu.in"
                        value={formData.email}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      />
                    </div>
                    <div className="lp-form-group">
                      <label htmlFor="contact-phone">Phone / WhatsApp Number *</label>
                      <input
                        id="contact-phone"
                        type="tel"
                        required
                        placeholder="+91 98765 00000"
                        value={formData.phone}
                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      />
                    </div>
                  </div>

                  <div className="lp-form-group">
                    <label htmlFor="contact-product">Interested Solution</label>
                    <select
                      id="contact-product"
                      value={formData.product}
                      onChange={(e) => setFormData({ ...formData, product: e.target.value })}
                    >
                      <option value="ID Cards">Student &amp; Staff ID Cards</option>
                      <option value="LANYARDS / RIBBONS">Customized Sublimation Lanyards &amp; Ribbons</option>
                      <option value="ID CARD HOLDERS">ID Card Holders (Soft &amp; Hard)</option>
                      <option value="CLIPS & HOOKS">Metal Clips, Hooks &amp; Yoyos</option>
                      <option value="Complete Package">Complete ID Card Package (Cards + Lanyards + Holders)</option>
                      <option value="Bulk Order">Bulk Order / Annual School Contract</option>
                    </select>
                  </div>

                  <div className="lp-form-group">
                    <label htmlFor="contact-message">Estimated Quantity or Details</label>
                    <textarea
                      id="contact-message"
                      rows={4}
                      placeholder="Tell us about your estimated student strength or custom design requirements..."
                      value={formData.message}
                      onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                    />
                  </div>

                  <button type="submit" className="lp-form-submit-btn" disabled={formLoading}>
                    {formLoading ? "Sending..." : "Submit Inquiry"} <Send size={16} />
                  </button>
                </form>
              )}
            </div>
          </div>
        </div>
      </section>
    </PublicLayout>
  );
}
