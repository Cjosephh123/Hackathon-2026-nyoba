import { lazy, Suspense } from 'react';
import PredictionChart from './PredictionChart.jsx';
import './PredictionChart.css';
import './AssistantMessage.css';

const ReactMarkdown = lazy(() => import('react-markdown'));

function createMarkdownComponents(allowedImageUrls) {
  return {
    pre: ({ children }) => {
      const child = Array.isArray(children) ? children[0] : children;
      return child?.props?.className === 'language-chart' ? children : <pre>{children}</pre>;
    },
    code: ({ className, children, node, inline: _inline, ...props }) => {
      if (className === 'language-chart') {
        return <PredictionChart source={String(children).trim()} />;
      }
      return <code className={className} {...props}>{children}</code>;
    },
    img: ({ src, alt }) => {
      const isOpenLibraryCover =
        typeof src === 'string' &&
        /^https:\/\/covers\.openlibrary\.org\/b\/id\/\d+-M\.jpg$/.test(src);
      if (!src || (!allowedImageUrls.has(src) && !isOpenLibraryCover)) return null;
      return <img src={src} alt={alt || 'Book cover'} loading="lazy" referrerPolicy="no-referrer" />;
    },
  };
}

export default function AssistantMessage({ message, allowedImageUrls = [] }) {
  const isAssistant = message.role === 'assistant';
  const allowedImages = new Set(
    allowedImageUrls.filter((url) => {
      try {
        return new URL(url).protocol === 'https:';
      } catch {
        return false;
      }
    }),
  );

  return (
    <article className={`assistant-message${isAssistant ? ' assistant-message--ai' : ' assistant-message--user'}`}>
      <div className="assistant-message__avatar" aria-hidden="true">
        {isAssistant ? 'AI' : 'You'}
      </div>
      <div className="assistant-message__body">
        <div className="assistant-message__text">
          {isAssistant ? (
            <Suspense fallback={message.text}>
              <ReactMarkdown components={createMarkdownComponents(allowedImages)}>
                {message.text}
              </ReactMarkdown>
            </Suspense>
          ) : message.text}
        </div>
        {message.attachment_name && (
          <p className="assistant-message__attachment">Analyzed file: {message.attachment_name}</p>
        )}
      </div>
    </article>
  );
}
