export type ApiSchoolDeletionSummary = {
  schoolName: string;
  shortCode: string;
  cards: number;
  users: number;
  requests: number;
  orders?: number;
  removedCards?: number;
};

export type ApiSchool = {
  id: number;
  name: string;
  shortCode: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  isActive: boolean;
  selectedTemplateId?: number | null;
  selectedTemplateName?: string | null;
  templateSelectionStatus?: "Selected" | "Not Selected";
  selectedTemplate?: ApiTemplate | null;
  credentials?: {
    loginId: string;
    email: string;
    password: string;
  };
};
export type ApiUser = { id: number; name: string | null; email: string | null; role: string; schoolId: number | null; isActive: boolean; openId?: string };
export type ApiTemplate = {
  id: number;
  name: string;
  meta: string | null;
  description: string | null;
  status: string;
  accent: "teal" | "coral" | "indigo" | "yellow";
  orientation?: "portrait" | "landscape";
  cardType?: "student" | "staff";
  cardWidth?: number;
  cardHeight?: number;
  elements?: ApiTemplateElement[];
};
export type ApiTemplateElement = { id?: number; elementKey: string; elementType: string; label?: string | null; config?: unknown; sortOrder?: number };
export type ApiSchoolTemplate = { id: number; schoolId: number; templateId: number; isDefault: boolean; isLocked: boolean; lockedAt: string | null; lockedByUserId: number | null };

export type ApiIdCard = {
  id: number;
  schoolId: number;
  templateId: number;
  requestId: number | null;
  cardNumber: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  printedAt?: string | null;
  removedAt?: string | null;
  removedByUserId?: number | null;
  studentName?: string;
  schoolName?: string;
  templateName?: string;
  dataMap?: Record<string, string>;
};

export type ApiIdCardFile = {
  id: number;
  idCardId: number;
  fileType: string;
  fileName: string;
  fileUrl: string;
  mimeType: string | null;
  fileSize: number | null;
  createdAt: string;
};

export type ApiApprovalHistoryItem = {
  id: number;
  idCardId: number;
  fromStatus: string | null;
  toStatus: string;
  action: string;
  comments: string | null;
  actedByUserId: number;
  createdAt: string;
  actorName?: string | null;
  actorRole?: string | null;
};

export type ApiIdCardDetail = ApiIdCard & {
  data: Array<{ id?: number; fieldKey: string; fieldValue: string | null }>;
  dataMap: Record<string, string>;
  files: ApiIdCardFile[];
  template: ApiTemplate | null;
  approvalHistory: ApiApprovalHistoryItem[];
  request?: {
    id: number;
    studentName?: string | null;
    admissionCode?: string | null;
    reviewNote?: string | null;
    status: string;
  } | null;
};

export type ApiApproval = {
  id: number;
  studentName: string;
  admissionCode: string;
  schoolId: number;
  schoolName: string;
  status: string;
  reviewNote: string | null;
  submittedAt: string | null;
  reviewedAt: string | null;
  cardId?: number | null;
  cardNumber?: string | null;
};

export type ApiActivity = {
  id: number;
  userId: number | null;
  userName?: string | null;
  userEmail?: string | null;
  userRole?: string | null;
  actorRole?: string | null;
  isMarketing?: boolean;
  schoolId: number | null;
  schoolName?: string | null;
  schoolCode?: string | null;
  action: string;
  entityType: string;
  entityId: number | null;
  newValues?: Record<string, any> | null;
  oldValues?: Record<string, any> | null;
  ipAddress?: string | null;
  createdAt: string;
};
export type ApiNotification = { id: number; type: string; title: string; message: string; isRead: boolean; createdAt: string };
export type ApiAuthUser = {
  id: number;
  openId?: string;
  name: string | null;
  email: string | null;
  phone?: string | null;
  avatarUrl?: string | null;
  role: "SUPER_ADMIN" | "SCHOOL_ADMIN" | "SCHOOL_OPERATOR" | "VIEWER" | "MARKETING_ADMIN";
  schoolId: number | null;
  schoolName?: string | null;
  isActive: boolean;
};

