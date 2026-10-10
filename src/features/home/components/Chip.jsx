import './Chip.css';

/** Small rounded label. tone: neutral | accent | success | warning | danger */
export default function Chip({ tone = 'neutral', children }) {
  return <span className={`chip chip--${tone}`}>{children}</span>;
}
