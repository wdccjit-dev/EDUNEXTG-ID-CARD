import { useEffect, useState } from "react";
import { Link } from "wouter";
import PublicLayout from "@/components/PublicLayout";
import {
  CheckCircle2,
  ChevronRight,
  ArrowRight,
  Sparkles,
  ShieldCheck,
  Palette,
  Package,
} from "lucide-react";

interface ProductItem {
  id: string;
  category: "idcards" | "lanyards" | "holders" | "clips";
  title: "ID CARDS" | "LANYARDS / RIBBONS" | "ID CARD HOLDERS" | "CLIPS & HOOKS";
  displayTitle: string;
  subtitle: string;
  image: string;
  specs: string[];
  features: string[];
}

const PRODUCTS_DATA: ProductItem[] = [
  {
    id: "id-cards",
    category: "idcards",
    title: "ID CARDS",
    displayTitle: "Student & Staff PVC ID Cards",
    subtitle: "High Definition, durable laminated PVC cards with photo clarity",
    image: "/home/product-idcards.jpg",
    specs: ["Standard CR80 size (85.6 x 54 mm)", "Thickness: 0.76mm / 30 Mil", "Material: 100% Solid Premium PVC"],
    features: [
      "Scratch & water-resistant thermal protective overlay",
      "Dynamic QR code, barcode & security watermark support",
      "Vibrant high-resolution edge-to-edge sublimation printing",
      "Pre-punched slot or round hole ready for holders and lanyards",
    ],
  },
  {
    id: "lanyards",
    category: "lanyards",
    title: "LANYARDS / RIBBONS",
    displayTitle: "Custom Printed Sublimation Lanyards",
    subtitle: "Silky satin finished personalized ribbons with your institution logo",
    image: "/home/product-lanyards.jpg",
    specs: ["Width options: 12mm, 16mm, 20mm, 25mm", "Length: 36 inches standard", "Material: Premium Satin / Polyester"],
    features: [
      "High-definition multi-color digital sublimation heat transfer",
      "Color-fast print that won't fade or peel after washing",
      "Safety breakaway buckle and quick-release detachment options",
      "Sturdy metal fish hook, dog hook, or alligator clip attachment",
    ],
  },
  {
    id: "holders",
    category: "holders",
    title: "ID CARD HOLDERS",
    displayTitle: "Durable Rigid & Soft Card Holders",
    subtitle: "Engineered protection against bending, moisture, and daily wear",
    image: "/home/product-holders.jpg",
    specs: ["Vertical & Horizontal orientations", "Standard CR80 internal fit", "Material: Acrylic, Polycarbonate & Vinyl"],
    features: [
      "Rigid hard plastic casing prevents cards from cracking or bending",
      "Crystal clear transparent window maintains barcode scanning",
      "Thumb-notch slider for easy card insertion and extraction",
      "Available in multiple institutional colors (Royal Blue, Black, White, Clear)",
    ],
  },
  {
    id: "clips",
    category: "clips",
    title: "CLIPS & HOOKS",
    displayTitle: "Metal Hooks, Plastic Clips & Retractable Yoyos",
    subtitle: "Heavy duty connectors and badge reels for seamless wear",
    image: "/home/product-clips.jpg",
    specs: ["Corrosion-resistant nickel plating", "High-durability spring mechanisms", "Retractable cord reach: up to 60cm"],
    features: [
      "Heavy-duty dog hooks, trigger snaps, and lobster claws",
      "Spring-loaded badge clips with reinforced clear vinyl straps",
      "Retractable badge reels (yoyos) with custom center logo sticker",
      "Detachable buckles and breakaway connectors for lab and child safety",
    ],
  },
];

