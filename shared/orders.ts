export const HOOK_TYPES = [
  "Lanyard hook",
  "Swivel hook",
  "J-hook",
  "Badge reel",
  "None",
] as const;

export type HookType = (typeof HOOK_TYPES)[number];

export const CARD_MATERIALS = [
  { value: "PVC_STANDARD", label: "PVC Standard" },
  { value: "PVC_PREMIUM", label: "PVC Premium" },
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
    badgeClass: "bg-blue-50 text-blue-700 border-blue-200",
  },
  {
    value: "CONFIRMED",
    label: "Confirmed",
    badgeClass: "bg-purple-50 text-purple-700 border-purple-200",
  },
  {
    value: "IN_PRODUCTION",
    label: "In Production",
    badgeClass: "bg-amber-50 text-amber-700 border-amber-200",
  },
  {
    value: "DISPATCHED",
    label: "Dispatched",
    badgeClass: "bg-indigo-50 text-indigo-700 border-indigo-200",
  },
  {
    value: "DELIVERED",
    label: "Delivered",
    badgeClass: "bg-emerald-50 text-emerald-700 border-emerald-200",
  },
  {
    value: "CANCELLED",
    label: "Cancelled",
    badgeClass: "bg-red-50 text-red-700 border-red-200",
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
    badgeClass: "bg-gray-100 text-gray-700 border-gray-200",
    badgeColor: "bg-gray-100 text-gray-700 border-gray-200",
  };
}

export const getOrderStatusMeta = getOrderStatusConfig;
