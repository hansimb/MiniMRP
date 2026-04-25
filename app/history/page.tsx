import { EmptyState, Notice, PageHeader, Panel } from "@/shared/ui";
import { getRuntimeQueries } from "@/lib/runtime";

export default async function HistoryPage() {
  const queries = await getRuntimeQueries();
  const { items, error } = await queries.getHistoryEntries();

  return (
    <div className="page">
      <PageHeader
        title="History"
        description="Chronological list of changes made through the UI."
      />

      {error ? <Notice error>{error}</Notice> : null}

      <Panel title="All changes" description="Newest changes first.">
        {items.length === 0 ? (
          <EmptyState>No history entries found yet.</EmptyState>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Time</th>
                  <th>Entity</th>
                  <th>Action</th>
                  <th>Summary</th>
                  <th>Old value</th>
                  <th>New value</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id}>
                    <td>{new Date(item.created_at).toLocaleString()}</td>
                    <td>{item.entity_type}</td>
                    <td>{item.action_type}</td>
                    <td>{item.summary}</td>
                    <td>{item.old_value ?? "-"}</td>
                    <td>{item.new_value ?? "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </div>
  );
}
