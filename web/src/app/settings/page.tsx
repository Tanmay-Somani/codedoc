"use client";

import { useState } from "react";
import {
  Bot,
  Check,
  Eye,
  EyeOff,
  KeyRound,
  Lock,
  Save,
  ShieldCheck,
} from "lucide-react";
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

export default function SettingsPage() {
  const [show, setShow] = useState<Record<string, boolean>>({});
  const [values, setValues] = useState<Record<string, string>>({});

  return (
    <div>
      <PageHeader
        title="Settings"
        description="Configure providers and encrypted API keys"
      >
        <Badge className="gap-1.5" variant="success">
          <Lock className="h-3 w-3" />
          Keys encrypted at rest
        </Badge>
      </PageHeader>

      <div className="space-y-6">
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
                          className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
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
                      onClick={() =>
                        setValues((v) => ({
                          ...v,
                          [`enabled__${p.id}`]: enabled ? "" : "on",
                        }))
                      }
                      className={`relative h-5 w-9 rounded-full transition-colors ${
                        enabled ? "bg-primary" : "bg-muted"
                      }`}
                    >
                      <span
                        className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-transform ${
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

        <div className="flex justify-end">
          <Button className="gap-1.5">
            <Save className="h-4 w-4" />
            Save settings
          </Button>
        </div>
      </div>
    </div>
  );
}
