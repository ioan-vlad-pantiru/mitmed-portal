// Iconițe — wrapper subțire peste lucide-react. Numele de export rămân
// aceleași (IconCalendar, IconUsers, …) ca niciun alt fișier din portal să
// nu trebuiască schimbat — doar implementarea de dedesubt s-a mutat de la
// SVG-uri desenate de mână la Lucide.
import {
  Calendar,
  Users,
  Activity,
  Tag,
  Coins,
  AlertTriangle,
  Sparkles,
  Clock,
  Inbox,
  BarChart3,
  FileText,
  Pencil,
  Trash2,
  Power,
  X,
  Search,
  Package,
  ChevronLeft,
  ChevronRight,
  Shield,
  type LucideIcon,
} from "lucide-react";

type IconProps = { className?: string };

function wrap(Icon: LucideIcon) {
  return function IconWrapper({ className }: IconProps) {
    return <Icon className={className} strokeWidth={1.75} />;
  };
}

export const IconCalendar = wrap(Calendar);
export const IconUsers = wrap(Users);
export const IconTherapy = wrap(Activity);
export const IconTag = wrap(Tag);
export const IconCoin = wrap(Coins);
export const IconAlert = wrap(AlertTriangle);
export const IconSparkle = wrap(Sparkles);
export const IconPending = wrap(Clock);
export const IconInbox = wrap(Inbox);
export const IconChart = wrap(BarChart3);
export const IconFileText = wrap(FileText);
export const IconEdit = wrap(Pencil);
export const IconTrash = wrap(Trash2);
export const IconPower = wrap(Power);
export const IconClose = wrap(X);
export const IconSearch = wrap(Search);
export const IconPackage = wrap(Package);
export const IconChevronLeft = wrap(ChevronLeft);
export const IconChevronRight = wrap(ChevronRight);
export const IconShield = wrap(Shield);