export type ApiOrder = {
  id: number;
  orderNumber: string;
  placedByUserId: number | null;
  placedByRole: string;
  placedByName: string;
  schoolId: number;
  schoolName?: string | null;
  orderType: "STUDENT" | "STAFF";
  hookType?: string | null;
  clip: boolean;
  className?: string | null;
  section?: string | null;
  quantity: number;
  printSides: "SINGLE" | "DOUBLE";
  cardMaterial: "PVC_STANDARD" | "PVC_PREMIUM";
  lanyardIncluded: boolean;
  lanyardColor?: string | null;
  neededByDate?: string | null;
  deliveryAddress?: string | null;
  contactPerson?: string | null;
  contactPhone?: string | null;
  notes?: string | null;
  status: "PLACED" | "CONFIRMED" | "IN_PRODUCTION" | "DISPATCHED" | "DELIVERED" | "CANCELLED";
  statusNote?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ApiRemovedCard = {
  id: number;
  idCardId: number;
  schoolId: number;
  schoolName?: string | null;
  cardNumber: string;
  studentName?: string | null;
  className?: string | null;
  section?: string | null;
  templateName?: string | null;
  previousStatus: string;
  removedByUserId: number | null;
  removedByName?: string | null;
  removedByRole?: string | null;
  removedAt: string;
  cardType?: "student" | "staff" | null;
};

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, { credentials: "include", ...init, headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) } });
  const body = await response.json().catch(() => null);
  if (!response.ok) throw new Error(body?.error ?? `Request failed (${response.status})`);
  return body as T;
}
const json = (body: unknown): RequestInit => ({ method: "POST", body: JSON.stringify(body) });
const put = (body: unknown): RequestInit => ({ method: "PUT", body: JSON.stringify(body) });
const patch = (body: unknown): RequestInit => ({ method: "PATCH", body: JSON.stringify(body) });

