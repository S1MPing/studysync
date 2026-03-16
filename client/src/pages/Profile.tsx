import { useRef, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useUpdateProfile } from "@/hooks/use-users";
import { useTutorCourses, useAddTutorCourse, useRemoveTutorCourse } from "@/hooks/use-tutor";
import { useCourses } from "@/hooks/use-courses";
import { useQuery } from "@tanstack/react-query";
import { useQueryClient, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { updateProfileSchema } from "@shared/routes";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Loader2, Camera, LogOut, Lock, X, Plus, KeyRound, Trash2, Shield } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useI18n } from "@/lib/i18n";
import Cropper from "react-easy-crop";
import { cropImageToDataUrl, type Area as CropArea } from "@/lib/image-crop";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useLocation } from "wouter";

const ALL_LEVELS = ["100", "200", "300", "400", "Masters"];
const MAX_AVATAR_MB = 7;

export function Profile() {
  const { user, logout, isLoggingOut } = useAuth();
  const updateProfile = useUpdateProfile();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { t } = useI18n();
  const [, navigate] = useLocation();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [addingCourse, setAddingCourse] = useState("");
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [cropOpen, setCropOpen] = useState(false);
  const [cropSrc, setCropSrc] = useState<string | null>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<CropArea | null>(null);

  // Change password state
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  // Delete account state
  const [deleteConfirm, setDeleteConfirm] = useState("");

  const isTutor = user?.role === "tutor";
  const { data: tutorCourses } = useTutorCourses(isTutor ? user?.id || "" : "");
  const { data: allCourses } = useCourses();
  const addTutorCourse = useAddTutorCourse();
  const removeTutorCourse = useRemoveTutorCourse();

  const form = useForm<z.infer<typeof updateProfileSchema>>({
    resolver: zodResolver(updateProfileSchema),
    defaultValues: {
      role: (user?.role as any) || "student",
      university: user?.university || "",
      level: user?.level || "",
      major: user?.major || "",
      teachingLevels: user?.teachingLevels || "",
      bio: user?.bio || "",
    },
  });

  // Change password mutation
  const changePassword = useMutation({
    mutationFn: async (data: { currentPassword: string; newPassword: string }) => {
      const res = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Failed to change password");
      }
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Password changed successfully" });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    },
    onError: (err: any) => {
      toast({ title: err.message, variant: "destructive" });
    },
  });

  // Delete account mutation
  const deleteAccount = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/auth/account", {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to delete account");
      return res.json();
    },
    onSuccess: () => {
      queryClient.setQueryData(["/api/auth/user"], null);
      navigate("/auth");
    },
    onError: () => {
      toast({ title: "Failed to delete account", variant: "destructive" });
    },
  });

  if (!user) return null;

  const roleLabel = isTutor ? t("profile.tutor") : user.role === "both" ? t("profile.both") : t("profile.student");

  function onSubmit(data: z.infer<typeof updateProfileSchema>) {
    const { role, ...rest } = data;
    updateProfile.mutate({ ...rest, role: user!.role as any }, {
      onSuccess: (updatedUser) => {
        queryClient.setQueryData(["/api/auth/user"], (old: any) => ({ ...old, ...updatedUser }));
        toast({ title: t("profile.updated") });
      },
      onError: () => {
        toast({ title: t("profile.updateFailed"), variant: "destructive" });
      }
    });
  }

  const handlePhotoClick = () => setDetailsOpen(true);

  const handlePhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > MAX_AVATAR_MB * 1024 * 1024) { toast({ title: `Max ${MAX_AVATAR_MB}MB`, variant: "destructive" }); return; }
    if (!file.type.startsWith("image/")) { toast({ title: "Select an image", variant: "destructive" }); return; }
    const reader = new FileReader();
    reader.onload = async () => {
      setCropSrc(typeof reader.result === "string" ? reader.result : null);
      setCrop({ x: 0, y: 0 });
      setZoom(1);
      setCroppedAreaPixels(null);
      setCropOpen(true);
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const uploadAvatar = async (image: string | null) => {
    setUploading(true);
    try {
      const res = await fetch("/api/users/me/avatar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ image }),
      });
      if (!res.ok) throw new Error("Upload failed");
      const u = await res.json();
      queryClient.setQueryData(["/api/auth/user"], (old: any) => ({ ...old, ...u }));
      toast({ title: t("profile.updated") });
    } catch {
      toast({ title: "Failed to update photo", variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  const handleRemovePhoto = async () => { await uploadAvatar(null); };

  const handleCropConfirm = async () => {
    if (!cropSrc || !croppedAreaPixels) return;
    try {
      const cropped = await cropImageToDataUrl(cropSrc, croppedAreaPixels, { maxSize: 512, mimeType: "image/jpeg", quality: 0.9 });
      setCropOpen(false);
      setCropSrc(null);
      await uploadAvatar(cropped);
    } catch {
      toast({ title: "Failed to crop photo", variant: "destructive" });
    }
  };

  const handleAddCourse = () => {
    if (!addingCourse) return;
    addTutorCourse.mutate({ courseId: parseInt(addingCourse) }, {
      onSuccess: () => { setAddingCourse(""); queryClient.invalidateQueries({ queryKey: ["/api/tutor-courses"] }); }
    });
  };

  const handleRemoveCourse = (id: number) => {
    removeTutorCourse.mutate(id, {
      onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/tutor-courses"] })
    });
  };

  const toggleTeachingLevel = (lvl: string) => {
    const current = form.getValues("teachingLevels")?.split(",").filter(Boolean) || [];
    const updated = current.includes(lvl) ? current.filter(l => l !== lvl) : [...current, lvl];
    form.setValue("teachingLevels", updated.join(","), { shouldDirty: true });
  };

  const currentTeachingLevels = form.watch("teachingLevels")?.split(",").filter(Boolean) || [];

  const handleChangePassword = () => {
    if (newPassword !== confirmPassword) { toast({ title: "Passwords do not match", variant: "destructive" }); return; }
    if (newPassword.length < 6) { toast({ title: "Password must be at least 6 characters", variant: "destructive" }); return; }
    changePassword.mutate({ currentPassword, newPassword });
  };

  return (
    <div className="max-w-4xl mx-auto w-full space-y-6 pb-12 px-4 sm:px-6 lg:px-0">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold">{t("profile.title")}</h1>
        <p className="text-muted-foreground text-sm mt-1">{t("profile.subtitle")}</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-[220px_1fr] gap-6">
        {/* Left */}
        <div className="flex flex-col gap-4">
          <Card className="rounded-xl border-border/60 shadow-soft pt-6 pb-5 px-5">
            {/* Mobile: horizontal layout, Desktop: vertical/centered */}
            <div className="flex flex-row md:flex-col items-center gap-4 md:gap-0">
              <div className="relative w-20 h-20 md:w-24 md:h-24 md:mx-auto md:mb-3 flex-shrink-0 group cursor-pointer" onClick={handlePhotoClick}>
                <Avatar className="w-full h-full border-2 border-background shadow-sm">
                  <AvatarImage src={user.profileImageUrl || ""} />
                  <AvatarFallback className="bg-primary/8 text-primary text-3xl font-bold">{user.firstName?.[0] || "?"}</AvatarFallback>
                </Avatar>
                <div className="absolute inset-0 rounded-full bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  {uploading ? <Loader2 className="w-5 h-5 text-white animate-spin" /> : <Camera className="w-5 h-5 text-white" />}
                </div>
              </div>
              <div className="flex-1 md:text-center min-w-0">
                <h2 className="text-base font-bold truncate">{user.firstName} {user.lastName}</h2>
                <p className="text-xs text-muted-foreground mt-0.5 truncate">{user.email}</p>
                <div className="flex flex-wrap gap-1 mt-2 md:justify-center">
                  <Badge variant="secondary" className="text-[10px]">{roleLabel}</Badge>
                  {(user as any).isAdmin && (
                    <Badge variant="outline" className="text-[10px] text-amber-600 border-amber-300 bg-amber-50">
                      <Shield className="w-2.5 h-2.5 mr-1" />Admin
                    </Badge>
                  )}
                </div>
              </div>
            </div>
            <div className="mt-4 pt-4 border-t border-border/50">
              <Button variant="destructive" size="sm" className="w-full rounded-lg bg-destructive/8 text-destructive hover:bg-destructive hover:text-white border-0 text-xs" onClick={() => logout()} disabled={isLoggingOut}>
                {isLoggingOut ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <LogOut className="w-3.5 h-3.5 mr-1.5" />}
                {t("nav.logout")}
              </Button>
            </div>
          </Card>
        </div>

        {/* Right */}
        <div className="space-y-4">
          {/* Academic Details */}
          <Card className="rounded-xl border-border/60 shadow-soft">
            <CardHeader className="bg-muted/20 border-b pb-3 px-5 rounded-t-xl">
              <CardTitle className="text-base">{t("profile.academicDetails")}</CardTitle>
            </CardHeader>
            <CardContent className="p-5">
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium flex items-center gap-1.5">{t("profile.role")} <Lock className="w-3 h-3 text-muted-foreground" /></label>
                      <div className="h-10 rounded-lg border border-border bg-muted/20 flex items-center px-3 text-xs text-muted-foreground">{roleLabel}</div>
                    </div>
                    <FormField control={form.control} name="university" render={({ field }) => (
                      <FormItem><FormLabel className="text-xs">{t("profile.university")}</FormLabel><FormControl><Input className="h-10 rounded-lg text-sm" {...field} /></FormControl></FormItem>
                    )} />
                    {!isTutor && (
                      <>
                        <FormField control={form.control} name="level" render={({ field }) => (
                          <FormItem><FormLabel className="text-xs">{t("profile.level")}</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger className="h-10 rounded-lg text-sm"><SelectValue /></SelectTrigger></FormControl>
                              <SelectContent>{ALL_LEVELS.map(l => <SelectItem key={l} value={l}>Level {l}</SelectItem>)}</SelectContent>
                            </Select></FormItem>
                        )} />
                        <FormField control={form.control} name="major" render={({ field }) => (
                          <FormItem><FormLabel className="text-xs">{t("profile.major")}</FormLabel><FormControl><Input className="h-10 rounded-lg text-sm" {...field} /></FormControl></FormItem>
                        )} />
                      </>
                    )}
                  </div>
                  {isTutor && (
                    <div>
                      <label className="text-xs font-medium block mb-2">Levels you can teach</label>
                      <div className="flex flex-wrap gap-2">
                        {ALL_LEVELS.map(lvl => (
                          <button key={lvl} type="button" onClick={() => toggleTeachingLevel(lvl)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${currentTeachingLevels.includes(lvl) ? "bg-primary text-white border-primary" : "border-border text-muted-foreground hover:border-primary/30"}`}>
                            Level {lvl}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                  <FormField control={form.control} name="bio" render={({ field }) => (
                    <FormItem><FormLabel className="text-xs">{t("profile.bio")}</FormLabel><FormControl><Textarea className="resize-none rounded-lg min-h-[80px] text-sm" {...field} /></FormControl></FormItem>
                  )} />
                  <div className="flex justify-end pt-2">
                    <Button type="submit" size="sm" className="px-6 h-9 rounded-lg font-semibold text-xs" disabled={updateProfile.isPending || !form.formState.isDirty}>
                      {updateProfile.isPending && <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />}
                      {t("profile.saveChanges")}
                    </Button>
                  </div>
                </form>
              </Form>
            </CardContent>
          </Card>

          {/* Tutor: Manage Courses */}
          {isTutor && (
            <Card className="rounded-xl border-border/60 shadow-soft">
              <CardHeader className="bg-muted/20 border-b pb-3 px-5 rounded-t-xl">
                <CardTitle className="text-base">My Courses</CardTitle>
              </CardHeader>
              <CardContent className="p-5">
                {tutorCourses && tutorCourses.length > 0 ? (
                  <div className="flex flex-wrap gap-2 mb-4">
                    {tutorCourses.map((tc: any) => (
                      <Badge key={tc.id} variant="secondary" className="rounded-lg text-xs gap-1.5 pr-1.5 py-1">
                        {tc.course?.code || `Course ${tc.courseId}`}
                        <button onClick={() => handleRemoveCourse(tc.id)} className="hover:text-destructive transition-colors"><X className="w-3 h-3" /></button>
                      </Badge>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground mb-4">No courses added yet.</p>
                )}
                <div className="flex gap-2">
                  <Select value={addingCourse} onValueChange={setAddingCourse}>
                    <SelectTrigger className="h-9 rounded-lg text-xs flex-1"><SelectValue placeholder="Select a course to add" /></SelectTrigger>
                    <SelectContent>
                      {allCourses?.filter(c => !tutorCourses?.some((tc: any) => tc.courseId === c.id)).map(c => (
                        <SelectItem key={c.id} value={c.id.toString()}>{c.code} - {c.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button size="sm" className="h-9 rounded-lg text-xs px-3 gap-1" onClick={handleAddCourse} disabled={!addingCourse || addTutorCourse.isPending}>
                    <Plus className="w-3.5 h-3.5" /> Add
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Tutor: Availability Calendar */}
          {isTutor && <AvailabilityCalendar tutorId={user.id} />}

          {/* Change Password */}
          <Card className="rounded-xl border-border/60 shadow-soft">
            <CardHeader className="bg-muted/20 border-b pb-3 px-5 rounded-t-xl">
              <CardTitle className="text-base flex items-center gap-2"><KeyRound className="w-4 h-4" /> Change Password</CardTitle>
            </CardHeader>
            <CardContent className="p-5 space-y-3">
              <div className="space-y-1.5">
                <label className="text-xs font-medium">Current Password</label>
                <Input type="password" className="h-10 rounded-lg text-sm" value={currentPassword} onChange={e => setCurrentPassword(e.target.value)} placeholder="••••••••" />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium">New Password</label>
                <Input type="password" className="h-10 rounded-lg text-sm" value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="••••••••" />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium">Confirm New Password</label>
                <Input type="password" className="h-10 rounded-lg text-sm" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} placeholder="••••••••" />
              </div>
              <div className="flex justify-end pt-1">
                <Button size="sm" className="h-9 rounded-lg text-xs px-5" onClick={handleChangePassword}
                  disabled={!currentPassword || !newPassword || !confirmPassword || changePassword.isPending}>
                  {changePassword.isPending && <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />}
                  Update Password
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Delete Account */}
          <Card className="rounded-xl border-destructive/30 shadow-soft">
            <CardHeader className="bg-destructive/5 border-b border-destructive/20 pb-3 px-5 rounded-t-xl">
              <CardTitle className="text-base text-destructive flex items-center gap-2"><Trash2 className="w-4 h-4" /> Delete Account</CardTitle>
            </CardHeader>
            <CardContent className="p-5">
              <p className="text-xs text-muted-foreground mb-3">
                Deleting your account is permanent. All your sessions, messages, and data will be removed.
              </p>
              <div className="space-y-2">
                <label className="text-xs font-medium">Type <span className="font-mono bg-muted px-1 rounded">DELETE</span> to confirm</label>
                <Input className="h-9 rounded-lg text-sm max-w-xs" value={deleteConfirm} onChange={e => setDeleteConfirm(e.target.value)} placeholder="DELETE" />
              </div>
              <div className="flex justify-end mt-3">
                <Button variant="destructive" size="sm" className="h-9 rounded-lg text-xs px-5"
                  disabled={deleteConfirm !== "DELETE" || deleteAccount.isPending}
                  onClick={() => deleteAccount.mutate()}>
                  {deleteAccount.isPending && <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />}
                  Delete My Account
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Photo dialog */}
      <Dialog open={detailsOpen} onOpenChange={(open) => { setDetailsOpen(open); if (!open) { setCropOpen(false); setCropSrc(null); } }}>
        <DialogContent className="max-w-xl">
          <DialogHeader><DialogTitle>Profile details</DialogTitle></DialogHeader>
          <div className="flex flex-col md:flex-row items-center md:items-stretch gap-6">
            <div className="relative w-40 h-40 rounded-full overflow-hidden bg-muted flex items-center justify-center">
              <Avatar className="w-full h-full">
                <AvatarImage src={user.profileImageUrl || ""} />
                <AvatarFallback className="bg-primary/10 text-primary text-4xl font-bold">{user.firstName?.[0] || "?"}</AvatarFallback>
              </Avatar>
              <div className="absolute inset-0 bg-black/40 flex flex-col items-center justify-center text-white text-xs gap-2">
                <button type="button" className="px-3 py-1 rounded-full bg-white/10 hover:bg-white/20 text-xs font-medium"
                  onClick={() => fileInputRef.current?.click()} disabled={uploading}>Choose photo</button>
                <button type="button" className="px-3 py-1 rounded-full bg-white/5 hover:bg-white/15 text-xs font-medium"
                  onClick={handleRemovePhoto} disabled={uploading || !user.profileImageUrl}>Remove photo</button>
              </div>
              <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoChange} />
            </div>
            <div className="flex-1 flex flex-col justify-between gap-4 w-full">
              <div className="space-y-2">
                <label className="text-xs font-semibold block">Display name</label>
                <Input className="h-10 rounded-lg text-sm" defaultValue={`${user.firstName || ""} ${user.lastName || ""}`.trim()}
                  onBlur={(e) => {
                    const value = e.target.value.trim();
                    if (!value) return;
                    const [firstName, ...rest] = value.split(" ");
                    const lastName = rest.join(" ");
                    updateProfile.mutate({ firstName, lastName, role: user.role as any }, {
                      onSuccess: (updatedUser) => {
                        queryClient.setQueryData(["/api/auth/user"], (old: any) => ({ ...old, ...updatedUser }));
                        toast({ title: t("profile.updated") });
                      },
                    });
                  }}
                />
              </div>
              <div className="flex justify-end">
                <Button type="button" onClick={() => setDetailsOpen(false)} disabled={uploading}>Save</Button>
              </div>
            </div>
          </div>
          <p className="mt-4 text-[11px] text-muted-foreground">By proceeding, you agree you have the right to upload this image.</p>
        </DialogContent>
      </Dialog>

      {/* Availability crop dialog */}
      <Dialog open={cropOpen} onOpenChange={(open) => { setCropOpen(open); if (!open) setCropSrc(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Crop photo</DialogTitle></DialogHeader>
          {cropSrc && (
            <div className="space-y-4">
              <div className="relative w-full h-72 bg-muted rounded-lg overflow-hidden">
                <Cropper image={cropSrc} crop={crop} zoom={zoom} aspect={1} cropShape="round" showGrid={false}
                  onCropChange={setCrop} onZoomChange={setZoom}
                  onCropComplete={(_a, pixels) => setCroppedAreaPixels(pixels as CropArea)} />
              </div>
              <div className="flex gap-2 justify-end">
                <Button type="button" variant="outline" onClick={() => setCropOpen(false)} disabled={uploading}>Cancel</Button>
                <Button type="button" onClick={handleCropConfirm} disabled={uploading || !croppedAreaPixels}>Use photo</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ── Availability Calendar ──────────────────────────────────────────
const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const HOURS = Array.from({ length: 14 }, (_, i) => i + 8); // 8am–9pm

function AvailabilityCalendar({ tutorId }: { tutorId: string }) {
  const { toast } = useToast();
  const { data: slots = [], refetch } = useQuery<any[]>({
    queryKey: ["/api/availabilities", tutorId],
    queryFn: async () => {
      const res = await fetch(`/api/availabilities/${tutorId}`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
  });

  const isActive = (day: number, hour: number) =>
    slots.some(s => s.dayOfWeek === day && parseInt(s.startTime) <= hour && parseInt(s.endTime) > hour);

  const toggle = async (day: number, hour: number) => {
    const startTime = `${String(hour).padStart(2, "0")}:00`;
    const endTime = `${String(hour + 1).padStart(2, "0")}:00`;
    const existing = slots.find(s => s.dayOfWeek === day && s.startTime === startTime);
    try {
      if (existing) {
        await fetch(`/api/availabilities/${existing.id}`, { method: "DELETE", credentials: "include" });
      } else {
        await fetch("/api/availabilities", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ dayOfWeek: day, startTime, endTime }),
        });
      }
      refetch();
    } catch {
      toast({ title: "Failed to update availability", variant: "destructive" });
    }
  };

  return (
    <Card className="rounded-xl border-border/60 shadow-soft">
      <CardHeader className="bg-muted/20 border-b pb-3 px-5 rounded-t-xl">
        <CardTitle className="text-base">My Availability</CardTitle>
        <p className="text-[11px] text-muted-foreground">Click a slot to toggle your availability for students to see.</p>
      </CardHeader>
      <CardContent className="p-4 overflow-x-auto">
        <div className="min-w-[500px]">
          {/* Day headers */}
          <div className="grid grid-cols-8 mb-1">
            <div className="text-[10px] text-muted-foreground font-medium px-1" />
            {DAYS.map(d => (
              <div key={d} className="text-center text-[10px] font-semibold text-muted-foreground uppercase tracking-wide py-1">{d}</div>
            ))}
          </div>
          {/* Time rows */}
          {HOURS.map(h => (
            <div key={h} className="grid grid-cols-8 mb-0.5 items-center">
              <div className="text-[9px] text-muted-foreground text-right pr-2">
                {h < 12 ? `${h}am` : h === 12 ? "12pm" : `${h - 12}pm`}
              </div>
              {DAYS.map((_, dayIdx) => {
                const active = isActive(dayIdx + 1, h);
                return (
                  <button key={dayIdx} onClick={() => toggle(dayIdx + 1, h)}
                    className={`h-6 mx-0.5 rounded transition-all border ${
                      active
                        ? "bg-primary border-primary/50 hover:bg-primary/80"
                        : "bg-muted/30 border-border/40 hover:bg-primary/10 hover:border-primary/30"
                    }`}
                    title={`${DAYS[dayIdx]} ${h}:00`}
                  />
                );
              })}
            </div>
          ))}
        </div>
        <p className="text-[10px] text-muted-foreground mt-3 text-center">
          <span className="inline-block w-3 h-3 rounded bg-primary mr-1 align-middle" /> Available &nbsp;
          <span className="inline-block w-3 h-3 rounded bg-muted/30 border border-border/40 mr-1 align-middle" /> Unavailable
        </p>
      </CardContent>
    </Card>
  );
}
