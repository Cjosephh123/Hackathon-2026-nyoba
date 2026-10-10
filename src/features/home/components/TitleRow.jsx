import { useState } from 'react';
import Chip from './Chip.jsx';
import { BookIcon } from './icons.jsx';
import './TitleRow.css';

/** One book/journal row: cover, title, subtitle, tags and availability status. */
export default function TitleRow({ title, subtitle, tags = [], status, coverUrl, highlighted = false }) {
  const [coverFailed, setCoverFailed] = useState(false);

  return (
    <div className={`title-row${highlighted ? ' title-row--highlight' : ''}`}>
      <div className="title-row__cover">
        {coverUrl && !coverFailed ? (
          <img src={coverUrl} alt="" loading="lazy" onError={() => setCoverFailed(true)} />
        ) : (
          <BookIcon aria-hidden="true" />
        )}
      </div>

      <div className="title-row__body">
        <h3 className="title-row__title">{title}</h3>
        {subtitle && <p className="title-row__subtitle">{subtitle}</p>}
        <div className="title-row__tags">
          {tags.filter(Boolean).map((tag) => (
            <Chip key={tag} tone={highlighted ? 'accent' : 'neutral'}>
              {tag}
            </Chip>
          ))}
        </div>
      </div>

      <div className="title-row__status">
        <span className="title-row__status-label">{status.label}</span>
        <Chip tone={status.tone}>{status.chip}</Chip>
      </div>
    </div>
  );
}
