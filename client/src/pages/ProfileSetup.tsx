import { useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { useUpdateProfile } from "@/hooks/use-users";
import { useCourses } from "@/hooks/use-courses";
import { useAddTutorCourse, useAddAvailability } from "@/hooks/use-tutor";
import { useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Loader2, X } from "lucide-react";

const ALL_LEVELS = ["100", "200", "300", "400", "Masters"];

export function ProfileSetup() {
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const updateProfile = useUpdateProfile();
  const addTutorCourse = useAddTutorCourse();
  const addAvailability = useAddAvailability();
  const { data: allCourses } = useCourses();
  const queryClient = useQueryClient();

  const [step, setStep] = useState<1 | 2>(1);
  const [role, setRole] = useState<"student" | "tutor">("student");
  const [university, setUniversity] = useState("");
  const [bio, setBio] = useState("");

  // Student fields
  const [level, setLevel] = useState("");
  const [major, setMajor] = useState("");

  // Tutor fields
  const [teachingLevels, setTeachingLevels] = useState<string[]>([]);
  const [selectedCourses, setSelectedCourses] = useState<number[]>([]);
  const [addingCourse, setAddingCourse] = useState("");
  const [availabilitySlots, setAvailabilitySlots] = useState<
    { id: number; dayOfWeek: number; timeOfDay: "morning" | "afternoon" | "evening" | "night" }
  >([]);

  const [submitting, setSubmitting] = useState(false);

  const toggleLevel = (lvl: string) => {
    setTeachingLevels(prev => prev.includes(lvl) ? prev.filter(l => l !== lvl) : [...prev, lvl]);
  };

  const addCourse = () => {
    if (addingCourse && !selectedCourses.includes(parseInt(addingCourse))) {
      setSelectedCourses(prev => [...prev, parseInt(addingCourse)]);
      setAddingCourse("");
    }
  };

  const removeCourse = (id: number) => {
    setSelectedCourses(prev => prev.filter(c => c !== id));
  };

  const addAvailabilitySlot = (dayOfWeek: number, timeOfDay: "morning" | "afternoon" | "evening" | "night") => {
    setAvailabilitySlots(prev => {
      // Avoid exact duplicates
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

  const handleSubmit = async () => {
    if (!university) return;
    setSubmitting(true);

    try {
      const profileData: any = { role, university, bio };

      if (role === "student") {
        profileData.level = level;
        profileData.major = major;
      } else {
        profileData.teachingLevels = teachingLevels.join(",");
      }

      await new Promise<void>((resolve, reject) => {
        updateProfile.mutate(profileData, {
          onSuccess: (updatedUser) => {
            queryClient.setQueryData(["/api/auth/user"], (old: any) => ({ ...old, ...updatedUser }));
            resolve();
          },
          onError: reject,
        });
      });

      // If tutor, add selected courses
      if (role === "tutor") {
        // Add selected courses
        if (selectedCourses.length > 0) {
          for (const courseId of selectedCourses) {
            await new Promise<void>((resolve) => {
              addTutorCourse.mutate({ courseId }, { onSuccess: () => resolve(), onError: () => resolve() });
            });
          }
        }

        // Add availability slots
        if (availabilitySlots.length > 0) {
          for (const slot of availabilitySlots) {
            // Map time-of-day to concrete start/end times
            let startTime = "08:00";
            let endTime = "10:00";
            if (slot.timeOfDay === "morning") {
              startTime = "08:00"; endTime = "12:00";
            } else if (slot.timeOfDay === "afternoon") {
              startTime = "12:00"; endTime = "16:00";
            } else if (slot.timeOfDay === "evening") {
              startTime = "16:00"; endTime = "20:00";
            } else if (slot.timeOfDay === "night") {
              startTime = "20:00"; endTime = "23:00";
            }

            await new Promise<void>((resolve) => {
              addAvailability.mutate(
                { dayOfWeek: slot.dayOfWeek, startTime, endTime },
                { onSuccess: () => resolve(), onError: () => resolve() },
              );
            });
          }
        }
      }

      setLocation("/dashboard");
    } catch (err) {
      console.error("Profile setup error:", err);
    } finally {
      setSubmitting(false);
    }
  };

  return (
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
              </div>
            )}

            {/* Step 2: Profile details */}
            {step === 2 && (
              <div className="space-y-5">
                {/* University — both roles */}
                <div>
                  <label className="text-xs font-semibold block mb-1.5">University</label>
                  <Input placeholder="e.g. University of Ghana, KNUST, UPSA" className="h-10 rounded-lg" value={university} onChange={e => setUniversity(e.target.value)} />
                </div>

                {/* Student-specific fields */}
                {role === "student" && (
                  <>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs font-semibold block mb-1.5">Level / Year</label>
                        <Select value={level} onValueChange={setLevel}>
                          <SelectTrigger className="h-10 rounded-lg text-sm"><SelectValue placeholder="Select" /></SelectTrigger>
                          <SelectContent>
                            {ALL_LEVELS.map(l => <SelectItem key={l} value={l}>Level {l}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <label className="text-xs font-semibold block mb-1.5">Major / Program</label>
                        <Input placeholder="e.g. Computer Science" className="h-10 rounded-lg" value={major} onChange={e => setMajor(e.target.value)} />
                      </div>
                    </div>
                  </>
                )}

                {/* Tutor-specific fields */}
                {role === "tutor" && (
                  <>
                    {/* Teaching levels */}
                    <div>
                      <label className="text-xs font-semibold block mb-2">What levels can you teach?</label>
                      <div className="flex flex-wrap gap-2">
                        {ALL_LEVELS.map(lvl => (
                          <button key={lvl} onClick={() => toggleLevel(lvl)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                              teachingLevels.includes(lvl) ? "bg-primary text-white border-primary" : "border-border text-muted-foreground hover:border-primary/30"
                            }`}>
                            Level {lvl}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Courses */}
                    <div>
                      <label className="text-xs font-semibold block mb-2">Courses you can teach</label>
                      {selectedCourses.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mb-3">
                          {selectedCourses.map(id => {
                            const course = allCourses?.find(c => c.id === id);
                            return (
                              <Badge key={id} variant="secondary" className="rounded-md text-xs gap-1 pr-1">
                                {course?.code || `Course ${id}`}
                                <button onClick={() => removeCourse(id)} className="ml-0.5 hover:text-destructive"><X className="w-3 h-3" /></button>
                              </Badge>
                            );
                          })}
                        </div>
                      )}
                      <div className="flex gap-2">
                        <Select value={addingCourse} onValueChange={setAddingCourse}>
                          <SelectTrigger className="h-9 rounded-lg text-xs flex-1"><SelectValue placeholder="Select a course" /></SelectTrigger>
                          <SelectContent>
                            {allCourses?.filter(c => !selectedCourses.includes(c.id)).map(c => (
                              <SelectItem key={c.id} value={c.id.toString()}>{c.code} - {c.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Button size="sm" variant="outline" className="h-9 rounded-lg text-xs px-3" onClick={addCourse} disabled={!addingCourse}>Add</Button>
                      </div>
                    </div>

                    {/* Availability */}
                    <div>
                      <label className="text-xs font-semibold block mb-2">When are you usually available?</label>
                      <p className="text-[11px] text-muted-foreground mb-2">
                        Choose typical times you can teach (morning, afternoon, evening, night). Students can filter by these later.
                      </p>
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
                                  className="px-2 py-0.5 rounded-full border border-border text-[10px] text-muted-foreground hover:border-primary/40"
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
                            <Badge
                              key={slot.id}
                              variant="secondary"
                              className="rounded-md text-[10px] gap-1 pr-1 py-0.5"
                            >
                              {availabilityLabel(slot)}
                              <button
                                type="button"
                                onClick={() => removeAvailabilitySlot(slot.id)}
                                className="hover:text-destructive"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>
                  </>
                )}

                {/* Bio — both roles */}
                <div>
                  <label className="text-xs font-semibold block mb-1.5">Short Bio</label>
                  <Textarea placeholder={role === "student" ? "What do you need help with?" : "What are you great at teaching?"} 
                    className="resize-none rounded-lg min-h-[80px] text-sm" value={bio} onChange={e => setBio(e.target.value)} />
                </div>

                <div className="flex gap-3 pt-2">
                  <Button variant="outline" onClick={() => setStep(1)} className="h-11 rounded-lg flex-1">Back</Button>
                  <Button onClick={handleSubmit} disabled={submitting || !university} className="h-11 rounded-lg flex-1 font-semibold">
                    {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : "Complete Setup"}
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
