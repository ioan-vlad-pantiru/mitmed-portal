/** Plain page title for the client portal: says where you are, nothing more. */
export function PortalPageHeader({ title, description }: { title: string; description?: string }) {
  return (
    <header className="portal-page-header">
      <h1>{title}</h1>
      {description && <p>{description}</p>}
    </header>
  );
}
