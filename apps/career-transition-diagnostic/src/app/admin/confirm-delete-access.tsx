"use client";

import { useState } from "react";

type ConfirmDeleteAccessProps = {
  action: (formData: FormData) => void | Promise<void>;
};

export function ConfirmDeleteAccess({ action }: ConfirmDeleteAccessProps) {
  const [confirming, setConfirming] = useState(false);

  if (!confirming) {
    return (
      <button
        className="rounded-full border border-terracotta px-5 py-3 text-sm"
        type="button"
        onClick={() => setConfirming(true)}
      >
        Delete access
      </button>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm leading-6">
        Remove this customer’s access? The report link will stop working.
      </p>
      <div className="flex flex-wrap gap-3">
        <button
          className="rounded-full border border-ink px-5 py-3 text-sm"
          type="button"
          onClick={() => setConfirming(false)}
        >
          Cancel
        </button>
        <form action={action}>
          <button
            className="rounded-full border border-terracotta px-5 py-3 text-sm"
            type="submit"
          >
            Confirm delete
          </button>
        </form>
      </div>
    </div>
  );
}
