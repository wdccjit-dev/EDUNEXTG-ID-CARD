import { useEffect, useState } from "react";
import { api, type ApiRemovedCard, type ApiAuthUser, type ApiSchool } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Search,
  Download,
  RotateCcw,
  Loader2,
  ChevronLeft,
  ChevronRight,
  History,
  Building2,
  Layers,
  GraduationCap,
  Briefcase,
} from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";

interface RemovedCardsHistorySectionProps {
  user: ApiAuthUser;
  schools: ApiSchool[];
  cardType?: "student" | "staff";
}

export default function RemovedCardsHistorySection({
  user,
  schools,
  cardType = "student",
}: RemovedCardsHistorySectionProps) {
  const isSuperAdmin = user.role === "SUPER_ADMIN";
  const isStaff = cardType === "staff";

  const [cards, setCards] = useState<ApiRemovedCard[]>([]);
  const [total, setTotal] = useState(0);
  const [classCounts, setClassCounts] = useState<Record<string, number>>({});
  const [sectionCounts, setSectionCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);

  // Filters & pagination
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(25);
  const [search, setSearch] = useState("");
  const [schoolFilter, setSchoolFilter] = useState<string>("ALL");
  const [classFilter, setClassFilter] = useState<string>("ALL");
  const [sectionFilter, setSectionFilter] = useState<string>("ALL");
  const [fromDate, setFromDate] = useState<string>("");
  const [toDate, setToDate] = useState<string>("");

  const normalizeCountMap = (
    data: Record<string, number> | Array<{ className?: string; section?: string; count: number }> | undefined,
    keyProp: "className" | "section",
  ): Record<string, number> => {
    if (!data) return {};
    if (Array.isArray(data)) {
      const map: Record<string, number> = {};
      for (const item of data) {
        const key = item[keyProp];
        if (key && String(key).trim()) {
          map[String(key).trim()] = Number(item.count || 0);
        }
      }
      return map;
    }
    if (typeof data === "object") {
      const map: Record<string, number> = {};
      for (const [k, v] of Object.entries(data)) {
        if (typeof v === "number") {
          map[k] = v;
        } else if (v && typeof v === "object" && "count" in (v as any)) {
          map[k] = Number((v as any).count || 0);
        }
      }
      return map;
    }
    return {};
  };

  const fetchHistory = () => {
    setLoading(true);
    api.reports
      .removedCards({
        page,
        pageSize,
        cardType,
        schoolId: schoolFilter === "ALL" ? undefined : Number(schoolFilter),
        className: classFilter === "ALL" ? undefined : classFilter,
        section: sectionFilter === "ALL" ? undefined : sectionFilter,
        search: search.trim() || undefined,
        from: fromDate || undefined,
        to: toDate || undefined,
      })
      .then((res) => {
        setCards(res.items);
        setTotal(res.total);
        setClassCounts(normalizeCountMap(res.classCounts, "className"));
        setSectionCounts(normalizeCountMap(res.sectionCounts, "section"));
      })
      .catch((err) => {
        toast.error(`Failed to load removed ${isStaff ? "staff" : "student"} cards history`, {
          description: err instanceof Error ? err.message : "Network error",
        });
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchHistory();
  }, [page, pageSize, schoolFilter, classFilter, sectionFilter, fromDate, toDate, cardType]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setPage(1);
      fetchHistory();
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  // Export CSV
  const handleExportCsv = () => {
    api.reports.exportRemovedCardsCsv({
      cardType,
      schoolId: schoolFilter === "ALL" ? undefined : Number(schoolFilter),
      className: classFilter === "ALL" ? undefined : classFilter,
      section: sectionFilter === "ALL" ? undefined : sectionFilter,
      search: search.trim() || undefined,
      from: fromDate || undefined,
      to: toDate || undefined,
    });
    toast.success(`Downloading removed ${isStaff ? "staff" : "student"} cards history CSV...`);
  };

  const availableClasses = Object.keys(classCounts).sort();
  const availableSections = Object.keys(sectionCounts).sort();

  return (
    <div className="space-y-5">
      {/* Group by Class / Section Summary Strip */}
      <div className={`grid grid-cols-1 gap-3 ${isStaff && availableSections.length === 0 ? "sm:grid-cols-1" : "sm:grid-cols-2"}`}>
        {/* Class / Designation Breakdown Strip */}
        <div className="rounded-2xl border border-border bg-muted/30 p-3.5 space-y-2">
          <div className="flex items-center justify-between text-xs font-bold text-foreground">
            <span className="flex items-center gap-1.5 uppercase tracking-wider text-[11px] text-primary">
              {isStaff ? <Briefcase className="h-4 w-4" /> : <GraduationCap className="h-4 w-4" />}
              {isStaff ? "Designation / Dept Breakdown" : "Classwise Breakdown"}
            </span>
            <span className="text-[11px] text-muted-foreground font-normal">
              {availableClasses.length} distinct {isStaff ? "designations" : "classes"}
            </span>
          </div>
          <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto pt-1">
            {availableClasses.length === 0 ? (
              <span className="text-xs text-muted-foreground">
                No {isStaff ? "designation" : "class"} records available
              </span>
            ) : (
              availableClasses.map((cls) => (
                <button
                  key={cls}
                  onClick={() => {
                    setClassFilter((prev) => (prev === cls ? "ALL" : cls));
                    setPage(1);
                  }}
                  className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold transition-all ${
                    classFilter === cls
                      ? "bg-primary text-primary-foreground shadow-2xs"
                      : "bg-card border border-border text-foreground hover:bg-accent"
                  }`}
                >
                  <span>{isStaff ? cls : `Class ${cls}`}</span>
                  <Badge
                    variant="secondary"
                    className={`h-4 px-1 text-[10px] ${
                      classFilter === cls ? "bg-primary-foreground/20 text-primary-foreground" : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {classCounts[cls]}
                  </Badge>
                </button>
              ))
            )}
          </div>
        </div>

        {/* Section Breakdown Strip (shown for students or if sections exist) */}
        {(!isStaff || availableSections.length > 0) && (
          <div className="rounded-2xl border border-border bg-muted/30 p-3.5 space-y-2">
            <div className="flex items-center justify-between text-xs font-bold text-foreground">
              <span className="flex items-center gap-1.5 uppercase tracking-wider text-[11px] text-primary">
                <Layers className="h-4 w-4" /> Sectionwise Breakdown
              </span>
              <span className="text-[11px] text-muted-foreground font-normal">
                {availableSections.length} distinct sections
              </span>
            </div>
            <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto pt-1">
              {availableSections.length === 0 ? (
                <span className="text-xs text-muted-foreground">No section records available</span>
              ) : (
                availableSections.map((sec) => (
                  <button
                    key={sec}
                    onClick={() => {
                      setSectionFilter((prev) => (prev === sec ? "ALL" : sec));
                      setPage(1);
                    }}
                    className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold transition-all ${
                      sectionFilter === sec
                        ? "bg-primary text-primary-foreground shadow-2xs"
                        : "bg-card border border-border text-foreground hover:bg-accent"
                    }`}
                  >
                    <span>Sec {sec}</span>
                    <Badge
                      variant="secondary"
                      className={`h-4 px-1 text-[10px] ${
                        sectionFilter === sec ? "bg-primary-foreground/20 text-primary-foreground" : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {sectionCounts[sec]}
                    </Badge>
                  </button>
                ))
              )}
            </div>
          </div>
        )}
      </div>

      {/* Filter & Export Bar */}
      <Card className="rounded-2xl border border-border bg-card text-card-foreground shadow-2xs p-4 space-y-3">
        <div className={`grid grid-cols-1 gap-3 sm:grid-cols-2 ${isStaff && availableSections.length === 0 ? "lg:grid-cols-4" : "lg:grid-cols-5"}`}>
          {/* Search */}
          <div className="relative lg:col-span-2">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              className="pl-9 text-xs rounded-xl h-9"
              placeholder={isStaff ? "Search card #, staff name, designation..." : "Search card #, student name, class..."}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          {/* School filter (Super Admin) */}
          {isSuperAdmin && (
            <div>
              <Select value={schoolFilter} onValueChange={(val) => { setSchoolFilter(val); setPage(1); }}>
                <SelectTrigger className="text-xs rounded-xl h-9">
                  <SelectValue placeholder="All Schools" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All Schools</SelectItem>
                  {schools.map((s) => (
                    <SelectItem key={s.id} value={String(s.id)}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Class / Designation Filter */}
          <div>
            <Select value={classFilter} onValueChange={(val) => { setClassFilter(val); setPage(1); }}>
              <SelectTrigger className="text-xs rounded-xl h-9">
                <SelectValue placeholder={isStaff ? "All Designations" : "All Classes"} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">{isStaff ? "All Designations" : "All Classes"}</SelectItem>
                {availableClasses.map((cls) => (
                  <SelectItem key={cls} value={cls}>
                    {isStaff ? cls : `Class ${cls}`} ({classCounts[cls]})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Section Filter (only if student or sections exist) */}
          {(!isStaff || availableSections.length > 0) && (
            <div>
              <Select value={sectionFilter} onValueChange={(val) => { setSectionFilter(val); setPage(1); }}>
                <SelectTrigger className="text-xs rounded-xl h-9">
                  <SelectValue placeholder="All Sections" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All Sections</SelectItem>
                  {availableSections.map((sec) => (
                    <SelectItem key={sec} value={sec}>
                      Section {sec} ({sectionCounts[sec]})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        {/* Date range & CSV Export */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-border text-xs">
          <div className="flex flex-wrap items-center gap-3">
            <span className="font-semibold text-foreground">Removed Date:</span>
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] text-muted-foreground">From</span>
              <Input
                type="date"
                className="text-xs rounded-xl h-8 w-36"
                value={fromDate}
                onChange={(e) => { setFromDate(e.target.value); setPage(1); }}
              />
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] text-muted-foreground">To</span>
              <Input
                type="date"
                className="text-xs rounded-xl h-8 w-36"
                value={toDate}
                onChange={(e) => { setToDate(e.target.value); setPage(1); }}
              />
            </div>
            {(search || schoolFilter !== "ALL" || classFilter !== "ALL" || sectionFilter !== "ALL" || fromDate || toDate) && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSearch("");
                  setSchoolFilter("ALL");
                  setClassFilter("ALL");
                  setSectionFilter("ALL");
                  setFromDate("");
                  setToDate("");
                  setPage(1);
                }}
                className="h-8 text-xs font-semibold text-muted-foreground hover:text-foreground"
              >
                <RotateCcw className="h-3 w-3 mr-1" /> Reset
              </Button>
            )}
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={handleExportCsv}
            disabled={total === 0}
            className="h-8 text-xs font-bold gap-1.5 rounded-xl border-primary text-primary hover:bg-primary/10"
          >
            <Download className="h-3.5 w-3.5" /> Export {isStaff ? "Staff " : "Student "}CSV ({total})
          </Button>
        </div>
      </Card>

      {/* Removed Cards Table */}
      <Card className="rounded-2xl border border-border bg-card text-card-foreground shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-border bg-muted/40 text-[11px] font-extrabold uppercase tracking-wider text-muted-foreground">
                <th className="py-3 px-4 w-12">#</th>
                <th className="py-3 px-4">Card No</th>
                <th className="py-3 px-4">{isStaff ? "Staff Name" : "Student Name"}</th>
                <th className="py-3 px-4">{isStaff ? "Designation / Dept" : "Class"}</th>
                {!isStaff && <th className="py-3 px-4">Section</th>}
                {isSuperAdmin && <th className="py-3 px-4">School</th>}
                <th className="py-3 px-4">Template</th>
                <th className="py-3 px-4">Previous Status</th>
                <th className="py-3 px-4">Removed By</th>
                <th className="py-3 px-4">Removed On</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border text-xs">
              {loading ? (
                <tr>
                  <td colSpan={isSuperAdmin ? (isStaff ? 9 : 10) : (isStaff ? 8 : 9)} className="py-16 text-center text-muted-foreground">
                    <Loader2 className="h-5 w-5 animate-spin mx-auto mb-2 text-primary" />
                    Loading history...
                  </td>
                </tr>
              ) : cards.length === 0 ? (
                <tr>
                  <td colSpan={isSuperAdmin ? (isStaff ? 9 : 10) : (isStaff ? 8 : 9)} className="py-16 text-center text-muted-foreground">
                    No removed {isStaff ? "staff" : "student"} ID cards match your filter criteria.
                  </td>
                </tr>
              ) : (
                cards.map((c, index) => (
                  <tr key={c.id} className="hover:bg-muted/30 transition-colors">
                    <td className="py-3 px-4 text-muted-foreground font-mono text-[11px]">
                      {(page - 1) * pageSize + index + 1}
                    </td>
                    <td className="py-3 px-4 font-mono font-bold text-primary">
                      {c.cardNumber}
                    </td>
                    <td className="py-3 px-4 font-bold text-foreground">
                      {c.studentName || "-"}
                    </td>
                    <td className="py-3 px-4 font-semibold text-foreground">
                      {c.className || "-"}
                    </td>
                    {!isStaff && (
                      <td className="py-3 px-4 font-semibold text-foreground">
                        {c.section || "-"}
                      </td>
                    )}
                    {isSuperAdmin && (
                      <td className="py-3 px-4 text-muted-foreground font-medium">
                        School #{c.schoolId}
                      </td>
                    )}
                    <td className="py-3 px-4 text-muted-foreground">
                      {c.templateName || "-"}
                    </td>
                    <td className="py-3 px-4">
                      <Badge variant="outline" className="text-[10px] font-bold">
                        {c.previousStatus}
                      </Badge>
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      <div className="flex flex-col">
                        <span className="font-semibold text-foreground">{c.removedByName || "User"}</span>
                        <span className="text-[10px] text-muted-foreground">{c.removedByRole || "ADMIN"}</span>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-muted-foreground whitespace-nowrap">
                      {format(new Date(c.removedAt), "dd MMM yyyy, HH:mm")}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination bar */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-4 border-t border-border bg-muted/30">
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span>
              Showing <b>{cards.length}</b> of <b>{total}</b> cards
            </span>
            <div className="flex items-center gap-1.5 ml-2">
              <span>Per page:</span>
              <Select
                value={String(pageSize)}
                onValueChange={(val) => {
                  setPageSize(Number(val));
                  setPage(1);
                }}
              >
                <SelectTrigger className="h-7 w-20 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[10, 25, 50, 100].map((sz) => (
                    <SelectItem key={sz} value={String(sz)}>
                      {sz}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground mr-2">
              Page {page} of {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1 || loading}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="h-8 rounded-lg text-xs font-bold"
            >
              <ChevronLeft className="h-3.5 w-3.5 mr-0.5" /> Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages || loading}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              className="h-8 rounded-lg text-xs font-bold"
            >
              Next <ChevronRight className="h-3.5 w-3.5 ml-0.5" />
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
