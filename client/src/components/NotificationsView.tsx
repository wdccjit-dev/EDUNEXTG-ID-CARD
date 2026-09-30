import { useEffect, useState } from "react";
import { api, type ApiNotification } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Bell, Check, Trash2, Clock, Loader2, Info } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";

export default function NotificationsView() {
  const [notifications, setNotifications] = useState<ApiNotification[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchNotifications = () => {
    setLoading(true);
    api.notifications
      .list()
      .then((res) => setNotifications(res))
      .catch((err) => {
        console.error("Failed to load notifications:", err);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchNotifications();
  }, []);

  const handleMarkRead = async (id: number) => {
    try {
      await api.notifications.markRead(id);
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, isRead: true } : n)),
      );
    } catch (err) {
      toast.error("Failed to mark as read");
    }
  };

  const handleClearAll = async () => {
    try {
      await api.notifications.clear();
      setNotifications([]);
      toast.success("Notifications cleared");
    } catch (err) {
      toast.error("Failed to clear notifications");
    }
  };

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-[#152e2c] flex items-center gap-2.5">
            <Bell className="h-6 w-6 text-[#0f7f79]" /> Notifications
            {unreadCount > 0 && (
              <Badge className="bg-red-500 text-white text-xs px-2 py-0.5 rounded-full font-bold">
                {unreadCount} unread
              </Badge>
            )}
          </h1>
          <p className="text-xs text-[#788784] mt-0.5">
            Order updates, production milestones, and approval announcements
          </p>
        </div>

        {notifications.length > 0 && (
          <Button
            variant="outline"
            size="sm"
            onClick={handleClearAll}
            className="text-xs font-semibold text-gray-500 hover:text-red-600 rounded-xl"
          >
            <Trash2 className="h-3.5 w-3.5 mr-1" /> Clear All
          </Button>
        )}
      </div>

      <Card className="rounded-2xl border-[#e2e8e3] bg-white shadow-2xs overflow-hidden">
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-16 text-xs text-gray-400">
              <Loader2 className="h-5 w-5 animate-spin mr-2 text-[#0f7f79]" /> Loading notifications...
            </div>
          ) : notifications.length === 0 ? (
            <div className="py-16 text-center text-xs text-gray-400">
              <Info className="h-6 w-6 mx-auto mb-2 text-gray-300" />
              No notifications yet. You will be notified when your orders make progress.
            </div>
          ) : (
            <div className="divide-y divide-[#edf0ed]">
              {notifications.map((n) => (
                <div
                  key={n.id}
                  className={`p-4 sm:p-5 flex items-start justify-between gap-4 transition-colors ${
                    n.isRead ? "bg-white" : "bg-[#f4faf7]/60"
                  }`}
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-xs text-[#193230]">
                        {n.title}
                      </span>
                      {!n.isRead && (
                        <span className="h-2 w-2 rounded-full bg-emerald-500 shrink-0" />
                      )}
                    </div>
                    <p className="text-xs text-[#526360] leading-relaxed">
                      {n.message}
                    </p>
                    <div className="flex items-center gap-1.5 text-[11px] text-[#869693] pt-1">
                      <Clock className="h-3 w-3" />
                      <span>
                        {formatDistanceToNow(new Date(n.createdAt), { addSuffix: true })}
                      </span>
                    </div>
                  </div>

                  {!n.isRead && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleMarkRead(n.id)}
                      className="text-xs font-semibold text-teal-700 hover:bg-teal-50 shrink-0 h-8"
                    >
                      <Check className="h-3.5 w-3.5 mr-1" /> Mark read
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
