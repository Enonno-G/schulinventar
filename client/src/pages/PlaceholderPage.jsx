// Platzhalter für Bereiche, die laut Jira-Plan erst in einem späteren Sprint umgesetzt werden
export default function PlaceholderPage({ title, sprint, reference, children }) {
  return (
    <div className="page">
      <h1>{title}</h1>
      <div className="card placeholder">
        <p>
          <strong>In Arbeit – geplant für Sprint {sprint}.</strong>
        </p>
        <p>{children}</p>
        <p className="muted">Pflichtenheft: {reference}</p>
      </div>
    </div>
  );
}
