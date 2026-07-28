interface Props {
  title: string;
  description?: string;
  action?: React.ReactNode;
}

export default function AdminPageHeader({ title, description, action }: Props) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        gap: '16px',
        marginBottom: '24px',
        paddingBottom: '20px',
        borderBottom: '1px solid #D8E1E9',
        flexWrap: 'wrap',
      }}
    >
      <div>
        <h1
          style={{
            color: '#172B3A',
            fontSize: '22px',
            fontWeight: 700,
            fontFamily: 'Inter, sans-serif',
            margin: 0,
          }}
        >
          {title}
        </h1>
        {description && (
          <p
            style={{
              color: '#718596',
              fontSize: '13px',
              fontFamily: 'Inter, sans-serif',
              margin: '4px 0 0',
            }}
          >
            {description}
          </p>
        )}
      </div>
      {action && <div style={{ flexShrink: 0 }}>{action}</div>}
    </div>
  );
}
