import { Button } from "@/components/ui/button";
import { Calendar } from "lucide-react";

function toICSDate(dateStr: string, timeStr?: string): string {
  try {
    const base = dateStr.slice(0, 10); // YYYY-MM-DD
    const time = timeStr ? timeStr.replace(":", "") + "00" : "000000";
    // Combine to YYYYMMDDTHHmmss — treat as local time (no Z suffix)
    // Use UTC representation by parsing properly
    const iso = timeStr
      ? new Date(`${base}T${timeStr}:00`).toISOString()
      : new Date(`${base}T00:00:00`).toISOString();
    // Format: YYYYMMDDTHHmmssZ
    return iso.replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  } catch {
    return "";
  }
}

function addMinutes(dateStr: string, timeStr: string | undefined, minutes: number): string {
  try {
    const base = dateStr.slice(0, 10);
    const dt = timeStr
      ? new Date(`${base}T${timeStr}:00`)
      : new Date(`${base}T00:00:00`);
    dt.setMinutes(dt.getMinutes() + minutes);
    return dt.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  } catch {
    return "";
  }
}

export function CalendarSync({ sessions }: { sessions: any[] }) {
  const handleExport = () => {
    const lines: string[] = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//StudySync//StudySync//EN",
      "CALSCALE:GREGORIAN",
    ];

    for (const session of sessions) {
      if (!session.date) continue;

      const dtStart = toICSDate(session.date, session.startTime);
      if (!dtStart) continue;

      const duration = typeof session.durationMinutes === "number" ? session.durationMinutes : 60;
      const dtEnd = addMinutes(session.date, session.startTime, duration);

      const courseCode = session.course?.code || `Session #${session.id}`;
      const otherName = session.tutor
        ? `${session.tutor.firstName || ""} ${session.tutor.lastName || ""}`.trim()
        : session.student
          ? `${session.student.firstName || ""} ${session.student.lastName || ""}`.trim()
          : "Unknown";

      lines.push("BEGIN:VEVENT");
      lines.push(`UID:${session.id}@studysync`);
      lines.push(`DTSTART:${dtStart}`);
      lines.push(`DTEND:${dtEnd || dtStart}`);
      lines.push(`SUMMARY:StudySync Session - ${courseCode}`);
      lines.push(`DESCRIPTION:Tutoring session with ${otherName}`);
      lines.push("END:VEVENT");
    }

    lines.push("END:VCALENDAR");

    const icsContent = lines.join("\r\n");
    const blob = new Blob([icsContent], { type: "text/calendar" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = "studysync-sessions.ics";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleExport}
      className="gap-2 rounded-lg text-xs h-9"
    >
      <Calendar className="w-3.5 h-3.5" />
      Export to Calendar
    </Button>
  );
}
