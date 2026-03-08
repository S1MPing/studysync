import { Link } from "wouter";
import { useI18n } from "@/lib/i18n";
import { GraduationCap, ArrowLeft, Users, Calendar, MessageSquare, Star, Code } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

export function About() {
  const { t } = useI18n();

  const features = [
    { icon: Users, text: t("about.feature1") },
    { icon: Calendar, text: t("about.feature2") },
    { icon: MessageSquare, text: t("about.feature3") },
    { icon: Star, text: t("about.feature4") },
  ];

  return (
    <div className="max-w-2xl mx-auto w-full space-y-8 pb-12">
      <Link href="/dashboard" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
        <ArrowLeft className="w-4 h-4" /> {t("about.back")}
      </Link>

      <div className="text-center">
        <img src="/icon-192.png" alt="StudySync" className="w-16 h-16 mx-auto mb-4" />
        <h1 className="text-3xl font-bold font-display">{t("about.title")}</h1>
        <p className="text-sm text-muted-foreground mt-1">{t("about.version")}</p>
      </div>

      <Card className="rounded-2xl border-border/50">
        <CardContent className="p-6">
          <p className="text-sm text-muted-foreground leading-relaxed">
            {t("about.description")}
          </p>
        </CardContent>
      </Card>

      <Card className="rounded-2xl border-border/50">
        <CardContent className="p-6">
          <h2 className="text-lg font-semibold mb-2">{t("about.mission")}</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            {t("about.missionText")}
          </p>
        </CardContent>
      </Card>

      <Card className="rounded-2xl border-border/50">
        <CardContent className="p-6">
          <h2 className="text-lg font-semibold mb-4">{t("about.features")}</h2>
          <div className="space-y-3">
            {features.map((f, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                  <f.icon className="w-4 h-4 text-primary" />
                </div>
                <p className="text-sm">{f.text}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="text-center">
        <p className="text-xs text-muted-foreground flex items-center justify-center gap-1">
          <Code className="w-3.5 h-3.5" /> {t("about.builtWith")}
        </p>
      </div>
    </div>
  );
}
