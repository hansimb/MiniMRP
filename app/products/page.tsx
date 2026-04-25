import Link from "next/link";
import { createProductAction } from "@/lib/runtime/actions";
import { getRuntimeQueries } from "@/lib/runtime";
import { Badge, EmptyState, ModalTrigger, Notice, PageHeader, Panel } from "@/shared/ui";

export default async function ProductsPage() {
  const queries = await getRuntimeQueries();
  const { items, error } = await queries.getProductList();

  return (
    <div className="page">
      <PageHeader
        title="Products"
        description="List of products. Open a product to view its image, basic information, and version list."
      />

      {error ? (
        <Notice error>
          Supabase query failed. Check that the `supabase/production/` SQL files were applied to this
          project and that the signed-in user has the `admin` role.
          <br />
          <br />
          Error: {error}
        </Notice>
      ) : null}

      <Panel
        title="All products"
        description="Tailored product list for daily internal use."
        actions={
          <ModalTrigger buttonLabel="Add product" buttonClassName="button primary" title="Add product">
            <form action={createProductAction} className="stack">
              <label className="field-group">
                <span>Name</span>
                <input className="input" name="name" placeholder="Product name" required />
              </label>
              <button className="button primary" type="submit">
                Create product
              </button>
            </form>
          </ModalTrigger>
        }
      >
        {items.length === 0 ? (
          <EmptyState>No products found yet.</EmptyState>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Versions</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {items.map((product) => (
                  <tr key={product.id}>
                    <td>
                      <strong>{product.name}</strong>
                    </td>
                    <td>
                      <Badge>{product.versionCount} versions</Badge>
                    </td>
                    <td>
                      <Link className="button-link subtle" href={`/products/${product.id}`}>
                        Open
                      </Link>
                    </td>
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
