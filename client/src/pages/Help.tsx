import { useState } from "react";
import { Link } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { ArrowLeft, ChevronDown, HelpCircle, Ban, Flag, MessageSquare, Shield, Mail, BookOpen, Star, Users, AlertTriangle, Search, Loader2, X } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";

const faqs = [
  {
    q: "How do I request a tutoring session?",
    a: "Go to Find Tutors, browse available tutors, and click 'Connect with [Name]'. Select the course you need help with, add an optional message, and send your request. The tutor will be notified and can accept or decline."
  },
  {
    q: "How do recurring sessions work?",
    a: "When sending a session request, check the 'Recurring weekly sessions' box and choose how many weeks. The system will automatically create a session for each week. Each session can be managed individually."
  },
  {
    q: "Can I cancel a session after it's been accepted?",
    a: "Yes. Go to Sessions, find the accepted session, and click 'End / Cancel'. Please try to cancel with enough notice so your tutor can plan accordingly."
  },
  {
    q: "How are tutors verified?",
    a: "Tutors self-register and list the courses they have completed. We rely on the community rating system and reporting tools to maintain quality. If a tutor misrepresents their credentials, please report them."
  },
  {
    q: "Why can't I see my session history?",
    a: "Only completed or cancelled sessions are moved to history. Pending or accepted sessions appear under active sessions. If something looks wrong, try refreshing the page."
  },
  {
    q: "How do I leave a review?",
    a: "After a session is marked as completed, a 'Leave Review' button appears on the session card in your Sessions page. You can rate 1–5 stars and leave an optional comment."
  },
  {
    q: "How do I share files or notes in a session?",
    a: "Open the session workspace by clicking 'Open Workspace' on an accepted session. In the chat, use the paperclip icon to attach images, documents, or other files. Shared files appear in your Shared Files gallery."
  },
  {
    q: "What courses are available?",
    a: "Available courses depend on which courses tutors have listed in their profiles. When requesting a session, you can only pick from the courses the specific tutor teaches."
  },
];

