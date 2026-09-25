import { useEffect, useRef } from "react";
import type { DesignerElement, DesignerSide, ElementConfig } from "@shared/templateDesigner";
import { DYNAMIC_FIELDS, SAMPLE_CARD_DATA } from "@shared/templateDesigner";
import QRCode from "qrcode";
import JsBarcode from "jsbarcode";

// ─── QR Code Element ────────────────────────────────────────────────────────

function QrCodeEl({ config, data }: { config: ElementConfig; data: Record<string, string> }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fieldValue = data[config.qrField ?? "admission_number"] ?? config.qrField ?? "N/A";

  useEffect(() => {
    if (!canvasRef.current) return;
    QRCode.toCanvas(canvasRef.current, fieldValue || "N/A", {
      width: Math.min(config.width, config.height),
      margin: 1,
      color: { dark: "#000000", light: "#ffffff" },
    }).catch(() => {});
  }, [fieldValue, config.width, config.height]);

  return <canvas ref={canvasRef} style={{ width: "100%", height: "100%", objectFit: "contain" }} />;
}

// ─── Barcode Element ────────────────────────────────────────────────────────

function BarcodeEl({ config, data }: { config: ElementConfig; data: Record<string, string> }) {
  const svgRef = useRef<SVGSVGElement>(null);
  const fieldValue = data[config.barcodeField ?? "admission_number"] ?? config.barcodeField ?? "N/A";

  useEffect(() => {
    if (!svgRef.current) return;
    try {
      JsBarcode(svgRef.current, fieldValue || "N/A", {
        format: config.barcodeFormat ?? "CODE128",
        width: 1.5,
        height: Math.max(20, config.height - 10),
        displayValue: false,
        margin: 2,
      });
    } catch {
      /* Invalid barcode value — silently ignore in preview */
    }
  }, [fieldValue, config.barcodeFormat, config.height]);

  return <svg ref={svgRef} style={{ width: "100%", height: "100%" }} />;
}

// ─── Single Element Renderer ────────────────────────────────────────────────

function RenderElement({
  element,
  cardData,
}: {
  element: DesignerElement;
  cardData: Record<string, string>;
}) {
  const c = element.config;

  const baseStyle: React.CSSProperties = {
    position: "absolute",
    left: c.x,
    top: c.y,
    width: c.width,
    height: c.height,
    opacity: c.opacity ?? 1,
    transform: c.rotation ? `rotate(${c.rotation}deg)` : undefined,
    overflow: "hidden",
    backgroundColor: c.bgColor || undefined,
    borderColor: c.borderColor || undefined,
    borderWidth: c.borderWidth ? `${c.borderWidth}px` : undefined,
    borderStyle: c.borderWidth ? "solid" : undefined,
    borderRadius: c.borderRadius ? `${c.borderRadius}px` : undefined,
  };

  const textStyle: React.CSSProperties = {
    fontFamily: c.fontFamily ?? "Inter, sans-serif",
    fontSize: c.fontSize ? `${c.fontSize}px` : undefined,
    fontWeight: c.fontWeight ?? undefined,
    fontStyle: c.fontStyle ?? undefined,
    textAlign: c.textAlign ?? undefined,
    color: c.textColor ?? undefined,
    lineHeight: 1.35,
    wordBreak: "break-word" as const,
  };

  switch (element.elementType) {
    case "TEXT":
      return (
        <div style={{ ...baseStyle, ...textStyle, display: "flex", alignItems: "center" }}>
          <span style={{ width: "100%" }}>{c.content ?? ""}</span>
        </div>
      );

    case "DYNAMIC_FIELD": {
      const field = c.dynamicField ?? "student_name";
      const value = cardData[field] ?? `{{${field}}}`;
      const fieldDef = DYNAMIC_FIELDS.find((f) => f.key === field);
      return (
        <div style={{ ...baseStyle, ...textStyle, display: "flex", alignItems: "center" }}>
          <span style={{ width: "100%" }} title={fieldDef?.label ?? field}>{value}</span>
        </div>
      );
    }

    case "IMAGE":
    case "PHOTO":
    case "LOGO":
    case "SIGNATURE": {
      const fieldKey =
        c.dynamicField ||
        (element.elementType === "PHOTO"
          ? "photo"
          : element.elementType === "SIGNATURE"
            ? "signature"
            : element.elementType === "LOGO"
              ? "logo"
              : undefined);

      const dynamicImg =
        fieldKey && (cardData[fieldKey] || (fieldKey === "photo" && cardData["student_photo"]))
          ? cardData[fieldKey] || cardData["student_photo"]
          : c.imageUrl;

      // Apply image shape clipping
      const shapeStyle: React.CSSProperties = {};
      const shape = c.imageShape ?? "square";
      if (shape === "circle") {
        shapeStyle.borderRadius = "50%";
      } else if (shape === "rounded") {
        shapeStyle.borderRadius = "16%";
      } else if (shape === "ellipse") {
        shapeStyle.borderRadius = "50% / 50%";
      }

      return (
        <div style={{ ...baseStyle, ...shapeStyle }}>
          {dynamicImg ? (
            <img
              src={dynamicImg}
              alt={element.label ?? element.elementType}
              style={{ width: "100%", height: "100%", objectFit: c.objectFit ?? "cover", display: "block" }}
            />
          ) : (
            <div
              style={{
                width: "100%",
                height: "100%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: "#f0f0f0",
                color: "#999",
                fontSize: "10px",
                textTransform: "uppercase",
                letterSpacing: "0.05em",
              }}
            >
              {element.elementType === "PHOTO"
                ? "📷 Photo"
                : element.elementType === "LOGO"
                  ? "🏫 Logo"
                  : element.elementType === "SIGNATURE"
                    ? "✍️ Sig"
                    : "🖼 Image"}
            </div>
          )}
        </div>
      );
    }

    case "QR_CODE":
      return (
        <div style={baseStyle}>
          <QrCodeEl config={c} data={cardData} />
        </div>
      );

    case "BARCODE":
      return (
        <div style={baseStyle}>
          <BarcodeEl config={c} data={cardData} />
        </div>
      );

    case "RECTANGLE":
      return <div style={baseStyle} />;

    case "LINE":
      return (
        <div
          style={{
            ...baseStyle,
            backgroundColor: c.lineColor ?? "#cccccc",
            height: c.lineDirection === "vertical" ? c.height : (c.lineWidth ?? 2),
            width: c.lineDirection === "vertical" ? (c.lineWidth ?? 2) : c.width,
          }}
        />
      );

    default:
      return <div style={baseStyle} />;
  }
}

