import React, { useState, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import packageJson from '../../package.json';

export default function About() {
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/about.md')
      .then((res) => res.text())
      .then((text) => {
        const version = packageJson.version || '1.0.0';
        setContent(text.replace(/\{\{VERSION\}\}/g, version));
      })
      .catch(() => setContent('# About\n\nFailed to load content.'))
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