function FAQ({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border border-border/50 rounded-xl overflow-hidden">
      <button
        className="w-full flex items-center justify-between px-4 py-3.5 text-left text-sm font-medium hover:bg-muted/30 transition-colors"
        onClick={() => setOpen(!open)}
      >
        <span>{q}</span>
        <ChevronDown className={`w-4 h-4 text-muted-foreground shrink-0 ml-3 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="px-4 pb-4 text-sm text-muted-foreground leading-relaxed border-t border-border/30 pt-3">
          {a}
        </div>
      )}
    </div>
  );
}

function BlockUserDialog() {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedUser, setSelectedUser] = useState<any | null>(null);
  const { toast } = useToast();

  const { data: results = [], isFetching } = useQuery({
    queryKey: ["/api/users/search/block", search],
    queryFn: async () => {
      if (search.trim().length < 2) return [];
      const res = await fetch(`/api/users/search?q=${encodeURIComponent(search)}`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: search.trim().length >= 2,
  });

  const submitBlock = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/users/${selectedUser.id}/block`, { method: "POST", credentials: "include" });
      if (!res.ok) throw new Error("Failed");
    },
    onSuccess: () => {
      toast({ title: `${selectedUser.firstName} ${selectedUser.lastName} has been blocked.` });
      setOpen(false); setSearch(""); setSelectedUser(null);
    },
    onError: () => toast({ title: "Failed to block user", variant: "destructive" }),
  });

  return (
    <>
      <Button variant="outline" size="sm" className="rounded-lg gap-2 border-amber-500/40 text-amber-700 hover:bg-amber-50 dark:text-amber-400 dark:hover:bg-amber-950/30" onClick={() => setOpen(true)}>
        <Ban className="w-3.5 h-3.5" /> Block a User
      </Button>
      <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) { setSelectedUser(null); setSearch(""); } }}>
        <DialogContent className="sm:max-w-[400px] rounded-xl p-5">
          <DialogHeader>
            <DialogTitle className="text-base">Block a User</DialogTitle>
            <p className="text-xs text-muted-foreground mt-1">Blocked users cannot send you messages or session requests.</p>
          </DialogHeader>
          <div className="space-y-3 mt-2">
            {!selectedUser ? (
              <div className="space-y-2">
                <Label className="text-xs font-semibold">Search by name</Label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                  <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Type a name..."
                    className="w-full pl-8 pr-3 h-9 rounded-lg border border-border bg-background text-sm outline-none focus:ring-1 focus:ring-primary" />
                  {isFetching && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 animate-spin text-muted-foreground" />}
                </div>
                {search.trim().length >= 2 && (
                  <div className="border border-border/60 rounded-lg overflow-hidden max-h-48 overflow-y-auto">
                    {results.length === 0 && !isFetching ? (
                      <p className="text-xs text-muted-foreground text-center py-4">No users found</p>
                    ) : results.map((u: any) => (
                      <button key={u.id} onClick={() => setSelectedUser(u)} className="w-full flex items-center gap-2.5 px-3 py-2.5 hover:bg-muted/50 transition-colors text-left">
                        <Avatar className="w-7 h-7 shrink-0">
                          <AvatarImage src={u.profileImageUrl || ""} />
                          <AvatarFallback className="text-[10px] bg-primary/8 text-primary font-bold">{u.firstName?.[0]}</AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          <p className="text-xs font-semibold truncate">{u.firstName} {u.lastName}</p>
                          <p className="text-[10px] text-muted-foreground capitalize">{u.role} · {u.university}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-2.5 p-3 rounded-lg bg-muted/40 border border-border/60">
                <Avatar className="w-8 h-8 shrink-0">
                  <AvatarImage src={selectedUser.profileImageUrl || ""} />
                  <AvatarFallback className="text-xs bg-primary/8 text-primary font-bold">{selectedUser.firstName?.[0]}</AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold">{selectedUser.firstName} {selectedUser.lastName}</p>
                  <p className="text-xs text-muted-foreground capitalize">{selectedUser.role} · {selectedUser.university}</p>
                </div>
                <button onClick={() => { setSelectedUser(null); setSearch(""); }} className="text-muted-foreground hover:text-foreground"><X className="w-3.5 h-3.5" /></button>
              </div>
            )}
          </div>
          <DialogFooter className="mt-4">
            <Button variant="outline" size="sm" onClick={() => setOpen(false)}>Cancel</Button>
            <Button variant="outline" size="sm" className="border-amber-500/40 text-amber-700 hover:bg-amber-50 dark:text-amber-400"
              disabled={!selectedUser || submitBlock.isPending} onClick={() => submitBlock.mutate()}>
              {submitBlock.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Block User"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function ReportUserDialog() {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedUser, setSelectedUser] = useState<any | null>(null);
  const [reason, setReason] = useState("harassment");
  const [details, setDetails] = useState("");
  const { toast } = useToast();

  const { data: results = [], isFetching } = useQuery({
    queryKey: ["/api/users/search", search],
    queryFn: async () => {
      if (search.trim().length < 2) return [];
      const res = await fetch(`/api/users/search?q=${encodeURIComponent(search)}`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: search.trim().length >= 2,
  });

  const submitReport = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/users/${selectedUser.id}/report`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ reason, details: details || undefined }),
      });
      if (!res.ok) throw new Error("Failed");
    },
    onSuccess: () => {
      toast({ title: "Report submitted. Our team will review it within 48 hours." });
      setOpen(false);
      setSearch("");
      setSelectedUser(null);
      setReason("harassment");
      setDetails("");
    },
    onError: () => toast({ title: "Failed to submit report", variant: "destructive" }),
  });

  return (
    <>
      <Button
        variant="destructive"
        size="sm"
        className="rounded-lg gap-2"
        onClick={() => setOpen(true)}
      >
        <Flag className="w-3.5 h-3.5" /> Report a User
      </Button>

      <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) { setSelectedUser(null); setSearch(""); } }}>
        <DialogContent className="sm:max-w-[420px] rounded-xl p-5">
          <DialogHeader>
            <DialogTitle className="text-base">Report a User</DialogTitle>
            <p className="text-xs text-muted-foreground mt-1">
              Search for the person you want to report. Reports are reviewed by our admin team within 48 hours.
            </p>
          </DialogHeader>

          <div className="space-y-4 mt-2">
            {/* User search */}
            {!selectedUser ? (
              <div className="space-y-2">
                <Label className="text-xs font-semibold">Search by name</Label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                  <input
                    type="text"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder="Type a name..."
                    className="w-full pl-8 pr-3 h-9 rounded-lg border border-border bg-background text-sm outline-none focus:ring-1 focus:ring-primary"
                  />
                  {isFetching && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 animate-spin text-muted-foreground" />}
                </div>
                {search.trim().length >= 2 && (
                  <div className="border border-border/60 rounded-lg overflow-hidden max-h-48 overflow-y-auto">
                    {results.length === 0 && !isFetching ? (
                      <p className="text-xs text-muted-foreground text-center py-4">No users found</p>
                    ) : (
                      results.map((u: any) => (
                        <button
                          key={u.id}
                          onClick={() => setSelectedUser(u)}
                          className="w-full flex items-center gap-2.5 px-3 py-2.5 hover:bg-muted/50 transition-colors text-left"
                        >
                          <Avatar className="w-7 h-7 shrink-0">
                            <AvatarImage src={u.profileImageUrl || ""} />
                            <AvatarFallback className="text-[10px] bg-primary/8 text-primary font-bold">{u.firstName?.[0]}</AvatarFallback>
                          </Avatar>
                          <div className="min-w-0">
                            <p className="text-xs font-semibold truncate">{u.firstName} {u.lastName}</p>
                            <p className="text-[10px] text-muted-foreground capitalize">{u.role} · {u.university}</p>
                          </div>
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-2.5 p-3 rounded-lg bg-muted/40 border border-border/60">
                <Avatar className="w-8 h-8 shrink-0">
                  <AvatarImage src={selectedUser.profileImageUrl || ""} />
                  <AvatarFallback className="text-xs bg-primary/8 text-primary font-bold">{selectedUser.firstName?.[0]}</AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold">{selectedUser.firstName} {selectedUser.lastName}</p>
                  <p className="text-xs text-muted-foreground capitalize">{selectedUser.role} · {selectedUser.university}</p>
                </div>
                <button onClick={() => { setSelectedUser(null); setSearch(""); }} className="text-muted-foreground hover:text-foreground">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            {selectedUser && (
              <>
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Reason</Label>
                  <Select value={reason} onValueChange={setReason}>
                    <SelectTrigger className="h-9 rounded-lg text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="harassment">Harassment</SelectItem>
                      <SelectItem value="spam">Spam</SelectItem>
                      <SelectItem value="inappropriate">Inappropriate content</SelectItem>
                      <SelectItem value="fake">Fake profile</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Details (optional)</Label>
                  <Textarea
                    className="resize-none rounded-lg text-sm min-h-[72px]"
                    placeholder="Describe what happened..."
                    value={details}
                    onChange={e => setDetails(e.target.value)}
                  />
                </div>
              </>
            )}
          </div>

          <DialogFooter className="mt-4">
            <Button variant="outline" size="sm" onClick={() => setOpen(false)}>Cancel</Button>
            <Button
              variant="destructive"
              size="sm"
              disabled={!selectedUser || submitReport.isPending}
              onClick={() => submitReport.mutate()}
            >
              {submitReport.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Submit Report"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export function Help() {
  return (
    <div className="max-w-2xl mx-auto w-full space-y-8 pb-12">
      <Link href="/dashboard" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
        <ArrowLeft className="w-4 h-4" /> Back
      </Link>

      <div>
        <div className="flex items-center gap-3 mb-1">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <HelpCircle className="w-5 h-5 text-primary" />
          </div>
          <h1 className="text-2xl md:text-3xl font-bold font-display">Help & Support</h1>
        </div>
        <p className="text-muted-foreground text-sm mt-2">Everything you need to know about using StudySync safely and effectively.</p>
      </div>

      {/* Safety section */}
      <Card className="rounded-2xl border-destructive/20 bg-destructive/5">
        <CardContent className="p-6 space-y-4">
          <h2 className="text-base font-semibold flex items-center gap-2">
            <Shield className="w-4 h-4 text-destructive" /> Safety & Community Standards
          </h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            StudySync is a peer learning community. All users are expected to treat each other with respect. Harassment, inappropriate content, or academic dishonesty will result in account suspension.
          </p>

          <div className="grid sm:grid-cols-2 gap-3">
            <div className="bg-background rounded-xl p-4 border border-border/50">
              <div className="flex items-center gap-2 mb-2">
                <Ban className="w-4 h-4 text-amber-600" />
                <p className="text-sm font-semibold">Blocking a User</p>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                On any tutor's card in Find Tutors, tap the <strong>⋮</strong> menu and select <strong>Block user</strong>. Blocked users can no longer send you requests or messages.
              </p>
            </div>

            <div className="bg-background rounded-xl p-4 border border-border/50">
              <div className="flex items-center gap-2 mb-2">
                <Flag className="w-4 h-4 text-destructive" />
                <p className="text-sm font-semibold">Reporting a User</p>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Use the button below to search for a user by name and submit a report. Choose a reason and describe the issue. Reports go directly to our admin team.
              </p>
            </div>
          </div>

          <div className="bg-background rounded-xl p-4 border border-border/50">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className="w-4 h-4 text-amber-600" />
              <p className="text-sm font-semibold">What happens after a report?</p>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Our admin team reviews every report within 48 hours. Depending on severity, actions range from a warning to permanent account suspension. Banned users lose all access immediately. Reports are kept confidential.
            </p>
          </div>

          <div className="flex flex-wrap gap-3 pt-1">
            <BlockUserDialog />
            <ReportUserDialog />
          </div>
        </CardContent>
      </Card>

      {/* How it works */}
      <Card className="rounded-2xl border-border/50">
        <CardContent className="p-6 space-y-4">
          <h2 className="text-base font-semibold flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-primary" /> How StudySync Works
          </h2>
          <div className="space-y-3">
            {[
              { icon: Users, title: "Students find tutors", desc: "Browse tutors filtered by course, then send a session request. Tutors cannot initiate — they only respond to requests." },
              { icon: MessageSquare, title: "Chat & coordinate", desc: "Once a tutor accepts your request, a shared workspace opens. Use the chat to agree on a time, share notes, and ask questions." },
              { icon: BookOpen, title: "Complete sessions", desc: "After your session, the tutor or student marks it as completed. Both parties can then leave a star rating and review." },
              { icon: Star, title: "Build your reputation", desc: "Reviews are public and help other students find great tutors. Good tutors with high ratings appear more prominently." },
            ].map(({ icon: Icon, title, desc }) => (
              <div key={title} className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-primary/8 flex items-center justify-center shrink-0 mt-0.5">
                  <Icon className="w-3.5 h-3.5 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-semibold">{title}</p>
                  <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* FAQs */}
      <div>
        <h2 className="text-base font-semibold mb-4 flex items-center gap-2">
          <HelpCircle className="w-4 h-4 text-primary" /> Frequently Asked Questions
        </h2>
        <div className="space-y-2">
          {faqs.map((f) => (
            <FAQ key={f.q} q={f.q} a={f.a} />
          ))}
        </div>
      </div>

      {/* Contact */}
      <Card className="rounded-2xl border-border/50">
        <CardContent className="p-6">
          <h2 className="text-base font-semibold mb-2 flex items-center gap-2">
            <Mail className="w-4 h-4 text-primary" /> Still need help?
          </h2>
          <p className="text-sm text-muted-foreground mb-4 leading-relaxed">
            If you can't find the answer above or need to escalate a safety concern, contact our support team. We aim to respond within 24 hours.
          </p>
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm">
              <Mail className="w-3.5 h-3.5 text-muted-foreground" />
              <span className="text-muted-foreground">General support:</span>
              <a href="mailto:tno.godson@gmail.com" className="font-medium hover:underline">tno.godson@gmail.com</a>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <Flag className="w-3.5 h-3.5 text-muted-foreground" />
              <span className="text-muted-foreground">Report abuse:</span>
              <a href="mailto:tno.godson@gmail.com" className="font-medium hover:underline">tno.godson@gmail.com</a>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
