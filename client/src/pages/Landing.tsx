import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { GraduationCap, ArrowRight, BookOpen, Users, Zap, Shield } from "lucide-react";
import { motion } from "framer-motion";

const fade = (delay = 0) => ({
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.5, delay, ease: [0.25, 0.46, 0.45, 0.94] },
});

export function Landing() {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Nav */}
      <header className="border-b border-border/50">
        <div className="max-w-6xl mx-auto px-6 h-16 flex justify-between items-center">
          <div className="flex items-center gap-2.5">
            <img src="/favicon-96x96.png" alt="StudySync" className="w-7 h-7" />
            <span className="text-lg font-bold tracking-tight">StudySync</span>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/auth">
              <Button variant="ghost" size="sm" className="text-sm font-medium hidden sm:flex">Sign in</Button>
            </Link>
            <Link href="/auth">
              <Button size="sm" className="text-sm font-semibold rounded-lg px-4">
                Get Started <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <main className="flex-1 flex flex-col">
        <section className="max-w-6xl mx-auto px-6 pt-20 pb-24 md:pt-28 md:pb-32">
          <motion.div {...fade(0)} className="max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/8 text-primary text-xs font-semibold mb-6 border border-primary/12">
              <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
              Peer Tutoring Platform
            </div>

            <h1 className="text-4xl sm:text-5xl md:text-6xl font-extrabold leading-[1.08] tracking-tight text-foreground">
              Learn from peers
              <br />
              who've been there.
            </h1>

            <p className="mt-5 text-lg text-muted-foreground leading-relaxed max-w-lg">
              Connect with top students at your university who have already aced your courses. Book sessions, chat, and improve your grades together.
            </p>

            <div className="flex flex-col sm:flex-row gap-3 mt-8">
              <Link href="/auth">
                <Button size="lg" className="h-12 px-6 text-sm font-semibold rounded-lg shadow-sm">
                  Start learning <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </Link>
              <Link href="/auth">
                <Button size="lg" variant="outline" className="h-12 px-6 text-sm font-semibold rounded-lg">
                  Become a tutor
                </Button>
              </Link>
            </div>
          </motion.div>
        </section>

        {/* Features */}
        <section className="border-t border-border/50 bg-muted/30">
          <div className="max-w-6xl mx-auto px-6 py-20 md:py-24">
            <motion.div {...fade(0.1)}>
              <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3">Why StudySync</p>
              <h2 className="text-2xl md:text-3xl font-bold tracking-tight max-w-md">
                Everything you need to succeed academically.
              </h2>
            </motion.div>

            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6 mt-12">
              {[
                { icon: Users, title: "Peer Matching", desc: "Find tutors from your university who've excelled in your exact courses." },
                { icon: BookOpen, title: "Course Focused", desc: "Filter by specific courses to find the most relevant help." },
                { icon: Zap, title: "Instant Booking", desc: "Request sessions in seconds. Tutors respond quickly." },
                { icon: Shield, title: "Verified Tutors", desc: "All tutors are verified students at accredited universities." },
              ].map((feature, i) => (
                <motion.div key={feature.title} {...fade(0.15 + i * 0.05)}
                  className="p-5 rounded-xl border border-border/60 bg-card hover:shadow-elevated transition-shadow">
                  <div className="w-9 h-9 rounded-lg bg-primary/8 flex items-center justify-center mb-4">
                    <feature.icon className="w-4.5 h-4.5 text-primary" />
                  </div>
                  <h3 className="font-semibold text-sm mb-1.5">{feature.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{feature.desc}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="border-t border-border/50">
          <div className="max-w-6xl mx-auto px-6 py-20 md:py-24 text-center">
            <motion.div {...fade(0.1)}>
              <h2 className="text-2xl md:text-3xl font-bold tracking-tight">Ready to improve your grades?</h2>
              <p className="text-muted-foreground mt-3 max-w-md mx-auto">
                Join students across Ghana who are learning smarter with peer tutoring.
              </p>
              <Link href="/auth">
                <Button size="lg" className="mt-8 h-12 px-8 text-sm font-semibold rounded-lg shadow-sm">
                  Get started for free <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </Link>
            </motion.div>
          </div>
        </section>

        {/* Footer */}
        <footer className="border-t border-border/50 py-6">
          <div className="max-w-6xl mx-auto px-6 flex flex-col sm:flex-row justify-between items-center gap-4">
            <div className="flex items-center gap-2">
              <img src="/favicon-96x96.png" alt="StudySync" className="w-5 h-5" />
              <span className="text-sm font-semibold">StudySync</span>
            </div>
            <p className="text-xs text-muted-foreground">Built as a thesis project. All rights reserved.</p>
          </div>
        </footer>
      </main>
    </div>
  );
}
