export const HOOK_TYPES = [
  "Lanyard hook",
  "Swivel hook",
  "J-hook",
  "Badge reel",
  "None",
] as const;

export type HookType = (typeof HOOK_TYPES)[number];

export const HOLDER_TYPES = [
  "5pp (Plastic)",
  "5pc (Plastic Transparent)",
  "White (Plastic)",
  "Metal Silver",
  "Metal Gold",
  "Transparent (Both side cover)",
] as const;

export type HolderType = (typeof HOLDER_TYPES)[number];

export const LANYARD_SIZES = [
  "16mm",
  "18mm",
  "20mm",
] as const;

export type LanyardSize = (typeof LANYARD_SIZES)[number];


export const CARD_MATERIALS = [
  { value: "PVC_STANDARD", label: "PVC Inkjet" },
  { value: "PVC_PREMIUM", label: "PVC Core" },
] as const;

export type CardMaterial = (typeof CARD_MATERIALS)[number]["value"];

export const ORDER_TYPES = [
  { value: "STUDENT", label: "Student" },
  { value: "STAFF", label: "Staff" },
] as const;

export type OrderType = (typeof ORDER_TYPES)[number]["value"];

export const PRINT_SIDES = [
  { value: "SINGLE", label: "Single Sided" },
  { value: "DOUBLE", label: "Double Sided" },
] as const;

export type PrintSides = (typeof PRINT_SIDES)[number]["value"];

export const ORDER_STATUSES = [
  {
    value: "PLACED",
    label: "Placed",
    badgeClass: "status-badge-placed font-bold",
  },
  {
    value: "CONFIRMED",
    label: "Confirmed",
    badgeClass: "status-badge-confirmed font-bold",
  },
  {
    value: "IN_PRODUCTION",
    label: "In Production",
    badgeClass: "status-badge-in_production font-bold",
  },
  {
    value: "DISPATCHED",
    label: "Dispatched",
    badgeClass: "status-badge-dispatched font-bold",
  },
  {
    value: "DELIVERED",
    label: "Delivered",
    badgeClass: "status-badge-delivered font-bold",
  },
  {
    value: "CANCELLED",
    label: "Cancelled",
    badgeClass: "status-badge-cancelled font-bold",
  },
] as const;

export type OrderStatus = (typeof ORDER_STATUSES)[number]["value"];

export function getOrderStatusConfig(status: string) {
  const found = ORDER_STATUSES.find((s) => s.value === status);
  if (found) {
    return {
      ...found,
      badgeColor: found.badgeClass,
    };
  }
  return {
    value: status,
    label: status,
    badgeClass: "bg-gray-100 text-gray-700 border-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700",
    badgeColor: "bg-gray-100 text-gray-700 border-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700",
  };
}

export const getOrderStatusMeta = getOrderStatusConfig;
