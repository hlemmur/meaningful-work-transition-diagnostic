export function LoginEmailField() {
  return (
    <label className="flex flex-col gap-1 text-sm">
      Email
      <input
        className="rounded border border-hairline bg-field px-3 py-2"
        name="email"
        type="email"
        autoComplete="username"
        required
      />
    </label>
  );
}
