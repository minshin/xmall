import {
  Activity, AppWindow, BatteryFull, Calendar, Camera, CircleDot, Cpu, Fingerprint, Gauge, HardDrive, Keyboard, Laptop, Layers,
  MemoryStick, Monitor, MonitorSmartphone, Mouse, Palette, Plug, Printer, Ruler, Scan, Server, ShieldCheck, Signal, Smartphone,
  Speaker, Tablet, Usb, Weight, Wifi, type LucideIcon,
} from "lucide-react";

/**
 * スペック項目・品目に付けられるアイコン（管理画面で名前を選ぶ）。
 * 名前は lucide のケバブケース名に合わせる。増やすときはここに足す。
 */
export const ICONS: Record<string, LucideIcon> = {
  activity: Activity,
  "app-window": AppWindow,
  "battery-full": BatteryFull,
  calendar: Calendar,
  camera: Camera,
  cpu: Cpu,
  fingerprint: Fingerprint,
  gauge: Gauge,
  "hard-drive": HardDrive,
  keyboard: Keyboard,
  laptop: Laptop,
  layers: Layers,
  "memory-stick": MemoryStick,
  monitor: Monitor,
  "monitor-smartphone": MonitorSmartphone,
  mouse: Mouse,
  palette: Palette,
  plug: Plug,
  printer: Printer,
  ruler: Ruler,
  scan: Scan,
  server: Server,
  "shield-check": ShieldCheck,
  signal: Signal,
  smartphone: Smartphone,
  speaker: Speaker,
  tablet: Tablet,
  usb: Usb,
  weight: Weight,
  wifi: Wifi,
};

export const ICON_NAMES = Object.keys(ICONS).sort();

export function Icon({ name, size = 16, className, strokeWidth = 1.7 }: { name: string | null | undefined; size?: number; className?: string; strokeWidth?: number }) {
  const C = (name && ICONS[name]) || CircleDot;
  return <C size={size} className={className} strokeWidth={strokeWidth} aria-hidden="true" />;
}
