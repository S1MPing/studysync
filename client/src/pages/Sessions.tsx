import { useSessions, useUpdateSessionStatus } from "@/hooks/use-sessions";
import { useAuth } from "@/hooks/use-auth";
import { Link } from "wouter";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { BookOpen, CalendarCheck, Check, X, Loader2, MessageSquare } from "lucide-react";

export function Sessions() {
  const { user } = useAuth();
  const { data: sessions, isLoading } = useSessions();
  const updateStatus = useUpdateSessionStatus();

  if (isLoading) return <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;

  const learningSessions = sessions?.filter(s => s.studentId === user?.id) || [];
  const tutoringSessions = sessions?.filter(s => s.tutorId === user?.id) || [];

  const isTutor = user?.role === "tutor" || user?.role === "both";

  const renderSessionCard = (session: any, isTutorView: boolean) => (
    <Card key={session.id} className="rounded-2xl border-border/50 shadow-sm hover:shadow-md transition-all overflow-hidden mb-4">
      <CardContent className="p-0 flex flex-col sm:flex-row">
        <div className="bg-muted/40 p-6 flex flex-col justify-center items-center sm:w-32 border-b sm:border-b-0 sm:border-r border-border/50">
          <span className="text-xs font-bold uppercase text-muted-foreground">{format(new Date(session.date), 'MMM')}</span>
          <span className="text-3xl font-display font-bold text-foreground">{format(new Date(session.date), 'dd')}</span>
          <span className="text-xs font-semibold text-muted-foreground mt-1">{session.startTime}</span>
        </div>
        
        <div className="p-6 flex-1">
          <div className="flex justify-between items-start mb-2">
            <div>
              <h3 className="text-lg font-bold font-display">{session.course?.code || `Session #${session.id}`}</h3>
              <p className="text-sm text-muted-foreground">
                {isTutorView ? `Student: ${session.student?.firstName || 'Unknown'}` : `Tutor: ${session.tutor?.firstName || 'Unknown'}`}
              </p>
            </div>
            <StatusBadge status={session.status} />
          </div>
          
          <p className="text-sm text-muted-foreground mt-4 line-clamp-2">
            {session.notes ? `"${session.notes}"` : "No specific notes provided."}
          </p>
          
          <div className="mt-6 flex flex-wrap gap-3 items-center">
            {session.status === 'pending' && isTutorView && (
              <>
                <Button size="sm" onClick={() => updateStatus.mutate({ id: session.id, status: 'accepted' })} disabled={updateStatus.isPending} className="rounded-lg shadow-sm bg-primary hover:bg-primary/90 text-white">
                  <Check className="w-4 h-4 mr-1" /> Accept
                </Button>
                <Button size="sm" variant="outline" onClick={() => updateStatus.mutate({ id: session.id, status: 'declined' })} disabled={updateStatus.isPending} className="rounded-lg text-destructive hover:bg-destructive/10 border-destructive/20">
                  <X className="w-4 h-4 mr-1" /> Decline
                </Button>
              </>
            )}
            
            {(session.status === 'accepted' || session.status === 'completed') && (
              <Link href={`/sessions/${session.id}`}>
                <Button size="sm" variant="outline" className="rounded-lg border-primary/20 text-primary hover:bg-primary/5">
                  <MessageSquare className="w-4 h-4 mr-2" />
                  {session.status === 'completed' ? 'View Details' : 'Open Workspace'}
                </Button>
              </Link>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="max-w-4xl mx-auto w-full space-y-8 pb-12">
      <div className="mb-8">
        <h1 className="text-3xl md:text-4xl font-display font-bold">My Sessions</h1>
        <p className="text-muted-foreground mt-2">Manage your scheduled tutoring and learning appointments.</p>
      </div>

      {!isTutor ? (
        <div className="space-y-6">
          {learningSessions.length > 0 ? learningSessions.map(s => renderSessionCard(s, false)) : <EmptyState />}
        </div>
      ) : (
        <Tabs defaultValue="tutoring" className="w-full">
          <TabsList className="grid w-full grid-cols-2 h-14 rounded-2xl p-1 bg-muted/50 mb-8">
            <TabsTrigger value="tutoring" className="rounded-xl text-base font-medium data-[state=active]:bg-card data-[state=active]:shadow-sm">
              I am Teaching
            </TabsTrigger>
            <TabsTrigger value="learning" className="rounded-xl text-base font-medium data-[state=active]:bg-card data-[state=active]:shadow-sm">
              I am Learning
            </TabsTrigger>
          </TabsList>
          <TabsContent value="tutoring" className="space-y-6">
            {tutoringSessions.length > 0 ? tutoringSessions.map(s => renderSessionCard(s, true)) : <EmptyState type="teaching" />}
          </TabsContent>
          <TabsContent value="learning" className="space-y-6">
            {learningSessions.length > 0 ? learningSessions.map(s => renderSessionCard(s, false)) : <EmptyState />}
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    pending: "bg-amber-100 text-amber-800 border-amber-200",
    accepted: "bg-primary/10 text-primary border-primary/20",
    completed: "bg-blue-100 text-blue-800 border-blue-200",
    declined: "bg-muted text-muted-foreground border-border",
    cancelled: "bg-destructive/10 text-destructive border-destructive/20"
  };
  return (
    <Badge variant="outline" className={`capitalize font-bold text-xs px-3 py-1 rounded-full ${styles[status] || styles.pending}`}>
      {status}
    </Badge>
  );
}

function EmptyState({ type = "learning" }: { type?: "learning" | "teaching" }) {
  return (
    <div className="text-center py-20 bg-muted/20 rounded-3xl border border-dashed border-border/60">
      <CalendarCheck className="w-16 h-16 text-muted-foreground/30 mx-auto mb-4" />
      <h3 className="text-xl font-bold font-display text-foreground">No sessions yet</h3>
      <p className="text-muted-foreground mt-2 mb-6 max-w-sm mx-auto">
        {type === "learning" 
          ? "You haven't requested any sessions. Find a peer tutor to get started!"
          : "You don't have any tutoring requests right now."}
      </p>
      {type === "learning" && (
        <Link href="/tutors">
          <Button className="rounded-full px-8 shadow-md">Find Tutors</Button>
        </Link>
      )}
    </div>
  );
}
