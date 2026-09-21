import {
  boolean,
  index,
  int,
  json,
  longtext,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/mysql-core";
import { relations } from "drizzle-orm";

export const userRoleValues = ["SUPER_ADMIN", "SCHOOL_ADMIN", "SCHOOL_OPERATOR", "VIEWER"] as const;
export const idCardStatusValues = [
  "DRAFT",
  "SUBMITTED",
  "UNDER_REVIEW",
  "CHANGES_REQUIRED",
  "RESUBMITTED",
  "APPROVED",
  "REJECTED",
  "PRINTED",
] as const;
export const templateStatusValues = ["DRAFT", "ACTIVE", "INACTIVE", "ARCHIVED"] as const;

export const users = mysqlTable(
  "users",
  {
    id: int("id").autoincrement().primaryKey(),
    openId: varchar("openId", { length: 64 }).notNull().unique(),
    name: text("name"),
    email: varchar("email", { length: 320 }),
    passwordHash: varchar("passwordHash", { length: 255 }),
    loginMethod: varchar("loginMethod", { length: 64 }),
    role: mysqlEnum("role", userRoleValues).default("VIEWER").notNull(),
    schoolId: int("schoolId").references(() => schools.id, { onDelete: "set null", onUpdate: "cascade" }),
    phone: varchar("phone", { length: 32 }),
    avatarUrl: longtext("avatarUrl"),
    isActive: boolean("isActive").default(true).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
    lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
  },
  (table) => [index("users_schoolId_idx").on(table.schoolId), index("users_role_idx").on(table.role)],
);

export const schools = mysqlTable("schools", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 191 }).notNull(),
  shortCode: varchar("shortCode", { length: 16 }).notNull().unique(),
  email: varchar("email", { length: 320 }),
  phone: varchar("phone", { length: 32 }),
  address: text("address"),
  isActive: boolean("isActive").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const templateOrientationValues = ["portrait", "landscape"] as const;

