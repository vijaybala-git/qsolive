import React, { useState, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';

export default function UserGuide() {
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/user-guide.md')
      .then((res) => res.text())
      .then(setContent)
      .catch(() => setContent('# User Guide\n\nFailed to load content.'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="help-loading">Loading…</div>;

  return (
    <div className="help-page">
      <article className="help-content">
        <ReactMarkdown
          components={{
            a: ({ href, children }) => (
              <a href={href} target="_blank" rel="noopener noreferrer">
                {children}
              </a>
            ),
          }}
        >
          {content}
        </ReactMarkdown>
      </article>
    </div>
  );
}
