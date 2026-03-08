import { useState } from "react";
import { useTutors } from "@/hooks/use-users";
import { useCourses } from "@/hooks/use-courses";
import { useTutorCourses } from "@/hooks/use-tutor";
import { useCreateSession } from "@/hooks/use-sessions";
import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Search, Star, BookOpen, MapPin, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export function FindTutors() {
  const [courseFilter, setCourseFilter] = useState<string>("");
  const { data: tutors, isLoading: tutorsLoading } = useTutors({ courseId: courseFilter === "all" ? "" : courseFilter });
  const { data: courses } = useCourses();
  const { t } = useI18n();
  
  return (
    <div className="space-y-6 pb-12">
      <div className="bg-primary rounded-2xl p-6 sm:p-8 relative overflow-hidden">
        <div className="absolute inset-0 bg-grid opacity-[0.07]" />
        <div className="relative z-10 max-w-2xl">
          <h1 className="text-2xl md:text-3xl font-bold text-white mb-2">{t("dashboard.findATutor")}</h1>
          <p className="text-primary-foreground/70 text-sm mb-6">Search by course and connect with peer tutors at your university.</p>
          
          <div className="flex items-center bg-card rounded-lg px-3 text-foreground max-w-md">
            <Search className="w-4 h-4 text-muted-foreground mr-2" />
            <Select value={courseFilter} onValueChange={setCourseFilter}>
              <SelectTrigger className="border-0 shadow-none focus:ring-0 px-0 h-10 text-sm">
                <SelectValue placeholder="Filter by course..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Courses</SelectItem>
                {courses?.map(c => (
                  <SelectItem key={c.id} value={c.id.toString()}>{c.code} - {c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {tutorsLoading ? (
          Array(6).fill(0).map((_, i) => (
            <Card key={i} className="animate-pulse h-52 bg-muted/30 rounded-xl border-0" />
          ))
        ) : tutors?.length === 0 ? (
          <div className="col-span-full py-16 text-center">
            <BookOpen className="w-12 h-12 text-muted-foreground/20 mx-auto mb-3" />
            <h3 className="text-base font-semibold">No tutors found</h3>
            <p className="text-sm text-muted-foreground mt-1">Try adjusting your filters or check back later.</p>
          </div>
        ) : (
          tutors?.map((tutor) => (
            <TutorCard key={tutor.id} tutor={tutor} />
          ))
        )}
      </div>
    </div>
  );
}

function TutorCard({ tutor }: { tutor: any }) {
  const { data: tutorCourses } = useTutorCourses(tutor.id);

  return (
    <Card className="rounded-xl shadow-soft hover:shadow-elevated transition-all border-border/60 overflow-hidden">
      <CardContent className="p-5">
        <div className="flex justify-between items-start mb-3">
          <Avatar className="w-12 h-12 border border-border shadow-sm">
            <AvatarImage src={tutor.profileImageUrl || ""} />
            <AvatarFallback className="bg-primary/8 text-primary text-base font-bold">{tutor.firstName?.[0]}</AvatarFallback>
          </Avatar>
          <div className="flex items-center gap-1 bg-amber-500/10 text-amber-700 dark:text-amber-400 px-2 py-0.5 rounded-md">
            <Star className="w-3 h-3 fill-current" />
            <span className="text-[10px] font-bold">4.8</span>
          </div>
        </div>
        
        <h3 className="text-sm font-bold">{tutor.firstName} {tutor.lastName}</h3>
        <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5 mb-3">
          <MapPin className="w-3 h-3" /> {tutor.university} · Lvl {tutor.level}
        </p>
        
        <p className="text-xs text-muted-foreground line-clamp-2 mb-3 min-h-[2rem]">{tutor.bio || "Peer tutor ready to help you succeed!"}</p>
        
        {/* Show tutor's actual courses */}
        {tutorCourses && tutorCourses.length > 0 && (
          <div className="mb-4 flex flex-wrap gap-1.5">
            {tutorCourses.map((tc: any) => (
              <Badge key={tc.id} variant="secondary" className="rounded-md text-[10px] bg-primary/5 text-primary px-2 py-0.5">
                {tc.course?.code || tc.courseId} {tc.grade ? `(${tc.grade})` : ""}
              </Badge>
            ))}
          </div>
        )}
        
        <ConnectDialog tutor={tutor} tutorCourses={tutorCourses || []} />
      </CardContent>
    </Card>
  );
}

function ConnectDialog({ tutor, tutorCourses }: { tutor: any, tutorCourses: any[] }) {
  const [open, setOpen] = useState(false);
  const createSession = useCreateSession();
  const { toast } = useToast();
  const [courseId, setCourseId] = useState("");
  const [notes, setNotes] = useState("");

  const handleSubmit = () => {
    if (!courseId) return;
    createSession.mutate({
      tutorId: tutor.id,
      courseId: parseInt(courseId),
      notes: notes || undefined,
    }, {
      onSuccess: () => {
        setOpen(false);
        setCourseId("");
        setNotes("");
        toast({ title: "Request sent! The tutor will be notified." });
      },
      onError: (err) => {
        toast({ title: "Failed to send request", variant: "destructive" });
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="w-full rounded-lg text-xs h-9" size="sm">
          Connect with {tutor.firstName}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[400px] rounded-xl p-5">
        <DialogHeader className="mb-3">
          <DialogTitle className="text-lg font-bold">Connect with {tutor.firstName}</DialogTitle>
          <p className="text-xs text-muted-foreground">Send a request. Once accepted, you can chat to agree on a time.</p>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">Select a course {tutor.firstName} teaches</Label>
            <Select value={courseId} onValueChange={setCourseId}>
              <SelectTrigger className="h-10 rounded-lg text-sm">
                <SelectValue placeholder="Pick a course" />
              </SelectTrigger>
              <SelectContent>
                {tutorCourses.length > 0 ? (
                  tutorCourses.map((tc: any) => (
                    <SelectItem key={tc.courseId || tc.id} value={(tc.courseId || tc.id).toString()}>
                      {tc.course?.code ? `${tc.course.code} - ${tc.course.name}` : `Course ${tc.courseId}`}
                    </SelectItem>
                  ))
                ) : (
                  <SelectItem value="none" disabled>No courses listed</SelectItem>
                )}
              </SelectContent>
            </Select>
          </div>
          
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">Message (optional)</Label>
            <Textarea 
              placeholder="Hi! I need help with chapter 4 derivatives..." 
              className="resize-none rounded-lg text-sm min-h-[80px]"
              value={notes}
              onChange={e => setNotes(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter className="mt-4">
          <Button 
            className="w-full h-10 rounded-lg text-sm font-semibold" 
            onClick={handleSubmit}
            disabled={createSession.isPending || !courseId}
          >
            {createSession.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Send Request"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
