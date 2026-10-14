"use client";

import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis, Legend } from "recharts";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import type { MessagesPerDay } from "@/app/(workspace)/dashboard/queries";

const COLORS = {
  whatsapp: "#22c55e",
  facebook: "#3b82f6",
  instagram: "#ec4899",
} as const;

export function MessagesChart({ data }: { data: MessagesPerDay[] }) {
  if (data.every((d) => d.whatsapp + d.facebook + d.instagram === 0)) {
    return (
      <div className="flex h-[280px] items-center justify-center rounded-md border bg-muted/20 text-sm text-muted-foreground">
        Aún no hay mensajes en los últimos {data.length} días.
      </div>
    );
  }

  return (
    <div className="h-[280px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 10, right: 16, left: 0, bottom: 0 }}>
          <XAxis
            dataKey="date"
            tickFormatter={(v) => format(parseISO(v), "d MMM", { locale: es })}
            stroke="#94a3b8"
            fontSize={11}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            allowDecimals={false}
            stroke="#94a3b8"
            fontSize={11}
            tickLine={false}
            axisLine={false}
            width={28}
          />
          <Tooltip
            contentStyle={{
              borderRadius: 8,
              border: "1px solid #e2e8f0",
              fontSize: 12,
            }}
            labelFormatter={(v) => format(parseISO(String(v)), "EEEE d 'de' MMMM", { locale: es })}
          />
          <Legend
            iconType="circle"
            wrapperStyle={{ fontSize: 12, paddingTop: 8 }}
            formatter={(v) =>
              v === "whatsapp" ? "WhatsApp" : v === "facebook" ? "Messenger" : "Instagram"
            }
          />
          <Line type="monotone" dataKey="whatsapp" stroke={COLORS.whatsapp} strokeWidth={2} dot={false} />
          <Line type="monotone" dataKey="facebook" stroke={COLORS.facebook} strokeWidth={2} dot={false} />
          <Line type="monotone" dataKey="instagram" stroke={COLORS.instagram} strokeWidth={2} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}