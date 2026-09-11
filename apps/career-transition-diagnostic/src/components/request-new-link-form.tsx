import { requestNewLinkAction } from "@/server/tracer/actions";

export function RequestNewLinkForm({ expiredToken }: { expiredToken: string }) {
  return (
    <form className="flex flex-col gap-3" action={requestNewLinkAction}>
      <input type="hidden" name="expiredToken" value={expiredToken} />
      <button
        className="w-fit rounded-full bg-[#2b211c] px-5 py-3 text-sm font-medium text-[#f7f1ea]"
        type="submit"
      >
        Request a new link
      </button>
    </form>
  );
}
