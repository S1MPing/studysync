import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { useCourses } from "@/hooks/use-courses";
import { useTutorCourses } from "@/hooks/use-tutor";
import { useI18n } from "@/lib/i18n";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Search, GraduationCap, MapPin, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export function FindStudents() {
  const { user } = useAuth();
  const { t } = useI18n();
  const [, setLocation] = useLocation();
  const [universityFilter, setUniversityFilter] = useState<string>("");

  // Students cannot browse this page — only tutors see incoming requests via Sessions
  useEffect(() => {
    if (user && user.role !== "tutor") {
      setLocation("/dashboard");
    }
  }, [user]);

  const { data: students, isLoading } = useQuery({
    queryKey: ["/api/users/students", universityFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (universityFilter && universityFilter !== "all") params.append("university", universityFilter);
      const res = await fetch(`/api/users/students?${params.toString()}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
  });

  return (
    <div className="space-y-6 pb-12">
      <div className="bg-primary rounded-2xl p-6 sm:p-8 relative overflow-hidden">
        <div className="absolute inset-0 bg-grid opacity-[0.07]" />
        <div className="relative z-10 max-w-2xl">
          <h1 className="text-2xl md:text-3xl font-bold text-white mb-2">{t("nav.findStudents") || "Find Students"}</h1>
          <p className="text-primary-foreground/70 text-sm mb-6">Browse students who need help. Offer to teach them.</p>
          
          <div className="flex items-center bg-card rounded-lg px-3 text-foreground max-w-md">
            <Search className="w-4 h-4 text-muted-foreground mr-2" />
            <Select value={universityFilter} onValueChange={setUniversityFilter}>
              <SelectTrigger className="border-0 shadow-none focus:ring-0 px-0 h-10 text-sm">
                <SelectValue placeholder="Filter by university..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Universities</SelectItem>
                <SelectItem value="University of Ghana">University of Ghana</SelectItem>
                <SelectItem value="KNUST">KNUST</SelectItem>
                <SelectItem value="UPSA">UPSA</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {isLoading ? (
          Array(6).fill(0).map((_, i) => (
            <Card key={i} className="animate-pulse h-44 bg-muted/30 rounded-xl border-0" />
          ))
        ) : students?.length === 0 ? (
          <div className="col-span-full py-16 text-center">
            <GraduationCap className="w-12 h-12 text-muted-foreground/20 mx-auto mb-3" />
            <h3 className="text-base font-semibold">No students found</h3>
            <p className="text-sm text-muted-foreground mt-1">Check back later.</p>
          </div>
        ) : (
          students?.map((student: any) => (
            <Card key={student.id} className="rounded-xl shadow-soft hover:shadow-elevated transition-all border-border/60">
              <CardContent className="p-5">
                <div className="flex items-start gap-3 mb-3">
                  <Avatar className="w-12 h-12 border border-border shadow-sm">
                    <AvatarImage src={student.profileImageUrl || ""} />
                    <AvatarFallback className="bg-primary/8 text-primary text-base font-bold">{student.firstName?.[0]}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-bold">{student.firstName} {student.lastName}</h3>
                    <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                      <MapPin className="w-3 h-3" /> {student.university} · Level {student.level}
                    </p>
                  </div>
                </div>
                
                {student.major && (
                  <p className="text-xs text-muted-foreground mb-2">
                    <span className="font-medium text-foreground">{student.major}</span> student
                  </p>
                )}
                
                <p className="text-xs text-muted-foreground line-clamp-2 mb-4 min-h-[2rem]">{student.bio || "Looking for tutoring help!"}</p>

                <OfferDialog student={student} />
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}

function OfferDialog({ student }: { student: any }) {
  const [open, setOpen] = useState(false);
  const { user } = useAuth();
  const { data: myCourses } = useTutorCourses(user?.id || "");
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [courseId, setCourseId] = useState("");
  const [notes, setNotes] = useState("");

  const createOffer = useMutation({
    mutationFn: async (data: { studentId: string; tutorId: string; courseId: number; notes?: string }) => {
      const res = await fetch("/api/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sessions"] });
    },
  });

  const handleSubmit = () => {
    if (!courseId || !user) return;
    createOffer.mutate({
      studentId: student.id,
      tutorId: user.id,
      courseId: parseInt(courseId),
      notes: notes || undefined,
    }, {
      onSuccess: () => {
        setOpen(false);
        setCourseId("");
        setNotes("");
        toast({ title: `Offer sent to ${student.firstName}!` });
      },
      onError: () => {
        toast({ title: "Failed to send offer", variant: "destructive" });
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="w-full rounded-lg text-xs h-9" size="sm">
          Offer to teach {student.firstName}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[400px] rounded-xl p-5">
        <DialogHeader className="mb-3">
          <DialogTitle className="text-lg font-bold">Offer to teach {student.firstName}</DialogTitle>
          <p className="text-xs text-muted-foreground">Pick a course you teach. Once accepted, you can chat to schedule.</p>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">Which course will you teach?</Label>
            <Select value={courseId} onValueChange={setCourseId}>
              <SelectTrigger className="h-10 rounded-lg text-sm"><SelectValue placeholder="Pick from your courses" /></SelectTrigger>
              <SelectContent>
                {myCourses && myCourses.length > 0 ? (
                  myCourses.map((tc: any) => (
                    <SelectItem key={tc.courseId || tc.id} value={(tc.courseId || tc.id).toString()}>
                      {tc.course?.code ? `${tc.course.code} - ${tc.course.name}` : `Course ${tc.courseId}`}
                    </SelectItem>
                  ))
                ) : (
                  <SelectItem value="none" disabled>Add courses in your profile first</SelectItem>
                )}
              </SelectContent>
            </Select>
          </div>
          
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">Message (optional)</Label>
            <Textarea 
              placeholder="Hi! I can help you with this course..." 
              className="resize-none rounded-lg text-sm min-h-[80px]"
              value={notes}
              onChange={e => setNotes(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter className="mt-4">
          <Button className="w-full h-10 rounded-lg text-sm font-semibold" onClick={handleSubmit} disabled={createOffer.isPending || !courseId}>
            {createOffer.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Send Offer"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
