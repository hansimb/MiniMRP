import type { ReactNode } from "react";

export function PageHeader(props: {
  title: string;
  description: string;
  actions?: ReactNode;
}) {
  return (
    <header className="page-header">
      <div>
        <h2>{props.title}</h2>
        <p>{props.description}</p>
      </div>
      {props.actions ? <div className="toolbar">{props.actions}</div> : null}
    </header>
  );
}

export function Panel(props: {
  title: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="panel">
      <div className="panel-header">
        <div>
          <h3>{props.title}</h3>
          {props.description ? <p className="small">{props.description}</p> : null}
        </div>
        {props.actions}
      </div>
      <div className="panel-body">{props.children}</div>
    </section>
  );
}

export function EmptyState({ children }: { children: ReactNode }) {
  return <div className="empty">{children}</div>;
}

export function Notice(props: { children: ReactNode; error?: boolean }) {
  return <div className={`notice${props.error ? " error" : ""}`}>{props.children}</div>;
}

export function Badge({ children }: { children: ReactNode }) {
  return <span className="badge">{children}</span>;
}