export default function ProductsPage() {
  const [selectedCategory, setSelectedCategory] = useState<string>("all");

  useEffect(() => {
    document.title = "Products · Insight Education ID Card Solutions";
    window.scrollTo(0, 0);
  }, []);

  const filteredProducts =
    selectedCategory === "all"
      ? PRODUCTS_DATA
      : PRODUCTS_DATA.filter((p) => p.category === selectedCategory);

  return (
    <PublicLayout activePath="/products">
      {/* ════════════ PAGE BANNER ════════════ */}
      <section className="lp-page-banner">
        <div className="lp-container">
          <div className="lp-page-banner-content">
            <span className="lp-page-badge">OUR CATALOG</span>
            <h1 className="font-heading">Comprehensive Identity Products</h1>
            <p>
              Premium PVC ID cards, custom printed lanyards, card holders, and accessories built for longevity and unmatched institutional presentation.
            </p>
          </div>
        </div>
      </section>

      {/* ════════════ PRODUCTS LIST ════════════ */}
      <section className="lp-products-catalog-section">
        <div className="lp-container">
          {/* Category Filter Pills */}
          <div className="lp-products-filter-bar">
            {[
              { id: "all", label: "All Solutions" },
              { id: "idcards", label: "PVC ID Cards" },
              { id: "lanyards", label: "Custom Lanyards" },
              { id: "holders", label: "Card Holders" },
              { id: "clips", label: "Clips & Attachments" },
            ].map((cat) => (
              <button
                key={cat.id}
                className={`lp-filter-pill ${selectedCategory === cat.id ? "active" : ""}`}
                onClick={() => setSelectedCategory(cat.id)}
              >
                {cat.label}
              </button>
            ))}
          </div>

          {/* Detailed Product Showcase Grid */}
          <div className="lp-products-showcase-grid">
            {filteredProducts.map((product) => (
              <div key={product.id} className="lp-product-showcase-card">
                <div className="lp-product-showcase-image-wrapper">
                  <img
                    src={product.image}
                    alt={product.displayTitle}
                    className="lp-product-showcase-image"
                  />
                  <span className="lp-product-category-tag">{product.title}</span>
                </div>

                <div className="lp-product-showcase-content">
                  <h3 className="font-heading">{product.displayTitle}</h3>
                  <p className="lp-product-subtitle">{product.subtitle}</p>

                  <div className="lp-product-specs-list">
                    <h5 className="font-bold text-xs uppercase tracking-wider text-[#1d5a2e] mb-2">Specifications</h5>
                    {product.specs.map((spec, i) => (
                      <div key={i} className="lp-spec-item">
                        <span className="lp-bullet-dot" />
                        <span>{spec}</span>
                      </div>
                    ))}
                  </div>

                  <div className="lp-product-features-list">
                    <h5 className="font-bold text-xs uppercase tracking-wider text-[#1b4a7c] mb-2">Key Highlights</h5>
                    {product.features.map((feat, i) => (
                      <div key={i} className="lp-feature-item">
                        <CheckCircle2 size={14} className="text-[#00894d] flex-shrink-0 mt-0.5" />
                        <span>{feat}</span>
                      </div>
                    ))}
                  </div>

                  <div className="lp-product-card-action">
                    <Link href={`/contact-us?product=${encodeURIComponent(product.title)}`} className="lp-product-inquire-btn">
                      Request Quotation <ArrowRight size={15} />
                    </Link>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ════════════ BULK CUSTOM PACKAGES BANNER ════════════ */}
      <section className="lp-custom-package-band">
        <div className="lp-container">
          <div className="lp-custom-banner">
            <div className="lp-custom-banner-text">
              <h3 className="font-heading">
                All-in-One Institutional
                <br />
                <span className="highlight-green">Annual ID Card Packages</span>
              </h3>
              <p>
                Get combined bundles comprising high-definition Student ID Cards, institution-branded lanyards, and matching heavy-duty holders packed student-wise and section-wise for hassle-free campus distribution.
              </p>
              <Link href="/contact-us" className="lp-banner-cta">
                Get Customized Package <ArrowRight size={16} />
              </Link>
            </div>
            <div className="lp-banner-image">
              <img
                src="/home/banner-products.jpg"
                alt="Complete ID card bundle display"
                loading="lazy"
                width={500}
                height={280}
              />
            </div>
          </div>
        </div>
      </section>
    </PublicLayout>
  );
}
