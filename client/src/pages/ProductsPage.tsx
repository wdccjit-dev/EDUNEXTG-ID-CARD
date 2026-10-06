import { useEffect } from "react";
import PublicLayout from "@/components/PublicLayout";

interface ProductItem {
  id: string;
  category: "idcards" | "lanyards" | "holders" | "clips";
  title: "ID CARDS" | "LANYARDS / RIBBONS" | "ID CARD HOLDERS" | "CLAMPS & HOOKS";
  displayTitle: string;
  subtitle: string;
  image: string;
}

const PRODUCTS_DATA: ProductItem[] = [
  {
    id: "id-cards",
    category: "idcards",
    title: "ID CARDS",
    displayTitle: "Student & Staff PVC ID Cards",
    subtitle: "High Definition, durable laminated PVC cards with photo clarity",
    image: "/home/product-idcards.jpg",
  },
  {
    id: "lanyards",
    category: "lanyards",
    title: "LANYARDS / RIBBONS",
    displayTitle: "Custom Printed Sublimation Lanyards",
    subtitle: "Silky satin finished personalized ribbons with your institution logo",
    image: "/home/product-lanyards.jpg",
  },
  {
    id: "holders",
    category: "holders",
    title: "ID CARD HOLDERS",
    displayTitle: "Durable Rigid & Soft Card Holders",
    subtitle: "Engineered protection against bending, moisture, and daily wear",
    image: "/home/product-holders.jpg",
  },
  {
    id: "clips",
    category: "clips",
    title: "CLAMPS & HOOKS",
    displayTitle: "Metal Hooks, Plastic Clamps & Retractable Yoyos",
    subtitle: "Heavy duty connectors and badge reels for seamless wear",
    image: "/home/product-clips.jpg",
  },
];

export default function ProductsPage() {
  useEffect(() => {
    document.title = "Products · Insight Education ID Card Solutions";
    window.scrollTo(0, 0);
  }, []);

  return (
    <PublicLayout activePath="/products">
      {/* ════════════ PAGE BANNER ════════════ */}
      <section className="lp-page-banner">
        <div className="lp-container">
          <div className="lp-page-banner-content">
            <span className="lp-page-badge">OUR CATALOG</span>
            <h1 className="font-heading">Identity Products &amp; Accessories</h1>
            <p>
              Premium PVC ID cards, custom printed lanyards, card holders, and clamps designed for schools, colleges, and institutions.
            </p>
          </div>
        </div>
      </section>

      {/* ════════════ PRODUCTS LIST ════════════ */}
      <section className="lp-products-catalog-section">
        <div className="lp-container">
          {/* Minimal Product Showcase Grid */}
          <div className="lp-products-showcase-grid">
            {PRODUCTS_DATA.map((product) => (
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
                  <p className="lp-product-subtitle" style={{ marginBottom: 0 }}>
                    {product.subtitle}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </PublicLayout>
  );
}
