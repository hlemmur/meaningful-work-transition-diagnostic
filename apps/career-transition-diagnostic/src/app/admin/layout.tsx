import { DeskShell } from "@/components/desk-shell";

export default function AdminLayout({ children }: LayoutProps<"/admin">) {
  return <DeskShell>{children}</DeskShell>;
}
