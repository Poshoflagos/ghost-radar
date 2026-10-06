export default function ResearchLinks({ links = {} }) {
  const entries = Object.entries(links).filter(([, value]) => Boolean(value));
  return (
    <div className="flex flex-wrap gap-2">
      {entries.map(([key, value]) => (
        <a key={key} href={value} target="_blank" rel="noreferrer" className="btn-secondary text-sm">
          {key.replace(/([A-Z])/g, ' $1').trim()}
        </a>
      ))}
    </div>
  );
}
