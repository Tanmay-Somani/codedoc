"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  Bot,
  Eye,
  EyeOff,
  Info,
  KeyRound,
  Lock,
  Map,
  Save,
  ShieldCheck,
} from "lucide-react";
import { toast } from "sonner";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/page-header";
import { resetTour } from "@/lib/tour";

const llmProviders = [
  {
    id: "openrouter",
    name: "OpenRouter",
    desc: "Primary — one key routes to many models",
    primary: true,
    keys: ["API key"],
  },
  { id: "gemini", name: "Gemini", desc: "Google AI", keys: ["API key"] },
  { id: "groq", name: "Groq", desc: "Fast inference", keys: ["API key"] },
  { id: "openai", name: "OpenAI", desc: "Optional", keys: ["API key"] },
  { id: "anthropic", name: "Anthropic", desc: "Optional", keys: ["API key"] },
];

const externalServices = [
  { id: "github", name: "GitHub", keys: ["Token"] },
  { id: "search", name: "Search (SearXNG)", keys: ["URL"] },
  { id: "nvd", name: "NVD", keys: [] },
  { id: "stackexchange", name: "Stack Exchange", keys: [] },
];

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.06,
      delayChildren: 0.1,
    },
  },
};

const item = {
  hidden: { opacity: 0, y: 8 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.35, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] },
  },
};

export default function SettingsPage() {
  const router = useRouter();
  const [show, setShow] = useState<Record<string, boolean>>({});
  const [values, setValues] = useState<Record<string, string>>({});

  const restartTour = () => {
    resetTour();
    router.push("/repositories?tour=1");
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
    >
      <PageHeader
        title="Settings"
        description="Configure providers and encrypted API keys"
      >
        <Badge className="gap-1.5" variant="success">
          <Lock className="h-3 w-3" />
          Keys encrypted at rest
        </Badge>
      </PageHeader>

      <motion.div
        className="space-y-6"
        variants={container}
        initial="hidden"
        animate="show"
      >
        <motion.div variants={item}>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Bot className="h-4 w-4 text-primary" />
                AI Providers
              </CardTitle>
              <CardDescription>
                Keys never leave the server, are never logged, and are encrypted
                before storage.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {llmProviders.map((p, idx) => (
                <div key={p.id}>
                  {idx > 0 && <Separator className="mb-4" />}
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{p.name}</span>
                      {p.primary && <Badge>Primary</Badge>}
                    </div>
                    <p className="text-xs text-muted-foreground">{p.desc}</p>
                  </div>
                  {p.keys.map((k) => {
                    const keyName = `${p.id}__${k}`;
                    const shown = show[keyName];
                    return (
                      <div key={k} className="mt-2 flex items-center gap-2">
                        <KeyRound className="h-4 w-4 shrink-0 text-muted-foreground" />
                        <div className="relative flex-1">
                          <Input
                            type={shown ? "text" : "password"}
                            placeholder={`${p.name} ${k.toLowerCase()}`}
                            value={values[keyName] ?? ""}
                            onChange={(e) =>
                              setValues((v) => ({ ...v, [keyName]: e.target.value }))
                            }
                            className="pr-10"
                          />
                          <button
                            type="button"
                            onClick={() =>
                              setShow((s) => ({ ...s, [keyName]: !s[keyName] }))
                            }
                            aria-label={shown ? `Hide ${p.name} ${k.toLowerCase()}` : `Show ${p.name} ${k.toLowerCase()}`}
                            aria-pressed={shown}
                            className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors duration-200"
                          >
                            {shown ? (
                              <EyeOff className="h-4 w-4" />
                            ) : (
                              <Eye className="h-4 w-4" />
                            )}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ))}
            </CardContent>
          </Card>
        </motion.div>

        <motion.div variants={item}>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <ShieldCheck className="h-4 w-4 text-primary" />
                External Services
              </CardTitle>
              <CardDescription>
                Optional data sources for enrichment and research.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {externalServices.map((p) => {
                const enabled = values[`enabled__${p.id}`];
                const keyName = `${p.id}__key`;
                return (
                  <div key={p.id}>
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="font-medium">{p.name}</span>
                        {p.keys.length === 0 && (
                          <Badge variant="secondary" className="ml-2">
                            No key needed
                          </Badge>
                        )}
                      </div>
                      <button
                        type="button"
                        role="switch"
                        aria-checked={!!enabled}
                        aria-label={`Toggle ${p.name}`}
                        onClick={() =>
                          setValues((v) => ({
                            ...v,
                            [`enabled__${p.id}`]: enabled ? "" : "on",
                          }))
                        }
                        className={`relative h-5 w-9 rounded-full transition-colors duration-300 ease-out-expo ${
                          enabled ? "bg-primary" : "bg-muted"
                        }`}
                      >
                        <span
                          className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition-all duration-300 ease-out-expo ${
                            enabled ? "translate-x-4" : "translate-x-0.5"
                          }`}
                        />
                      </button>
                    </div>
                    {enabled &&
                      p.keys.map((k) => (
                        <Input
                          key={k}
                          className="mt-2"
                          type="password"
                          placeholder={`${p.name} ${k.toLowerCase()}`}
                          value={values[keyName] ?? ""}
                          onChange={(e) =>
                            setValues((v) => ({ ...v, [keyName]: e.target.value }))
                          }
                        />
                      ))}
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </motion.div>

        <motion.div variants={item}>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Map className="h-4 w-4 text-primary" />
                Help
              </CardTitle>
              <CardDescription>
                Replay the interactive onboarding tour that walks you through
                connecting a repository and scanning the sample.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button variant="outline" onClick={restartTour} className="gap-1.5">
                <Map className="h-4 w-4" />
                Restart guided tour
              </Button>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          variants={item}
          className="flex flex-col items-end gap-2"
        >
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Info className="h-3.5 w-3.5" />
            Settings are applied locally — syncing to the server is coming soon.
          </div>
          <Button
            className="gap-1.5"
            onClick={() =>
              toast.info("Settings kept locally — server sync coming soon.")
            }
          >
            <Save className="h-4 w-4" />
            Save settings
          </Button>
        </motion.div>
      </motion.div>
    </motion.div>
  );
}
