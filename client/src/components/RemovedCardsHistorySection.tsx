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
} from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";

interface RemovedCardsHistorySectionProps {
  user: ApiAuthUser;
  schools: ApiSchool[];
}

export default function RemovedCardsHistorySection({
  user,
  schools,
}: RemovedCardsHistorySectionProps) {
  const isSuperAdmin = user.role === "SUPER_ADMIN";

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

  const fetchHistory = () => {
    setLoading(true);
    api.reports
      .removedCards({
        page,
        pageSize,
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
        if (res.classCounts) setClassCounts(res.classCounts);
        if (res.sectionCounts) setSectionCounts(res.sectionCounts);
      })
      .catch((err) => {
        toast.error("Failed to load removed cards history", {
          description: err instanceof Error ? err.message : "Network error",
        });
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchHistory();
  }, [page, pageSize, schoolFilter, classFilter, sectionFilter, fromDate, toDate]);

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
      schoolId: schoolFilter === "ALL" ? undefined : Number(schoolFilter),
      className: classFilter === "ALL" ? undefined : classFilter,
      section: sectionFilter === "ALL" ? undefined : sectionFilter,
      search: search.trim() || undefined,
      from: fromDate || undefined,
      to: toDate || undefined,
    });
    toast.success("Downloading removed cards history CSV...");
  };

  const availableClasses = Object.keys(classCounts).sort();
  const availableSections = Object.keys(sectionCounts).sort();

  return (
    <div className="space-y-5">
      {/* Group by Class / Section Summary Strip */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {/* Class Breakdown Strip */}
        <div className="rounded-2xl border border-[#dfe7e2] bg-[#f7faf8] p-3.5 space-y-2">
          <div className="flex items-center justify-between text-xs font-bold text-[#1f3634]">
            <span className="flex items-center gap-1.5 uppercase tracking-wider text-[11px] text-[#0f7f79]">
              <GraduationCap className="h-4 w-4" /> Classwise Breakdown
            </span>
            <span className="text-[11px] text-gray-500 font-normal">
              {availableClasses.length} distinct classes
            </span>
          </div>
          <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto pt-1">
            {availableClasses.length === 0 ? (
              <span className="text-xs text-gray-400">No class records available</span>
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
                      ? "bg-[#0f7f79] text-white shadow-2xs"
                      : "bg-white border border-gray-200 text-gray-700 hover:bg-gray-100"
                  }`}
                >
                  <span>Class {cls}</span>
                  <Badge
                    variant="secondary"
                    className={`h-4 px-1 text-[10px] ${
                      classFilter === cls ? "bg-white/20 text-white" : "bg-gray-100 text-gray-700"
                    }`}
                  >
                    {classCounts[cls]}
                  </Badge>
                </button>
              ))
            )}
          </div>
        </div>

        {/* Section Breakdown Strip */}
        <div className="rounded-2xl border border-[#dfe7e2] bg-[#f7faf8] p-3.5 space-y-2">
          <div className="flex items-center justify-between text-xs font-bold text-[#1f3634]">
            <span className="flex items-center gap-1.5 uppercase tracking-wider text-[11px] text-[#0f7f79]">
              <Layers className="h-4 w-4" /> Sectionwise Breakdown
            </span>
            <span className="text-[11px] text-gray-500 font-normal">
              {availableSections.length} distinct sections
            </span>
          </div>
          <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto pt-1">
            {availableSections.length === 0 ? (
              <span className="text-xs text-gray-400">No section records available</span>
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
                      ? "bg-[#0f7f79] text-white shadow-2xs"
                      : "bg-white border border-gray-200 text-gray-700 hover:bg-gray-100"
                  }`}
                >
                  <span>Sec {sec}</span>
                  <Badge
                    variant="secondary"
                    className={`h-4 px-1 text-[10px] ${
                      sectionFilter === sec ? "bg-white/20 text-white" : "bg-gray-100 text-gray-700"
                    }`}
                  >
                    {sectionCounts[sec]}
                  </Badge>
                </button>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Filter & Export Bar */}
      <Card className="rounded-2xl border-[#e2e8e3] bg-white shadow-2xs p-4 space-y-3">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {/* Search */}
          <div className="relative lg:col-span-2">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              className="pl-9 text-xs rounded-xl h-9"
              placeholder="Search card #, student name, template..."
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

          {/* Class Filter */}
          <div>
            <Select value={classFilter} onValueChange={(val) => { setClassFilter(val); setPage(1); }}>
              <SelectTrigger className="text-xs rounded-xl h-9">
                <SelectValue placeholder="All Classes" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Classes</SelectItem>
                {availableClasses.map((cls) => (
                  <SelectItem key={cls} value={cls}>
                    Class {cls} ({classCounts[cls]})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Section Filter */}
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
        </div>

        {/* Date range & CSV Export */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-gray-100 text-xs">
          <div className="flex flex-wrap items-center gap-3">
            <span className="font-semibold text-gray-700">Removed Date:</span>
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] text-gray-500">From</span>
              <Input
                type="date"
                className="text-xs rounded-xl h-8 w-36"
                value={fromDate}
                onChange={(e) => { setFromDate(e.target.value); setPage(1); }}
              />
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] text-gray-500">To</span>
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
                className="h-8 text-xs font-semibold text-gray-500 hover:text-gray-900"
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
            className="h-8 text-xs font-bold gap-1.5 rounded-xl border-[#0f7f79] text-[#0f7f79] hover:bg-[#eef7f4]"
          >
            <Download className="h-3.5 w-3.5" /> Export CSV ({total})
          </Button>
        </div>
      </Card>

      {/* Removed Cards Table */}
      <Card className="rounded-2xl border-[#e2e8e3] bg-white shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-[#edf0ed] bg-[#fbfdfb] text-[11px] font-extrabold uppercase tracking-wider text-[#637370]">
                <th className="py-3 px-4 w-12">#</th>
                <th className="py-3 px-4">Card No</th>
                <th className="py-3 px-4">Student Name</th>
                <th className="py-3 px-4">Class</th>
                <th className="py-3 px-4">Section</th>
                {isSuperAdmin && <th className="py-3 px-4">School</th>}
                <th className="py-3 px-4">Template</th>
                <th className="py-3 px-4">Previous Status</th>
                <th className="py-3 px-4">Removed By</th>
                <th className="py-3 px-4">Removed On</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#edf0ed] text-xs">
              {loading ? (
                <tr>
                  <td colSpan={isSuperAdmin ? 10 : 9} className="py-16 text-center text-gray-400">
                    <Loader2 className="h-5 w-5 animate-spin mx-auto mb-2 text-[#0f7f79]" />
                    Loading history...
                  </td>
                </tr>
              ) : cards.length === 0 ? (
                <tr>
                  <td colSpan={isSuperAdmin ? 10 : 9} className="py-16 text-center text-gray-400">
                    No removed cards match your filter criteria.
                  </td>
                </tr>
              ) : (
                cards.map((c, index) => (
                  <tr key={c.id} className="hover:bg-[#fbfdfb] transition-colors">
                    <td className="py-3 px-4 text-gray-400 font-mono text-[11px]">
                      {(page - 1) * pageSize + index + 1}
                    </td>
                    <td className="py-3 px-4 font-mono font-bold text-[#0f7f79]">
                      {c.cardNumber}
                    </td>
                    <td className="py-3 px-4 font-bold text-[#18312e]">
                      {c.studentName || "-"}
                    </td>
                    <td className="py-3 px-4 font-semibold text-gray-800">
                      {c.className || "-"}
                    </td>
                    <td className="py-3 px-4 font-semibold text-gray-800">
                      {c.section || "-"}
                    </td>
                    {isSuperAdmin && (
                      <td className="py-3 px-4 text-gray-700 font-medium">
                        School #{c.schoolId}
                      </td>
                    )}
                    <td className="py-3 px-4 text-gray-600">
                      {c.templateName || "-"}
                    </td>
                    <td className="py-3 px-4">
                      <Badge variant="outline" className="text-[10px] font-bold">
                        {c.previousStatus}
                      </Badge>
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      <div className="flex flex-col">
                        <span className="font-semibold text-gray-800">{c.removedByName || "User"}</span>
                        <span className="text-[10px] text-gray-400">{c.removedByRole || "ADMIN"}</span>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-gray-500 whitespace-nowrap">
                      {format(new Date(c.removedAt), "dd MMM yyyy, HH:mm")}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination bar */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-4 border-t border-[#edf0ed] bg-[#fbfdfb]">
          <div className="flex items-center gap-3 text-xs text-[#788784]">
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
            <span className="text-xs text-[#788784] mr-2">
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
