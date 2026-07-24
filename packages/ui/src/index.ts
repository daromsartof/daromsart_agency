// Utilitaires
export { cn } from "./lib/utils";
export {
  parseAmountToCents,
  formatCentsToInput,
  formatCentsEUR,
} from "./lib/money";
export { initials } from "./lib/format";

// Primitives ShadCN
export {
  Button,
  buttonVariants,
  type ButtonProps,
} from "./components/ui/button";
export { Input } from "./components/ui/input";
export { Textarea } from "./components/ui/textarea";
export { Label } from "./components/ui/label";
export { Badge, badgeVariants, type BadgeProps } from "./components/ui/badge";
export {
  Card,
  CardHeader,
  CardFooter,
  CardTitle,
  CardDescription,
  CardContent,
} from "./components/ui/card";
export { Separator } from "./components/ui/separator";
export { Skeleton } from "./components/ui/skeleton";
export { Avatar, AvatarImage, AvatarFallback } from "./components/ui/avatar";
export { Switch } from "./components/ui/switch";
export { Progress } from "./components/ui/progress";
export {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
  TooltipProvider,
} from "./components/ui/tooltip";
export {
  Dialog,
  DialogPortal,
  DialogOverlay,
  DialogTrigger,
  DialogClose,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
} from "./components/ui/dialog";
export {
  Sheet,
  SheetPortal,
  SheetOverlay,
  SheetTrigger,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetFooter,
  SheetTitle,
  SheetDescription,
} from "./components/ui/sheet";
export {
  AlertDialog,
  AlertDialogPortal,
  AlertDialogOverlay,
  AlertDialogTrigger,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogAction,
  AlertDialogCancel,
} from "./components/ui/alert-dialog";
export {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuCheckboxItem,
  DropdownMenuRadioItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuGroup,
  DropdownMenuPortal,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuRadioGroup,
} from "./components/ui/dropdown-menu";
export {
  Select,
  SelectGroup,
  SelectValue,
  SelectTrigger,
  SelectContent,
  SelectLabel,
  SelectItem,
  SelectSeparator,
  SelectScrollUpButton,
  SelectScrollDownButton,
} from "./components/ui/select";
export { Tabs, TabsList, TabsTrigger, TabsContent } from "./components/ui/tabs";
export {
  Popover,
  PopoverTrigger,
  PopoverContent,
  PopoverAnchor,
} from "./components/ui/popover";
export {
  Command,
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandShortcut,
  CommandSeparator,
} from "./components/ui/command";
export { Calendar, type CalendarProps } from "./components/ui/calendar";
export {
  Table,
  TableHeader,
  TableBody,
  TableFooter,
  TableHead,
  TableRow,
  TableCell,
  TableCaption,
} from "./components/ui/table";
export { Toaster, toast } from "./components/ui/sonner";
export {
  useFormField,
  Form,
  FormItem,
  FormLabel,
  FormControl,
  FormDescription,
  FormMessage,
  FormField,
} from "./components/ui/form";

// Composés
export { MoneyInput, type MoneyInputProps } from "./components/money-input";
export { PageHeader, type PageHeaderProps } from "./components/page-header";
export { EmptyState, type EmptyStateProps } from "./components/empty-state";
export {
  StatCard,
  type StatCardProps,
  type StatCardTone,
} from "./components/stat-card";
export {
  StatusBadge,
  STATUS_MAP,
  type StatusBadgeProps,
  type DocumentStatus,
} from "./components/status-badge";
export {
  ConfirmDialog,
  type ConfirmDialogProps,
} from "./components/confirm-dialog";
export { DatePicker, type DatePickerProps } from "./components/date-picker";
export { DataTable, type DataTableProps } from "./components/data-table";
export {
  AppShell,
  type AppShellProps,
  type NavItem,
  type NavSection,
} from "./components/app-shell";
export {
  Stepper,
  type StepperProps,
  type StepperStep,
} from "./components/stepper";

// Ré-exports de types tiers utiles aux apps
export type { ColumnDef } from "@tanstack/react-table";