export const api = {
  auth: {
    login: (usernameOrEmail: string, password: string) =>
      request<{ user: ApiAuthUser }>("/api/auth/login", json({ username: usernameOrEmail, email: usernameOrEmail, password })),
    logout: () => request<{ success: true }>("/api/auth/logout", { method: "POST" }),
    me: () => request<ApiAuthUser>("/api/auth/me"),
    forgotPassword: (email: string) => request<{ success: true; developmentResetToken?: string }>("/api/auth/forgot-password", json({ email })),
    resetPassword: (token: string, password: string) => request<{ success: true }>("/api/auth/reset-password", json({ token, password })),
  },
  schools: {
    list: () => request<ApiSchool[]>("/api/schools"),
    create: (body: Partial<ApiSchool>) => request<ApiSchool>("/api/schools", json(body)),
    update: (id: number, body: Partial<ApiSchool>) => request<ApiSchool>(`/api/schools/${id}`, put(body)),
    delete: (id: number) =>
      request<{ success: true; deleted?: ApiSchoolDeletionSummary }>(`/api/schools/${id}`, { method: "DELETE" }),
    deletionSummary: (id: number) => request<ApiSchoolDeletionSummary>(`/api/schools/${id}/deletion-summary`),
    setStatus: (id: number, isActive: boolean) =>
      request<{ success: true; school?: ApiSchool }>(`/api/schools/${id}/status`, patch({ isActive })),
    generateCredentials: (id: number) =>
      request<{ success: true; credentials: { loginId: string; email: string; password: string } }>(`/api/schools/${id}/credentials`, json({})),
  },
  users: {
    list: () => request<ApiUser[]>("/api/users"),
    create: (body: Partial<ApiUser> & { openId?: string; password?: string }) => request<ApiUser>("/api/users", json(body)),
    update: (id: number, body: Partial<ApiUser>) => request<ApiUser>(`/api/users/${id}`, put(body)),
    delete: (id: number) => request<void>(`/api/users/${id}`, { method: "DELETE" }),
  },
  templates: {
    list: () => request<ApiTemplate[]>("/api/templates"),
    get: (id: number) => request<ApiTemplate>(`/api/templates/${id}`),
    create: (body: Partial<ApiTemplate>) => request<ApiTemplate>("/api/templates", json(body)),
    update: (id: number, body: Partial<ApiTemplate> & { elements?: ApiTemplateElement[] }) => request<void>(`/api/templates/${id}`, put(body)),
    delete: (id: number) => request<void>(`/api/templates/${id}`, { method: "DELETE" }),
    setStatus: (id: number, status: string) => request<void>(`/api/templates/${id}/status`, json({ status })),
  },
  schoolTemplates: {
    list: (schoolId: number) => request<ApiSchoolTemplate[]>(`/api/schools/${schoolId}/templates`),
    select: (schoolId: number, templateId: number) =>
      request<{ success: true; selectedTemplateId: number; selectedTemplateName: string }>(`/api/schools/${schoolId}/templates/select`, json({ templateId })),
    unselect: (schoolId: number) =>
      request<{ success: true }>(`/api/schools/${schoolId}/templates/unselect`, json({})),
    lock: (schoolId: number, templateId: number) => request<void>(`/api/schools/${schoolId}/templates/lock`, json({ templateId })),
    unlock: (schoolId: number, templateId: number) => request<void>(`/api/schools/${schoolId}/templates/unlock`, json({ templateId })),
  },
  idCards: {
    list: (params?: { status?: string; schoolId?: number; q?: string }) => {
      const searchParams = new URLSearchParams();
      if (params?.status) searchParams.set("status", params.status);
      if (params?.schoolId) searchParams.set("schoolId", String(params.schoolId));
      if (params?.q) searchParams.set("q", params.q);
      const queryStr = searchParams.toString();
      return request<ApiIdCard[]>(`/api/id-cards${queryStr ? `?${queryStr}` : ""}`);
    },
    get: (id: number) => request<ApiIdCardDetail>(`/api/id-cards/${id}`),
    create: (body: { schoolId?: number; templateId?: number; cardNumber?: string; status?: string; data?: Record<string, string>; photoUrl?: string }) =>
      request<ApiIdCard>("/api/id-cards", json(body)),
    update: (id: number, body: { templateId?: number; data?: Record<string, string>; photoUrl?: string }) =>
      request<{ success: true; id: number }>(`/api/id-cards/${id}`, put(body)),
    delete: (id: number) => request<void>(`/api/id-cards/${id}`, { method: "DELETE" }),
    submit: (id: number) => request<{ success: true; requestId?: number; status: string }>(`/api/id-cards/${id}/submit`, json({})),
    approve: (id: number) => request<{ success: true; status: string }>(`/api/id-cards/${id}/approve`, json({})),
    reject: (id: number, reason: string) => request<{ success: true; status: string }>(`/api/id-cards/${id}/reject`, json({ reason })),
    bulkRemoveApproved: (cardIds: number[]) =>
      request<{ success: true; removedCount: number; skippedCount: number; removedCardIds: number[] }>(
        "/api/id-cards/bulk-remove-approved",
        json({ cardIds }),
      ),
    print: (id: number, mode: "FRONT_ONLY" | "BACK_ONLY" | "DUPLEX" = "DUPLEX") =>
      request<{ success: true; status: string; printedAt: string }>(`/api/id-cards/${id}/print`, json({ mode })),
    bulkPrint: (cardIds: number[], mode: "FRONT_ONLY" | "BACK_ONLY" | "DUPLEX" = "DUPLEX") =>
      request<{ success: true; count: number }>("/api/id-cards/bulk-print", json({ cardIds, mode })),
    pdfUrl: (id: number, side?: "FRONT" | "BACK" | "BOTH") =>
      `/api/id-cards/${id}/pdf${side ? `?side=${side}` : ""}`,
    bulkPdf: async (
      cardIds: number[],
      side: "FRONT" | "BACK" | "BOTH" = "BOTH",
      mode: "FRONT_ONLY" | "BACK_ONLY" | "DUPLEX" | "SEPARATE" = "DUPLEX",
      cropMarks = true,
    ) => {
      const res = await fetch("/api/id-cards/bulk-pdf", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cardIds, side, mode, cropMarks }),
      });
      if (!res.ok) throw new Error("Bulk PDF generation failed");
      return res.blob();
    },
  },
  requests: {
    downloadExampleExcel: async (params?: { schoolId?: number; templateId?: number; cardType?: string }) => {
      const sp = new URLSearchParams();
      if (params?.schoolId) sp.set("schoolId", String(params.schoolId));
      if (params?.templateId) sp.set("templateId", String(params.templateId));
      if (params?.cardType) sp.set("cardType", params.cardType);
      const qs = sp.toString();
      const res = await fetch(`/api/id-card-requests/example-excel${qs ? `?${qs}` : ""}`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to download example Excel file");
      return res.blob();
    },
    uploadExcel: (body: { fileBase64: string; filename: string; schoolId?: number; templateId?: number }) =>
      request<{
        success: true;
        processed: number;
        failed: number;
        total: number;
        errors?: Array<{ rowNumber: number; reason: string }>;
      }>("/api/id-card-requests/upload-excel", json(body)),
    bulkUploadPhotos: (body: {
      schoolId?: number;
      zipBase64?: string;
      images?: Array<{ filename: string; dataBase64: string; contentType?: string }>;
      dryRun?: boolean;
    }) =>
      request<{
        success: true;
        total: number;
        matched: number;
        unmatched: number;
        results: Array<{
          filename: string;
          identifier: string;
          matched: boolean;
          cardId?: number;
          cardNumber?: string;
          name?: string;
          isStaff?: boolean;
          photoUrl?: string;
          reason?: string;
        }>;
      }>("/api/id-card-requests/bulk-upload-photos", json(body)),
  },
  approvals: {
    list: (params?: { status?: string }) => {
      const queryStr = params?.status && params.status !== "All" ? `?status=${params.status}` : "";
      return request<ApiApproval[]>(`/api/approvals${queryStr}`);
    },
    review: (id: number) => request<{ success: true; status: string }>(`/api/approvals/${id}/review`, json({})),
    requestChanges: (id: number, comment: string) => request<{ success: true; status: string }>(`/api/approvals/${id}/request-changes`, json({ comment })),
    resubmit: (id: number) => request<{ success: true; status: string }>(`/api/approvals/${id}/resubmit`, json({})),
    approve: (id: number) => request<{ success: true; status: string }>(`/api/approvals/${id}/approve`, json({})),
    reject: (id: number, reason: string) => request<{ success: true; status: string }>(`/api/approvals/${id}/reject`, json({ reason })),
    bulkApprove: (cardIds: number[]) => request<{ success: true; processed: number; errors?: string[] }>("/api/approvals/bulk-approve", json({ cardIds })),
    bulkReject: (cardIds: number[], reason?: string) => request<{ success: true; processed: number; errors?: string[] }>("/api/approvals/bulk-reject", json({ cardIds, reason })),
  },
  notifications: {
    list: () => request<ApiNotification[]>("/api/notifications"),
    markRead: (id: number) => request<{ success: true }>(`/api/notifications/${id}/read`, json({})),
    clear: () => request<{ success: true; message: string }>("/api/notifications", { method: "DELETE" }),
  },
  auditLogs: {
    list: (params?: { schoolId?: number; marketing?: boolean | number }) => {
      const qs = new URLSearchParams();
      if (params?.schoolId) qs.set("schoolId", String(params.schoolId));
      if (params?.marketing) qs.set("marketing", "1");
      const q = qs.toString();
      return request<ApiActivity[]>(`/api/audit-logs${q ? `?${q}` : ""}`);
    },
    clear: () => request<{ success: true; message: string }>("/api/audit-logs", { method: "DELETE" }),
  },
  orders: {
    list: (params?: {
      page?: number;
      pageSize?: number;
      status?: string;
      orderType?: string;
      schoolId?: number;
      placedByRole?: string;
      from?: string;
      to?: string;
      search?: string;
    }) => {
      const qs = new URLSearchParams();
      if (params?.page) qs.set("page", String(params.page));
      if (params?.pageSize) qs.set("pageSize", String(params.pageSize));
      if (params?.status && params.status !== "ALL") qs.set("status", params.status);
      if (params?.orderType && params.orderType !== "ALL") qs.set("orderType", params.orderType);
      if (params?.schoolId) qs.set("schoolId", String(params.schoolId));
      if (params?.placedByRole && params.placedByRole !== "ALL") qs.set("placedByRole", params.placedByRole);
      if (params?.from) qs.set("from", params.from);
      if (params?.to) qs.set("to", params.to);
      if (params?.search) qs.set("search", params.search);
      const q = qs.toString();
      return request<{ items: ApiOrder[]; total: number; page: number; pageSize: number; totalPages: number }>(
        `/api/orders${q ? `?${q}` : ""}`,
      );
    },
    create: (body: Partial<ApiOrder>) => request<ApiOrder>("/api/orders", json(body)),
    get: (id: number) => request<ApiOrder>(`/api/orders/${id}`),
    updateStatus: (id: number, payload: { status: string; statusNote?: string } | string, note?: string) => {
      const body = typeof payload === "string" ? { status: payload, statusNote: note } : payload;
      return request<ApiOrder>(`/api/orders/${id}/status`, patch(body));
    },
    cancel: (id: number, payload?: { reason?: string; statusNote?: string } | string) => {
      const note = typeof payload === "string" ? payload : (payload?.reason || payload?.statusNote);
      return request<ApiOrder>(`/api/orders/${id}/cancel`, patch({ statusNote: note }));
    },
    schools: () => request<Array<{ id: number; name: string; shortCode: string }>>("/api/orders/schools"),
    activeSchools: () => request<Array<{ id: number; name: string; shortCode: string }>>("/api/orders/schools"),
  },
  reports: {
    removedCards: (params?: {
      page?: number;
      pageSize?: number;
      schoolId?: number;
      className?: string;
      section?: string;
      search?: string;
      from?: string;
      to?: string;
      cardType?: "student" | "staff";
    }) => {
      const qs = new URLSearchParams();
      if (params?.page) qs.set("page", String(params.page));
      if (params?.pageSize) qs.set("pageSize", String(params.pageSize));
      if (params?.schoolId) qs.set("schoolId", String(params.schoolId));
      if (params?.cardType) qs.set("cardType", params.cardType);
      if (params?.className && params.className !== "ALL") qs.set("className", params.className);
      if (params?.section && params.section !== "ALL") qs.set("section", params.section);
      if (params?.search) qs.set("search", params.search);
      if (params?.from) qs.set("from", params.from);
      if (params?.to) qs.set("to", params.to);
      const q = qs.toString();
      return request<{
        items: ApiRemovedCard[];
        total: number;
        page: number;
        pageSize: number;
        totalPages: number;
        classCounts?: Record<string, number> | Array<{ className: string; count: number }>;
        sectionCounts?: Record<string, number> | Array<{ section: string; count: number }>;
        classes?: string[];
        sections?: string[];
      }>(`/api/reports/removed-cards${q ? `?${q}` : ""}`);
    },
    exportRemovedCardsCsv: (params?: {
      schoolId?: number;
      className?: string;
      section?: string;
      search?: string;
      from?: string;
      to?: string;
      cardType?: "student" | "staff";
    }) => {
      const qs = new URLSearchParams();
      if (params?.schoolId) qs.set("schoolId", String(params.schoolId));
      if (params?.cardType) qs.set("cardType", params.cardType);
      if (params?.className && params.className !== "ALL") qs.set("className", params.className);
      if (params?.section && params.section !== "ALL") qs.set("section", params.section);
      if (params?.search) qs.set("search", params.search);
      if (params?.from) qs.set("from", params.from);
      if (params?.to) qs.set("to", params.to);
      qs.set("format", "csv");
      const url = `/api/reports/removed-cards?${qs.toString()}`;
      window.open(url, "_blank");
    },
  },
  upload: (filename: string, contentType: string, dataBase64: string, opts?: { kind?: string; isCardPhoto?: boolean }) =>
    request<{ url: string }>("/api/upload", json({ filename, contentType, dataBase64, ...opts })),
  profile: {
    get: () => request<ApiAuthUser>("/api/profile"),
    update: (data: { name?: string; email?: string; phone?: string }) =>
      request<{ success: true; message: string; user: ApiAuthUser }>("/api/profile", put(data)),
    updatePicture: (avatarUrl: string) =>
      request<{ success: true; message: string; avatarUrl: string }>("/api/profile/picture", json({ avatarUrl })),
    removePicture: () =>
      request<{ success: true; message: string; avatarUrl: null }>("/api/profile/picture", { method: "DELETE" }),
    changePassword: (data: { currentPassword: string; newPassword: string; confirmNewPassword: string }) =>
      request<{ success: true; message: string }>("/api/profile/password", json(data)),
  },
  about: {
    get: () => request<{ title: string; version: string; description: string; contactEmail?: string }>("/api/about"),
  },
};
