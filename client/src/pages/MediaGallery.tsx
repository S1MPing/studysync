import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { Link } from "wouter";
import { format } from "date-fns";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import {
  ImageIcon, Video, FileText, Loader2, Download, ExternalLink,
  ArrowLeft, FolderOpen
} from "lucide-react";

function useFileMessages() {
  return useQuery({
    queryKey: ["/api/messages/files"],
    queryFn: async () => {
      const res = await fetch("/api/messages/files", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load files");
      return res.json() as Promise<any[]>;
    },
  });
}

export function MediaGallery() {
  const { user } = useAuth();
  const { data: files = [], isLoading } = useFileMessages();
  const [lightbox, setLightbox] = useState<any | null>(null);

  const images = files.filter(f => f.type === "image");
  const videos = files.filter(f => f.type === "video");
  const docs = files.filter(f => f.type === "document");

  return (
    <div className="max-w-4xl mx-auto w-full space-y-6 pb-12">
      <div className="flex items-center gap-3">
        <Link href="/sessions" className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1">
          <ArrowLeft className="w-3.5 h-3.5" /> Back
        </Link>
      </div>

      <div>
        <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
          <FolderOpen className="w-6 h-6 text-primary" /> Shared Files
        </h1>
        <p className="text-muted-foreground text-sm mt-1">All photos, videos, and documents shared across your sessions.</p>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : files.length === 0 ? (
        <Card className="rounded-xl border-dashed border-border/60">
          <CardContent className="p-12 text-center">
            <FolderOpen className="w-12 h-12 text-muted-foreground/20 mx-auto mb-3" />
            <p className="font-semibold text-sm">No files yet</p>
            <p className="text-xs text-muted-foreground mt-1">Files shared in sessions will appear here.</p>
          </CardContent>
        </Card>
      ) : (
        <Tabs defaultValue="images">
          <TabsList className="rounded-lg">
            <TabsTrigger value="images" className="text-xs gap-1.5">
              <ImageIcon className="w-3.5 h-3.5" /> Photos ({images.length})
            </TabsTrigger>
            <TabsTrigger value="videos" className="text-xs gap-1.5">
              <Video className="w-3.5 h-3.5" /> Videos ({videos.length})
            </TabsTrigger>
            <TabsTrigger value="docs" className="text-xs gap-1.5">
              <FileText className="w-3.5 h-3.5" /> Documents ({docs.length})
            </TabsTrigger>
          </TabsList>

          {/* Images */}
          <TabsContent value="images" className="mt-4">
            {images.length === 0 ? (
              <EmptyTab label="No photos shared yet" />
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                {images.map(f => (
                  <div key={f.id} className="group relative aspect-square rounded-xl overflow-hidden border border-border/60 cursor-pointer hover:border-primary/40 transition-all"
                    onClick={() => setLightbox(f)}>
                    <img src={f.fileUrl} alt={f.content || "Photo"} className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-2">
                      <div>
                        <p className="text-white text-[10px] font-semibold truncate">{f.course?.code}</p>
                        <p className="text-white/70 text-[9px]">{format(new Date(f.createdAt), "MMM d, yyyy")}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          {/* Videos */}
          <TabsContent value="videos" className="mt-4">
            {videos.length === 0 ? (
              <EmptyTab label="No videos shared yet" />
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {videos.map(f => (
                  <Card key={f.id} className="rounded-xl border-border/60 overflow-hidden">
                    <video controls className="w-full aspect-video bg-muted">
                      <source src={f.fileUrl} />
                    </video>
                    <div className="p-3 flex items-center justify-between">
                      <div>
                        <p className="text-xs font-semibold truncate">{f.content || "Video"}</p>
                        <p className="text-[10px] text-muted-foreground">{f.course?.code} · {format(new Date(f.createdAt), "MMM d, yyyy")}</p>
                      </div>
                      <a href={f.fileUrl} download={f.content || "video"}>
                        <Button variant="ghost" size="icon" className="w-7 h-7">
                          <Download className="w-3.5 h-3.5" />
                        </Button>
                      </a>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* Documents */}
          <TabsContent value="docs" className="mt-4">
            {docs.length === 0 ? (
              <EmptyTab label="No documents shared yet" />
            ) : (
              <div className="space-y-2">
                {docs.map(f => (
                  <Card key={f.id} className="rounded-xl border-border/60 hover:border-primary/30 transition-colors">
                    <CardContent className="p-4 flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center shrink-0">
                        <FileText className="w-5 h-5 text-blue-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold truncate">{f.content || "Document"}</p>
                        <p className="text-[10px] text-muted-foreground">
                          {f.course?.code} · {f.sender?.firstName} {f.sender?.lastName} · {format(new Date(f.createdAt), "MMM d, yyyy")}
                        </p>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <a href={f.fileUrl} target="_blank" rel="noreferrer">
                          <Button variant="ghost" size="icon" className="w-7 h-7">
                            <ExternalLink className="w-3.5 h-3.5" />
                          </Button>
                        </a>
                        <a href={f.fileUrl} download={f.content || "document"}>
                          <Button variant="ghost" size="icon" className="w-7 h-7">
                            <Download className="w-3.5 h-3.5" />
                          </Button>
                        </a>
                        <Link href={`/sessions/${f.sessionId}`}>
                          <Button variant="outline" size="sm" className="h-7 text-[10px] rounded-md px-2.5">View session</Button>
                        </Link>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      )}

      {/* Lightbox */}
      <Dialog open={!!lightbox} onOpenChange={() => setLightbox(null)}>
        <DialogContent className="max-w-3xl p-2 rounded-xl">
          {lightbox && (
            <div className="space-y-2">
              <img src={lightbox.fileUrl} alt={lightbox.content || "Photo"} className="w-full rounded-lg max-h-[70vh] object-contain" />
              <div className="flex items-center justify-between px-2 pb-1">
                <div>
                  <p className="text-xs font-semibold">{lightbox.course?.code} · {lightbox.sender?.firstName} {lightbox.sender?.lastName}</p>
                  <p className="text-[10px] text-muted-foreground">{format(new Date(lightbox.createdAt), "MMMM d, yyyy 'at' h:mm a")}</p>
                </div>
                <div className="flex gap-2">
                  <a href={lightbox.fileUrl} download={lightbox.content || "photo"}>
                    <Button variant="outline" size="sm" className="h-7 text-xs rounded-md gap-1.5">
                      <Download className="w-3 h-3" /> Download
                    </Button>
                  </a>
                  <Link href={`/sessions/${lightbox.sessionId}`} onClick={() => setLightbox(null)}>
                    <Button size="sm" className="h-7 text-xs rounded-md gap-1.5">
                      <ExternalLink className="w-3 h-3" /> View session
                    </Button>
                  </Link>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function EmptyTab({ label }: { label: string }) {
  return (
    <div className="py-14 text-center text-sm text-muted-foreground">
      <FolderOpen className="w-8 h-8 text-muted-foreground/20 mx-auto mb-2" />
      {label}
    </div>
  );
}
