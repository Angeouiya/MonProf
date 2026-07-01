"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Search } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";

type Option = { slug: string; name: string };

export function HomeSearchBar({
  subjects,
  levels,
  communes,
}: {
  subjects: Option[];
  levels: Option[];
  communes: Option[];
}) {
  const router = useRouter();
  const [subject, setSubject] = useState<string>("all");
  const [level, setLevel] = useState<string>("all");
  const [commune, setCommune] = useState<string>("all");

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const params = new URLSearchParams();
    if (subject && subject !== "all") params.set("subject", subject);
    if (level && level !== "all") params.set("level", level);
    if (commune && commune !== "all") params.set("commune", commune);
    router.push(`/professeurs?${params.toString()}`);
  }

  return (
    <form
      onSubmit={submit}
      className="mx-auto flex w-full max-w-4xl flex-col gap-3 rounded-2xl border border-border bg-white p-3 shadow-sm sm:flex-row sm:items-center"
    >
      <div className="grid flex-1 grid-cols-1 gap-2 sm:grid-cols-3">
        <SelectField
          value={subject}
          onChange={setSubject}
          placeholder="Matière"
          options={subjects}
        />
        <SelectField
          value={level}
          onChange={setLevel}
          placeholder="Niveau"
          options={levels}
        />
        <SelectField
          value={commune}
          onChange={setCommune}
          placeholder="Commune"
          options={communes}
        />
      </div>
      <Button
        type="submit"
        size="lg"
        className="w-full sm:w-auto"
      >
        <Search className="mr-1.5 h-4 w-4" />
        Rechercher
      </Button>
    </form>
  );
}

function SelectField({
  value,
  onChange,
  placeholder,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  options: Option[];
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="w-full">
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">Toutes / Tous</SelectItem>
        {options.map((o) => (
          <SelectItem key={o.slug} value={o.slug}>
            {o.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
