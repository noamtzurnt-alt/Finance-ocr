export default function PageHeader(props: {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
}) {
  return (
    <header className="page-header">
      <div className="min-w-0">
        <h1 className="page-title">{props.title}</h1>
        {props.subtitle ? <p className="page-sub">{props.subtitle}</p> : null}
      </div>
      {props.actions ? <div className="page-header-end">{props.actions}</div> : null}
    </header>
  );
}
