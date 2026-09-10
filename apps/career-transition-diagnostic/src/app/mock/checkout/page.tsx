import { notFound } from "next/navigation";
import { isMockMode } from "@/config/app-mode";

export default function MockCheckoutPage() {
  if (!isMockMode()) {
    notFound();
  }

  return (
    <main className="mx-auto flex min-h-full max-w-2xl flex-col gap-4 px-6 py-20">
      <h1 className="text-3xl font-semibold tracking-tight">Mock checkout</h1>
      <p className="leading-7 text-[#4a3b34]">
        This stands in for Lemon Squeezy until paid access is implemented. No
        live commerce call is made.
      </p>
    </main>
  );
}