// ─── Card Renderer ──────────────────────────────────────────────────────────

export interface CardRendererProps {
  cardWidth: number;
  cardHeight: number;
  elements: DesignerElement[];
  side: DesignerSide;
  cardData?: Record<string, string>;
  scale?: number;
  showGrid?: boolean;
  gridSize?: number;
  className?: string;
  style?: React.CSSProperties;
}

export default function CardRenderer({
  cardWidth,
  cardHeight,
  elements,
  side,
  cardData = SAMPLE_CARD_DATA,
  scale = 1,
  showGrid = false,
  gridSize = 10,
  className = "",
  style,
}: CardRendererProps) {
  const visibleElements = elements
    .filter((el) => el.config.side === side)
    .sort((a, b) => a.sortOrder - b.sortOrder);

  return (
    <div
      className={className}
      style={{
        width: cardWidth * scale,
        height: cardHeight * scale,
        position: "relative",
        overflow: "hidden",
        backgroundColor: "#ffffff",
        boxShadow: "0 2px 12px rgba(0,0,0,0.12)",
        borderRadius: 8 * scale,
        transformOrigin: "top left",
        ...style,
      }}
    >
      {/* Grid overlay */}
      {showGrid && (
        <svg
          style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none", zIndex: 1 }}
        >
          <defs>
            <pattern
              id={`grid-${side}`}
              width={gridSize * scale}
              height={gridSize * scale}
              patternUnits="userSpaceOnUse"
            >
              <path
                d={`M ${gridSize * scale} 0 L 0 0 0 ${gridSize * scale}`}
                fill="none"
                stroke="rgba(0,0,0,0.06)"
                strokeWidth="0.5"
              />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill={`url(#grid-${side})`} />
          {/* Center guides */}
          <line
            x1={(cardWidth * scale) / 2}
            y1={0}
            x2={(cardWidth * scale) / 2}
            y2={cardHeight * scale}
            stroke="rgba(59,130,246,0.18)"
            strokeWidth="1"
            strokeDasharray="4 4"
          />
          <line
            x1={0}
            y1={(cardHeight * scale) / 2}
            x2={cardWidth * scale}
            y2={(cardHeight * scale) / 2}
            stroke="rgba(59,130,246,0.18)"
            strokeWidth="1"
            strokeDasharray="4 4"
          />
        </svg>
      )}

      {/* Elements layer */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          transform: `scale(${scale})`,
          transformOrigin: "top left",
          width: cardWidth,
          height: cardHeight,
          zIndex: 2,
        }}
      >
        {visibleElements.map((el) => (
          <RenderElement key={el.elementKey} element={el} cardData={cardData} />
        ))}
      </div>
    </div>
  );
}
