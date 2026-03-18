import { useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { useUpdateProfile } from "@/hooks/use-users";
import { useAddTutorCourse, useAddAvailability } from "@/hooks/use-tutor";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Loader2, X, Plus, BookOpen, MessageSquare, Video, Brain, Users, CheckCircle2, Clock, ArrowLeft } from "lucide-react";

const ALL_LEVELS = ["100", "200", "300", "400", "Masters"];

// ── Welcome Modal ─────────────────────────────────────────────────────────────
function WelcomeModal({ onClose, role }: { onClose: () => void; role: string }) {
  const features = [
    { icon: BookOpen, title: "Sessions", desc: "Request or accept tutoring sessions with your peers." },
    { icon: MessageSquare, title: "Messaging", desc: "Chat, share files, and send math equations in each session." },
    { icon: Video, title: "Video Calls", desc: "Jump into a live WebRTC call directly from any session." },
    { icon: Brain, title: "Quiz & Flashcards", desc: "Create and study flashcard decks to master any topic." },
    { icon: Users, title: "Study Rooms", desc: "Open or join a live Jitsi video room with other students." },
  ];

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.92 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-card rounded-2xl shadow-2xl max-w-md w-full border border-border/60 overflow-hidden"
      >
        <div className="bg-primary px-6 pt-6 pb-8 relative overflow-hidden">
          <div className="absolute inset-0 opacity-10" style={{ backgroundImage: "radial-gradient(circle at 20% 50%, white 1px, transparent 1px)", backgroundSize: "24px 24px" }} />
          <div className="relative">
            <div className="w-12 h-12 rounded-2xl bg-white/20 flex items-center justify-center mb-3">
              <CheckCircle2 className="w-6 h-6 text-white" />
            </div>
            <h2 className="text-xl font-bold text-white">Welcome to StudySync! 🎉</h2>
            <p className="text-primary-foreground/80 text-sm mt-1">
              {role === "tutor"
                ? "Your tutor profile is ready. Here's what you can do:"
                : "Your student profile is set. Here's what awaits you:"}
            </p>
          </div>
        </div>

        <div className="p-6 space-y-3">
          {features.map(({ icon: Icon, title, desc }) => (
            <div key={title} className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                <Icon className="w-4 h-4 text-primary" />
              </div>
              <div>
                <p className="text-sm font-semibold">{title}</p>
                <p className="text-xs text-muted-foreground leading-relaxed">{desc}</p>
              </div>
            </div>
          ))}

          <div className="pt-3 flex items-center gap-2 text-xs text-amber-600 dark:text-amber-400 bg-amber-500/10 rounded-lg px-3 py-2">
            <Clock className="w-3.5 h-3.5 shrink-0" />
            <span>Your account is pending admin verification. You'll get full access once approved.</span>
          </div>

          <Button onClick={onClose} className="w-full mt-2 rounded-xl h-11 font-semibold gap-2">
            <CheckCircle2 className="w-4 h-4" />
            Got it, let's go!
          </Button>
        </div>
      </motion.div>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
export function ProfileSetup() {
  const { user, logout } = useAuth();
  const [, setLocation] = useLocation();
  const updateProfile = useUpdateProfile();
  const addTutorCourse = useAddTutorCourse();
  const addAvailability = useAddAvailability();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [step, setStep] = useState<1 | 2>(1);
  const [role, setRole] = useState<"student" | "tutor">("student");
  const [university, setUniversity] = useState("");
  const [bio, setBio] = useState("");

  // Student fields
  const [level, setLevel] = useState("");
  const [major, setMajor] = useState("");

  // Tutor fields
  const [teachingLevels, setTeachingLevels] = useState<string[]>([]);
  const [courses, setCourses] = useState<{ code: string; name: string }[]>([]);
  const [courseCode, setCourseCode] = useState("");
  const [courseName, setCourseName] = useState("");
  const [availabilitySlots, setAvailabilitySlots] = useState<
    { id: number; dayOfWeek: number; timeOfDay: "morning" | "afternoon" | "evening" | "night" }[]
  >([]);

  const [submitting, setSubmitting] = useState(false);
  const [showWelcome, setShowWelcome] = useState(false);

  const toggleLevel = (lvl: string) => {
    setTeachingLevels(prev => prev.includes(lvl) ? prev.filter(l => l !== lvl) : [...prev, lvl]);
  };

  const addCourse = () => {
    const code = courseCode.trim().toUpperCase();
    const name = courseName.trim();
    if (!code || !name) return;
    if (courses.find(c => c.code === code)) {
      toast({ title: "Course already added", variant: "destructive" });
      return;
    }
    setCourses(prev => [...prev, { code, name }]);
    setCourseCode("");
    setCourseName("");
  };

  const removeCourse = (code: string) => {
    setCourses(prev => prev.filter(c => c.code !== code));
  };

  const addAvailabilitySlot = (dayOfWeek: number, timeOfDay: "morning" | "afternoon" | "evening" | "night") => {
    setAvailabilitySlots(prev => {
      if (prev.some(s => s.dayOfWeek === dayOfWeek && s.timeOfDay === timeOfDay)) return prev;
      return [...prev, { id: Date.now() + Math.random(), dayOfWeek, timeOfDay }];
    });
  };

  const removeAvailabilitySlot = (id: number) => {
    setAvailabilitySlots(prev => prev.filter(s => s.id !== id));
  };

  const availabilityLabel = (slot: { dayOfWeek: number; timeOfDay: string }) => {
    const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const times: Record<string, string> = {
      morning: "Morning (8am–12pm)",
      afternoon: "Afternoon (12pm–4pm)",
      evening: "Evening (4pm–8pm)",
      night: "Night (8pm–11pm)",
    };
    return `${days[slot.dayOfWeek]} · ${times[slot.timeOfDay] || slot.timeOfDay}`;
  };

  const validate = () => {
    if (!university.trim()) { toast({ title: "University is required", variant: "destructive" }); return false; }
    if (!bio.trim()) { toast({ title: "Bio is required", variant: "destructive" }); return false; }
    if (role === "student") {
      if (!level) { toast({ title: "Level / Year is required", variant: "destructive" }); return false; }
      if (!major.trim()) { toast({ title: "Major / Program is required", variant: "destructive" }); return false; }
    } else {
      if (teachingLevels.length === 0) { toast({ title: "Select at least one teaching level", variant: "destructive" }); return false; }
      if (courses.length === 0) { toast({ title: "Add at least one course you can teach", variant: "destructive" }); return false; }
      if (availabilitySlots.length === 0) { toast({ title: "Add at least one availability slot", variant: "destructive" }); return false; }
    }
    return true;
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    setSubmitting(true);

    try {
      // 1. Update profile
      const profileData: any = { role, university: university.trim(), bio: bio.trim() };
      if (role === "student") {
        profileData.level = level;
        profileData.major = major.trim();
      } else {
        profileData.teachingLevels = teachingLevels.join(",");
      }

      await new Promise<void>((resolve, reject) => {
        updateProfile.mutate(profileData, {
          onSuccess: (updatedUser) => {
            queryClient.setQueryData(["/api/auth/user"], (old: any) => ({ ...old, ...updatedUser }));
            resolve();
          },
          onError: (err: any) => reject(err),
        });
      });

      // 2. If tutor: create courses + availability
      if (role === "tutor") {
        for (const c of courses) {
          const res = await fetch("/api/courses/find-or-create", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({ code: c.code, name: c.name, university: university.trim() }),
          });
          if (res.ok) {
            const course = await res.json();
            await new Promise<void>((resolve) => {
              addTutorCourse.mutate({ courseId: course.id }, { onSuccess: () => resolve(), onError: () => resolve() });
            });
          }
        }

        for (const slot of availabilitySlots) {
          const times: Record<string, [string, string]> = {
            morning: ["08:00", "12:00"],
            afternoon: ["12:00", "16:00"],
            evening: ["16:00", "20:00"],
            night: ["20:00", "23:00"],
          };
          const [startTime, endTime] = times[slot.timeOfDay] || ["08:00", "12:00"];
          await new Promise<void>((resolve) => {
            addAvailability.mutate(
              { dayOfWeek: slot.dayOfWeek, startTime, endTime },
              { onSuccess: () => resolve(), onError: () => resolve() },
            );
          });
        }
      }

      // 3. Show welcome modal
      setShowWelcome(true);
    } catch (err: any) {
      toast({
        title: "Setup failed",
        description: err?.message || "Something went wrong. Please try again.",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      {showWelcome && (
        <WelcomeModal
          role={role}
          onClose={() => {
            setShowWelcome(false);
            setLocation("/dashboard");
          }}
        />
      )}

      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-lg">
          <div className="mb-6 flex justify-center">
            <img src="/icon-192.png" alt="StudySync" className="w-14 h-14" />
          </div>

          <Card className="border-border/60 shadow-elevated rounded-xl overflow-hidden">
            <CardHeader className="bg-muted/30 border-b pb-4 text-center">
              <CardTitle className="text-2xl font-bold">Welcome to StudySync</CardTitle>
              <CardDescription className="text-sm mt-1">
                {step === 1 ? "What brings you here?" : role === "student" ? "Tell us about your academics" : "Set up your teaching profile"}
              </CardDescription>
            </CardHeader>
            <CardContent className="p-6">

              {/* Step 1: Choose role */}
              {step === 1 && (
                <div className="space-y-4">
                  <p className="text-sm font-medium mb-3">I want to...</p>
                  <div className="grid grid-cols-2 gap-3">
                    <button onClick={() => setRole("student")}
                      className={`p-4 rounded-xl border-2 text-center transition-all ${role === "student" ? "border-primary bg-primary/5" : "border-border hover:border-primary/30"}`}>
                      <p className="text-2xl mb-2">📚</p>
                      <p className="text-sm font-semibold">Learn</p>
                      <p className="text-xs text-muted-foreground mt-0.5">Find tutors for my courses</p>
                    </button>
                    <button onClick={() => setRole("tutor")}
                      className={`p-4 rounded-xl border-2 text-center transition-all ${role === "tutor" ? "border-primary bg-primary/5" : "border-border hover:border-primary/30"}`}>
                      <p className="text-2xl mb-2">🎓</p>
                      <p className="text-sm font-semibold">Teach</p>
                      <p className="text-xs text-muted-foreground mt-0.5">Help other students succeed</p>
                    </button>
                  </div>
                  <Button onClick={() => setStep(2)} className="w-full h-11 rounded-lg font-semibold mt-4">
                    Continue
                  </Button>
                  <button
                    type="button"
                    onClick={() => logout()}
                    className="w-full flex items-center justify-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors mt-1"
                  >
                    <ArrowLeft className="w-3 h-3" /> Back to sign in
                  </button>
                </div>
              )}

              {/* Step 2: Profile details */}
              {step === 2 && (
                <div className="space-y-5">
                  {/* University */}
                  <div>
                    <label className="text-xs font-semibold block mb-1.5">University <span className="text-destructive">*</span></label>
                    <Input placeholder="e.g. University of Ghana, KNUST, UPSA" className="h-10 rounded-lg" value={university} onChange={e => setUniversity(e.target.value)} />
                  </div>

                  {/* Student fields */}
                  {role === "student" && (
                    <>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="text-xs font-semibold block mb-1.5">Level / Year <span className="text-destructive">*</span></label>
                          <div className="flex flex-wrap gap-1.5">
                            {ALL_LEVELS.map(l => (
                              <button key={l} onClick={() => setLevel(l)}
                                className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${level === l ? "bg-primary text-white border-primary" : "border-border text-muted-foreground hover:border-primary/30"}`}>
                                {l}
                              </button>
                            ))}
                          </div>
                        </div>
                        <div>
                          <label className="text-xs font-semibold block mb-1.5">Major / Program <span className="text-destructive">*</span></label>
                          <Input placeholder="e.g. Computer Science" className="h-10 rounded-lg" value={major} onChange={e => setMajor(e.target.value)} />
                        </div>
                      </div>
                    </>
                  )}

                  {/* Tutor fields */}
                  {role === "tutor" && (
                    <>
                      {/* Teaching levels */}
                      <div>
                        <label className="text-xs font-semibold block mb-2">What levels can you teach? <span className="text-destructive">*</span></label>
                        <div className="flex flex-wrap gap-2">
                          {ALL_LEVELS.map(lvl => (
                            <button key={lvl} onClick={() => toggleLevel(lvl)}
                              className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${teachingLevels.includes(lvl) ? "bg-primary text-white border-primary" : "border-border text-muted-foreground hover:border-primary/30"}`}>
                              Level {lvl}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Courses — free-text */}
                      <div>
                        <label className="text-xs font-semibold block mb-2">Courses you can teach <span className="text-destructive">*</span></label>
                        {courses.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 mb-3">
                            {courses.map(c => (
                              <Badge key={c.code} variant="secondary" className="rounded-md text-xs gap-1 pr-1">
                                {c.code} — {c.name}
                                <button onClick={() => removeCourse(c.code)} className="ml-0.5 hover:text-destructive"><X className="w-3 h-3" /></button>
                              </Badge>
                            ))}
                          </div>
                        )}
                        <div className="flex gap-2">
                          <Input
                            placeholder="Code (e.g. MATH101)"
                            className="h-9 rounded-lg text-xs flex-shrink-0 w-32"
                            value={courseCode}
                            onChange={e => setCourseCode(e.target.value)}
                            onKeyDown={e => e.key === "Enter" && addCourse()}
                          />
                          <Input
                            placeholder="Course name (e.g. Calculus)"
                            className="h-9 rounded-lg text-xs flex-1"
                            value={courseName}
                            onChange={e => setCourseName(e.target.value)}
                            onKeyDown={e => e.key === "Enter" && addCourse()}
                          />
                          <Button
                            size="sm" variant="outline"
                            className="h-9 rounded-lg text-xs px-3 shrink-0"
                            onClick={addCourse}
                            disabled={!courseCode.trim() || !courseName.trim()}
                          >
                            <Plus className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                        <p className="text-[11px] text-muted-foreground mt-1">Type the course code and full name, then press + to add.</p>
                      </div>

                      {/* Availability */}
                      <div>
                        <label className="text-xs font-semibold block mb-2">When are you usually available? <span className="text-destructive">*</span></label>
                        <div className="grid grid-cols-2 gap-2 mb-3">
                          {[0, 1, 2, 3, 4, 5, 6].map((day) => (
                            <div key={day} className="flex flex-col gap-1 rounded-lg border border-dashed border-border/60 p-2">
                              <span className="text-[11px] font-medium">
                                {["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][day]}
                              </span>
                              <div className="flex flex-wrap gap-1">
                                {["morning", "afternoon", "evening", "night"].map((tod) => (
                                  <button
                                    key={tod}
                                    type="button"
                                    onClick={() => addAvailabilitySlot(day, tod as any)}
                                    className={`px-2 py-0.5 rounded-full border text-[10px] transition-all ${availabilitySlots.some(s => s.dayOfWeek === day && s.timeOfDay === tod) ? "bg-primary/20 border-primary/40 text-primary" : "border-border text-muted-foreground hover:border-primary/40"}`}
                                  >
                                    {tod}
                                  </button>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                        {availabilitySlots.length > 0 && (
                          <div className="flex flex-wrap gap-1.5">
                            {availabilitySlots.map((slot) => (
                              <Badge key={slot.id} variant="secondary" className="rounded-md text-[10px] gap-1 pr-1 py-0.5">
                                {availabilityLabel(slot)}
                                <button type="button" onClick={() => removeAvailabilitySlot(slot.id)} className="hover:text-destructive">
                                  <X className="w-3 h-3" />
                                </button>
                              </Badge>
                            ))}
                          </div>
                        )}
                      </div>
                    </>
                  )}

                  {/* Bio */}
                  <div>
                    <label className="text-xs font-semibold block mb-1.5">Short Bio <span className="text-destructive">*</span></label>
                    <Textarea
                      placeholder={role === "student" ? "What do you need help with? What courses are you struggling with?" : "What are you great at teaching? Your experience?"}
                      className="resize-none rounded-lg min-h-[80px] text-sm"
                      value={bio}
                      onChange={e => setBio(e.target.value)}
                    />
                  </div>

                  <div className="flex gap-3 pt-2">
                    <Button variant="outline" onClick={() => setStep(1)} className="h-11 rounded-lg flex-1">Back</Button>
                    <Button onClick={handleSubmit} disabled={submitting} className="h-11 rounded-lg flex-1 font-semibold">
                      {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : "Complete Setup"}
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </>
  );
}
