import type { ChannelAdapter, NormalizedMessage } from "./types";
import { whatsappAdapter } from "./whatsapp";
import { facebookAdapter } from "./facebook";
import { instagramAdapter } from "./instagram";

export const adapters = {
  whatsapp: whatsappAdapter,
  facebook: facebookAdapter,
  instagram: instagramAdapter,
} as const;

export type ChannelType = keyof typeof adapters;

export function getAdapter(type: ChannelType): ChannelAdapter {
  return adapters[type];
}

export type { NormalizedMessage } from "./types";