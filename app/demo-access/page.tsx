import { unlockDemoAction } from "./actions";
import { getDemoPassword } from "@/lib/demo-security/config";

export default async function DemoAccessPage(props: {
  searchParams?: Promise<{ error?: string }>;
}) {
  const searchParams = (await props.searchParams) ?? {};
  const showError = searchParams.error === "1";
  const demoPassword = getDemoPassword();

  return (
    <div className="gate-page">
      <div className="gate-card">
        <div className="gate-copy">
          <span className="gate-eyebrow">Live Demo Access</span>
          <h1>MiniMRP demo</h1>
          <p>
            This demo instance is lightly protected to reduce random bot traffic and
            low-effort spam.
          </p>
        </div>

        <form action={unlockDemoAction} className="stack">
          <div className="field-group">
            <label htmlFor="password">Demo password</label>
            <input
              id="password"
              className="input"
              name="password"
              type="password"
              autoFocus
              required
            />
          </div>

          <div className="notice">
            Current demo password: <strong>{demoPassword}</strong>
          </div>

          {showError ? (
            <div className="notice error">Password did not match this demo instance.</div>
          ) : null}

          <button className="button primary" type="submit">
            Enter demo
          </button>
        </form>
      </div>
    </div>
  );
}
