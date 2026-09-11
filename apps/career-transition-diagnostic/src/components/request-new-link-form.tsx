import { requestNewLinkAction } from "@/server/tracer/actions";

export function RequestNewLinkForm() {
  return (
    <form className="flex flex-col gap-3" action={requestNewLinkAction}>
      <label className="text-sm font-medium" htmlFor="request-link-email">
        Email used at checkout
      </label>
      <input
        id="request-link-email"
        name="email"
        type="email"
        required
        className="rounded border border-[#e6d8cc] bg-white p-3"
        defaultValue="buyer@example.com"
      />
      <button
        className="w-fit rounded-full bg-[#2b211c] px-5 py-3 text-sm font-medium text-[#f7f1ea]"
        type="submit"
      >
        Request a new link
      </button>
    </form>
  );
}
