import { useRef, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useUpdateProfile } from "@/hooks/use-users";
import { useTutorCourses, useAddTutorCourse, useRemoveTutorCourse } from "@/hooks/use-tutor";
import { useCourses } from "@/hooks/use-courses";
import { useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { updateProfileSchema } from "@shared/routes";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Loader2, Camera, LogOut, Lock, X, Plus } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useI18n } from "@/lib/i18n";

const ALL_LEVELS = ["100", "200", "300", "400", "Masters"];

export function Profile() {
  const { user, logout, isLoggingOut } = useAuth();
  const updateProfile = useUpdateProfile();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { t } = useI18n();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [addingCourse, setAddingCourse] = useState("");

  const isTutor = user?.role === "tutor";
  const { data: tutorCourses } = useTutorCourses(isTutor ? user?.id || "" : "");
  const { data: allCourses } = useCourses();
  const addTutorCourse = useAddTutorCourse();
  const removeTutorCourse = useRemoveTutorCourse();

  const teachingLevelsArray = user?.teachingLevels?.split(",").filter(Boolean) || [];

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

  const handlePhotoClick = () => fileInputRef.current?.click();

  const handlePhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) { toast({ title: "Max 2MB", variant: "destructive" }); return; }
    if (!file.type.startsWith("image/")) { toast({ title: "Select an image", variant: "destructive" }); return; }
    setUploading(true);
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const res = await fetch("/api/users/me/avatar", { method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify({ image: reader.result }) });
        if (res.ok) { const u = await res.json(); queryClient.setQueryData(["/api/auth/user"], (old: any) => ({ ...old, ...u })); toast({ title: t("profile.updated") }); }
      } catch {} finally { setUploading(false); }
    };
    reader.readAsDataURL(file);
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

  return (
    <div className="max-w-4xl mx-auto w-full space-y-6 pb-12">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold">{t("profile.title")}</h1>
        <p className="text-muted-foreground text-sm mt-1">{t("profile.subtitle")}</p>
      </div>

      <div className="grid md:grid-cols-[220px_1fr] gap-6">
        {/* Left */}
        <div className="flex flex-col gap-4">
          <Card className="rounded-xl border-border/60 shadow-soft text-center pt-6 pb-5 px-5">
            <div className="relative w-24 h-24 mx-auto mb-3 group cursor-pointer" onClick={handlePhotoClick}>
              <Avatar className="w-full h-full border-2 border-background shadow-sm">
                <AvatarImage src={user.profileImageUrl || ""} />
                <AvatarFallback className="bg-primary/8 text-primary text-3xl font-bold">{user.firstName?.[0] || "?"}</AvatarFallback>
              </Avatar>
              <div className="absolute inset-0 rounded-full bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                {uploading ? <Loader2 className="w-5 h-5 text-white animate-spin" /> : <Camera className="w-5 h-5 text-white" />}
              </div>
              <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoChange} />
            </div>
            <h2 className="text-base font-bold">{user.firstName} {user.lastName}</h2>
            <p className="text-xs text-muted-foreground mt-0.5">{user.email}</p>
            <Badge variant="secondary" className="text-[10px] mt-2">{roleLabel}</Badge>
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
          <Card className="rounded-xl border-border/60 shadow-soft">
            <CardHeader className="bg-muted/20 border-b pb-3 px-5 rounded-t-xl">
              <CardTitle className="text-base">{t("profile.academicDetails")}</CardTitle>
            </CardHeader>
            <CardContent className="p-5">
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
                  <div className="grid sm:grid-cols-2 gap-4">
                    {/* Role locked */}
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium flex items-center gap-1.5">{t("profile.role")} <Lock className="w-3 h-3 text-muted-foreground" /></label>
                      <div className="h-10 rounded-lg border border-border bg-muted/20 flex items-center px-3 text-xs text-muted-foreground">{roleLabel}</div>
                    </div>
                    {/* University */}
                    <FormField control={form.control} name="university" render={({ field }) => (
                      <FormItem><FormLabel className="text-xs">{t("profile.university")}</FormLabel><FormControl><Input className="h-10 rounded-lg text-sm" {...field} /></FormControl></FormItem>
                    )} />

                    {/* Student fields */}
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

                  {/* Tutor: teaching levels */}
                  {isTutor && (
                    <div>
                      <label className="text-xs font-medium block mb-2">Levels you can teach</label>
                      <div className="flex flex-wrap gap-2">
                        {ALL_LEVELS.map(lvl => (
                          <button key={lvl} type="button" onClick={() => toggleTeachingLevel(lvl)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                              currentTeachingLevels.includes(lvl) ? "bg-primary text-white border-primary" : "border-border text-muted-foreground hover:border-primary/30"
                            }`}>
                            Level {lvl}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Bio */}
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
                {/* Current courses */}
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
                  <p className="text-xs text-muted-foreground mb-4">No courses added yet. Add courses you can teach below.</p>
                )}

                {/* Add course */}
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
        </div>
      </div>
    </div>
  );
}
