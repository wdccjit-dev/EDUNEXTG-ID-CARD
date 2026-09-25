import { FormEvent, useEffect, useRef, useState } from "react";
import {
  Camera,
  Check,
  KeyRound,
  Loader2,
  Lock,
  Mail,
  Phone,
  ShieldCheck,
  Trash2,
  Upload,
  User,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { api, type ApiAuthUser } from "@/lib/api";
import { toast } from "sonner";
import {
  isValidIndianMobileNumber,
  INDIAN_MOBILE_ERROR_MESSAGE,
  INDIAN_MOBILE_PLACEHOLDER,
} from "@shared/phoneValidation";

interface SuperAdminProfileDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentUser: ApiAuthUser;
  onProfileUpdated: (user: ApiAuthUser) => void;
}

export default function SuperAdminProfileDialog({
  open,
  onOpenChange,
  currentUser,
  onProfileUpdated,
}: SuperAdminProfileDialogProps) {
  // Strict frontend guard: only SUPER_ADMIN may open this profile modal
  if (currentUser.role !== "SUPER_ADMIN") {
    return null;
  }

  const [activeTab, setActiveTab] = useState<"details" | "security">("details");
  const [savingDetails, setSavingDetails] = useState(false);
  const [savingPicture, setSavingPicture] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);

  // Profile fields
  const [name, setName] = useState(currentUser.name ?? "");
  const [email, setEmail] = useState(currentUser.email ?? "");
  const [phone, setPhone] = useState(currentUser.phone ?? "");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(currentUser.avatarUrl ?? null);
  const [pendingAvatarPreview, setPendingAvatarPreview] = useState<string | null>(null);

  // Password fields
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Synchronize form when dialog is opened without flickering
  useEffect(() => {
    if (!open) return;
    setName(currentUser.name ?? "");
    setEmail(currentUser.email ?? "");
    setPhone(currentUser.phone ?? "");
    setAvatarUrl(currentUser.avatarUrl ?? null);
    setPendingAvatarPreview(null);
    setCurrentPassword("");
    setNewPassword("");
    setConfirmNewPassword("");

    // Silently fetch fresh profile in background without full dialog unmount/flicker
    let active = true;
    api.profile
      .get()
      .then((fresh) => {
        if (!active) return;
        setName((prev) => (prev === (currentUser.name ?? "") ? (fresh.name ?? "") : prev));
        setEmail((prev) => (prev === (currentUser.email ?? "") ? (fresh.email ?? "") : prev));
        setPhone((prev) => (prev === (currentUser.phone ?? "") ? (fresh.phone ?? "") : prev));
        setAvatarUrl(fresh.avatarUrl ?? null);
      })
      .catch((err) => {
        console.error("Failed to refresh profile:", err);
      });

    return () => {
      active = false;
    };
  }, [open]);

  const initials = (name.trim() || currentUser.email || "SA")
    .split(" ")
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

  // Handle profile image file selection
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Please select a valid image file (PNG, JPEG, WebP).");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image file size must be under 5 MB.");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      setPendingAvatarPreview(result);
    };
    reader.onerror = () => {
      toast.error("Failed to read image file.");
    };
    reader.readAsDataURL(file);
    // Reset file input so re-selecting same file triggers change
    e.target.value = "";
  };

  // Save new profile picture
  const handleSavePicture = async () => {
    if (!pendingAvatarPreview) return;
    setSavingPicture(true);
    try {
      const res = await api.profile.updatePicture(pendingAvatarPreview);
      setAvatarUrl(res.avatarUrl);
      setPendingAvatarPreview(null);
      const updatedUser: ApiAuthUser = { ...currentUser, avatarUrl: res.avatarUrl };
      onProfileUpdated(updatedUser);
      toast.success(res.message || "Profile picture updated successfully.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Unable to update profile picture. Please try again.");
    } finally {
      setSavingPicture(false);
    }
  };

  // Remove existing profile picture
  const handleRemovePicture = async () => {
    setSavingPicture(true);
    try {
      const res = await api.profile.removePicture();
      setAvatarUrl(null);
      setPendingAvatarPreview(null);
      const updatedUser: ApiAuthUser = { ...currentUser, avatarUrl: null };
      onProfileUpdated(updatedUser);
      toast.success(res.message || "Profile picture removed successfully.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Unable to remove profile picture. Please try again.");
    } finally {
      setSavingPicture(false);
    }
  };

  // Handle saving details (Name, Email, Phone)
  const handleSaveDetails = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error("Name cannot be empty.");
      return;
    }
    if (!email.trim() || !email.includes("@")) {
      toast.error("A valid email address is required.");
      return;
    }


    setSavingDetails(true);
    try {
      const res = await api.profile.update({
        name: name.trim(),
        email: email.trim().toLowerCase(),
        phone: phone.trim() || undefined,
      });
      onProfileUpdated(res.user);
      toast.success(res.message || "Profile updated successfully.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Unable to update profile. Please try again.");
    } finally {
      setSavingDetails(false);
    }
  };

  // Handle password change
  const handleChangePassword = async (e: FormEvent) => {
    e.preventDefault();
    if (!currentPassword) {
      toast.error("Please enter your current password.");
      return;
    }
    if (!newPassword) {
      toast.error("Please enter a new password.");
      return;
    }
    if (newPassword.length < 8) {
      toast.error("New password must be at least 8 characters long.");
      return;
    }
    if (newPassword !== confirmNewPassword) {
      toast.error("Passwords do not match.");
      return;
    }

    setChangingPassword(true);
    try {
      const res = await api.profile.changePassword({
        currentPassword,
        newPassword,
        confirmNewPassword,
      });
      toast.success(res.message || "Password changed successfully.");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmNewPassword("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Unable to change password. Please try again.");
    } finally {
      setChangingPassword(false);
    }
  };

  const displayAvatar = pendingAvatarPreview ?? avatarUrl;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl overflow-hidden rounded-3xl border border-[#dfe7e2] bg-[#fffefa] p-0 shadow-2xl">
        {/* Header */}
        <div className="border-b border-[#e6ede8] bg-[#f7faf8] px-6 py-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#0f7f79] text-white shadow-md shadow-[#0f7f79]/20">
                <ShieldCheck className="h-6 w-6" strokeWidth={2.2} />
              </div>
              <div>
                <DialogTitle className="text-xl font-extrabold tracking-tight text-[#182326]">
                  Super Admin Profile
                </DialogTitle>
                <DialogDescription className="text-xs text-[#778381]">
                  Manage your administrator credentials, personal information, and photo.
                </DialogDescription>
              </div>
            </div>
            <span className="rounded-full border border-[#b7e3d9] bg-[#dff3ee] px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wider text-[#0b716b]">
              Super Admin
            </span>
          </div>

          {/* Navigation Tabs */}
          <div className="mt-5 flex gap-2 border-t border-[#e8efe9] pt-3">
            <button
              type="button"
              onClick={() => setActiveTab("details")}
              className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition-all ${
                activeTab === "details"
                  ? "bg-[#0f7f79] text-white shadow-sm"
                  : "text-[#5e716e] hover:bg-[#eaf2ee] hover:text-[#182326]"
              }`}
            >
              <User className="h-3.5 w-3.5" />
              General Details & Photo
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("security")}
              className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition-all ${
                activeTab === "security"
                  ? "bg-[#0f7f79] text-white shadow-sm"
                  : "text-[#5e716e] hover:bg-[#eaf2ee] hover:text-[#182326]"
              }`}
            >
              <KeyRound className="h-3.5 w-3.5" />
              Security & Password
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="px-6 py-5">
          {activeTab === "details" ? (
            <div className="space-y-6">
              {/* Profile Picture Section */}
              <div className="rounded-2xl border border-[#e5ece7] bg-[#f9fbf9] p-4">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                  {/* Avatar Display */}
                  <div className="relative flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-2xl border-2 border-[#b7e3d9] bg-[#dff3ee] text-xl font-black text-[#0b716b] shadow-sm">
                    {displayAvatar ? (
                      <img
                        src={displayAvatar}
                        alt="Profile avatar"
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      initials
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex-1 space-y-2">
                    <div className="text-xs font-extrabold text-[#203734]">Profile Picture</div>
                    <p className="text-[11px] text-[#778381]">
                      Upload a square portrait photo (JPG, PNG, WebP up to 5MB).
                    </p>

                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleFileChange}
                      className="hidden"
                    />

                    <div className="flex flex-wrap gap-2 pt-1">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={savingPicture}
                        className="h-8 rounded-xl border-[#cfdcd6] bg-white text-xs font-bold text-[#203734] hover:bg-[#edf5f0]"
                      >
                        <Upload className="mr-1.5 h-3.5 w-3.5 text-[#0f7f79]" />
                        {displayAvatar ? "Change Picture" : "Upload Picture"}
                      </Button>

                      {pendingAvatarPreview && (
                        <Button
                          type="button"
                          size="sm"
                          onClick={handleSavePicture}
                          disabled={savingPicture}
                          className="h-8 rounded-xl bg-[#0f7f79] text-xs font-bold text-white hover:bg-[#096c67]"
                        >
                          {savingPicture ? (
                            <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Check className="mr-1.5 h-3.5 w-3.5" />
                          )}
                          Save Photo
                        </Button>
                      )}

                      {avatarUrl && !pendingAvatarPreview && (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={handleRemovePicture}
                          disabled={savingPicture}
                          className="h-8 rounded-xl border-[#fcd5ce] bg-white text-xs font-bold text-[#b91c1c] hover:bg-[#fff1f0]"
                        >
                          <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                          Remove Photo
                        </Button>
                      )}

                      {pendingAvatarPreview && (
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          onClick={() => setPendingAvatarPreview(null)}
                          className="h-8 rounded-xl text-xs font-semibold text-[#778381]"
                        >
                          Cancel
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* General Details Form */}
              <form onSubmit={handleSaveDetails} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-[#38514e]">
                    Full Name <span className="text-red-500">*</span>
                  </label>
                  <div className="relative mt-1.5">
                    <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8fa09d]" />
                    <Input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="e.g. Master Administrator"
                      className="h-10 rounded-xl pl-9 text-xs"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#38514e]">
                    Email Address <span className="text-red-500">*</span>
                  </label>
                  <div className="relative mt-1.5">
                    <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8fa09d]" />
                    <Input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="admin@edunextg.com"
                      className="h-10 rounded-xl pl-9 text-xs"
                      required
                    />
                  </div>
                  <p className="mt-1 text-[10px] text-[#8fa09d]">
                    Used for administrator login and system notifications.
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#38514e]">
                    Phone / Mobile Number
                  </label>
                  <div className="mt-1.5 flex items-center gap-1.5">
                    <div className="h-10 w-14 flex items-center justify-center rounded-xl border border-[#d2dbd8] bg-[#f5f8f7] text-xs font-bold text-[#2a4541] select-none shrink-0">
                      +91
                    </div>
                    <div className="flex-1 relative">
                      <Phone className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8fa09d]" />
                      <Input
                        type="tel"
                        inputMode="numeric"
                        maxLength={10}
                        value={phone}
                        onChange={(e) => {
                          const digits = e.target.value.replace(/\D/g, "").slice(0, 10);
                          setPhone(digits);
                        }}
                        placeholder={INDIAN_MOBILE_PLACEHOLDER}
                        className={`h-10 rounded-xl pl-9 text-xs transition-colors ${
                          phone.length > 0 && phone.length < 10
                            ? "border-red-500 bg-red-50/15 text-red-900 focus-visible:ring-red-400 focus-visible:border-red-500"
                            : ""
                        }`}
                      />
                    </div>
                  </div>
                  {phone.length > 0 && phone.length < 10 && (
                    <p className="mt-1 text-[11px] font-medium text-red-500">
                      Phone number must be 10 digits ({phone.length}/10)
                    </p>
                  )}
                </div>

                <div className="flex justify-end pt-3">
                  <Button
                    type="submit"
                    disabled={savingDetails}
                    className="h-10 rounded-xl bg-[#0f7f79] px-6 text-xs font-bold text-white hover:bg-[#096c67]"
                  >
                    {savingDetails ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving changes…
                      </>
                    ) : (
                      "Save Profile Details"
                    )}
                  </Button>
                </div>
              </form>
            </div>
          ) : (
            /* Security & Password Form */
            <form onSubmit={handleChangePassword} className="space-y-4">
              <div className="rounded-2xl border border-[#b7e3d9] bg-[#dff3ee]/40 p-3 text-xs text-[#123b3b]">
                <div className="flex items-center gap-2 font-bold text-[#0b716b]">
                  <Lock className="h-4 w-4" /> Strong Password Protection
                </div>
                <p className="mt-1 text-[11px] leading-relaxed text-[#41625d]">
                  Ensure your administrator password has at least 8 characters. You will need to provide your existing password to verify this update.
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#38514e]">
                  Current Password <span className="text-red-500">*</span>
                </label>
                <div className="relative mt-1.5">
                  <KeyRound className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8fa09d]" />
                  <Input
                    type="password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder="Enter current password"
                    className="h-10 rounded-xl pl-9 text-xs"
                    autoComplete="current-password"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#38514e]">
                  New Password <span className="text-red-500">*</span>
                </label>
                <div className="relative mt-1.5">
                  <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8fa09d]" />
                  <Input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Minimum 8 characters"
                    className="h-10 rounded-xl pl-9 text-xs"
                    autoComplete="new-password"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#38514e]">
                  Confirm New Password <span className="text-red-500">*</span>
                </label>
                <div className="relative mt-1.5">
                  <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8fa09d]" />
                  <Input
                    type="password"
                    value={confirmNewPassword}
                    onChange={(e) => setConfirmNewPassword(e.target.value)}
                    placeholder="Re-enter new password"
                    className="h-10 rounded-xl pl-9 text-xs"
                    autoComplete="new-password"
                    required
                  />
                </div>
                {newPassword && confirmNewPassword && newPassword !== confirmNewPassword && (
                  <p className="mt-1 text-[11px] font-semibold text-red-600">
                    Passwords do not match.
                  </p>
                )}
              </div>

              <div className="flex justify-end pt-3">
                <Button
                  type="submit"
                  disabled={changingPassword}
                  className="h-10 rounded-xl bg-[#0f7f79] px-6 text-xs font-bold text-white hover:bg-[#096c67]"
                >
                  {changingPassword ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Updating password…
                    </>
                  ) : (
                    "Update Password"
                  )}
                </Button>
              </div>
            </form>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
