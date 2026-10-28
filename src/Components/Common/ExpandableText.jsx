import { useLayoutEffect, useRef, useState } from 'react';

// Long text shows as two lines with a "Show more" link, so one long note can't make a row very tall.
// The link only appears when the text actually needs it.
const ExpandableText = ({ text }) => {
  const ref = useRef(null);
  const [expanded, setExpanded] = useState(false);
  const [overflowing, setOverflowing] = useState(false);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || expanded) return undefined;

    const measure = () => {
      if (el.clientHeight > 0) {
        setOverflowing(el.scrollHeight > el.clientHeight + 1);
      } else {
        // No layout available (e.g. very first paint in a test environment): estimate from the text itself
        setOverflowing(text.length > 90 || text.includes('\n'));
      }
    };
    measure();

    if (typeof ResizeObserver === 'undefined') return undefined;
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [text, expanded]);

  return (
    <div className="expandable">
      <div ref={ref} className={`expandable-text${expanded ? '' : ' clamped'}`}>{text}</div>
      {(overflowing || expanded) && (
        <button type="button" className="expand-toggle" aria-expanded={expanded} onClick={() => setExpanded((e) => !e)}>
          {expanded ? 'Show less' : 'Show more'}
        </button>
      )}
    </div>
  );
};

export default ExpandableText;
