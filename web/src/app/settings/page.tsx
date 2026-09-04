"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  Bot,
  Check,
  ChevronDown,
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
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/page-header";
import { DropdownMenu } from "@/components/dropdown-menu";
import { resetTour } from "@/lib/tour";
import { cn } from "@/lib/utils";

const llmProviders = [
  {
    id: "openrouter",
    name: "OpenRouter",
    desc: "Primary — one key routes to many models",
    primary: true,
    key: "API key",
  },
  { id: "gemini", name: "Gemini", desc: "Google AI", key: "API key" },
  { id: "groq", name: "Groq", desc: "Fast inference", key: "API key" },
  { id: "openai", name: "OpenAI", desc: "Optional", key: "API key" },
  { id: "anthropic", name: "Anthropic", desc: "Optional", key: "API key" },
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
  const [activeProviderId, setActiveProviderId] = useState("openrouter");

  const restartTour = () => {
    resetTour();
    router.push("/repositories?tour=1");
  };

  const activeProvider =
    llmProviders.find((p) => p.id === activeProviderId) ?? llmProviders[0];
  const activeKeyName = `${activeProvider.id}__key`;
  const activeShown = show[activeKeyName];

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
              <div>
                <label className="text-xs font-medium text-muted-foreground">
                  Provider
                </label>
                <DropdownMenu
                  align="left"
                  className="mt-1.5"
                  items={llmProviders.map((p) => ({
                    label: p.name,
                    description: p.desc,
                    onSelect: () => setActiveProviderId(p.id),
                    icon: p.primary ? Check : undefined,
                  }))}
                  trigger={(open) => (
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full justify-between"
                    >
                      <span className="flex flex-col items-start">
                        <span>{activeProvider.name}</span>
                        <span className="text-xs font-normal text-muted-foreground">
                          {activeProvider.desc}
                        </span>
                      </span>
                      <span className="flex items-center gap-2">
                        {activeProvider.primary && <Badge>Primary</Badge>}
                        <ChevronDown
                          className={cn(
                            "h-4 w-4 transition-transform duration-200",
                            open && "rotate-180"
                          )}
                        />
                      </span>
                    </Button>
                  )}
                />
              </div>

              <div className="flex items-center gap-2">
                <KeyRound className="h-4 w-4 shrink-0 text-muted-foreground" />
                <div className="relative flex-1">
                  <Input
                    type={activeShown ? "text" : "password"}
                    placeholder={`${activeProvider.name} API key`}
                    value={values[activeKeyName] ?? ""}
                    onChange={(e) =>
                      setValues((v) => ({ ...v, [activeKeyName]: e.target.value }))
                    }
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() =>
                      setShow((s) => ({ ...s, [activeKeyName]: !s[activeKeyName] }))
                    }
                    aria-label={
                      activeShown
                        ? `Hide ${activeProvider.name} API key`
                        : `Show ${activeProvider.name} API key`
                    }
                    aria-pressed={activeShown}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors duration-200"
                  >
                    {activeShown ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>
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
                          className={`absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition-transform duration-300 ease-out-expo ${
                            enabled ? "translate-x-4" : "translate-x-0"
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
