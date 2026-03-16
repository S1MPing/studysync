import { useState } from "react";
import { motion } from "framer-motion";
import { useAuth } from "@/hooks/use-auth";
import { useCourses } from "@/hooks/use-courses";
import { useRooms, useCreateRoom, type StudyRoom } from "@/hooks/use-rooms";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Users,
  Plus,
  Video,
  ExternalLink,
  Lock,
  Loader2,
  BookOpen,
} from "lucide-react";

// ─── Create Room Dialog ───────────────────────────────────────────────────────

function CreateRoomDialog({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { data: courses } = useCourses();
  const createRoom = useCreateRoom();
  const { toast } = useToast();

  const [form, setForm] = useState({
    name: "",
    description: "",
    courseId: "",
    maxParticipants: "10",
  });

  function resetForm() {
    setForm({ name: "", description: "", courseId: "", maxParticipants: "10" });
  }

  function handleClose() {
    resetForm();
    onClose();
  }

  function handleCreate() {
    if (!form.name.trim()) {
      toast({ title: "Room name is required", variant: "destructive" });
      return;
    }
    createRoom.mutate(
      {
        name: form.name.trim(),
        description: form.description.trim() || undefined,
        courseId: form.courseId && form.courseId !== "none" ? Number(form.courseId) : null,
        maxParticipants: Number(form.maxParticipants),
      },
      {
        onSuccess: (room) => {
          // Open Jitsi in new tab automatically
          window.open(`https://meet.jit.si/${room.jitsiRoomId}`, "_blank", "noopener,noreferrer");
          toast({ title: "Room created!", description: "Jitsi opened in a new tab." });
          handleClose();
        },
        onError: () =>
          toast({ title: "Failed to create room", variant: "destructive" }),
      }
    );
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Video className="w-5 h-5 text-primary" />
            Create Study Room
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          <div className="space-y-1.5">
            <Label htmlFor="room-name">Room Name *</Label>
            <Input
              id="room-name"
              placeholder="e.g. Calculus Study Group"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="room-desc">Description</Label>
            <Textarea
              id="room-desc"
              placeholder="What will you be studying?"
              rows={3}
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            />
          </div>

          <div className="space-y-1.5">
            <Label>Course (optional)</Label>
            <Select
              value={form.courseId}
              onValueChange={(v) => setForm((f) => ({ ...f, courseId: v }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="No course" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No course</SelectItem>
                {(courses as any[] | undefined)?.map((c: any) => (
                  <SelectItem key={c.id} value={String(c.id)}>
                    {c.code} — {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>Max Participants</Label>
            <Select
              value={form.maxParticipants}
              onValueChange={(v) => setForm((f) => ({ ...f, maxParticipants: v }))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="5">5 participants</SelectItem>
                <SelectItem value="10">10 participants</SelectItem>
                <SelectItem value="20">20 participants</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter className="mt-4">
          <Button variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          <Button
            onClick={handleCreate}
            disabled={createRoom.isPending}
            className="gap-2"
          >
            {createRoom.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Video className="w-4 h-4" />
            )}
            Create & Join
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Room Card ────────────────────────────────────────────────────────────────

function RoomCard({ room }: { room: StudyRoom }) {
  function handleJoin() {
    window.open(
      `https://meet.jit.si/${room.jitsiRoomId}`,
      "_blank",
      "noopener,noreferrer"
    );
  }

  return (
    <Card className="rounded-xl border-border/60 shadow-sm hover:shadow-md transition-all group">
      <CardContent className="p-5 flex flex-col gap-3">
        {/* Title row */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-0.5">
              <h3 className="font-semibold text-sm truncate">{room.name}</h3>
              {room.isOpen && (
                <Badge className="text-[10px] px-1.5 py-0.5 rounded-md bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-300/30 dark:border-emerald-700/30 font-semibold">
                  Open
                </Badge>
              )}
            </div>
            {room.description && (
              <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                {room.description}
              </p>
            )}
          </div>
          <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
            <Video className="w-4 h-4 text-primary" />
          </div>
        </div>

        {/* Badges */}
        <div className="flex items-center gap-2 flex-wrap">
          {room.course && (
            <Badge variant="secondary" className="text-[10px] px-2 py-0.5 rounded-md gap-1">
              <BookOpen className="w-2.5 h-2.5" />
              {room.course.code}
            </Badge>
          )}
          <span className="text-[11px] text-muted-foreground flex items-center gap-1">
            <Users className="w-3 h-3" />
            Max {room.maxParticipants}
          </span>
        </div>

        {/* Host */}
        {room.host && (
          <p className="text-[11px] text-muted-foreground">
            Host: {room.host.firstName} {room.host.lastName}
          </p>
        )}

        {/* Join button */}
        <Button
          size="sm"
          className="w-full gap-2 mt-1"
          onClick={handleJoin}
          disabled={!room.isOpen}
        >
          {room.isOpen ? (
            <>
              <ExternalLink className="w-3.5 h-3.5" /> Join Room
            </>
          ) : (
            <>
              <Lock className="w-3.5 h-3.5" /> Closed
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}

// ─── Main Rooms Page ──────────────────────────────────────────────────────────

export function Rooms() {
  const { data: rooms, isLoading, error } = useRooms();
  const [createOpen, setCreateOpen] = useState(false);

  const openRooms = (rooms || []).filter((r) => r.isOpen);
  const closedRooms = (rooms || []).filter((r) => !r.isOpen);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="space-y-6 pb-16"
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5 mb-1">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <Users className="w-5 h-5 text-primary" />
            </div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Study Rooms</h1>
          </div>
          <p className="text-muted-foreground text-sm">
            Join a live study room or create your own
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)} className="gap-2 shrink-0">
          <Plus className="w-4 h-4" /> Create Room
        </Button>
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-52 bg-muted/40 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : error ? (
        <div className="text-center py-20 rounded-2xl border border-dashed border-border/60 bg-muted/10">
          <Users className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
          <p className="font-semibold text-sm">Study Rooms unavailable</p>
          <p className="text-xs text-muted-foreground mt-1">
            The rooms service is not ready yet. Check back soon.
          </p>
        </div>
      ) : (rooms || []).length === 0 ? (
        <div className="text-center py-20 rounded-2xl border border-dashed border-border/60 bg-muted/10">
          <Users className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
          <p className="font-semibold text-sm">No study rooms yet</p>
          <p className="text-xs text-muted-foreground mt-1 max-w-xs mx-auto">
            Be the first to open a live study room and invite others to join!
          </p>
          <Button size="sm" className="mt-4 gap-2" onClick={() => setCreateOpen(true)}>
            <Plus className="w-4 h-4" /> Create Room
          </Button>
        </div>
      ) : (
        <div className="space-y-8">
          {/* Open rooms */}
          {openRooms.length > 0 && (
            <section>
              <div className="flex items-center gap-2 mb-4">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
                </span>
                <h2 className="text-sm font-semibold">
                  Live Now
                  <span className="ml-2 text-xs font-normal text-muted-foreground">
                    ({openRooms.length} room{openRooms.length !== 1 ? "s" : ""})
                  </span>
                </h2>
              </div>
              <motion.div
                initial="hidden"
                animate="show"
                variants={{ hidden: {}, show: { transition: { staggerChildren: 0.06 } } }}
                className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
              >
                {openRooms.map((room) => (
                  <motion.div
                    key={room.id}
                    variants={{ hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0 } }}
                  >
                    <RoomCard room={room} />
                  </motion.div>
                ))}
              </motion.div>
            </section>
          )}

          {/* Closed rooms */}
          {closedRooms.length > 0 && (
            <section>
              <h2 className="text-sm font-semibold mb-4 text-muted-foreground">Past Rooms</h2>
              <motion.div
                initial="hidden"
                animate="show"
                variants={{ hidden: {}, show: { transition: { staggerChildren: 0.04 } } }}
                className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
              >
                {closedRooms.map((room) => (
                  <motion.div
                    key={room.id}
                    variants={{ hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0 } }}
                  >
                    <RoomCard room={room} />
                  </motion.div>
                ))}
              </motion.div>
            </section>
          )}
        </div>
      )}

      {/* Create Room Dialog */}
      <CreateRoomDialog open={createOpen} onClose={() => setCreateOpen(false)} />
    </motion.div>
  );
}