export const idCardTemplates = mysqlTable(
  "idCardTemplates",
  {
    id: int("id").autoincrement().primaryKey(),
    name: varchar("name", { length: 191 }).notNull(),
    meta: varchar("meta", { length: 191 }),
    orientation: mysqlEnum("orientation", templateOrientationValues).default("landscape").notNull(),
    cardWidth: int("cardWidth").default(324).notNull(),
    cardHeight: int("cardHeight").default(204).notNull(),
    accent: mysqlEnum("accent", ["teal", "coral", "indigo", "yellow"]).default("teal").notNull(),
    status: mysqlEnum("status", templateStatusValues).default("DRAFT").notNull(),
    description: text("description"),
    createdByUserId: int("createdByUserId").references(() => users.id, { onDelete: "set null", onUpdate: "cascade" }),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  (table) => [index("idCardTemplates_status_idx").on(table.status), index("idCardTemplates_createdByUserId_idx").on(table.createdByUserId)],
);

export const idCardRequests = mysqlTable(
  "idCardRequests",
  {
    id: int("id").autoincrement().primaryKey(),
    studentName: varchar("studentName", { length: 191 }).notNull(),
    admissionCode: varchar("admissionCode", { length: 64 }).notNull(),
    schoolId: int("schoolId").notNull().references(() => schools.id, { onDelete: "restrict", onUpdate: "cascade" }),
    status: mysqlEnum("status", idCardStatusValues).default("DRAFT").notNull(),
    reviewNote: text("reviewNote"),
    requestedByUserId: int("requestedByUserId").references(() => users.id, { onDelete: "set null", onUpdate: "cascade" }),
    reviewedByUserId: int("reviewedByUserId").references(() => users.id, { onDelete: "set null", onUpdate: "cascade" }),
    templateId: int("templateId").references(() => idCardTemplates.id, { onDelete: "set null", onUpdate: "cascade" }),
    submittedAt: timestamp("submittedAt"),
    reviewedAt: timestamp("reviewedAt"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  (table) => [
    index("idCardRequests_schoolId_idx").on(table.schoolId),
    index("idCardRequests_status_idx").on(table.status),
    uniqueIndex("idCardRequests_school_admission_unique").on(table.schoolId, table.admissionCode),
  ],
);

export const schoolPermissions = mysqlTable(
  "school_permissions",
  {
    id: int("id").autoincrement().primaryKey(),
    schoolId: int("school_id").notNull().references(() => schools.id, { onDelete: "cascade", onUpdate: "cascade" }),
    userId: int("user_id").notNull().references(() => users.id, { onDelete: "cascade", onUpdate: "cascade" }),
    permission: varchar("permission", { length: 64 }).notNull(),
    grantedByUserId: int("granted_by_user_id").references(() => users.id, { onDelete: "set null", onUpdate: "cascade" }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
  },
  (table) => [
    uniqueIndex("school_permissions_school_user_permission_unique").on(table.schoolId, table.userId, table.permission),
    index("school_permissions_user_idx").on(table.userId),
  ],
);

export const templateElements = mysqlTable(
  "template_elements",
  {
    id: int("id").autoincrement().primaryKey(),
    templateId: int("template_id").notNull().references(() => idCardTemplates.id, { onDelete: "cascade", onUpdate: "cascade" }),
    elementKey: varchar("element_key", { length: 64 }).notNull(),
    elementType: varchar("element_type", { length: 32 }).notNull(),
    label: varchar("label", { length: 191 }),
    config: json("config"),
    sortOrder: int("sort_order").default(0).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
  },
  (table) => [uniqueIndex("template_elements_template_key_unique").on(table.templateId, table.elementKey), index("template_elements_template_idx").on(table.templateId)],
);

export const schoolTemplates = mysqlTable(
  "school_templates",
  {
    id: int("id").autoincrement().primaryKey(),
    schoolId: int("school_id").notNull().references(() => schools.id, { onDelete: "cascade", onUpdate: "cascade" }),
    templateId: int("template_id").notNull().references(() => idCardTemplates.id, { onDelete: "cascade", onUpdate: "cascade" }),
    assignedByUserId: int("assigned_by_user_id").references(() => users.id, { onDelete: "set null", onUpdate: "cascade" }),
    isDefault: boolean("is_default").default(false).notNull(),
    isLocked: boolean("is_locked").default(false).notNull(),
    lockedAt: timestamp("locked_at"),
    lockedByUserId: int("locked_by_user_id").references(() => users.id, { onDelete: "set null", onUpdate: "cascade" }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
  },
  (table) => [uniqueIndex("school_templates_school_template_unique").on(table.schoolId, table.templateId), index("school_templates_school_idx").on(table.schoolId), index("school_templates_locked_idx").on(table.schoolId, table.isLocked)],
);

export const idCards = mysqlTable(
  "id_cards",
  {
    id: int("id").autoincrement().primaryKey(),
    schoolId: int("school_id").notNull().references(() => schools.id, { onDelete: "cascade", onUpdate: "cascade" }),
    templateId: int("template_id").notNull().references(() => idCardTemplates.id, { onDelete: "cascade", onUpdate: "cascade" }),
    requestId: int("request_id").references(() => idCardRequests.id, { onDelete: "set null", onUpdate: "cascade" }),
    cardNumber: varchar("card_number", { length: 64 }).notNull(),
    status: mysqlEnum("status", idCardStatusValues).default("DRAFT").notNull(),
    submittedByUserId: int("submitted_by_user_id").references(() => users.id, { onDelete: "set null", onUpdate: "cascade" }),
    approvedByUserId: int("approved_by_user_id").references(() => users.id, { onDelete: "set null", onUpdate: "cascade" }),
    printedAt: timestamp("printed_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
  },
  (table) => [uniqueIndex("id_cards_school_card_number_unique").on(table.schoolId, table.cardNumber), index("id_cards_school_status_idx").on(table.schoolId, table.status), index("id_cards_request_idx").on(table.requestId)],
);

export const idCardData = mysqlTable(
  "id_card_data",
  {
    id: int("id").autoincrement().primaryKey(),
    idCardId: int("id_card_id").notNull().references(() => idCards.id, { onDelete: "cascade", onUpdate: "cascade" }),
    fieldKey: varchar("field_key", { length: 64 }).notNull(),
    fieldValue: longtext("field_value"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
  },
  (table) => [uniqueIndex("id_card_data_card_field_unique").on(table.idCardId, table.fieldKey), index("id_card_data_card_idx").on(table.idCardId)],
);

export const idCardFiles = mysqlTable(
  "id_card_files",
  {
    id: int("id").autoincrement().primaryKey(),
    idCardId: int("id_card_id").notNull().references(() => idCards.id, { onDelete: "cascade", onUpdate: "cascade" }),
    fileType: varchar("file_type", { length: 32 }).notNull(),
    fileName: varchar("file_name", { length: 255 }).notNull(),
    fileUrl: longtext("file_url").notNull(),
    mimeType: varchar("mime_type", { length: 128 }),
    fileSize: int("file_size"),
    uploadedByUserId: int("uploaded_by_user_id").references(() => users.id, { onDelete: "set null", onUpdate: "cascade" }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
  },
  (table) => [index("id_card_files_card_idx").on(table.idCardId), index("id_card_files_type_idx").on(table.fileType)],
);

export const approvalHistory = mysqlTable(
  "approval_history",
  {
    id: int("id").autoincrement().primaryKey(),
    idCardId: int("id_card_id").notNull().references(() => idCards.id, { onDelete: "cascade", onUpdate: "cascade" }),
    fromStatus: mysqlEnum("from_status", idCardStatusValues),
    toStatus: mysqlEnum("to_status", idCardStatusValues).notNull(),
    action: varchar("action", { length: 64 }).notNull(),
    comments: text("comments"),
    actedByUserId: int("acted_by_user_id").notNull().references(() => users.id, { onDelete: "restrict", onUpdate: "cascade" }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [index("approval_history_card_idx").on(table.idCardId), index("approval_history_actor_idx").on(table.actedByUserId)],
);

export const notifications = mysqlTable(
  "notifications",
  {
    id: int("id").autoincrement().primaryKey(),
    userId: int("user_id").notNull().references(() => users.id, { onDelete: "cascade", onUpdate: "cascade" }),
    schoolId: int("school_id").references(() => schools.id, { onDelete: "set null", onUpdate: "cascade" }),
    type: varchar("type", { length: 64 }).notNull(),
    title: varchar("title", { length: 191 }).notNull(),
    message: text("message").notNull(),
    entityType: varchar("entity_type", { length: 64 }),
    entityId: int("entity_id"),
    isRead: boolean("is_read").default(false).notNull(),
    readAt: timestamp("read_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
  },
  (table) => [index("notifications_user_read_idx").on(table.userId, table.isRead), index("notifications_school_idx").on(table.schoolId)],
);

export const auditLogs = mysqlTable(
  "audit_logs",
  {
    id: int("id").autoincrement().primaryKey(),
    userId: int("user_id").references(() => users.id, { onDelete: "set null", onUpdate: "cascade" }),
    schoolId: int("school_id").references(() => schools.id, { onDelete: "set null", onUpdate: "cascade" }),
    action: varchar("action", { length: 128 }).notNull(),
    entityType: varchar("entity_type", { length: 64 }).notNull(),
    entityId: int("entity_id"),
    oldValues: json("old_values"),
    newValues: json("new_values"),
    ipAddress: varchar("ip_address", { length: 45 }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [index("audit_logs_school_created_idx").on(table.schoolId, table.createdAt), index("audit_logs_entity_idx").on(table.entityType, table.entityId), index("audit_logs_user_idx").on(table.userId)],
);

export const passwordResets = mysqlTable(
  "password_resets",
  {
    id: int("id").autoincrement().primaryKey(),
    userId: int("user_id").notNull().references(() => users.id, { onDelete: "cascade", onUpdate: "cascade" }),
    tokenHash: varchar("token_hash", { length: 255 }).notNull().unique(),
    expiresAt: timestamp("expires_at").notNull(),
    usedAt: timestamp("used_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
  },
  (table) => [index("password_resets_user_idx").on(table.userId), index("password_resets_expires_idx").on(table.expiresAt)],
);

export const usersRelations = relations(users, ({ one, many }) => ({ school: one(schools, { fields: [users.schoolId], references: [schools.id] }), permissions: many(schoolPermissions) }));
export const schoolsRelations = relations(schools, ({ many }) => ({ users: many(users), permissions: many(schoolPermissions), templates: many(schoolTemplates), cards: many(idCards), requests: many(idCardRequests) }));
export const idCardTemplatesRelations = relations(idCardTemplates, ({ many }) => ({ elements: many(templateElements), schools: many(schoolTemplates), cards: many(idCards) }));
export const idCardsRelations = relations(idCards, ({ one, many }) => ({ school: one(schools, { fields: [idCards.schoolId], references: [schools.id] }), template: one(idCardTemplates, { fields: [idCards.templateId], references: [idCardTemplates.id] }), data: many(idCardData), files: many(idCardFiles), approvals: many(approvalHistory) }));

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
export type School = typeof schools.$inferSelect;
export type InsertSchool = typeof schools.$inferInsert;
export type IdCardTemplate = typeof idCardTemplates.$inferSelect;
export type InsertIdCardTemplate = typeof idCardTemplates.$inferInsert;
export type IdCardRequest = typeof idCardRequests.$inferSelect;
export type InsertIdCardRequest = typeof idCardRequests.$inferInsert;
export type IdCard = typeof idCards.$inferSelect;
export type InsertIdCard = typeof idCards.$inferInsert;
