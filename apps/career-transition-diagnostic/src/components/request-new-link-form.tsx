import { requestNewLinkAction } from "@/server/tracer/actions";

export function RequestNewLinkForm({ expiredToken }: { expiredToken: string }) {
  return (
    <form className="flex flex-col gap-3" action={requestNewLinkAction}>
      <input type="hidden" name="expiredToken" value={expiredToken} />
      <button
        className="w-fit rounded-full bg-ink px-5 py-3 text-sm font-medium text-paper"
        type="submit"
      >
        Request a new link
      </button>
    </form>
  );
}
